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

export const formatCurrency = (amount, decimals = 0) => {
    return safeFloat(amount).toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
    });
};

// Number formatted with grouping but no currency symbol.
export const formatNumber = (amount, decimals = 0) => {
    return safeFloat(amount).toLocaleString('es-ES', {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
    });
};

// Units: adaptive precision (crypto needs more decimals than shares).
export const formatUnits = (units) => {
    const n = safeFloat(units);
    const abs = Math.abs(n);
    const decimals = abs === 0 ? 0 : abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
    return n.toLocaleString('es-ES', { maximumFractionDigits: decimals });
};

/**
 * Aggregate a portfolio X-ray from per-position look-through data.
 *
 * Returns { total, companies, countries, currencies, sectors, regions }.
 */

const COUNTRY_TO_REGION = {
    'United States': 'North America', 'Canada': 'North America', 'Mexico': 'Latin America',
    'United Kingdom': 'Europe', 'France': 'Europe', 'Germany': 'Europe', 'Netherlands': 'Europe',
    'Switzerland': 'Europe', 'Spain': 'Europe', 'Italy': 'Europe', 'Belgium': 'Europe',
    'Portugal': 'Europe', 'Austria': 'Europe', 'Ireland': 'Europe', 'Finland': 'Europe',
    'Sweden': 'Europe', 'Norway': 'Europe', 'Denmark': 'Europe',
    'Europe (diversified)': 'Europe',
    'Japan': 'Asia-Pacific', 'Australia': 'Asia-Pacific', 'Hong Kong': 'Asia-Pacific',
    'Singapore': 'Asia-Pacific', 'Taiwan': 'Asia-Pacific', 'South Korea': 'Asia-Pacific',
    'Asia-Pacific (diversified)': 'Asia-Pacific',
    'China': 'Emerging Markets', 'India': 'Emerging Markets', 'Brazil': 'Emerging Markets',
    'South Africa': 'Emerging Markets', 'Emerging Markets': 'Emerging Markets',
    'Global (diversified)': 'Global', 'Global small cap (diversified)': 'Global',
};

export const buildXray = (positions, filterTicker = null) => {
    const list = (positions || []).filter(p => !filterTicker || p.ticker === filterTicker);
    const total = list.reduce((s, p) => s + safeFloat(p.value), 0);

    const companies = new Map();
    const countries = {};
    const currencies = {};
    const sectors = {};
    const regions = {};

    const addCompany = (key, name, symbol, val, sourceTicker) => {
        const c = companies.get(key) || { key, name, symbol, value: 0, sources: new Set(), other: false };
        c.value += val;
        if (sourceTicker) c.sources.add(sourceTicker);
        companies.set(key, c);
    };

    for (const p of list) {
        const value = safeFloat(p.value);
        let covered = 0;

        for (const h of (p.holdings || [])) {
            const val = value * safeFloat(h.weight);
            if (val <= 0) continue;
            covered += val;
            const key = (h.symbol || h.name || '').toUpperCase();
            addCompany(key, h.name || h.symbol, h.symbol, val, p.ticker);
            const country = h.country || 'Other';
            const currency = h.currency || 'USD';
            if (!/diversified|Emerging|Global|Europe|North America|Asia|Latin|Africa|Pacific/i.test(country)) {
                countries[country] = (countries[country] || 0) + val;
            }
            currencies[currency] = (currencies[currency] || 0) + val;
            const region = COUNTRY_TO_REGION[country] || 'Other';
            regions[region] = (regions[region] || 0) + val;
        }

        // Redistribute remainder proportionally across known holdings
        // instead of creating an "Otros de X" bucket
        const rem = value - covered;
        if (rem > 0.5 && (p.holdings || []).length > 0) {
            const holdingTotal = (p.holdings || []).reduce((s, h) => s + safeFloat(h.weight), 0);
            if (holdingTotal > 0) {
                for (const h of (p.holdings || [])) {
                    const fraction = safeFloat(h.weight) / holdingTotal;
                    const extra = rem * fraction;
                    const key = (h.symbol || h.name || '').toUpperCase();
                    addCompany(key, h.name || h.symbol, h.symbol, extra, p.ticker);
                    const country = h.country || 'Other';
                    const currency = h.currency || 'USD';
                    if (!/diversified|Emerging|Global|Europe|North America|Asia|Latin|Africa|Pacific/i.test(country)) {
                        countries[country] = (countries[country] || 0) + extra;
                    }
                    currencies[currency] = (currencies[currency] || 0) + extra;
                    const region = COUNTRY_TO_REGION[country] || 'Other';
                    regions[region] = (regions[region] || 0) + extra;
                }
            } else {
                // No holdings at all — attribute to the ETF's region
                const region = p.region || 'Global (diversified)';
                const cur = p.currency || 'USD';
                if (!/diversified|Emerging|Global|Europe|North America|Asia|Latin|Africa|Pacific/i.test(region)) {
                    countries[region] = (countries[region] || 0) + rem;
                }
                currencies[cur] = (currencies[cur] || 0) + rem;
                const reg = COUNTRY_TO_REGION[region] || 'Other';
                regions[reg] = (regions[reg] || 0) + rem;
            }
        } else if (rem > 0.5) {
            // Position with no holdings at all (shouldn't happen for stocks)
            const region = p.region || 'Global (diversified)';
            const cur = p.currency || 'USD';
            if (!/diversified|Emerging|Global|Europe|North America|Asia|Latin|Africa|Pacific/i.test(region)) {
                countries[region] = (countries[region] || 0) + rem;
            }
            currencies[cur] = (currencies[cur] || 0) + rem;
            const reg = COUNTRY_TO_REGION[region] || 'Other';
            regions[reg] = (regions[reg] || 0) + rem;
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

    const toSorted = (obj) => Object.entries(obj)
        .map(([key, value]) => ({ key, name: key, value, pct: total > 0 ? (value / total) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);

    const companyList = [...companies.values()]
        .map(c => ({ ...c, sources: [...c.sources], pct: total > 0 ? (c.value / total) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);

    return {
        total,
        companies: companyList,
        countries: toSorted(countries),
        currencies: toSorted(currencies),
        sectors: toSorted(sectors),
        regions: toSorted(regions),
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
        taxes: roundTo(periodTaxes, 2),
        fees: roundTo(periodFees, 2),
        netTotal: roundTo(totalGross - periodTaxes - periodFees, 2),
        firstPurchase: firstBuy,
        portfolioValue: roundTo(currentValue, 2),
        costBasis: roundTo(costBasisNow, 2),
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
