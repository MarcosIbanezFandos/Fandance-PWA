/**
 * Almacén local de los CSV de Trade Republic.
 *
 * Va en localStorage y no en los metadatos del usuario porque esos viajan
 * dentro del JWT: meter ahí cientos de movimientos hincharía cada petición.
 * Además son datos financieros personales que no necesitan salir del móvil.
 *
 * Se guarda **una entrada por fichero subido**, no un único bloque. Así una
 * importación sólo añade lo que no estuviera ya, se puede ver qué aportó cada
 * fichero y se puede borrar uno concreto sin perder los demás.
 */
import { mesClave } from './recordatorio.js';

const CLAVE = (pid) => `tr_cargas_${pid}`;
const CLAVE_V1 = (pid) => `tr_txs_${pid}`;
const CLAVE_DESCARTE = (pid) => `tr_aviso_${pid}`;

/**
 * Sólo compraventa de activos.
 *
 * El export de Trade Republic es el extracto entero de la cuenta: pagos con
 * tarjeta, transferencias, recibos, intereses. Nada de eso es patrimonio
 * invertido ni tiene sitio en el historial de una app de cartera, y arrastrarlo
 * sólo ensucia las cifras. Se descarta al guardar, no al pintar, para que no
 * pueda colarse por ningún otro camino.
 */
export const esOperacionDeActivo = (t) =>
    t?.categoria === 'TRADING' && (t.tipo === 'BUY' || t.tipo === 'SELL') && t.isin;

// Lo que se conserva de cada movimiento. La descripción larga se descarta y se
// guarda sólo lo que aporta: si venía del plan automático.
const aligera = (t) => ({
    id: t.id,
    fecha: t.fecha,
    datetime: t.datetime,
    categoria: t.categoria,
    tipo: t.tipo,
    nombre: t.nombre,
    isin: t.isin,
    unidades: t.unidades,
    precio: t.precio,
    importe: t.importe,
    comision: t.comision,
    impuesto: t.impuesto,
    esPlanAutomatico: t.esPlanAutomatico,
});

const leerBruto = (pid) => {
    if (!pid) return null;
    try {
        const s = localStorage.getItem(CLAVE(pid));
        if (s) {
            const p = JSON.parse(s);
            if (Array.isArray(p?.cargas)) return p;
        }
        // Migración desde el formato de un solo bloque: se conserva como una
        // primera carga para no obligar a volver a subir el fichero.
        const viejo = localStorage.getItem(CLAVE_V1(pid));
        if (viejo) {
            const v = JSON.parse(viejo);
            if (Array.isArray(v?.txs)) {
                return {
                    version: 2,
                    cargas: [{
                        id: 'migrada',
                        nombre: 'Importación anterior',
                        importadoEn: v.importadoEn || new Date().toISOString(),
                        txs: v.txs.filter(esOperacionDeActivo),
                    }],
                };
            }
        }
        return null;
    } catch {
        localStorage.removeItem(CLAVE(pid));
        return null;
    }
};

const escribir = (pid, paquete) => {
    try {
        localStorage.setItem(CLAVE(pid), JSON.stringify(paquete));
        localStorage.removeItem(CLAVE_V1(pid));
        return paquete;
    } catch (e) {
        console.error('No se pudo guardar el CSV localmente', e);
        return null;
    }
};

/** Todas las cargas, de más reciente a más antigua. */
export const listarCargas = (pid) => {
    const p = leerBruto(pid);
    if (!p) return [];
    // Más reciente primero. Con la misma marca de tiempo manda el orden de
    // inserción, que es el real.
    return p.cargas
        .map((c, i) => ({ ...c, _i: i }))
        .sort((a, b) => String(b.importadoEn).localeCompare(String(a.importadoEn)) || b._i - a._i)
        .map(({ _i, ...c }) => c);
};

