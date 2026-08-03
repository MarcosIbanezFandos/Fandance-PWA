#!/usr/bin/env node
/**
 * Comprobación end-to-end del plan de aportación contra Supabase real.
 *
 * Se ejecuta en TU máquina y pregunta las credenciales por consola: la
 * contraseña no se escribe en pantalla ni se guarda en ningún fichero. El
 * informe que imprime no contiene secretos —sólo PASS/FAIL y datos derivados—
 * así que puedes pegarlo tal cual.
 *
 * La URL de Supabase, la clave anon y la del API se leen solas de
 * frontend_rebalanceo/.env.production (o .env.development).
 *
 *   node scripts/verificar-plan.mjs
 *
 * Usa una cuenta de prueba, no la principal: el script escribe un plan y lo
 * restaura al terminar, pero mejor no tocar datos reales.
 */
import { readFileSync } from 'node:fs';
import readline from 'node:readline';

// Se habla con la API REST de Supabase directamente en vez de importar el SDK:
// así el script no depende de node_modules y se puede ejecutar tal cual.

const ROOT = new URL('..', import.meta.url).pathname;

const parseEnvFile = (ruta) => {
    const env = {};
    let raw;
    try { raw = readFileSync(ruta, 'utf8'); } catch { return env; }
    for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
    return env;
};

function loadConfig() {
    const front = `${ROOT}frontend_rebalanceo/`;
    const app = { ...parseEnvFile(`${front}.env.development`), ...parseEnvFile(`${front}.env.production`) };
    // En producción VITE_API_URL es relativo ("/api") porque el front y la
    // función viven en el mismo dominio. Desde Node no hay origen implícito,
    // así que se compone con el de la app desplegada (o el que se pase por
    // la variable APP_ORIGIN, para apuntar a un preview).
    const origen = (process.env.APP_ORIGIN || 'https://fandance-pwa.vercel.app').replace(/\/$/, '');
    const apiRaw = app.VITE_API_URL || '/api';
    const cfg = {
        SUPABASE_URL: app.VITE_SUPABASE_URL,
        SUPABASE_ANON_KEY: app.VITE_SUPABASE_ANON_KEY,
        API_URL: /^https?:\/\//.test(apiRaw) ? apiRaw : `${origen}${apiRaw.startsWith('/') ? '' : '/'}${apiRaw}`,
    };
    const faltan = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k);
    if (faltan.length) {
        console.error(`\nNo encuentro ${faltan.join(', ')} en frontend_rebalanceo/.env.production ni .env.development.`);
        process.exit(1);
    }
    return cfg;
}

