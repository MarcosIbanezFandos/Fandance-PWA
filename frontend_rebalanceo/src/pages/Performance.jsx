import React, { useState, useEffect, useMemo } from 'react';
import api from '../api'
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, TrendingDown, Wallet, PiggyBank, Percent, Receipt, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import { GlassCard, staggerContainer, fadeInUp } from '../components/UI';
import { Dropdown } from '../components/Dropdown';
import { BenchmarkCompare } from '../components/BenchmarkCompare';
import { TRCsvParser } from '../components/TRCsvParser';
import { useGlobal } from '../context/GlobalContext';
import { safeFloat, formatNumber, xirr, computeMetricsForPeriod, ttwror } from '../utils';

/* ───── Period definitions ───── */
// Chart periods map to yfinance API periods (kept for chart requests)
const CHART_PERIODS = { 'today': '1d', '1w': '5d', '1m': '1mo', '3m': '3mo', 'ytd': 'ytd', '1y': '1y', 'max': 'max' };
const PERIODS = [
    { id: 'today', label: 'Hoy' },
    { id: '1w',    label: '1S' },
    { id: '1m',    label: '1M' },
    { id: '1y',    label: '1A' },
    { id: 'ytd',   label: 'YTD' },
    { id: 'max',   label: 'Máx' },
];

