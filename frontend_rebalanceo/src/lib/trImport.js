/**
 * Lectura del export de transacciones de Trade Republic.
 *
 * Construido contra un export real, no contra suposiciones. La cabecera es:
 *   datetime, date, account_type, category, type, asset_class, name, symbol,
 *   shares, price, amount, fee, tax, currency, …, description, transaction_id
 *
 * Claves del formato:
 *   · `category` separa CASH (tarjeta, transferencias, intereses) de TRADING.
 *   · `symbol` en las operaciones es el ISIN, no un ticker.
 *   · `description` distingue el DCA ("Savings plan execution …") de una
 *     compra suelta ("Buy trade …").
 *   · `amount` es negativo en las compras (sale dinero).
 */
import { safeFloat } from '../utils.js';

const num = (v) => safeFloat(String(v ?? '').replace(',', '.'));

/** Una fila del CSV, ya normalizada. */
const normaliza = (r) => {
    const tipo = String(r.type || '').toUpperCase();
    const descripcion = String(r.description || '');
    return {
        id: r.transaction_id || `${r.datetime}-${r.symbol}-${r.amount}`,
        fecha: r.date || String(r.datetime || '').slice(0, 10),
        datetime: r.datetime || r.date,
        categoria: String(r.category || '').toUpperCase(),
        tipo,
        claseActivo: String(r.asset_class || '').toUpperCase(),
        nombre: r.name || '',
        // En TRADING esto es el ISIN; en CRYPTO llega el símbolo ("BTC").
        isin: r.symbol || '',
        unidades: Math.abs(num(r.shares)),
        precio: num(r.price),
        importe: num(r.amount),
        comision: num(r.fee),
        impuesto: num(r.tax),
        descripcion,
        // El plan automático se anuncia en la descripción. Es lo que permite
        // separarlo de una compra manual hecha el mismo día.
        esPlanAutomatico: /savings?\s*plan/i.test(descripcion),
    };
};

export const parseTradeRepublicRows = (filas) =>
    (filas || [])
        .map(normaliza)
        .filter(t => t.fecha && (t.categoria || t.tipo))
        .sort((a, b) => String(a.datetime).localeCompare(String(b.datetime)));

/** Compras y ventas, que son las que mueven posiciones. */
export const operaciones = (txs) =>
    txs.filter(t => t.categoria === 'TRADING' && (t.tipo === 'BUY' || t.tipo === 'SELL'));

/**
 * Agrupa las compras en aportaciones.
 *
 * Una aportación es el conjunto de compras del mismo día: el plan de Trade
 * Republic ejecuta los 5 activos a la vez. Agrupar por día —y no por mes—
 * resuelve solo los dos casos difíciles: subir el CSV con semanas de retraso, y
 * subirlo cada dos meses encontrando dos aportaciones distintas. Cada grupo
 * lleva su fecha, así que el mes al que pertenece nunca se adivina.
 */
export const detectarAportaciones = (txs) => {
    const compras = txs.filter(t => t.categoria === 'TRADING' && t.tipo === 'BUY' && t.unidades > 0);
    const porDia = new Map();

    for (const c of compras) {
        if (!porDia.has(c.fecha)) porDia.set(c.fecha, []);
        porDia.get(c.fecha).push(c);
    }

    return [...porDia.entries()]
        .map(([fecha, lineas]) => {
            const total = lineas.reduce((s, l) => s + Math.abs(l.importe), 0);
            const auto = lineas.filter(l => l.esPlanAutomatico).length;
            return {
                fecha,
                mes: fecha.slice(0, 7),
                lineas,
                total,
                activos: lineas.length,
                // Se considera aportación del plan si la mayoría de las líneas
                // vienen del plan automático. Con un solo activo comprado a
                // mano el mismo día, el grupo sigue siendo el del plan.
                esPlan: auto > 0 && auto >= lineas.length / 2,
            };
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
};

/**
 * Unidades acumuladas por ISIN a partir de todo el histórico.
 *
 * Es lo que elimina el desfase de céntimos: en lugar de convertir euros
 * tecleados a unidades con el precio del momento, se suman las unidades que
 * Trade Republic ejecutó de verdad.
 */
export const posicionesDesdeCsv = (txs) => {
    const pos = new Map();
    for (const t of operaciones(txs)) {
        const clave = t.isin;
        if (!clave) continue;
        const p = pos.get(clave) || { isin: clave, nombre: t.nombre, unidades: 0, coste: 0, ops: 0 };
        if (t.tipo === 'BUY') {
            p.unidades += t.unidades;
            p.coste += Math.abs(t.importe);
        } else {
            // Venta: se retira coste medio para que el precio medio no se
            // distorsione al vender parte de la posición.
            const medio = p.unidades > 0 ? p.coste / p.unidades : 0;
            p.unidades -= t.unidades;
            p.coste -= medio * t.unidades;
            if (p.unidades < 1e-9) { p.unidades = 0; p.coste = 0; }
        }
        p.ops += 1;
        p.nombre = p.nombre || t.nombre;
        pos.set(clave, p);
    }
    return [...pos.values()]
        .filter(p => p.unidades > 0)
        .map(p => ({ ...p, precioMedio: p.unidades > 0 ? p.coste / p.unidades : 0 }))
        .sort((a, b) => b.coste - a.coste);
};

/**
 * Aportaciones que aún no están registradas en la app.
 *
 * Se compara por fecha contra el historial de rebalanceos ya aplicado, así que
 * reimportar el mismo CSV no duplica nada.
 */
export const aportacionesNuevas = (aportaciones, historial = []) => {
    const yaRegistradas = new Set(
        historial
            .map(h => String(h.created_at || h.date || '').slice(0, 10))
            .filter(Boolean)
    );
    return aportaciones.filter(a => !yaRegistradas.has(a.fecha));
};

/* ------------------------------------------------------------------ *
 *  Emparejar con las posiciones de la app
 * ------------------------------------------------------------------ */

const normalizarNombre = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // sin acentos
    .replace(/\(.*?\)/g, ' ')                            // fuera "(Acc)", "(Dist)"
    .replace(/\b(ucits|etf|acc|dist|usd|eur|plc|fund[s]?|ishares|vanguard|amundi|xtrackers|spdr|invesco)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Cruza cada posición de la cartera con su línea del CSV.
 *
 * Primero por ISIN, que es identificador único y no admite ambigüedad. Si el
 * activo se dio de alta con un ticker en vez del ISIN, se recurre al nombre
 * normalizado —quitando acentos, sufijos de clase y la gestora— porque en la
 * práctica es lo que coincide: la app y Trade Republic llaman igual al fondo.
 */
export const emparejarPosiciones = (items = [], posCsv = []) => {
    const porIsin = new Map(posCsv.map(p => [String(p.isin).toUpperCase(), p]));
    const porNombre = new Map(posCsv.map(p => [normalizarNombre(p.nombre), p]));

    const emparejadas = [];
    const sinEmparejar = [];

    for (const it of items) {
        const ticker = String(it.asset?.ticker || '').toUpperCase();
        const nombre = normalizarNombre(it.asset?.name);
        const m = porIsin.get(ticker) || porNombre.get(nombre) || null;
        if (m) emparejadas.push({ item: it, csv: m, via: porIsin.get(ticker) ? 'isin' : 'nombre' });
        else sinEmparejar.push(it);
    }

    // Lo que hay en el CSV y no está dado de alta en la cartera.
    const usados = new Set(emparejadas.map(e => e.csv.isin));
    const soloEnCsv = posCsv.filter(p => !usados.has(p.isin));

    return { emparejadas, sinEmparejar, soloEnCsv };
};
