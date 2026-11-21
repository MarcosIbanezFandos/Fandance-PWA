/**
 * El vistazo de Fandance para el portal FANDOS y las otras apps (contrato FANDOS,
 * ver docs/conexiones.md en Fandios-App).
 *
 * Contesta una sola pregunta: «¿tengo que hacer algo con mi cartera?». El valor no es
 * el titular a propósito: el plan es mirarla una vez al trimestre, no cada mañana, así
 * que el portal lo enseña tapado hasta que se pide (`privada`).
 *
 * Lo calcula la propia app al abrirla, porque solo ella tiene los movimientos del CSV
 * (viven en este navegador). Se publica en dos sitios:
 *  - localStorage, para el portal y el lanzador de este mismo navegador, al instante;
 *  - el servidor (POST /api/fandos/vistazo), solo con cifras agregadas —nunca los
 *    movimientos—, para que FanWork lo lea desde cualquier aparato en la cosecha fiscal.
 *
 * Todo lo de aquí es puro salvo `publicarVistazo`.
 */
import { momentoAviso, mesClave } from './recordatorio.js';
import { posicionesDesdeCsv } from './trImport.js';
import { safeFloat } from '../utils.js';

export const CLAVE_VISTAZO = 'fandos:vistazo:fandance';
const BASE = '/fandance';
/** Cada cuánto se vuelve a guardar en el servidor un vistazo que no ha cambiado. */
export const REFRESCO_SERVIDOR_MS = 6 * 3600 * 1000;

