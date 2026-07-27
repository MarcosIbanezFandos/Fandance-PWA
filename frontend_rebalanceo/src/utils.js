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
