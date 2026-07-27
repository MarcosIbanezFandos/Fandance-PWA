// Default target allocation for the app owner.
//
// Mirrors the Indexa Capital "aggressive equity" model portfolio (the same
// Vanguard index funds held through Trade Republic). The owner can load these
// as the default targets with one click; they also seed automatically when a
// brand-new portfolio has no targets set yet.
//
// NOTE: this is public, non-sensitive configuration (just an asset mix). It is
// intentionally NOT the owner's balances — only the target percentages.

// Configurable so a fork can point the "owner defaults" at their own account
// via VITE_ADMIN_EMAIL, without changing code.
export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'marcosibanezfandos@gmail.com').toLowerCase();

// Weights taken from Indexa's model (equities add up to 99.5%; Indexa keeps the
// remaining 0.5% as cash, which Fandance does not model as an asset).
export const ADMIN_DEFAULT_TARGETS = [
    { key: 'us',       label: 'US 500',           weight: 44.2, match: ['u.s. 500', 'us 500', 's&p 500', 'sp 500', '500 stk', 'us500', 'vanguard u.s'] },
    { key: 'europe',   label: 'Europe',           weight: 27.1, match: ['european', 'europe', 'europa'] },
    { key: 'emerging', label: 'Emerging Markets', weight: 10.7, match: ['emrg', 'emerging', 'emergent', 'emerg'] },
    { key: 'smallcap', label: 'Global Small Cap', weight: 10.0, match: ['small cap', 'small-cap', 'smallcap', 'pequeña', 'small'] },
    { key: 'japan',    label: 'Japan',            weight: 7.5,  match: ['japan', 'japón', 'japon'] },
];

export const isAdmin = (email) => (email || '').toLowerCase() === ADMIN_EMAIL;

// Sum of the default targets (≈ 99.5). Used to decide "balanced" tolerance.
export const ADMIN_DEFAULT_SUM = ADMIN_DEFAULT_TARGETS.reduce((s, t) => s + t.weight, 0);

/**
 * Map the default weights onto a list of portfolio items.
 * Tries to match each fund by name/ticker keywords; if nothing matches
 * (assets named differently) it falls back to applying by position.
 * Returns a NEW array of items with updated target_weight.
 */
export const applyDefaultTargets = (items) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return list;

    const used = new Set();
    let matchedAny = false;

    const byMatch = list.map((i) => {
        const hay = `${i.asset?.name || ''} ${i.asset?.ticker || ''}`.toLowerCase();
        const found = ADMIN_DEFAULT_TARGETS.find(
            (t) => !used.has(t.key) && t.match.some((m) => hay.includes(m))
        );
        if (found) {
            used.add(found.key);
            matchedAny = true;
            return { ...i, target_weight: found.weight };
        }
        return { ...i, target_weight: 0 };
    });

    if (matchedAny) return byMatch;

    // Fallback: assign in order to the first N assets.
    return list.map((i, idx) =>
        idx < ADMIN_DEFAULT_TARGETS.length
            ? { ...i, target_weight: ADMIN_DEFAULT_TARGETS[idx].weight }
            : { ...i, target_weight: 0 }
    );
};