const eur = (n) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(n);
const puntos = (n) => `${n > 0 ? '+' : ''}${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} puntos`;
const nombreMes = (clave) =>
    new Date(`${clave}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long' });
/** «lunes 7 de diciembre». */
const diaCorto = (d) =>
    `${d.toLocaleDateString('es-ES', { weekday: 'long' })} ${d.getDate()} de ${d.toLocaleDateString('es-ES', { month: 'long' })}`;
const redondea = (n, dec = 2) => Math.round(safeFloat(n) * 10 ** dec) / 10 ** dec;

/**
 * Cuándo tocará el siguiente CSV: el cierre del primer lunes del primer mes que aún no
 * consta en los movimientos, a partir de hoy.
 */
export const siguienteCsv = (ahora = new Date(), mesesConAportacion = []) => {
    const hechos = new Set(mesesConAportacion);
    const d = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    for (let i = 0; i < 3; i++) {
        const momento = momentoAviso(d.getFullYear(), d.getMonth());
        if (!hechos.has(mesClave(d)) && momento > ahora) return momento;
        d.setMonth(d.getMonth() + 1);
    }
    return momentoAviso(d.getFullYear(), d.getMonth());
};

/**
 * @param {object} p
 * @param {Date}   p.ahora
 * @param {{name?: string}} p.cartera
 * @param {Array}  p.filas            posiciones valoradas (tableData de App)
 * @param {number} p.totalValor
 * @param {{avisar: boolean, pendientes: string[]}} p.aviso   el del CSV (debeAvisar)
 * @param {object|null} p.reajuste    evaluarReajuste(...)
 * @param {number} p.mensual          aportación mensual del plan
 * @param {string[]} p.mesesConAportacion
 * @param {Array}  p.txs              movimientos del CSV (solo para el coste)
 * @param {Object<string,string>} p.isinPorItem   item_id → ISIN ya emparejado
 */
export const construirVistazo = ({
    ahora = new Date(),
    cartera = null,
    filas = [],
    totalValor = 0,
    aviso = { avisar: false, pendientes: [] },
    reajuste = null,
    mensual = 0,
    mesesConAportacion = [],
    txs = [],
    isinPorItem = {},
} = {}) => {
    const avisos = [];
    const pendientes = aviso?.avisar ? aviso.pendientes || [] : [];
    if (pendientes.length) {
        const meses = pendientes.map(nombreMes);
        avisos.push({
            id: `fandance:csv:${pendientes[pendientes.length - 1]}`,
            texto: pendientes.length === 1
                ? `Sube a Fandance el CSV de ${meses[0]}`
                : `Sube a Fandance los CSV de ${meses.slice(0, -1).join(', ')} y ${meses[meses.length - 1]}`,
            href: `${BASE}/`,
            nivel: 'aviso',
        });
    }
    const fuera = reajuste?.fueraDeBanda || [];
    if (fuera.length) {
        const peor = fuera[0];
        avisos.push({
            id: `fandance:banda:${peor.ticker || peor.id}`,
            texto: `${peor.nombre || peor.ticker} se ha salido de su banda (${puntos(redondea(peor.desvio, 1))})`,
            href: `${BASE}/posiciones`,
            nivel: 'info',
        });
    }
    const sumaObjetivos = filas.reduce((s, f) => s + safeFloat(f.targetWeight ?? f.target_weight), 0);
    if (filas.length && Math.abs(sumaObjetivos - 100) > 1) {
        avisos.push({
            id: 'fandance:objetivos',
            texto: `Los pesos objetivo suman ${redondea(sumaObjetivos, 1).toLocaleString('es-ES')} %, no 100 %`,
            href: `${BASE}/posiciones`,
            nivel: 'info',
        });
    }

    // Coste de lo que tienes, según los movimientos del CSV (precio medio, como el resto
    // de Fandance). Solo si todas las posiciones están emparejadas con su ISIN: un total
    // a medias daría una plusvalía falsa.
    const costes = Object.fromEntries((txs?.length ? posicionesDesdeCsv(txs) : []).map(p => [p.isin, p.coste]));
    const posiciones = filas.map(f => {
        const valor = safeFloat(f.value);
        const isin = isinPorItem?.[f.id] || null;
        const coste = isin && costes[isin] != null ? redondea(costes[isin]) : null;
        return {
            ticker: String(f.asset?.ticker || f.ticker || '').slice(0, 20),
            nombre: String(f.asset?.name || f.name || f.asset?.ticker || '').slice(0, 120),
            valor: redondea(valor),
            peso: totalValor > 0 ? redondea((valor / totalValor) * 100, 1) : 0,
            objetivo: redondea(safeFloat(f.targetWeight ?? f.target_weight), 1),
            coste,
        };
    }).filter(p => p.ticker || p.nombre);
    const conCoste = posiciones.length > 0 && posiciones.every(p => p.coste != null);
    const coste = conCoste ? redondea(posiciones.reduce((s, p) => s + p.coste, 0)) : null;
    const plusvalia = conCoste ? redondea(totalValor - coste) : null;
    const fechas = (txs || []).map(t => t.fecha).filter(Boolean).sort();
    const csvHasta = fechas.length ? fechas[fechas.length - 1] : null;

    let tono = 'ok';
    let titular;
    let detalle;
    let href = `${BASE}/`;
    if (pendientes.length) {
        tono = 'aviso';
        titular = avisos[0].texto;
        detalle = 'Así Fandance sabe lo que aportaste este mes';
    } else if (fuera.length) {
        tono = 'info';
        titular = 'Toca reajustar la cartera';
        detalle = avisos.find(a => a.id.startsWith('fandance:banda:'))?.texto;
        href = `${BASE}/posiciones`;
    } else if (!filas.length) {
        titular = 'Tu cartera aún no tiene posiciones';
        detalle = 'Añade tus fondos o importa el CSV de Trade Republic';
    } else {
        titular = 'Nada que hacer con tu cartera';
        detalle = `Siguiente: subir el CSV a partir del ${diaCorto(siguienteCsv(ahora, mesesConAportacion))}`;
    }

    const cifras = [];
    if (totalValor > 0) cifras.push({ etiqueta: 'Cartera', valor: eur(totalValor), privada: true });
    if (plusvalia != null) cifras.push({ etiqueta: 'Plusvalía', valor: `≈ ${eur(plusvalia)}`, privada: true });
    if (mensual > 0) cifras.push({ etiqueta: 'Aportación', valor: `${eur(mensual)} al mes` });

    return {
        v: 1,
        app: 'fandance',
        generado: ahora.toISOString(),
        tono,
        titular,
        ...(detalle ? { detalle } : {}),
        href,
        cifras,
        avisos: avisos.slice(0, 5),
        cartera: {
            nombre: String(cartera?.name || 'Cartera').slice(0, 60),
            valor: redondea(totalValor),
            coste,
            plusvalia,
            mensual: redondea(mensual),
            csvHasta,
            posiciones: posiciones.slice(0, 30),
        },
    };
};

/** Lo que cuenta para decidir si hay que volver a guardarlo: todo menos la hora. */
export const huellaVistazo = (v) => JSON.stringify({ ...v, generado: undefined });

/** Lo publica en este navegador. Devuelve true si ha cambiado respecto a lo guardado. */
export const publicarLocal = (v, almacen = typeof localStorage !== 'undefined' ? localStorage : null) => {
    if (!almacen) return false;
    try {
        const previo = almacen.getItem(CLAVE_VISTAZO);
        almacen.setItem(CLAVE_VISTAZO, JSON.stringify(v));
        if (!previo) return true;
        return huellaVistazo(JSON.parse(previo)) !== huellaVistazo(v);
    } catch {
        return false; // modo privado o almacenamiento lleno: el portal simplemente no lo verá
    }
};

/** Borra el vistazo de este navegador (al cerrar sesión, como el CSV). */
export const borrarVistazoLocal = (almacen = typeof localStorage !== 'undefined' ? localStorage : null) => {
    try { almacen?.removeItem(CLAVE_VISTAZO); } catch { /* nada que borrar */ }
};