/** Movimientos de todas las cargas, sin repetidos. */
export const leerTxs = (pid) => {
    const p = leerBruto(pid);
    if (!p) return null;
    const vistos = new Set();
    const txs = [];
    for (const c of p.cargas) {
        for (const t of c.txs || []) {
            if (vistos.has(t.id)) continue;
            vistos.add(t.id);
            txs.push(t);
        }
    }
    txs.sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)));
    const ultima = p.cargas.reduce((max, c) => (String(c.importadoEn) > String(max) ? c.importadoEn : max), '');
    return { txs, importadoEn: ultima || null, cargas: p.cargas.length };
};

/**
 * Qué movimientos de este fichero son nuevos.
 *
 * Trade Republic exporta siempre el histórico entero, así que subir el export
 * del mes siguiente trae otra vez todo lo anterior. Se compara por identificador
 * de transacción y sólo entra lo que no estuviera.
 */
export const novedadesDe = (pid, txs = []) => {
    const previos = new Set((leerTxs(pid)?.txs || []).map(t => t.id));
    const utiles = txs.filter(esOperacionDeActivo);
    return {
        nuevas: utiles.filter(t => !previos.has(t.id)),
        repetidas: utiles.filter(t => previos.has(t.id)).length,
        descartadas: txs.length - utiles.length,
    };
};

/** Añade un fichero, guardando sólo lo que no estuviera ya. */
export const anadirCarga = (pid, { nombre, txs = [] }) => {
    if (!pid) return null;
    const { nuevas, repetidas, descartadas } = novedadesDe(pid, txs);
    const previo = leerBruto(pid) || { version: 2, cargas: [] };

    const carga = {
        // Date.now() solo repite si se suben dos ficheros en el mismo
        // milisegundo, y entonces borrar uno borraría los dos.
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nombre: nombre || 'transacciones.csv',
        importadoEn: new Date().toISOString(),
        txs: nuevas.map(aligera),
    };
    const guardado = escribir(pid, { ...previo, version: 2, cargas: [...previo.cargas, carga] });
    return guardado ? { carga, nuevas: nuevas.length, repetidas, descartadas } : null;
};

/** Borra un fichero concreto; el resto sigue en su sitio. */
export const borrarCarga = (pid, cargaId) => {
    const p = leerBruto(pid);
    if (!p) return false;
    const quedan = p.cargas.filter(c => c.id !== cargaId);
    escribir(pid, { ...p, cargas: quedan });
    return true;
};

export const borrarTxs = (pid) => {
    if (!pid) return;
    localStorage.removeItem(CLAVE(pid));
    localStorage.removeItem(CLAVE_V1(pid));
};

/**
 * Meses en los que consta al menos una compra.
 *
 * Es lo que alimenta el recordatorio y el seguimiento del plan: un mes con
 * compras ya está cubierto por el CSV.
 */
export const mesesConAportacion = (txs = []) => [...new Set(
    txs
        .filter(t => t.categoria === 'TRADING' && t.tipo === 'BUY' && t.unidades > 0)
        .map(t => (t.fecha ? mesClave(new Date(`${t.fecha}T12:00:00`)) : null))
        .filter(Boolean)
)].sort();

export const leerDescarte = (pid) => (pid ? localStorage.getItem(CLAVE_DESCARTE(pid)) : null);
export const guardarDescarte = (pid, mes) => {
    if (pid && mes) localStorage.setItem(CLAVE_DESCARTE(pid), mes);
};

/**
 * Borra todo rastro del CSV de este navegador.
 *
 * Se llama al cerrar sesión: son movimientos bancarios y no tienen por qué
 * seguir en el disco de un dispositivo que puede ser compartido. Recuperarlos
 * cuesta un toque —volver a subir el fichero—, así que no se pierde nada.
 */
export const borrarTodoElCsv = () => {
    try {
        const claves = Object.keys(localStorage).filter(k =>
            k.startsWith('tr_cargas_') || k.startsWith('tr_txs_') ||
            k.startsWith('tr_aviso_') || k.startsWith('perf_csv_'));
        claves.forEach(k => localStorage.removeItem(k));
        return claves.length;
    } catch { return 0; }
};
