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
        const p = pos.get(clave) || {
            isin: clave, nombre: t.nombre, unidades: 0, coste: 0, ops: 0,
            ultimoPrecio: 0, ultimaFecha: null,
        };
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
        // Último precio al que Trade Republic ejecutó. Es la mejor referencia
        // que hay del valor real de la participación cuando el proveedor de
        // cotizaciones no reconoce el activo.
        if (t.precio > 0 && (!p.ultimaFecha || t.fecha >= p.ultimaFecha)) {
            p.ultimoPrecio = t.precio;
            p.ultimaFecha = t.fecha;
        }
        pos.set(clave, p);
    }
    return [...pos.values()]
        .filter(p => p.unidades > 0)
        .map(p => ({ ...p, precioMedio: p.unidades > 0 ? p.coste / p.unidades : 0 }))
        .sort((a, b) => b.coste - a.coste);
};

/**
 * Aportaciones que no estaban en la importación anterior.
 *
 * Se compara contra las fechas del CSV ya guardado, no contra los rebalanceos
 * aplicados: quien aporta con el plan automático del bróker no pulsa nada en la
 * app, así que ese historial está vacío y todas las aportaciones salían como
 * nuevas en cada reimportación.
 */
export const aportacionesNuevas = (aportaciones, previas = []) => {
    const yaVistas = new Set(
        (previas || [])
            .map(x => (typeof x === 'string' ? x : String(x?.fecha || x?.created_at || x?.date || '')).slice(0, 10))
            .filter(Boolean)
    );
    return aportaciones.filter(a => !yaVistas.has(a.fecha));
};

/* ------------------------------------------------------------------ *
 *  Emparejar con las posiciones de la app
 * ------------------------------------------------------------------ */

// Envoltorio legal y clase de participación fuera: "UCITS ETF USD (Acc)" no
// distingue un fondo de otro. La gestora se conserva en la forma estricta y se
// quita en la laxa, porque el bróker la omite —llama "S&P 500 USD (Acc)" a lo
// que la gestora llama "Vanguard S&P 500 UCITS ETF USD Accumulation"— pero
// borrarla también hace indistinguibles dos fondos distintos con el mismo
// índice. Por eso la forma laxa sólo vale con el precio como testigo.
const LIMPIEZA = /\b(ucits|etf|acc|accumulating|accumulation|dist|distributing|distribution|usd|eur|gbp|chf|plc|fund[s]?|index)\b/g;
const GESTORAS = /\b(ishares|vanguard|amundi|xtrackers|spdr|invesco|lyxor|blackrock|hsbc|ubs|state street)\b/g;

const base = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')     // sin acentos
    .replace(/\(.*?\)/g, ' ')                            // fuera "(Acc)", "(Dist)"
    .replace(LIMPIEZA, ' ');

