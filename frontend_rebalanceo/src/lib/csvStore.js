/**
 * Almacén local del CSV de Trade Republic.
 *
 * Va en localStorage y no en los metadatos del usuario porque esos viajan
 * dentro del JWT: meter ahí cientos de movimientos hincharía cada petición.
 * Además son datos financieros personales que no necesitan salir del móvil.
 *
 * Se guarda por cartera. Al reimportar se sustituye entero: el export de Trade
 * Republic es acumulativo, así que el último siempre es la verdad completa.
 */
import { mesClave } from './recordatorio.js';

const clave = (pid) => `tr_txs_${pid}`;

// Sólo lo que se usa para pintar el histórico y cuadrar posiciones. La
// descripción larga se descarta y se conserva únicamente lo que aporta: si la
// línea venía del plan automático.
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

export const guardarTxs = (pid, txs) => {
    if (!pid) return null;
    const paquete = {
        version: 1,
        importadoEn: new Date().toISOString(),
        txs: (txs || []).map(aligera),
    };
    try {
        localStorage.setItem(clave(pid), JSON.stringify(paquete));
        return paquete;
    } catch (e) {
        // Cuota agotada: mejor quedarse sin histórico que dejar la app rota.
        console.error('No se pudo guardar el CSV localmente', e);
        return null;
    }
};

export const leerTxs = (pid) => {
    if (!pid) return null;
    try {
        const bruto = localStorage.getItem(clave(pid));
        if (!bruto) return null;
        const p = JSON.parse(bruto);
        return Array.isArray(p?.txs) ? p : null;
    } catch {
        // Un JSON corrupto no debe impedir volver a importar.
        localStorage.removeItem(clave(pid));
        return null;
    }
};

export const borrarTxs = (pid) => {
    if (pid) localStorage.removeItem(clave(pid));
};

/**
 * Meses en los que consta al menos una compra.
 *
 * Es lo que alimenta el recordatorio: un mes con compras ya está cubierto por
 * el CSV y no hace falta volver a pedirlo.
 */
export const mesesConAportacion = (txs = []) => [...new Set(
    txs
        .filter(t => t.categoria === 'TRADING' && t.tipo === 'BUY' && t.unidades > 0)
        .map(t => (t.fecha ? mesClave(new Date(`${t.fecha}T12:00:00`)) : null))
        .filter(Boolean)
)].sort();

const CLAVE_DESCARTE = (pid) => `tr_aviso_${pid}`;

export const leerDescarte = (pid) => (pid ? localStorage.getItem(CLAVE_DESCARTE(pid)) : null);
export const guardarDescarte = (pid, mes) => {
    if (pid && mes) localStorage.setItem(CLAVE_DESCARTE(pid), mes);
};