/* ───── Mini components ───── */
const Badge = ({ value, suffix = '%' }) => {
    if (value === null || value === undefined) return null;
    const up = value >= 0;
    return (
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-black tabular-nums ${up ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400'}`}>
            {up ? '↑' : '↓'} {formatNumber(Math.abs(value), 2)}{suffix}
        </span>
    );
};

const StatRow = ({ label, value, badge, borderTop, borderBottom, bold, tooltip }) => (
    <div className={`flex items-center justify-between py-3 px-1 ${borderTop ? 'border-t border-slate-200 dark:border-slate-700' : ''} ${borderBottom ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
        <div className="flex items-center gap-1.5">
            <span className={`text-[13px] ${bold ? 'font-black text-slate-700 dark:text-slate-200' : 'font-bold text-slate-500 dark:text-slate-400'}`}>{label}</span>
            {tooltip && (
                <span className="group relative">
                    <Info size={12} className="text-slate-300 dark:text-slate-600 cursor-help" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">{tooltip}</span>
                </span>
            )}
        </div>
        <div className="flex items-center gap-2">
            <span className={`text-[13px] tabular-nums ${bold ? 'font-black text-slate-800 dark:text-slate-100' : 'font-bold text-slate-600 dark:text-slate-300'}`}>{value}</span>
            {badge}
        </div>
    </div>
);

export const Performance = ({ portfolios, activePortfolioId }) => {
    const { t } = useGlobal();
    const [pid, setPid] = useState('');
    const [items, setItems] = useState([]);
    const [history, setHistory] = useState([]);
    const [evolution, setEvolution] = useState([]);
    const [period, setPeriod] = useState('ytd');
    const [loading, setLoading] = useState(false);
    const [csvMetrics, setCsvMetrics] = useState(null);

    // Pick a default portfolio
    useEffect(() => {
        if (!pid) {
            if (activePortfolioId) setPid(activePortfolioId);
            else if (portfolios.length) setPid(portfolios[0].id);
        }
    }, [portfolios, activePortfolioId]);

    useEffect(() => {
        if (!pid) return;
        const savedCsv = localStorage.getItem(`perf_csv_${pid}`);
        if (savedCsv) {
            try { 
                const parsed = JSON.parse(savedCsv);
                if (parsed && parsed.transactions) {
                    setCsvMetrics(parsed); 
                } else {
                    setCsvMetrics(null);
                    localStorage.removeItem(`perf_csv_${pid}`);
                }
            } catch (e) { }
        } else { setCsvMetrics(null); }
    }, [pid]);

    useEffect(() => { 
        if (pid) {
            if (csvMetrics) localStorage.setItem(`perf_csv_${pid}`, JSON.stringify(csvMetrics));
            else localStorage.removeItem(`perf_csv_${pid}`);
        }
    }, [csvMetrics, pid]);

    useEffect(() => {
        if (!pid) return;
        const load = async () => {
            setLoading(true);
            try {
                const [itemsRes, histRes] = await Promise.all([
                    api.get(`${import.meta.env.VITE_API_URL}/portfolio/${pid}?t=${Date.now()}`),
                    api.get(`${import.meta.env.VITE_API_URL}/portfolio/history/${pid}?t=${Date.now()}`),
                ]);
                setItems(itemsRes.data || []);
                setHistory(histRes.data || []);
            } catch (e) { setItems([]); setHistory([]); }
            finally { setLoading(false); }
        };
        load();
    }, [pid]);

    // Evolution chart (value over time)
    useEffect(() => {
        if (!pid) return;
        const load = async () => {
            try {
                const chartPeriod = CHART_PERIODS[period] || 'max';
                const res = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/history_chart`, { portfolio_id: pid, period: chartPeriod });
                const hist = (res.data?.history || []).map(p => ({
                    value: safeFloat(p.value),
                    date: new Date(p.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
                    full: new Date(p.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }),
                }));
                setEvolution(hist);
            } catch (e) { setEvolution([]); }
        };
        load();
    }, [pid, period]);

    // Current portfolio value
    const currentValue = useMemo(() => items.reduce((s, i) => s + safeFloat(i.value), 0), [items]);

    // Period-filtered metrics from CSV data
    const periodMetrics = useMemo(() => {
        if (!csvMetrics?.transactions?.length) return null;
        // Reconstruct transactions from the stored data (dates are serialized as strings)
        const txns = csvMetrics.transactions.map(t => ({
            ...t,
            date: new Date(t.date),
        }));
        return computeMetricsForPeriod(txns, currentValue, period);
    }, [csvMetrics, currentValue, period]);

    // TTWROR from chart evolution data
    const ttwrorValue = useMemo(() => ttwror(evolution), [evolution]);

    // Legacy metrics from rebalance history (fallback when no CSV)
    const legacyMetrics = useMemo(() => {
        const invested = history.reduce((s, h) => s + safeFloat(h.contribution), 0);
        const gain = currentValue - invested;
        const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
        const flows = history
            .map(h => ({ amount: -safeFloat(h.contribution), date: new Date(h.created_at) }))
            .sort((a, b) => a.date - b.date);
        if (currentValue > 0) flows.push({ amount: currentValue, date: new Date() });
        const rate = xirr(flows);
        const tir = rate === null ? null : rate * 100;
        const startDate = history.length
            ? new Date(Math.min(...history.map(h => new Date(h.created_at).getTime())))
            : null;
        return { currentValue, invested, gain, gainPct, tir, startDate };
    }, [items, history, currentValue]);

    const hasCsv = !!periodMetrics;
    const up = hasCsv ? (periodMetrics.totalGross >= 0) : (legacyMetrics.gain >= 0);

    // Period start date for display
    const periodStartLabel = useMemo(() => {
        const now = new Date();
        let d;
        switch (period) {
            case 'today': d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
            case '1w': d = new Date(now.getTime() - 7 * 86400000); break;
            case '1m': d = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
            case '3m': d = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
            case 'ytd': d = new Date(now.getFullYear(), 0, 1); break;
            case '1y': d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
            default: d = csvMetrics?.firstPurchase ? new Date(csvMetrics.firstPurchase) : null;
        }
        return d ? d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;
    }, [period, csvMetrics]);

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
            {/* Selector + period */}
            <GlassCard className="!p-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-40">
                <Dropdown
                    className="w-full md:w-64"
                    value={pid}
                    onChange={setPid}
                    options={portfolios.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="—"
                />
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-wrap justify-center">
                    {PERIODS.map(opt => (
                        <button key={opt.id} onClick={() => setPeriod(opt.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${period === opt.id ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </GlassCard>

            {!pid ? (
                <div className="text-center text-slate-400 font-bold py-16">{t('perf.select_portfolio')}</div>
            ) : loading ? (
                <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
            ) : (
                <>
                    {/* HERO: value + gain */}
                    <motion.div variants={fadeInUp}>
                        <GlassCard className="text-center py-8 relative">
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{t('perf.title')}</div>
                            {periodStartLabel && (
                                <div className="text-[11px] font-bold text-slate-400 mb-3">
                                    {t('perf.period_since')} {periodStartLabel}
                                </div>
                            )}
                            <div className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">{formatNumber(currentValue, 2)} €</div>
                            {hasCsv && (
                                <div className={`mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-black ${up ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400'}`}>
                                    {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {up ? '+' : ''}{formatNumber(periodMetrics.totalGross, 2)} € ({up ? '+' : ''}{periodMetrics.priceGainsPct}%)
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>

                    {/* Trade Republic CSV import */}
                    <GlassCard>
                        <div className="flex items-center gap-2 mb-3">
                            <Receipt size={15} className="text-slate-400" />
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('tr.title')}</h3>
                        </div>
                        <TRCsvParser
                            currentValue={currentValue}
                            onParsed={setCsvMetrics}
                            onClear={() => setCsvMetrics(null)}
                            hasData={!!csvMetrics}
                        />
                        {csvMetrics?.firstPurchase && (
                            <div className="mt-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">
                                {t('tr.since_first')}: {new Date(csvMetrics.firstPurchase).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                        )}
                    </GlassCard>

                    {/* ═══ PARQET-STYLE STATS ═══ */}
                    {hasCsv && (
                        <motion.div variants={fadeInUp}>
                            {/* Top KPI cards — 2x2 on mobile, 4 on desktop */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                <GlassCard className="!p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('perf.portfolio_value')}</div>
                                    <div className="text-lg font-black text-slate-800 dark:text-white tabular-nums">{formatNumber(periodMetrics.portfolioValue, 2)} €</div>
                                </GlassCard>
                                <GlassCard className="!p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('perf.invested')}</div>
                                    <div className="text-lg font-black text-slate-800 dark:text-white tabular-nums">{formatNumber(periodMetrics.invested, 2)} €</div>
                                </GlassCard>
                                <GlassCard className="!p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('perf.cashflow')}</div>
                                    <div className="text-lg font-black text-slate-800 dark:text-white tabular-nums">{formatNumber(periodMetrics.cashFlow, 2)} €</div>
                                </GlassCard>
                                <GlassCard className="!p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('perf.cost_basis')}</div>
                                    <div className="text-lg font-black text-slate-800 dark:text-white tabular-nums">{formatNumber(periodMetrics.costBasis, 2)} €</div>
                                </GlassCard>
                            </div>

                            {/* TIR + TTWROR cards */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <GlassCard className="!p-4">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TIR</div>
                                        <span className="group relative">
                                            <Info size={11} className="text-slate-300 dark:text-slate-600 cursor-help" />
                                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">{t('perf.tir_hint')}</span>
                                        </span>
                                    </div>
                                    <div className={`text-xl font-black tabular-nums ${periodMetrics.tir !== null && periodMetrics.tir >= 0 ? 'text-emerald-600 dark:text-emerald-400' : periodMetrics.tir !== null ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500'}`}>
                                        <Badge value={periodMetrics.tir} />
                                    </div>
                                </GlassCard>
                                <GlassCard className="!p-4">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('perf.ttwror')}</div>
                                        <span className="group relative">
                                            <Info size={11} className="text-slate-300 dark:text-slate-600 cursor-help" />
                                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">{t('perf.ttwror_hint')}</span>
                                        </span>
                                    </div>
                                    <div className={`text-xl font-black tabular-nums`}>
                                        {ttwrorValue !== null ? <Badge value={ttwrorValue} /> : <span className="text-slate-400">—</span>}
                                    </div>
                                </GlassCard>
                            </div>

                            {/* Detailed breakdown — Parqet-style list */}
                            <GlassCard>
                                <StatRow label={t('perf.price_gains')} borderBottom
                                    value={<span className={periodMetrics.priceGains >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}>{formatNumber(periodMetrics.priceGains, 2)} €</span>}
                                    badge={<Badge value={periodMetrics.priceGainsPct} />}
                                />
                                <StatRow label={t('perf.realized')} borderBottom
                                    value={<span className={periodMetrics.realizedGross >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}>{formatNumber(periodMetrics.realizedGross, 2)} €</span>}
                                    badge={<Badge value={periodMetrics.realizedPct} />}
                                />
                                <StatRow label={t('perf.dividends')} borderBottom
                                    value={`${formatNumber(periodMetrics.dividends, 2)} €`}
                                    badge={periodMetrics.dividends > 0 ? <Badge value={periodMetrics.dividendPct} /> : <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">0,00 %</span>}
                                />
                                <StatRow label={t('perf.interest')} borderBottom
                                    value={<span className={periodMetrics.interest > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}>{formatNumber(periodMetrics.interest, 2)} €</span>}
                                    badge={periodMetrics.interest > 0 ? <Badge value={periodMetrics.interestPct} /> : null}
                                />

                                {/* Total gross */}
                                <StatRow label={t('perf.total_gross')} bold borderTop borderBottom
                                    value={<span className={periodMetrics.totalGross >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}>{formatNumber(periodMetrics.totalGross, 2)} €</span>}
                                />

                                {/* Taxes + fees */}
                                <StatRow label={t('perf.taxes')} borderBottom
                                    value={`${formatNumber(periodMetrics.taxes, 2)} €`}
                                />
                                <StatRow label={t('perf.fees')} borderBottom
                                    value={`${formatNumber(periodMetrics.fees, 2)} €`}
                                />

                                {/* Net total */}
                                <StatRow label={t('perf.net_total')} bold borderTop
                                    value={<span className={`text-lg ${periodMetrics.netTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{formatNumber(periodMetrics.netTotal, 2)} €</span>}
                                />
                            </GlassCard>
                        </motion.div>
                    )}

                    {/* Legacy stats (when no CSV imported) */}
                    {!hasCsv && history.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <GlassCard>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('perf.invested')}</div>
                                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tabular-nums">{formatNumber(legacyMetrics.invested, 2)} €</div>
                            </GlassCard>
                            <GlassCard>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('perf.gain')}</div>
                                <div className={`text-2xl font-black tabular-nums ${legacyMetrics.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{legacyMetrics.gain >= 0 ? '+' : ''}{formatNumber(legacyMetrics.gain, 2)} €</div>
                                <div className="text-[11px] font-bold text-slate-400 mt-1">{legacyMetrics.gain >= 0 ? '+' : ''}{formatNumber(legacyMetrics.gainPct, 2)}%</div>
                            </GlassCard>
                            <GlassCard>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TIR</div>
                                <div className={`text-2xl font-black tabular-nums ${legacyMetrics.tir !== null && legacyMetrics.tir >= 0 ? 'text-emerald-600 dark:text-emerald-400' : legacyMetrics.tir !== null ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500'}`}>
                                    {legacyMetrics.tir !== null ? `${legacyMetrics.tir >= 0 ? '+' : ''}${formatNumber(legacyMetrics.tir, 2)}%` : '—'}
                                </div>
                                <div className="text-[11px] font-bold text-slate-400 mt-1">{t('perf.tir_hint')}</div>
                            </GlassCard>
                            <GlassCard>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('perf.simple_return')}</div>
                                <div className={`text-2xl font-black tabular-nums ${legacyMetrics.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{legacyMetrics.gain >= 0 ? '+' : ''}{formatNumber(legacyMetrics.gainPct, 2)}%</div>
                            </GlassCard>
                        </div>
                    )}

                    {!hasCsv && !history.length && (
                        <div className="text-center text-slate-400 font-bold py-10 px-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">{t('perf.no_data')}</div>
                    )}

                    {/* Evolution chart */}
                    {evolution.length > 1 && (
                        <GlassCard>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('perf.evolution')}</div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={evolution} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={up ? '#10b981' : '#f43f5e'} stopOpacity={0.25} />
                                                <stop offset="95%" stopColor={up ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={40} axisLine={false} tickLine={false} />
                                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} width={45} axisLine={false} tickLine={false} tickFormatter={(v) => `${formatNumber(v)}`} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.2)', background: '#0f172a' }}
                                            labelStyle={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}
                                            itemStyle={{ fontSize: '13px', color: '#fff', fontWeight: 900 }}
                                            formatter={(v) => [`${formatNumber(v, 2)} €`, '']}
                                            labelFormatter={(label, p) => p[0]?.payload?.full || label}
                                        />
                                        <Area type="monotone" dataKey="value" stroke={up ? '#10b981' : '#f43f5e'} strokeWidth={2.5} fill="url(#perfGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    )}

                    {/* Benchmark comparison */}
                    <BenchmarkCompare holdings={items.map(i => ({ ticker: i.asset?.ticker, units: i.units_held }))} period={CHART_PERIODS[period] || 'max'} />
                </>
            )}
        </motion.div>
    );
};
