export const safeFloat = (input) => {
    if (input === null || input === undefined || input === '') return 0;
    const strVal = String(input).replace(',', '.');
    const num = parseFloat(strVal);
    if (isNaN(num) || !isFinite(num)) return 0;
    return num;
};

export const roundTo = (num, decimals = 2) => {
    const p = Math.pow(10, decimals);
    return Math.round((safeFloat(num) + Number.EPSILON) * p) / p;
};

// El español, por norma CLDR, no separa los miles en números de cuatro cifras:
// 6478 sale sin punto y 12.345 con él. En una columna de importes eso parece un
// error de la app, así que se fuerza la agrupación siempre.
const GROUPING = { useGrouping: 'always' };

export const formatCurrency = (amount, decimals = 0) => {
    return safeFloat(amount).toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
        ...GROUPING,
    });
};

// Number formatted with grouping but no currency symbol.
export const formatNumber = (amount, decimals = 0) => {
    return safeFloat(amount).toLocaleString('es-ES', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
        ...GROUPING,
    });
};

// Units: adaptive precision (crypto needs more decimals than shares).
export const formatUnits = (units) => {
    const n = safeFloat(units);
    const abs = Math.abs(n);
    const decimals = abs === 0 ? 0 : abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
    return n.toLocaleString('es-ES', { maximumFractionDigits: decimals, ...GROUPING });
};

/**
 * Label a price/value series for charting, at the resolution the data actually has.
 *
 * Short periods come back as 15-minute or hourly candles. Labelling those with
 * the date alone left the axis repeating "1 ago" and made the tooltip identical
 * at 10:00 and at 17:30 — the reason this lives in one place now is that both
 * the Performance and the Analysis charts were formatting dates on their own.
 *
 * `timeOnlyAxis` is for single-day charts, where the date adds nothing.
 * Returns [{ value, date (axis label), full (tooltip label) }].
 */
