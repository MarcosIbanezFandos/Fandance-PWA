/**
 * Reglas de reajuste de Indexa Capital.
 *
 * La app replica su cartera modelo, así que replica también su criterio para
 * decidir *cuándo* toca reajustar. El objetivo de estas reglas es no operar por
 * ruido: cada compra o venta tiene coste y, en una cartera indexada, moverse por
 * medio punto de desviación destruye más valor del que corrige.
 *
 * Fuente: https://support.indexacapital.com/es/esp/rebalanceo
 */
// Sin importar de utils.js a propósito: utils importa de aquí, y un ciclo
// entre los dos deja uno de los módulos a medio inicializar según quién cargue
// primero. safeFloat es una línea; duplicarla sale más barato que el ciclo.
const safeFloat = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

/** A partir de este patrimonio el umbral se estrecha. */
export const LIMITE_PATRIMONIO = 100000;

/** Umbral por fondo, en puntos porcentuales. */
export const UMBRAL_PEQUEÑA = 1.5;
export const UMBRAL_GRANDE = 1.25;

/**
 * El monetario hace de colchón, no de inversión: se le exige mucho menos
 * desvío porque es de donde sale el dinero para todo lo demás.
 */
export const UMBRAL_MONETARIO = 0.20;

/** Con el mercado revuelto se ensancha la banda para no operar en pánico. */
export const AJUSTE_VOLATILIDAD = 0.5;
export const VIX_ALTO = 35;

/** Por debajo de este importe una operación es más coste que beneficio. */
export const OPERACION_MINIMA = 100;

/* ------------------------------------------------------------------ *
 *  Clasificación de activos
 * ------------------------------------------------------------------ */

// 'moneta' cubre monetario, monetaire y monetary de una vez.
const PALABRAS_MONETARIO = /moneta|money market|treasury bill|t-bill|liquidez|\bcash\b/i;
const PALABRAS_RENTA_FIJA = /\bbond|renta fija|aggregate|treasury|gilt|bund|govt|government|corporate|oblig|deuda|fixed income/i;

/**
 * Renta variable, renta fija o monetario.
 *
 * Se deduce del nombre porque el tipo que devuelve el proveedor no distingue:
 * un fondo de bonos y uno de acciones son los dos "ETF". El usuario puede
 * corregirlo, y su elección manda sobre la deducción.
 */
export const claseActivo = (item, overrides = {}) => {
    const manual = overrides?.[item?.id];
    if (manual) return manual;

    const tipo = String(item?.asset?.type || item?.type || '');
    const nombre = `${item?.asset?.name || item?.name || ''} ${item?.asset?.ticker || item?.ticker || ''}`;

    if (PALABRAS_MONETARIO.test(nombre)) return 'monetario';
    if (tipo === 'Bond' || PALABRAS_RENTA_FIJA.test(nombre)) return 'renta_fija';
    return 'renta_variable';
};

/* ------------------------------------------------------------------ *
 *  Umbrales
 * ------------------------------------------------------------------ */

/** Umbral base según el tamaño de la cartera. */
export const umbralBase = (patrimonio) =>
    safeFloat(patrimonio) >= LIMITE_PATRIMONIO ? UMBRAL_GRANDE : UMBRAL_PEQUEÑA;

/**
 * Umbral aplicable a un activo concreto.
 *
 * Tres correcciones sobre el umbral base, en este orden:
 *   · volatilidad alta lo ensancha (no operar en pánico),
 *   · una cartera descuadrada entre renta variable y fija lo estrecha a la
 *     mitad (el desvío agregado importa más que el de cada fondo suelto),
 *   · el monetario tiene el suyo propio, fijo.
 */
export const umbralActivo = ({ patrimonio, clase = 'renta_variable', vixAlto = false, agregadoDisparado = false }) => {
    if (clase === 'monetario') return UMBRAL_MONETARIO;
    let u = umbralBase(patrimonio);
    if (vixAlto) u += AJUSTE_VOLATILIDAD;
    if (agregadoDisparado) u /= 2;
    return u;
};

/* ------------------------------------------------------------------ *
 *  Evaluación de la cartera
 * ------------------------------------------------------------------ */

/**
 * ¿Toca reajustar?
 *
 * Devuelve el umbral aplicado, qué activos se han salido de banda y por qué,
 * para poder explicárselo al usuario en vez de darle sólo un sí o un no.
 */
