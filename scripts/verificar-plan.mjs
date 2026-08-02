#!/usr/bin/env node
/**
 * Comprobación end-to-end del plan de aportación contra Supabase real.
 *
 * Se ejecuta en TU máquina. Las credenciales se quedan en tu disco y el informe
 * que imprime no contiene ningún secreto: sólo PASS/FAIL y datos derivados.
 * Puedes pegarlo tal cual.
 *
 * La URL de Supabase, la clave anon y la del API se leen solas de
 * frontend_rebalanceo/.env.production (o .env.development). Lo único que hay que
 * escribir es la cuenta con la que iniciar sesión:
 *
 *   1) Crea Fandance-PWA/.env.verify  (ya está en .gitignore):
 *
 *        TEST_EMAIL=<email de una cuenta de prueba>
 *        TEST_PASSWORD=<su contraseña>
 *
 *      Usa una cuenta de prueba, no la principal: el script escribe un plan y
 *      lo restaura al terminar, pero mejor no tocar datos reales.
 *      Cuando acabes, bórralo:  rm .env.verify
 *
 *   2) node scripts/verificar-plan.mjs
 */
import { readFileSync } from 'node:fs';

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

// Un valor de la plantilla no sustituido produce un fallo de DNS con volcado de
// pila; mejor detectarlo aquí y decir qué falta.
const esPlaceholder = (v) => !v || /TU-PROYECTO|LA_CLAVE|ejemplo\.com|su-contraseña|<.*>/i.test(v);

function loadEnv() {
    const front = `${ROOT}frontend_rebalanceo/`;
    const app = { ...parseEnvFile(`${front}.env.development`), ...parseEnvFile(`${front}.env.production`) };
    const verify = parseEnvFile(`${ROOT}.env.verify`);

    // Un valor de plantilla en .env.verify se ignora en lugar de tapar la
    // configuración real de la app: si alguien pega el ejemplo tal cual, el
    // script sigue funcionando en vez de fallar con un DNS inexistente.
    const pick = (a, b) => (esPlaceholder(a) ? b : a);
    const env = {
        SUPABASE_URL: pick(verify.SUPABASE_URL, app.VITE_SUPABASE_URL),
        SUPABASE_ANON_KEY: pick(verify.SUPABASE_ANON_KEY, app.VITE_SUPABASE_ANON_KEY),
        API_URL: pick(verify.API_URL, app.VITE_API_URL),
        TEST_EMAIL: verify.TEST_EMAIL,
        TEST_PASSWORD: verify.TEST_PASSWORD,
    };

    const malas = Object.entries(env).filter(([, v]) => esPlaceholder(v)).map(([k]) => k);
    if (malas.length) {
        console.error('\nNo puedo arrancar. Revisa estas variables:\n');
        for (const k of malas) {
            const donde = ['TEST_EMAIL', 'TEST_PASSWORD'].includes(k)
                ? 'escríbela en Fandance-PWA/.env.verify'
                : 'no se encontró en frontend_rebalanceo/.env.production ni .env.development';
            console.error(`  - ${k}: ${donde}`);
        }
        console.error('\n.env.verify sólo necesita dos líneas:\n');
        console.error('  TEST_EMAIL=tu-cuenta-de-prueba@dominio.com');
        console.error('  TEST_PASSWORD=la-contraseña\n');
        process.exit(1);
    }
    return env;
}

const results = [];
const check = (nombre, ok, detalle = '') => {
    results.push({ nombre, ok, detalle });
    console.log(`  ${ok ? '✅' : '❌'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const env = loadEnv();
const API = env.API_URL.replace(/\/$/, '');
const SB = env.SUPABASE_URL.replace(/\/$/, '');

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
        headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.TEST_EMAIL, password: env.TEST_PASSWORD }),
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
check(
    'Columnas del plan presentes (migración aplicada)',
    tieneColumnas,
    tieneColumnas ? 'plan_monthly, plan_growth_pct, plan_start' : 'faltan → ejecuta supabase/contribution_plan.sql'
);

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