export const formatSeriesDates = (points, { timeOnlyAxis = false } = {}) => {
    const raw = (points || [])
        .map(p => ({ value: safeFloat(p.value), at: new Date(p.date) }))
        .filter(p => !isNaN(p.at.getTime()));

    const intraday = raw.some((p, i) => i > 0 && p.at.toDateString() === raw[i - 1].at.toDateString());
    const axisFmt = intraday
        ? (timeOnlyAxis
            ? { hour: '2-digit', minute: '2-digit' }
            : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : { day: 'numeric', month: 'short' };
    const fullFmt = intraday
        ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

    return raw.map(p => ({
        value: p.value,
        date: p.at.toLocaleString('es-ES', axisFmt),
        full: p.at.toLocaleString('es-ES', fullFmt),
    }));
};

/**
 * How much the user puts in each month over the horizon, with an optional
 * annual raise (IPC) spread across the year:
 *
 *     amount(m) = monthly * (1 + annualGrowthPct/100) ** ((m - 1) / 12)
 *
 * Month 1 is the base amount and every 12th month lands exactly on one full
 * annual raise, so "Mes 13" is the base + one IPC. This mirrors the projection
 * endpoint on purpose — a calendar that disagrees with the chart is worse than
 * no calendar.
 *
 * Display density adapts to the horizon so the strip never gets unreadable:
 *   < 12 months -> every month        ("Mes 1", "Mes 2", …)
 *   12–60       -> every 6 months     ("Mes 1", "Mes 7", "Mes 13", …)
 *   > 60        -> one per year       ("Año 1" / mes 1, "Año 2" / mes 13, …)
 *
 * Returns { rows: [{ month, year, amount }], total, months, step, lastMonth,
 *           lastAmount, monthlyGrowthPct }, where `amount` is rounded for
 * display and `total` sums the unrounded amounts of *every* month, not just
 * the shown ones. `lastAmount` is always the real final month, which in yearly
 * mode is not the last row (rows there are one per year, by year start).
 */
export const buildContributionSchedule = ({ monthly, annualGrowthPct = 0, months }) => {
    const base = safeFloat(monthly);
    const n = Math.max(0, Math.floor(safeFloat(months)));
    // A rate below -100% would make the base negative and the 12th root NaN.
    const annualFactor = Math.max(0, 1 + safeFloat(annualGrowthPct) / 100);
    const empty = { rows: [], total: 0, months: n, step: 1, lastMonth: 0, lastAmount: 0, monthlyGrowthPct: 0 };
    if (base <= 0 || n <= 0) return empty;

    const monthlyFactor = Math.pow(annualFactor, 1 / 12);
    const amountAt = (m) => base * Math.pow(monthlyFactor, m - 1);

    let total = 0;
    for (let m = 1; m <= n; m++) total += amountAt(m);

    const step = n < 12 ? 1 : n <= 60 ? 6 : 12;
    const sampled = [];
    for (let m = 1; m <= n; m += step) sampled.push(m);
    // Close the strip on the horizon itself when the cadence overshoots it —
    // except in yearly mode, where one row per year is the whole point and an
    // extra row would repeat the last year's label.
    if (step !== 12 && sampled[sampled.length - 1] !== n) sampled.push(n);

    return {
        rows: sampled.map(m => ({ month: m, year: Math.floor((m - 1) / 12) + 1, amount: Math.round(amountAt(m)) })),
        total: Math.round(total),
        months: n,
        step,
        lastMonth: n,
        lastAmount: Math.round(amountAt(n)),
        monthlyGrowthPct: (monthlyFactor - 1) * 100,
    };
};

/**
 * Aggregate a portfolio X-ray from per-position look-through data.
 *
 * Returns { total, companies, countries, currencies, sectors, regions }.
 */

const COUNTRY_TO_REGION = {
    'United States': 'North America', 'Canada': 'North America', 'Mexico': 'Latin America',
    'Brazil': 'Latin America',
    'United Kingdom': 'Europe', 'France': 'Europe', 'Germany': 'Europe', 'Netherlands': 'Europe',
    'Switzerland': 'Europe', 'Spain': 'Europe', 'Italy': 'Europe', 'Belgium': 'Europe',
    'Portugal': 'Europe', 'Austria': 'Europe', 'Ireland': 'Europe', 'Finland': 'Europe',
    'Sweden': 'Europe', 'Norway': 'Europe', 'Denmark': 'Europe', 'Poland': 'Europe',
    'Europe (diversified)': 'Europe',
    'Japan': 'Asia-Pacific', 'Australia': 'Asia-Pacific', 'Hong Kong': 'Asia-Pacific',
    'Singapore': 'Asia-Pacific', 'Taiwan': 'Asia-Pacific', 'South Korea': 'Asia-Pacific',
    'New Zealand': 'Asia-Pacific', 'Asia-Pacific (diversified)': 'Asia-Pacific',
    'China': 'Emerging Markets', 'India': 'Emerging Markets',
    'South Africa': 'Emerging Markets', 'Saudi Arabia': 'Emerging Markets',
    'Israel': 'Emerging Markets', 'Emerging Markets': 'Emerging Markets',
    'Global (diversified)': 'Global', 'Global small cap (diversified)': 'Global',
};

const COUNTRY_TO_CURRENCY = {
    'United States': 'USD', 'Canada': 'CAD', 'Mexico': 'MXN', 'Brazil': 'BRL',
    'United Kingdom': 'GBP', 'Switzerland': 'CHF', 'Sweden': 'SEK', 'Norway': 'NOK',
    'Denmark': 'DKK', 'Poland': 'PLN',
    'France': 'EUR', 'Germany': 'EUR', 'Netherlands': 'EUR', 'Spain': 'EUR',
    'Italy': 'EUR', 'Belgium': 'EUR', 'Portugal': 'EUR', 'Austria': 'EUR',
    'Ireland': 'EUR', 'Finland': 'EUR', 'Europe (diversified)': 'EUR',
    'Japan': 'JPY', 'Australia': 'AUD', 'Hong Kong': 'HKD', 'Singapore': 'SGD',
    'Taiwan': 'TWD', 'South Korea': 'KRW', 'New Zealand': 'NZD',
    'China': 'CNY', 'India': 'INR', 'South Africa': 'ZAR', 'Saudi Arabia': 'SAR',
    'Israel': 'ILS',
};

export const buildXray = (positions, filterTicker = null) => {
    const list = (positions || []).filter(p => !filterTicker || p.ticker === filterTicker);
    const total = list.reduce((s, p) => s + safeFloat(p.value), 0);

    const companies = new Map();
    const countries = {};
    const currencies = {};
    const sectors = {};
    const regions = {};
    let estimatedGeo = 0;

    const addCompany = (key, name, symbol, val, sourceTicker) => {
        const c = companies.get(key) || { key, name, symbol, value: 0, sources: new Set(), other: false };
        c.value += val;
        if (sourceTicker) c.sources.add(sourceTicker);
        companies.set(key, c);
    };

    // Un país entra siempre en el desglose, aunque la etiqueta sea regional:
    // descartarlo hacía desaparecer su valor del gráfico sin dejar rastro.
    const addGeo = (country, currency, val) => {
        if (val <= 0) return;
        const c = country || 'Other';
        countries[c] = (countries[c] || 0) + val;
        currencies[currency || COUNTRY_TO_CURRENCY[c] || 'USD'] = (currencies[currency || COUNTRY_TO_CURRENCY[c] || 'USD'] || 0) + val;
        const region = COUNTRY_TO_REGION[c] || 'Other';
        regions[region] = (regions[region] || 0) + val;
    };

    for (const p of list) {
        const value = safeFloat(p.value);

        // --- Geografía ---
        // El backend manda los pesos por país del fondo entero. No se derivan
        // del top 10 a propósito: Yahoo solo devuelve 10 posiciones (~20-35%
        // del fondo) y son casi todas megacaps de EE. UU., así que extrapolar
        // desde ahí convertía cualquier ETF global en "100% Estados Unidos".
        const geoWeights = p.countries && Object.keys(p.countries).length ? p.countries : null;
        if (geoWeights) {
            if (p.countries_estimated) estimatedGeo += value;
            const wTotal = Object.values(geoWeights).reduce((s, w) => s + safeFloat(w), 0) || 1;
            for (const [country, w] of Object.entries(geoWeights)) {
                addGeo(country, null, value * (safeFloat(w) / wTotal));
            }
        } else {
            // Respuesta antigua sin pesos por país: repartir por las posiciones
            // conocidas y mandar el resto a la región del fondo.
            let geoCovered = 0;
            for (const h of (p.holdings || [])) {
                const val = value * safeFloat(h.weight);
                if (val <= 0) continue;
                geoCovered += val;
                addGeo(h.country, h.currency, val);
            }
            if (value - geoCovered > 0.5) {
                addGeo(p.region || 'Global (diversified)', p.currency, value - geoCovered);
                estimatedGeo += value - geoCovered;
            }
        }

        // --- Empresas ---
        let covered = 0;
        for (const h of (p.holdings || [])) {
            const val = value * safeFloat(h.weight);
            if (val <= 0) continue;
            covered += val;
            const key = (h.symbol || h.name || '').toUpperCase();
            addCompany(key, h.name || h.symbol, h.symbol, val, p.ticker);
        }

        // Redistribute remainder proportionally across known holdings
        // instead of creating an "Otros de X" bucket
        const rem = value - covered;
        if (rem > 0.5 && (p.holdings || []).length > 0) {
            const holdingTotal = (p.holdings || []).reduce((s, h) => s + safeFloat(h.weight), 0);
            if (holdingTotal > 0) {
                for (const h of (p.holdings || [])) {
                    const extra = rem * (safeFloat(h.weight) / holdingTotal);
                    const key = (h.symbol || h.name || '').toUpperCase();
                    addCompany(key, h.name || h.symbol, h.symbol, extra, p.ticker);
                }
            }
        }

        // Sectors
        let secCovered = 0;
        for (const [s, w] of Object.entries(p.sectors || {})) {
            const val = value * safeFloat(w);
            sectors[s] = (sectors[s] || 0) + val;
            secCovered += val;
        }
        if (value - secCovered > 0.5) sectors['unknown'] = (sectors['unknown'] || 0) + (value - secCovered);
    }

    // "Other", "unknown" y compañía no son un país, un sector ni una divisa:
    // son el hueco que deja la fuente de datos. Ponerlos a competir en el
    // ranking llenaba el primer puesto de una barra que no informa de nada, así
    // que se sacan de la lista y su peso se reporta aparte como "sin clasificar".
    const RESIDUAL = /^(other|others|otros|unknown|desconocido|other \/ unknown|global \(diversified\)|n\/a|-|)$/i;
    const isResidual = (k) => RESIDUAL.test(String(k ?? '').trim());

    const toSorted = (obj) => {
        const known = Object.entries(obj).filter(([k]) => !isResidual(k));
        // Los porcentajes se normalizan sobre lo clasificado para que las barras
        // sumen 100% y sigan siendo comparables entre sí.
        const knownTotal = known.reduce((s, [, v]) => s + v, 0);
        return known
            .map(([key, value]) => ({ key, name: key, value, pct: knownTotal > 0 ? (value / knownTotal) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);
    };

    const residualPct = (obj) => {
        const res = Object.entries(obj).reduce((s, [k, v]) => s + (isResidual(k) ? v : 0), 0);
        return total > 0 ? (res / total) * 100 : 0;
    };

    const companyList = [...companies.values()]
        .filter(c => !isResidual(c.name) && !isResidual(c.key))
        .map(c => ({ ...c, sources: [...c.sources], pct: total > 0 ? (c.value / total) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);

    return {
        total,
        companies: companyList,
        countries: toSorted(countries),
        currencies: toSorted(currencies),
        sectors: toSorted(sectors),
        regions: toSorted(regions),
        // Peso que la fuente no supo etiquetar, por dimensión. La vista lo dice
        // en texto en lugar de inventarse una categoría.
        unclassified: {
            countries: residualPct(countries),
            currencies: residualPct(currencies),
            sectors: residualPct(sectors),
            regions: residualPct(regions),
        },
        // Parte de la cartera cuya geografía sale de los pesos del índice y no
        // de posiciones reales; la vista lo advierte en lugar de fingir dato duro.
        estimatedGeoPct: total > 0 ? (estimatedGeo / total) * 100 : 0,
    };
};

/**
 * Money-weighted return (XIRR) for irregularly-timed cash flows.
 * cashflows: [{ amount, date }] where deposits are negative and the final
 * portfolio value is a positive inflow dated today.
 * Returns the annual rate as a decimal (0.2079 = 20.79%) or null if it can't
 * be bracketed (e.g. not enough data / no sign change).
 */
export const xirr = (cashflows) => {
    const flows = (cashflows || []).filter(c => c && isFinite(c.amount) && c.date instanceof Date && !isNaN(c.date));
    if (flows.length < 2) return null;
    const hasNeg = flows.some(c => c.amount < 0);
    const hasPos = flows.some(c => c.amount > 0);
    if (!hasNeg || !hasPos) return null;

    const t0 = flows[0].date.getTime();
    const YEAR = 365 * 24 * 3600 * 1000;
    const yearFrac = (d) => (d.getTime() - t0) / YEAR;
    const npv = (rate) => flows.reduce((s, c) => s + c.amount / Math.pow(1 + rate, yearFrac(c.date)), 0);

    let lo = -0.9999, hi = 10;
    let fLo = npv(lo), fHi = npv(hi);
    if (isNaN(fLo) || isNaN(fHi) || fLo * fHi > 0) return null;

    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        const fMid = npv(mid);
        if (!isFinite(fMid)) return null;
        if (Math.abs(fMid) < 1e-7) return mid;
        if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
    }
    return (lo + hi) / 2;
};

/**
 * Compute portfolio-level metrics for a given period, matching Parqet's definitions.
 *
 * @param {Array} transactions – parsed TR transactions with { date, type, category,
 *   symbol, shares, price, amount, fee, tax }.
 * @param {number} currentValue – current portfolio value (live).
 * @param {string} periodId – one of 'today','1w','1m','3m','ytd','1y','max'.
 *
 * Returns an object with invested, cashFlow, tir, ttwror, priceGains, realizedGross,
 * dividends, interest, totalGross, taxes, fees, netTotal, firstPurchase.
 */
export const computeMetricsForPeriod = (transactions, currentValue, periodId) => {
    const all = Array.isArray(transactions) ? transactions : [];
    if (all.length === 0) return null;

    const now = new Date();
    let periodStart;
    switch (periodId) {
        case 'today': periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case '1w': periodStart = new Date(now.getTime() - 7 * 86400000); break;
        case '1m': periodStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
        case '3m': periodStart = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
        case 'ytd': periodStart = new Date(now.getFullYear(), 0, 1); break;
        case '1y': periodStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
        case 'max': default: periodStart = new Date(0); break;
    }

    // Sort everything by date
    const sorted = [...all].sort((a, b) => a.date - b.date);
    const tradingAll = sorted.filter(t => t.category === 'TRADING');
    const tradingBefore = tradingAll.filter(t => t.date < periodStart);
    const tradingInPeriod = tradingAll.filter(t => t.date >= periodStart);
    const cashInPeriod = sorted.filter(t => t.category === 'CASH' && t.date >= periodStart);

    // 1. Build position state at the start of the period (cost basis tracking)
    const posAtStart = {};
    for (const t of tradingBefore) {
        const sym = t.symbol;
        if (!posAtStart[sym]) posAtStart[sym] = { shares: 0, totalCost: 0 };
        const shares = Math.abs(t.shares);
        const amount = Math.abs(t.amount);

        if (t.type === 'BUY') {
            posAtStart[sym].shares += shares;
            posAtStart[sym].totalCost += amount;
        } else if (t.type === 'SELL') {
            const avg = posAtStart[sym].shares > 0 ? posAtStart[sym].totalCost / posAtStart[sym].shares : 0;
            const cost = shares * avg;
            posAtStart[sym].shares -= shares;
            posAtStart[sym].totalCost -= cost;
            if (posAtStart[sym].shares <= 1e-7) { posAtStart[sym].shares = 0; posAtStart[sym].totalCost = 0; }
        }
    }
    const costBasisAtStart = Object.values(posAtStart).reduce((s, p) => s + p.totalCost, 0);

    // 2. Process trades in the period (continue from posAtStart)
    const posCurrent = {};
    for (const [sym, p] of Object.entries(posAtStart)) {
        posCurrent[sym] = { shares: p.shares, totalCost: p.totalCost };
    }

    let realizedGross = 0;
    let periodFees = 0;
    let periodTaxes = 0;
    let periodDividends = 0;
    let periodInterest = 0;
    let firstBuy = null;

    // XIRR flows for the period: portfolio value at period start is an outflow
    const irrFlows = [];

    // If we had positions at start, the opening value acts as an initial investment
    // We'll use costBasisAtStart (or ideally market value at start, but we don't have it)
    // For XIRR, we track actual cash flows (buys = outflow, sells/divs/interest = inflow)

    for (const t of tradingInPeriod) {
        const sym = t.symbol;
        if (!posCurrent[sym]) posCurrent[sym] = { shares: 0, totalCost: 0 };
        const shares = Math.abs(t.shares);
        const amount = Math.abs(t.amount);
        const fee = Math.abs(t.fee);
        const tax = Math.abs(t.tax);

        periodFees += fee;
        periodTaxes += tax;

        if (t.type === 'BUY') {
            posCurrent[sym].shares += shares;
            posCurrent[sym].totalCost += amount;
            irrFlows.push({ date: t.date, amount: -amount }); // cash outflow
            if (!firstBuy || t.date < firstBuy) firstBuy = t.date;
        } else if (t.type === 'SELL') {
            const avg = posCurrent[sym].shares > 0 ? posCurrent[sym].totalCost / posCurrent[sym].shares : 0;
            const cost = shares * avg;
            realizedGross += amount - cost;
            posCurrent[sym].shares -= shares;
            posCurrent[sym].totalCost -= cost;
            if (posCurrent[sym].shares <= 1e-7) { posCurrent[sym].shares = 0; posCurrent[sym].totalCost = 0; }
            irrFlows.push({ date: t.date, amount: amount }); // cash inflow
        }
    }

    // Process dividends and interest
    for (const t of cashInPeriod) {
        const type = (t.type || '').toUpperCase();
        const amount = Math.abs(t.amount);
        if (type.includes('DIVIDEND')) {
            periodDividends += amount;
            irrFlows.push({ date: t.date, amount: amount });
        } else if (type.includes('INTEREST')) {
            periodInterest += amount;
            irrFlows.push({ date: t.date, amount: amount });
        }
    }

    // 3. Compute derived metrics
    const costBasisNow = Object.values(posCurrent).reduce((s, p) => s + p.totalCost, 0);

    // "Invertido" = change in cost basis during the period
    const invested = costBasisNow - costBasisAtStart;

    // "Ganancias de precio" = current market value - total cost basis of open positions
    const priceGains = currentValue - costBasisNow;

    // "Flujo de caja" = net cash flow related to the portfolio
    // Parqet: cash that went into/out of the portfolio = transfers used for investments
    // We approximate as: sells - buys + dividends + interest (net from portfolio perspective)
    const cashFlowInvest = tradingInPeriod.reduce((s, t) => {
        if (t.type === 'BUY') return s - Math.abs(t.amount);
        if (t.type === 'SELL') return s + Math.abs(t.amount);
        return s;
    }, 0);
    const cashFlow = -cashFlowInvest; // From user perspective: positive = money put in

    // "Total bruto"
    const totalGross = priceGains + realizedGross + periodDividends + periodInterest;

    // TIR (XIRR) — only if we have meaningful flows
    let tir = null;
    if (irrFlows.length > 0 || costBasisAtStart > 0) {
        const flows = [];
        // Opening cost basis as initial investment
        if (costBasisAtStart > 0 && periodId !== 'max') {
            flows.push({ date: periodStart, amount: -costBasisAtStart });
        }
        flows.push(...irrFlows);
        if (currentValue > 0) {
            flows.push({ date: now, amount: currentValue });
        }
        flows.sort((a, b) => a.date - b.date);
        const rate = xirr(flows);
        if (rate !== null) tir = rate * 100;
    }

    // Period-relative percentage: use costBasisAtStart as the denominator when available
    // (for 'max' period, costBasisAtStart is 0 so fall back to costBasisNow)
    const refBasis = costBasisAtStart > 0 ? costBasisAtStart : costBasisNow;
    const totalGrossPct = refBasis > 0 ? roundTo((totalGross / refBasis) * 100, 2) : 0;

    return {
        invested: roundTo(invested, 2),
        cashFlow: roundTo(cashFlow, 2),
        tir,
        priceGains: roundTo(priceGains, 2),
        priceGainsPct: costBasisNow > 0 ? roundTo((priceGains / costBasisNow) * 100, 2) : 0,
        realizedGross: roundTo(realizedGross, 2),
        realizedPct: invested !== 0 ? roundTo((realizedGross / Math.abs(invested)) * 100, 2) : 0,
        dividends: roundTo(periodDividends, 2),
        dividendPct: invested !== 0 ? roundTo((periodDividends / Math.abs(invested)) * 100, 2) : 0,
        interest: roundTo(periodInterest, 2),
        interestPct: invested !== 0 ? roundTo((periodInterest / Math.abs(invested)) * 100, 2) : 0,
        totalGross: roundTo(totalGross, 2),
        totalGrossPct,
        taxes: roundTo(periodTaxes, 2),
        fees: roundTo(periodFees, 2),
        netTotal: roundTo(totalGross - periodTaxes - periodFees, 2),
        firstPurchase: firstBuy,
        portfolioValue: roundTo(currentValue, 2),
        costBasis: roundTo(costBasisNow, 2),
        costBasisAtStart: roundTo(costBasisAtStart, 2),
    };
};

/**
 * Time-Weighted Rate of Return (TTWROR) from a value series.
 * evolution: [{ date, value }] — portfolio values over time.
 * Returns a percentage (e.g. 10.17 for 10.17%).
 */
export const ttwror = (evolution) => {
    const pts = (evolution || []).filter(p => p && p.value > 0);
    if (pts.length < 2) return null;
    const startVal = pts[0].value;
    const endVal = pts[pts.length - 1].value;
    return roundTo(((endVal / startVal) - 1) * 100, 2);
};

/**
 * Build a monthly rebalancing plan for a list of portfolio items.
 *
 * mode = 'contribute'  → only BUY. Distributes the whole monthly contribution
 *                        across the assets, prioritising the ones furthest
 *                        below their target, WITHOUT ever selling. This answers
 *                        "how much do I put into each asset this month?".
 * mode = 'full'        → BUY & SELL to land exactly on the target weights.
 *
 * Each item is expected to expose: id, value (€), current_price (€),
 * target_weight (%). Values may be strings (they are coerced with safeFloat).
 *
 * Returns { rows, totals }.
 */
export const buildRebalancePlan = (items, contributionInput, mode = 'contribute') => {
    const list = Array.isArray(items) ? items : [];
    const contribution = Math.max(0, safeFloat(contributionInput));

    const currentTotal = list.reduce((s, i) => s + safeFloat(i.value), 0);
    const futureTotal = currentTotal + contribution;
    const targetSum = list.reduce((s, i) => s + safeFloat(i.target_weight), 0);

    // Normalised target fraction (robust even if the targets don't add up to 100).
    const frac = (i) => {
        if (targetSum > 0) return safeFloat(i.target_weight) / targetSum;
        return list.length > 0 ? 1 / list.length : 0;
    };

    const allocations = new Map(); // id -> € to invest (signed; negative = sell)

    if (mode === 'full') {
        list.forEach((i) => {
            const targetVal = futureTotal * frac(i);
            allocations.set(i.id, targetVal - safeFloat(i.value));
        });
    } else {
        // contribute-only: never sell, spend exactly the contribution.
        const deficits = list.map((i) => Math.max(0, futureTotal * frac(i) - safeFloat(i.value)));
        const sumDef = deficits.reduce((a, b) => a + b, 0);

        if (contribution <= 0) {
            list.forEach((i) => allocations.set(i.id, 0));
        } else if (sumDef <= 1e-9) {
            // Everything already at/above target → split by target weight.
            list.forEach((i) => allocations.set(i.id, contribution * frac(i)));
        } else if (sumDef <= contribution) {
            // Top up every underweight asset, then spread the leftover by weight.
            const leftover = contribution - sumDef;
            list.forEach((i, idx) => allocations.set(i.id, deficits[idx] + leftover * frac(i)));
        } else {
            // Not enough cash to fix everything → prioritise the most underweight.
            list.forEach((i, idx) => allocations.set(i.id, contribution * (deficits[idx] / sumDef)));
        }
    }

    const rows = list.map((i) => {
        const price = safeFloat(i.current_price);
        const value = safeFloat(i.value);
        const alloc = allocations.get(i.id) ?? 0;
        const currentWeight = currentTotal > 0 ? (value / currentTotal) * 100 : 0;
        const targetWeight = safeFloat(i.target_weight);
        const futureValue = Math.max(0, value + alloc);
        const futureWeight = futureTotal > 0 ? (futureValue / futureTotal) * 100 : 0;
        const unitsToTrade = price > 0 ? alloc / price : 0;
        const action = alloc > 0.005 ? 'BUY' : alloc < -0.005 ? 'SELL' : 'HOLD';

        return {
            ...i,
            currentWeight,
            targetWeight,
            drift: currentWeight - targetWeight,
            allocation: alloc,   // € to invest this month (signed)
            diffVal: alloc,      // backwards-compat alias
            unitsToTrade,
            futureValue,
            futureWeight,
            action
        };
    });

    const investTotal = rows.reduce((s, r) => s + Math.max(0, r.allocation), 0);
    const sellTotal = rows.reduce((s, r) => s + Math.max(0, -r.allocation), 0);

    return {
        rows,
        totals: {
            currentTotal,
            futureTotal,
            contribution,
            targetSum,
            investTotal,
            sellTotal,
            // In contribute mode the whole contribution is always allocated.
            unallocated: mode === 'contribute' ? Math.max(0, contribution - investTotal) : 0
        }
    };
};

/* ================================================================== *
 *  Analítica de decisión
 *  Todo lo que hay aquí existe para responder a una pregunta concreta
 *  del inversor, no para llenar una tarjeta.
 * ================================================================== */

/**
 * Desviación frente a los pesos objetivo.
 *
 * Es la señal que justifica rebalancear: mientras la desviación sea pequeña,
 * mover dinero sólo genera costes y peajes fiscales. Se devuelven dos medidas
 * porque responden a cosas distintas: `maxDrift` avisa de la posición más
 * descolocada y `totalDrift` (la mitad de la suma de desviaciones absolutas)
 * mide qué fracción de la cartera habría que mover para volver al objetivo.
 */
export const computeDrift = (items = []) => {
    // El total sale de las propias posiciones: la desviación en euros no tiene
    // sentido sin saber sobre cuánto patrimonio se aplica.
    const total = items.reduce((s, i) => s + safeFloat(i.value), 0);

    const rows = items
        .map(i => {
            const current = safeFloat(i.currentWeight);
            const target = safeFloat(i.targetWeight);
            const drift = current - target;
            return {
                id: i.id,
                ticker: i.asset?.ticker || i.ticker,
                name: i.asset?.name || i.name || i.asset?.ticker,
                current, target,
                drift,
                absDrift: Math.abs(drift),
                value: safeFloat(i.value),
                // Euros que sobran (+) o faltan (−) frente al objetivo. Es la
                // cifra accionable: "te sobran 3.200 €" se entiende, "te sobran
                // 4,1 pp" hay que traducirlo mentalmente antes de poder actuar.
                amount: (drift / 100) * total,
                absAmount: Math.abs((drift / 100) * total),
            };
        })
        .filter(r => r.target > 0 || r.current > 0)
        .sort((a, b) => b.absDrift - a.absDrift);

    const sumAbs = rows.reduce((s, r) => s + r.absDrift, 0);
    return {
        rows,
        total,
        maxDrift: rows.length ? rows[0].absDrift : 0,
        // Mitad de la suma: cada punto que sobra en un sitio falta en otro, así
        // que contarlos dos veces duplicaría el trabajo real de rebalanceo.
        totalDrift: sumAbs / 2,
        // Dinero que habría que mover para volver al objetivo.
        totalAmount: (sumAbs / 2 / 100) * total,
        worst: rows[0] || null,
    };
};

/** Umbral clásico de la regla 5/25 de Larimore, en puntos porcentuales. */
export const driftBand = (targetPct) => {
    const t = safeFloat(targetPct);
    // Para pesos grandes manda el 5 absoluto; para los pequeños, el 25% relativo.
    return Math.min(5, Math.max(1, t * 0.25));
};

export const driftSeverity = (row) => {
    if (!row) return 'ok';
    const band = driftBand(row.target);
    if (row.absDrift >= band * 1.5) return 'high';
    if (row.absDrift >= band) return 'warn';
    return 'ok';
};

/**
 * Solapamiento entre fondos: qué parte del patrimonio está duplicada.
 *
 * Dos ETF distintos pueden ser casi el mismo producto (un S&P 500 y un MSCI
 * World comparten las mismas megacaps). Detectarlo es una decisión de negocio
 * real: pagar dos comisiones por la misma exposición, o consolidar.
 *
 * `positions` es la respuesta de /portfolio/xray.
 */
export const computeOverlap = (positions = []) => {
    const funds = positions.filter(p => ['ETF', 'Fund'].includes(p.type) && (p.holdings || []).length);
    const pairs = [];

    for (let i = 0; i < funds.length; i++) {
        for (let j = i + 1; j < funds.length; j++) {
            const a = funds[i], b = funds[j];
            const wa = new Map(), wb = new Map();
            for (const h of a.holdings) wa.set((h.symbol || h.name || '').toUpperCase(), safeFloat(h.weight));
            for (const h of b.holdings) wb.set((h.symbol || h.name || '').toUpperCase(), safeFloat(h.weight));

            // Solapamiento = suma de los mínimos de peso en cada emisor común.
            // Es la definición estándar y acota bien: nunca supera el 100%.
            let shared = 0;
            const names = [];
            for (const [sym, w] of wa) {
                if (!sym || !wb.has(sym)) continue;
                const m = Math.min(w, wb.get(sym));
                if (m <= 0) continue;
                shared += m;
                names.push(sym);
            }

            const covA = [...wa.values()].reduce((s, w) => s + w, 0) || 1;
            const covB = [...wb.values()].reduce((s, w) => s + w, 0) || 1;
            // Se normaliza por la cobertura conocida: si de cada fondo sólo se
            // ven las 10 mayores posiciones, comparar contra el 100% del fondo
            // haría parecer que casi no se solapan.
            const pct = (shared / Math.min(covA, covB)) * 100;

            pairs.push({
                key: `${a.ticker}|${b.ticker}`,
                a: { ticker: a.ticker, name: a.name, value: safeFloat(a.value) },
                b: { ticker: b.ticker, name: b.name, value: safeFloat(b.value) },
                pct: Math.max(0, Math.min(100, pct)),
                shared: names.slice(0, 8),
                sharedCount: names.length,
            });
        }
    }

    return pairs.sort((x, y) => y.pct - x.pct);
};

/**
 * Concentración de la cartera mirando a través de los fondos.
 *
 * `effectiveHoldings` (inverso de Herfindahl) responde a "¿entre cuántas
 * empresas está repartido esto de verdad?". Tener 500 posiciones no diversifica
 * si el 35% está en cinco valores.
 */
export const computeConcentration = (companies = []) => {
    if (!companies.length) return { top1: 0, top5: 0, top10: 0, hhi: 0, effectiveHoldings: 0, count: 0 };
    const pcts = companies.map(c => safeFloat(c.pct)).sort((a, b) => b - a);
    const sum = (n) => pcts.slice(0, n).reduce((s, p) => s + p, 0);
    const hhi = pcts.reduce((s, p) => s + (p / 100) ** 2, 0);
    return {
        top1: sum(1), top5: sum(5), top10: sum(10),
        hhi,
        effectiveHoldings: hhi > 0 ? 1 / hhi : 0,
        count: companies.length,
    };
};

/* ------------------------------------------------------------------ *
 *  Plan de aportaciones
 * ------------------------------------------------------------------ */

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Meses completos transcurridos entre dos fechas (puede ser negativo). */
const monthsBetween = (from, to) =>
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

/**
 * Importe que toca aportar en un mes dado según el plan.
 * El crecimiento anual se reparte de forma compuesta mes a mes, igual que en
 * buildContributionSchedule, para que plan y proyección no se contradigan.
 */
export const planAmountFor = (plan, date = new Date()) => {
    if (!plan || safeFloat(plan.monthly) <= 0) return 0;
    const start = plan.startDate ? new Date(plan.startDate) : new Date();
    const m = monthsBetween(start, date);
    if (m < 0) return 0;
    const annualFactor = Math.max(0, 1 + safeFloat(plan.annualGrowthPct) / 100);
    return Math.round(safeFloat(plan.monthly) * Math.pow(Math.pow(annualFactor, 1 / 12), m));
};

/**
 * Estado del plan mes a mes.
 *
 * El check no se marca a mano: se deduce de los rebalanceos ya aplicados. Si en
 * ese mes se aportó al menos lo previsto, cuenta como cumplido. Pedirle al
 * usuario que confirme algo que la app ya sabe es trabajo que sobra.
 */
export const buildPlanStatus = ({ plan, history = [], months = 12, now = new Date() }) => {
    if (!plan || safeFloat(plan.monthly) <= 0) {
        return { rows: [], currentMonth: null, streak: 0, doneCount: 0, contributedTotal: 0, plannedTotal: 0 };
    }

    // Aportado por mes, sumando todos los rebalanceos aplicados en él.
    const byMonth = {};
    for (const h of history) {
        const raw = h.created_at || h.date;
        if (!raw) continue;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) continue;
        const amount = safeFloat(h.contribution ?? h.contribution_amount ?? h.amount);
        if (amount <= 0) continue;
        byMonth[monthKey(d)] = (byMonth[monthKey(d)] || 0) + amount;
    }

    const start = plan.startDate ? new Date(plan.startDate) : now;
    const rows = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        if (monthsBetween(start, d) < 0) continue;
        const planned = planAmountFor(plan, d);
        const contributed = byMonth[monthKey(d)] || 0;
        const isFuture = d > new Date(now.getFullYear(), now.getMonth(), 1);
        const isCurrent = monthKey(d) === monthKey(now);
        // Nadie transfiere 316,42 €: se transfiere 316, o 315. Exigir el importe
        // exacto dejaría el mes sin marcar por céntimos. La tolerancia cubre el
        // redondeo, no un incumplimiento real: un 5% por debajo sigue siendo
        // parcial, que es justo lo que hay que ver.
        const tolerance = Math.max(1, planned * 0.01);
        rows.push({
            key: monthKey(d),
            date: d,
            planned,
            contributed,
            done: planned > 0 && contributed >= planned - tolerance,
            partial: contributed > 0 && contributed < planned - tolerance,
            isCurrent,
            isFuture,
        });
    }

    // Racha: meses consecutivos cumplidos hacia atrás, sin contar el actual si
    // todavía está en curso (aún puede cumplirse).
    let streak = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (r.isCurrent && !r.done) continue;
        if (r.done) streak++;
        else break;
    }

    const past = rows.filter(r => !r.isFuture);
    return {
        rows,
        currentMonth: rows.find(r => r.isCurrent) || null,
        streak,
        doneCount: past.filter(r => r.done).length,
        pastCount: past.length,
        contributedTotal: past.reduce((s, r) => s + r.contributed, 0),
        plannedTotal: past.reduce((s, r) => s + r.planned, 0),
    };
};