export const evaluarReajuste = (items = [], { vixAlto = false, clases = {} } = {}) => {
    const lista = Array.isArray(items) ? items : [];
    const patrimonio = lista.reduce((s, i) => s + safeFloat(i.value), 0);

    const conClase = lista.map(i => {
        const valor = safeFloat(i.value);
        const actual = patrimonio > 0 ? (valor / patrimonio) * 100 : 0;
        const objetivo = safeFloat(i.targetWeight ?? i.target_weight);
        return {
            id: i.id,
            ticker: i.asset?.ticker || i.ticker,
            nombre: i.asset?.name || i.name || i.asset?.ticker,
            clase: claseActivo(i, clases),
            valor, actual, objetivo,
            desvio: actual - objetivo,
        };
    });

    // Desvío agregado de la renta variable: lo que se ha movido el reparto
    // entre acciones y bonos, que es la decisión que de verdad marca el riesgo.
    const rvActual = conClase.filter(r => r.clase === 'renta_variable').reduce((s, r) => s + r.actual, 0);
    const rvObjetivo = conClase.filter(r => r.clase === 'renta_variable').reduce((s, r) => s + r.objetivo, 0);
    const desvioAgregado = rvActual - rvObjetivo;

    const base = umbralBase(patrimonio) + (vixAlto ? AJUSTE_VOLATILIDAD : 0);
    // Sólo tiene sentido hablar de desvío agregado si hay las dos clases.
    const hayVariasClases = new Set(conClase.map(r => r.clase)).size > 1;
    const agregadoDisparado = hayVariasClases && Math.abs(desvioAgregado) > base * 2;

    const filas = conClase.map(r => {
        const umbral = umbralActivo({ patrimonio, clase: r.clase, vixAlto, agregadoDisparado });
        return { ...r, umbral, fueraDeBanda: Math.abs(r.desvio) > umbral };
    }).sort((a, b) => Math.abs(b.desvio) - Math.abs(a.desvio));

    return {
        patrimonio,
        umbralBase: base,
        vixAlto,
        agregadoDisparado,
        desvioAgregado,
        rvActual, rvObjetivo,
        filas,
        fueraDeBanda: filas.filter(r => r.fueraDeBanda),
        necesitaReajuste: filas.some(r => r.fueraDeBanda),
    };
};

/* ------------------------------------------------------------------ *
 *  Operación mínima
 * ------------------------------------------------------------------ */

/**
 * Reparte respetando el importe mínimo por operación.
 *
 * Repartir 60 € entre cinco fondos son cinco compras de 12 €: cinco comisiones
 * y ningún efecto sobre los pesos. Se van descartando los destinos que no
 * llegan al mínimo y su parte se reasigna a los que más lo necesitan; si
 * ninguno llega, todo va al que más se ha quedado atrás.
 *
 * `pesos` es {id: peso} donde peso es la necesidad relativa de cada activo.
 */
export const repartirConMinimo = (pesos, importe, minimo = OPERACION_MINIMA) => {
    const total = safeFloat(importe);
    const entradas = Object.entries(pesos || {}).filter(([, p]) => safeFloat(p) > 0);
    if (total <= 0 || !entradas.length) return {};

    // No llega ni para una operación: se concentra en el que más lo necesita.
    if (total < minimo) {
        const [mejor] = entradas.sort((a, b) => safeFloat(b[1]) - safeFloat(a[1]));
        return { [mejor[0]]: total };
    }

    let vivos = entradas.slice();
    for (let vuelta = 0; vuelta < entradas.length; vuelta++) {
        const suma = vivos.reduce((s, [, p]) => s + safeFloat(p), 0) || 1;
        const reparto = vivos.map(([id, p]) => [id, total * (safeFloat(p) / suma)]);
        const pequeños = reparto.filter(([, v]) => v < minimo);

        // Todos llegan al mínimo: reparto válido.
        if (!pequeños.length) return Object.fromEntries(reparto);

        // Si al quitar los pequeños no queda nadie, se concentra en el mayor.
        const quedan = vivos.filter(([id]) => !pequeños.some(([pid]) => pid === id));
        if (!quedan.length) {
            const [mejor] = vivos.sort((a, b) => safeFloat(b[1]) - safeFloat(a[1]));
            return { [mejor[0]]: total };
        }
        vivos = quedan;
    }
    return Object.fromEntries(vivos.map(([id]) => [id, total / vivos.length]));
};
