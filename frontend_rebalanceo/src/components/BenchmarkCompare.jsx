import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api'
import { AnimatePresence, motion } from 'framer-motion';
import { Scale, Activity, ChevronDown, Check, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GlassCard, ChartSkeleton } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { safeFloat, formatNumber } from '../utils';

const BENCHMARKS = [
    { ticker: '^GSPC', label: 'S&P 500' },
    { ticker: 'URTH', label: 'MSCI World' },
    { ticker: '^IXIC', label: 'Nasdaq 100' },
    { ticker: '^STOXX50E', label: 'Euro Stoxx 50' },
    { ticker: 'EEM', label: 'Emerging Mkts' },
    { ticker: 'GLD', label: 'Gold' },
    { ticker: 'BTC-EUR', label: 'Bitcoin' },
    { ticker: 'AGG', label: 'US Bonds' },
];
const COLORS = ['#f59e0b', '#10b981', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#a3a3a3'];

const signCls = (v) => v > 0 ? 'text-emerald-600 dark:text-emerald-400' : v < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-ink-3';
const pct = (v) => (v === undefined || v === null) ? '—' : `${v > 0 ? '+' : ''}${formatNumber(v, 2)}%`;

/**
 * Read one relative metric out of the API payload.
 * Returns { kind: 'value' | 'insufficient' | 'error', value? } — never a raw
 * number that could be NaN/Infinity.
 */
const relState = (rel, key) => {
    const v = rel ? rel[key] : undefined;
    if (typeof v === 'number' && Number.isFinite(v)) return { kind: 'value', value: v };
    return { kind: rel && rel.status === 'not_computable' ? 'error' : 'insufficient' };
};

const betaNoteKey = (v) => v < 0 ? 'bench.beta_inverse'
    : v > 1.05 ? 'bench.beta_amplify'
        : v >= 0.95 ? 'bench.beta_inline'
            : 'bench.beta_damp';

const corrNoteKey = (v) => v < 0 ? 'bench.corr_inverse'
    : v >= 0.8 ? 'bench.corr_strong'
        : v >= 0.5 ? 'bench.corr_moderate'
            : 'bench.corr_weak';

/**
 * Subtle inline benchmark picker: reads as underlined text, not as a form
 * control, so it doesn't compete with the chips that drive the chart.
 */
const InlineSelect = ({ value, options, onChange, label }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const current = options.find(o => o.value === value);

    return (
        <span className="relative inline-block align-baseline" ref={ref}>
            <button
                type="button"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
                className="inline-flex items-center gap-1 font-semibold text-ink-2 border-b border-dashed border-line-strong hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-400 focus:outline-none focus-visible:text-indigo-600 transition-colors"
            >
                {current ? current.label : '—'}
                <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        key="benchref-menu"
                        role="listbox"
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        className="absolute z-[70] left-0 mt-2 w-max min-w-[160px] max-w-[240px] bg-surface border border-line rounded-card shadow-pop overflow-hidden py-1.5"
                    >
                        {options.map(o => {
                            const active = o.value === value;
                            return (
                                <button
                                    key={o.value}
                                    role="option"
                                    aria-selected={active}
                                    onClick={() => { onChange(o.value); setOpen(false); }}
                                    className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-3 transition-colors ${active ? 'bg-brand-soft' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                >
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                                        <span className={`text-footnote font-bold truncate ${active ? 'text-brand' : 'text-ink'}`}>{o.label}</span>
                                    </span>
                                    {active && <Check size={14} className="text-brand shrink-0" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </span>
    );
};

const MetricTile = ({ title, state, valueCls, note, warn, t }) => (
    <div className="flex-1 min-w-[150px] rounded-card bg-surface border border-line px-4 py-3">
        <div className="flex items-center gap-1.5">
            <span className="text-caption2 font-semibold text-ink-3">{title}</span>
            {warn && <Info size={12} className="text-amber-500 shrink-0" />}
        </div>
        {state.kind === 'value' ? (
            <p className={`mt-1 text-title1 font-semibold tabular-nums ${valueCls}`}>{formatNumber(state.value, 2)}</p>
        ) : (
            <p className="mt-1.5 text-subhead font-semibold text-ink-3">
                {t(state.kind === 'error' ? 'bench.rel_not_computable' : 'bench.rel_insufficient')}
            </p>
        )}
        <p className={`mt-1 text-caption1 font-bold leading-snug ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-ink-3'}`}>{note}</p>
    </div>
);

export const BenchmarkCompare = ({ holdings, period }) => {
    const { t } = useGlobal();
    const [selected, setSelected] = useState(['^GSPC', 'URTH']);
    const [refTicker, setRefTicker] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const holdingsKey = JSON.stringify(holdings);
    const list = useMemo(
        () => (holdings || []).filter(h => h.ticker && safeFloat(h.units) > 0),
        [holdingsKey]
    );
    const hasHoldings = list.length > 0;

    useEffect(() => {
        if (!hasHoldings || selected.length === 0) { setData(null); return; }
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const res = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/benchmark`,
                    { holdings: list, benchmarks: selected, period }, { timeout: 60000 });
                if (!cancelled) setData(res.data);
            } catch (e) { if (!cancelled) setData(null); }
            finally { if (!cancelled) setLoading(false); }
        };
        run();
        return () => { cancelled = true; };
    }, [holdingsKey, period, selected.join(',')]);

    const toggle = (ticker) => setSelected(s => s.includes(ticker) ? s.filter(x => x !== ticker) : [...s, ticker].slice(0, 6));

    const colorFor = (ticker) => COLORS[selected.indexOf(ticker) % COLORS.length];
    const labelFor = (ticker) => data?.labels?.[ticker] || BENCHMARKS.find(b => b.ticker === ticker)?.label || ticker;
    const rows = data?.stats ? ['portfolio', ...selected.filter(s => data.stats[s])] : [];

    // Reference index for the relative block. The user's pick wins while it is
    // still active up top; otherwise we fall back to the first one they turned on.
    const activeRef = selected.includes(refTicker) ? refTicker : (selected[0] || null);
    const rel = activeRef ? data?.relative?.[activeRef] : null;
    const beta = relState(rel, 'beta');
    const corr = relState(rel, 'correlation');

    const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });

    // --- Relative metrics section ---
    let relativeSection = null;
    if (hasHoldings && selected.length === 0) {
        relativeSection = (
            <div className="mt-5 rounded-card border border-dashed border-line px-5 py-6 text-center">
                <p className="text-footnote font-bold text-ink-3">{t('bench.rel_empty')}</p>
            </div>
        );
    } else if (hasHoldings && !loading && data && activeRef) {
        const unavailable = beta.kind !== 'value' && corr.kind !== 'value';
        relativeSection = (
            <div className="mt-5 rounded-card bg-surface-2/70 border border-line p-5">
                <div className="flex items-center gap-2">
                    <Activity size={15} className="text-ink-3" />
                    <h4 className="text-footnote font-semibold text-ink-2">{t('bench.rel_title')}</h4>
                </div>

                {/* <div>, not <p>: the picker's popup is a block element. */}
                <div className="mt-1.5 mb-4 text-caption1 font-medium text-ink-3">
                    {t('bench.rel_ref')}:{' '}
                    {selected.length > 1 ? (
                        <InlineSelect
                            value={activeRef}
                            onChange={setRefTicker}
                            label={t('bench.rel_change')}
                            options={selected.map(s => ({ value: s, label: labelFor(s), color: colorFor(s) }))}
                        />
                    ) : (
                        <span className="font-semibold text-ink-2">{labelFor(activeRef)}</span>
                    )}
                </div>

                <div className="flex flex-wrap gap-3">
                    <MetricTile
                        t={t}
                        title={t('bench.beta_long')}
                        state={beta}
                        warn={beta.kind === 'value' && beta.value < 0}
                        valueCls={beta.kind === 'value' && beta.value < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-ink'}
                        note={beta.kind === 'value' ? t(betaNoteKey(beta.value)) : t(beta.kind === 'error' ? 'bench.rel_why_error' : 'bench.rel_why_insufficient')}
                    />
                    <MetricTile
                        t={t}
                        title={t('bench.corr_long')}
                        state={corr}
                        warn={corr.kind === 'value' && corr.value < 0}
                        valueCls={corr.kind === 'value' && corr.value < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-ink'}
                        note={corr.kind === 'value' ? t(corrNoteKey(corr.value)) : t(corr.kind === 'error' ? 'bench.rel_why_error' : 'bench.rel_why_insufficient')}
                    />
                </div>

                {!unavailable && rel?.points > 0 && (
                    <p className="mt-3 text-caption2 font-bold text-ink-3">{formatNumber(rel.points)} {t('bench.rel_points')}</p>
                )}
            </div>
        );
    }

    return (
        <GlassCard>
            <div className="flex items-center gap-2 mb-2">
                <Scale size={15} className="text-ink-3" />
                <h3 className="text-footnote font-semibold text-ink-3">{t('bench.title')}</h3>
            </div>
            <p className="text-caption1 font-medium text-ink-3 mb-4">{t('bench.hint')}</p>

            {/* Benchmark chips */}
            <div className="flex flex-wrap gap-2 mb-5">
                {BENCHMARKS.map(b => {
                    const on = selected.includes(b.ticker);
                    return (
                        <button key={b.ticker} onClick={() => toggle(b.ticker)}
                            className={`px-3 py-1.5 rounded-control text-caption1 font-semibold uppercase tracking-wide transition-all border ${on ? 'text-white border-transparent' : 'bg-surface-2 text-ink-3 border-line hover:text-slate-700 dark:hover:text-slate-200'}`}
                            style={on ? { backgroundColor: colorFor(b.ticker) } : undefined}>
                            {b.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <ChartSkeleton height="h-72" />
            ) : !data || !data.series || data.series.length === 0 ? (
                <>
                    <div className="h-40 flex items-center justify-center text-subhead font-bold text-ink-3">
                        {selected.length === 0 ? t('bench.select_hint') : t('bench.no_data')}
                    </div>
                    {relativeSection}
                </>
            ) : (
                <>
                    {/* Overlay chart */}
                    <div className="h-72 -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.15} />
                                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={40} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={38} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.3)', background: '#0f172a' }}
                                    labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                                    itemStyle={{ fontSize: 12, fontWeight: 800 }}
                                    labelFormatter={(v) => new Date(v).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    formatter={(val, key) => [`${formatNumber(val, 1)}`, key === 'portfolio' ? t('bench.your_portfolio') : labelFor(key)]}
                                />
                                <Legend formatter={(key) => key === 'portfolio' ? t('bench.your_portfolio') : labelFor(key)} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                                <Line type="monotone" dataKey="portfolio" name="portfolio" stroke="#6366f1" strokeWidth={3} dot={false} isAnimationActive={false} />
                                {selected.map(b => data.series[0][b] !== undefined && (
                                    <Line key={b} type="monotone" dataKey={b} name={b} stroke={colorFor(b)} strokeWidth={2} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Absolute stats table */}
                    <div className="scroll-x mt-4">
                        <table className="w-full text-left min-w-[440px]">
                            <thead className="text-caption2 font-semibold text-ink-3 border-b border-line">
                                <tr>
                                    <th className="py-3 pr-2">{t('bench.asset')}</th>
                                    <th className="py-3 px-2 text-right">{t('bench.return')}</th>
                                    <th className="py-3 px-2 text-right">{t('bench.cagr')}</th>
                                    <th className="py-3 px-2 text-right">{t('bench.vol')}</th>
                                    <th className="py-3 pl-2 text-right">{t('bench.maxdd')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {rows.map(key => {
                                    const s = data.stats[key];
                                    if (!s) return null;
                                    const isPort = key === 'portfolio';
                                    return (
                                        <tr key={key} className={isPort ? 'bg-brand-soft/50' : ''}>
                                            <td className="py-3 pr-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: isPort ? '#6366f1' : colorFor(key) }} />
                                                    <span className={`text-footnote font-semibold ${isPort ? 'text-brand' : 'text-ink'}`}>{isPort ? t('bench.your_portfolio') : labelFor(key)}</span>
                                                </div>
                                            </td>
                                            <td className={`py-3 px-2 text-right text-footnote font-semibold tabular-nums ${signCls(s.return_pct)}`}>{pct(s.return_pct)}</td>
                                            <td className={`py-3 px-2 text-right text-footnote font-bold tabular-nums ${signCls(s.cagr)}`}>{pct(s.cagr)}</td>
                                            <td className="py-3 px-2 text-right text-footnote font-bold tabular-nums text-ink-2">{formatNumber(s.volatility, 1)}%</td>
                                            <td className="py-3 pl-2 text-right text-footnote font-bold tabular-nums text-rose-500 dark:text-rose-400">{formatNumber(s.max_drawdown, 1)}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {relativeSection}
                </>
            )}
        </GlassCard>
    );
};