const normalizarNombre = (s) => base(s).replace(/[^a-z0-9]+/g, ' ').trim();
const normalizarSinGestora = (s) => base(s).replace(GESTORAS, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * A partir de qué diferencia se deja de creer al proveedor de cotizaciones.
 *
 * Se compara el precio que la app tiene para el activo con el último al que el
 * bróker ejecutó de verdad. El mercado mueve los precios, pero no los duplica
 * de una semana para otra: una diferencia así significa que la app tiene el
 * activo dado de alta con otro ticker, otra clase de participación u otra
 * divisa.
 *
 * En ese caso NO se descarta el emparejamiento —el usuario tiene ese fondo y
 * quiere verlo— sino que se marca para valorarlo con el precio del bróker, que
 * es el único que se corresponde con lo que posee.
 */
export const DESVIO_PRECIO_MAXIMO = 0.25;

const precioDiscrepa = (item, pos) => {
    const precioApp = safeFloat(item?.current_price);
    const precioCsv = pos?.ultimoPrecio > 0
        ? pos.ultimoPrecio
        : (pos?.unidades > 0 ? pos.coste / pos.unidades : 0);
    // Sin precio en alguno de los dos lados no hay nada que comparar; que la
    // app no tenga cotización ya es motivo suficiente para usar la del CSV.
    if (precioCsv <= 0) return false;
    if (precioApp <= 0) return true;
    const mayor = Math.max(precioApp, precioCsv);
    const menor = Math.min(precioApp, precioCsv);
    return (mayor / menor) - 1 > DESVIO_PRECIO_MAXIMO;
};

/**
 * Cruza cada posición de la cartera con su línea del CSV.
 *
 * Primero por ISIN, que es identificador único y no admite ambigüedad. Si el
 * activo se dio de alta con un ticker en vez del ISIN, se recurre al nombre
 * normalizado —quitando acentos, sufijos de clase y la gestora— porque en la
 * práctica es lo que coincide: la app y Trade Republic llaman igual al fondo.
 */
export const emparejarPosiciones = (items = [], posCsv = [], { isinConocido = {} } = {}) => {
    const porIsin = new Map(posCsv.map(p => [String(p.isin).toUpperCase(), p]));
    const porNombre = new Map(posCsv.map(p => [normalizarNombre(p.nombre), p]));
    const porNombreLaxo = new Map(posCsv.map(p => [normalizarSinGestora(p.nombre), p]));

    const emparejadas = [];
    const sinEmparejar = [];

    // Una línea del CSV no puede alimentar a dos activos de la app: sería
    // contar el mismo dinero dos veces.
    const yaAsignadas = new Set();

    for (const it of items) {
        const ticker = String(it.asset?.ticker || '').toUpperCase();

        // 1. ISIN recordado de una importación anterior. Es lo que hace estable
        //    el emparejamiento: al resolver el ISIN, el activo se renombra con
        //    el nombre de la gestora y deja de parecerse al del bróker, así que
        //    sin memoria la siguiente importación ya no lo reconocería.
        const recordado = isinConocido?.[it.id]
            ? porIsin.get(String(isinConocido[it.id]).toUpperCase())
            : null;

        // 2. El activo dado de alta directamente con su ISIN.
        const porTicker = porIsin.get(ticker);

        // 3. Nombre completo, gestora incluida.
        const porNombreM = porNombre.get(normalizarNombre(it.asset?.name));

        // 4. Nombre sin gestora. Aquí sí puede colarse otro fondo del mismo
        //    índice, así que se exige que el precio cuadre, o bien que el nombre
        //    sea único tanto en la cartera como en el CSV (no hay ambigüedad).
        const laxo = porNombreLaxo.get(normalizarSinGestora(it.asset?.name));
        const nombreLaxoStr = normalizarSinGestora(it.asset?.name);
        const laxoEsUnico = laxo &&
            items.filter(x => normalizarSinGestora(x.asset?.name) === nombreLaxoStr).length === 1 &&
            posCsv.filter(x => normalizarSinGestora(x.nombre) === nombreLaxoStr).length === 1;

        const porNombreLaxoM = laxo && (laxoEsUnico || !precioDiscrepa(it, laxo)) ? laxo : null;

        const m = recordado || porTicker || porNombreM || porNombreLaxoM || null;
        if (!m || yaAsignadas.has(m.isin)) { sinEmparejar.push(it); continue; }

        yaAsignadas.add(m.isin);
        emparejadas.push({
            item: it,
            csv: m,
            via: recordado ? 'memoria' : porTicker ? 'isin' : porNombreM ? 'nombre' : 'nombre-laxo',
            // Si la cotización de la app no se parece a lo que se pagó, la
            // posición se valora con el precio del bróker.
            precioDiscrepa: precioDiscrepa(it, m),
        });
    }

    // Lo que hay en el CSV y no está dado de alta en la cartera.
    const usados = new Set(emparejadas.map(e => e.csv.isin));
    const soloEnCsv = posCsv.filter(p => !usados.has(p.isin));

    return { emparejadas, sinEmparejar, soloEnCsv };
};

/* ------------------------------------------------------------------ *
 *  Puente hacia las métricas de rentabilidad
 * ------------------------------------------------------------------ */

/**
 * Traduce los movimientos normalizados al formato que espera
 * `computeMetricsForPeriod`.
 *
 * Existe para que el CSV se suba una sola vez: rentabilidad y posiciones beben
 * del mismo almacén en vez de pedir el fichero cada una por su lado.
 */
export const aFormatoMetricas = (txs = []) => txs.map(t => ({
    date: new Date(t.datetime || `${t.fecha}T12:00:00`),
    type: t.tipo,
    category: t.categoria,
    // En TRADING el símbolo es el ISIN; si falta, el nombre sirve de clave
    // estable para el seguimiento de coste medio.
    symbol: t.isin || t.nombre || 'Unknown',
    shares: Math.abs(t.unidades),
    price: t.precio,
    amount: t.importe,
    fee: Math.abs(t.comision),
    tax: Math.abs(t.impuesto),
}));

/** Fecha de la primera compra: desde cuándo tienen sentido las estadísticas. */
export const primeraCompra = (txs = []) => {
    const compras = txs
        .filter(t => t.categoria === 'TRADING' && t.tipo === 'BUY' && t.fecha)
        .map(t => t.fecha)
        .sort();
    return compras.length ? new Date(`${compras[0]}T12:00:00`).toISOString() : null;
};

/**
 * Aportado por mes según el CSV: { 'AAAA-MM': importe }.
 *
 * Es la fuente de verdad del seguimiento del plan. Antes el cumplimiento sólo
 * salía de los rebalanceos aplicados dentro de la app, así que quien aporta con
 * el plan automático de Trade Republic y se limita a sincronizar el CSV veía
 * cero meses cumplidos por muchos meses que llevara aportando.
 */
export const aportadoPorMes = (txs = []) => {
    const porMes = {};
    for (const a of detectarAportaciones(txs)) {
        porMes[a.mes] = (porMes[a.mes] || 0) + a.total;
    }
    return porMes;
};

/** Patrimonio invertido según el CSV: suma del coste de las posiciones vivas. */
export const invertidoTotal = (txs = []) =>
    posicionesDesdeCsv(txs).reduce((s, p) => s + p.coste, 0);