// Preguntar por consola evita dos problemas de golpe: la contraseña no acaba en
// texto plano en el disco, y nadie puede pegar un valor de ejemplo por error.
async function pedirCredenciales() {
    // Sin terminal (tubería, CI) readline no encadena bien dos preguntas: la
    // primera consume el buffer entero. Ahí se leen las dos líneas de una vez.
    if (!process.stdin.isTTY) {
        const trozos = [];
        for await (const c of process.stdin) trozos.push(c);
        const [email = '', password = ''] = trozos.join('').split('\n').map(l => l.trim());
        return { email, password };
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const preguntar = (texto, oculto = false) => new Promise((resolve) => {
        rl._writeToOutput = oculto
            ? (str) => { if (str.includes(texto)) rl.output.write(str); }
            : (str) => rl.output.write(str);
        rl.question(texto, (val) => {
            if (oculto) rl.output.write('\n');
            resolve(val.trim());
        });
    });

    const email = await preguntar('Email de la cuenta de prueba: ');
    const password = await preguntar('Contraseña (no se muestra):  ', true);
    rl.close();
    return { email, password };
}

const results = [];
const check = (nombre, ok, detalle = '') => {
    results.push({ nombre, ok, detalle });
    console.log(`  ${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const cfg = loadConfig();
const API = cfg.API_URL.replace(/\/$/, '');
const SB = cfg.SUPABASE_URL.replace(/\/$/, '');

console.log(`\nProyecto: ${SB}`);
console.log(`API:      ${API}\n`);
const { email: EMAIL, password: PASSWORD } = await pedirCredenciales();
if (!EMAIL || !PASSWORD) { console.error('\nHacen falta email y contraseña.'); process.exit(1); }

let token;
const api = async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }
    return { status: res.status, data };
};

console.log('\n── Autenticación ──');
let authRes;
try {
    authRes = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: cfg.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
} catch (e) {
    check('Inicio de sesión', false, `no se pudo contactar con ${SB} (${e.cause?.code || e.message})`);
    process.exit(1);
}
const auth = await authRes.json().catch(() => ({}));
if (!authRes.ok || !auth.access_token) {
    check('Inicio de sesión', false, auth.error_description || auth.msg || `HTTP ${authRes.status}`);
    process.exit(1);
}
token = auth.access_token;
check('Inicio de sesión', true, `usuario ${String(auth.user?.id || '').slice(0, 8)}…`);

console.log('\n── Migración y lectura ──');
const list = await api('/portfolios/list');
check('GET /portfolios/list', list.status === 200, `HTTP ${list.status}`);
if (list.status !== 200 || !Array.isArray(list.data) || !list.data.length) {
    console.error('\nSin carteras que probar. Crea una en la app y repite.');
    process.exit(1);
}

const p = list.data[0];
const tieneColumnas = ['plan_monthly', 'plan_growth_pct', 'plan_start'].every(c => c in p);
check('Columnas del plan presentes', tieneColumnas,
    tieneColumnas ? 'plan_monthly, plan_growth_pct, plan_start' : 'no llegan en la respuesta');

// Distingue "falta la migración" de "está aplicada pero PostgREST no la ve":
// son arreglos distintos y desde la app no había forma de saber cuál era.
if (!tieneColumnas) {
    const diag = await api('/portfolios/plan_diagnostico');
    console.log(`     ↳ ${diag.data?.mensaje || `HTTP ${diag.status}`}`);
    if (diag.data?.detalle) console.log(`     ↳ ${diag.data.detalle}`);
}

// Se guardan los valores originales para restaurarlos al final.
const original = {
    monthly: Number(p.plan_monthly) || 0,
    growth: Number(p.plan_growth_pct) || 0,
    start: p.plan_start || null,
};

console.log('\n── Guardado del plan ──');
const put = await api('/portfolios/contribution_plan', {
    method: 'PUT',
    body: {
        portfolio_id: p.id,
        monthly: 300,
        annual_growth_pct: 15,
        start_date: new Date().toISOString().slice(0, 10),
    },
});
check('PUT /portfolios/contribution_plan', put.status === 200,
    put.status === 501 ? 'falta la migración' : `HTTP ${put.status}`);

const relist = await api('/portfolios/list');
const after = (relist.data || []).find(x => x.id === p.id) || {};
const persiste = Number(after.plan_monthly) === 300 && Number(after.plan_growth_pct) === 15;
check('El plan persiste tras releer', persiste,
    `monthly=${after.plan_monthly} growth=${after.plan_growth_pct}`);

console.log('\n── MAX acotado al inicio de la cartera ──');
const chart = await api('/portfolio/history_chart', {
    method: 'POST',
    body: { portfolio_id: p.id, period: 'max' },
});
const hist = chart.data?.history || [];
if (hist.length) {
    const primera = new Date(hist[0].date);
    const creada = new Date(p.created_at);
    const ok = primera >= new Date(creada.getTime() - 86400000 * 2);
    check('La serie MAX no empieza antes que la cartera', ok,
        `serie desde ${primera.toISOString().slice(0, 10)} · cartera creada ${creada.toISOString().slice(0, 10)}`);
} else {
    check('La serie MAX devuelve datos', false, 'histórico vacío');
}

console.log('\n── Rechazo de entradas inválidas ──');
const inj = await api('/portfolios/contribution_plan', {
    method: 'PUT',
    body: { portfolio_id: "'; DROP TABLE portfolios;--", monthly: 300, annual_growth_pct: 15 },
});
check('Id malformado rechazado', inj.status === 422, `HTTP ${inj.status} (se espera 422)`);

const rango = await api('/portfolios/contribution_plan', {
    method: 'PUT',
    body: { portfolio_id: p.id, monthly: -50, annual_growth_pct: 15 },
});
check('Aporte negativo rechazado', rango.status === 422, `HTTP ${rango.status} (se espera 422)`);

const ajeno = await api('/portfolio/history_chart', {
    method: 'POST',
    body: { portfolio_id: '00000000-0000-4000-8000-000000000000', period: '1mo' },
});
check('Cartera ajena/inexistente rechazada', ajeno.status === 404, `HTTP ${ajeno.status} (se espera 404)`);

console.log('\n── Restaurando el plan original ──');
const restore = await api('/portfolios/contribution_plan', {
    method: 'PUT',
    body: {
        portfolio_id: p.id,
        monthly: original.monthly,
        annual_growth_pct: original.growth,
        start_date: original.start,
    },
});
check('Plan original restaurado', restore.status === 200,
    `monthly=${original.monthly} growth=${original.growth}`);

const fallos = results.filter(r => !r.ok);
console.log(`\n── Resultado: ${results.length - fallos.length}/${results.length} correctos ──`);
if (fallos.length) {
    console.log('Fallan:');
    for (const f of fallos) console.log(`  - ${f.nombre}: ${f.detalle}`);
}
process.exit(fallos.length ? 1 : 0);
