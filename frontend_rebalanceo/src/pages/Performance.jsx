import React, { useState, useEffect, useMemo } from 'react';
import api from '../api'
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, TrendingDown, Wallet, PiggyBank, Percent, Receipt, Info, ArrowUpRight, ArrowDownRight, Upload, RefreshCw, CheckCircle2 } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import { GlassCard, staggerContainer, fadeInUp } from '../components/UI';
import { Dropdown } from '../components/Dropdown';
import { BenchmarkCompare } from '../components/BenchmarkCompare';
import { TRCsvParser } from '../components/TRCsvParser';
import { useGlobal } from '../context/GlobalContext';
import { safeFloat, formatNumber, xirr, computeMetricsForPeriod, ttwror, formatSeriesDates } from '../utils';

/* ───── Period definitions ───── */
// Chart periods map to yfinance API periods (kept for chart requests)
const CHART_PERIODS = { 'today': '1d', '1w': '5d', '1m': '1mo', '3m': '3mo', 'ytd': 'ytd', '1y': '1y', 'max': 'max' };
const PERIODS = [
    { id: 'today', label: 'Hoy' },
    { id: '1w',    label: '1S' },
    { id: '1m',    label: '1M' },
    { id: '3m',    label: '3M' },
    { id: '1y',    label: '1A' },
    { id: 'ytd',   label: 'YTD' },
    { id: 'max',   label: 'Máx' },
];

/* ───── Mini components ───── */
const Badge = ({ value, suffix = '%' }) => {
    if (value === null || value === undefined) return null;
    const up = value >= 0;
    return (
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-caption1 font-semibold tabular-nums ${up ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400'}`}>
            {up ? '↑' : '↓'} {formatNumber(Math.abs(value), 2)}{suffix}
        </span>
    );
};

const StatRow = ({ label, value, badge, borderTop, borderBottom, bold, tooltip }) => (
    <div className={`flex items-center justify-between py-3 px-1 ${borderTop ? 'border-t border-line' : ''} ${borderBottom ? 'border-b border-line' : ''}`}>
        <div className="flex items-center gap-1.5">
            <span className={`text-footnote ${bold ? 'font-semibold text-ink' : 'font-bold text-ink-3'}`}>{label}</span>
            {tooltip && (
                <span className="group relative">
                    <Info size={12} className="text-ink-3 cursor-help" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-slate-900 px-3 py-2 text-caption2 font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">{tooltip}</span>
                </span>
            )}
        </div>
        <div className="flex items-center gap-2">
            <span className={`text-footnote tabular-nums ${bold ? 'font-semibold text-ink' : 'font-bold text-ink-2'}`}>{value}</span>
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
                setEvolution(formatSeriesDates(res.data?.history, { timeOnlyAxis: period === 'today' }));
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

    // El color del gráfico sale del propio gráfico. Antes lo decidía la ganancia
    // total de la cartera, así que un mes en rojo podía pintarse en verde.
    const chartUp = evolution.length > 1
        ? evolution[evolution.length - 1].value >= evolution[0].value
        : up;

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
                <div className="flex bg-surface-2 p-1 rounded-xl flex-wrap justify-center">
                    {PERIODS.map(opt => (
                        <button key={opt.id} onClick={() => setPeriod(opt.id)}
                            className={`px-3 py-1.5 rounded-lg text-footnote font-semibold transition-all ${period === opt.id ? 'bg-surface text-brand shadow-sm' : 'text-ink-3 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </GlassCard>

            {!pid ? (
                <div className="text-center text-ink-3 font-bold py-16">{t('perf.select_portfolio')}</div>
            ) : loading ? (
                <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-brand" /></div>
            ) : (
                <>
                    {/* HERO: value + gain */}
                    <motion.div variants={fadeInUp}>
                        <GlassCard className="text-center py-8 relative">
                            <div className="text-footnote font-semibold text-ink-3 mb-1">{t('perf.title')}</div>
                            {periodStartLabel && (
                                <div className="text-caption1 font-bold text-ink-3 mb-3">
                                    {t('perf.period_since')} {periodStartLabel}
                                </div>
                            )}
                            <div className="text-largetitle md:text-5xl font-semibold text-ink tracking-tight">{formatNumber(currentValue, 2)} €</div>
                            {hasCsv && (
                                <div className={`mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-subhead font-semibold ${up ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400'}`}>
                                    {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {up ? '+' : ''}{formatNumber(periodMetrics.totalGross, 2)} € ({up ? '+' : ''}{periodMetrics.totalGrossPct}%)
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>

                    {/* Trade Republic CSV import — COMPACT or FULL */}
                    {hasCsv ? (
                        /* ── Compact mode: data imported, show a discrete chip ── */
                        <motion.div variants={fadeInUp}>
                            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-surface rounded-2xl border border-line shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-footnote font-semibold text-ink">{t('tr.imported_title')}</div>
                                        <div className="text-caption2 font-bold text-ink-3 truncate">
                                            {csvMetrics?.firstPurchase
                                                ? `${t('tr.since_first')}: ${new Date(csvMetrics.firstPurchase).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                                : t('tr.imported_hint')
                                            }
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <label
                                        htmlFor="csv-upload-input"
                                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-ink-3 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-caption2 font-semibold uppercase tracking-wide cursor-pointer transition-all"
                                    >
                                        <RefreshCw size={12} /> {t('tr.update')}
                                    </label>
                                    <TRCsvParser
                                        currentValue={currentValue}
                                        onParsed={setCsvMetrics}
                                        onClear={() => setCsvMetrics(null)}
                                        hasData={true}
                                        compact={true}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        /* ── Full onboarding mode: premium upload experience ── */
                        <motion.div variants={fadeInUp}>
                            <GlassCard className="!p-0 overflow-hidden">
                                <div className="relative">
                                    {/* Gradient background */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 dark:from-indigo-950/40 dark:via-violet-950/30 dark:to-purple-950/20" />
                                    
                                    <div className="relative p-6 md:p-8">
                                        {/* Header */}
                                        <div className="text-center mb-6">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-soft rounded-full mb-4">
                                                <Receipt size={13} className="text-brand" />
                                                <span className="text-caption2 font-semibold text-brand">{t('tr.title')}</span>
                                            </div>
                                            <h3 className="text-title3 font-semibold text-ink mb-2">{t('tr.onboarding_title')}</h3>
                                            <p className="text-footnote font-medium text-ink-3 max-w-md mx-auto leading-relaxed">{t('tr.onboarding_desc')}</p>
                                        </div>

                                        {/* Steps */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                                            <div className="flex items-start gap-3 p-4 bg-surface/70 rounded-2xl backdrop-blur-sm border border-line">
                                                <div className="w-7 h-7 shrink-0 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-footnote font-semibold">1</div>
                                                <div>
                                                    <div className="text-footnote font-semibold text-ink">{t('tr.step1_title')}</div>
                                                    <div className="text-caption2 font-medium text-ink-3 mt-0.5">{t('tr.step1_desc')}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3 p-4 bg-surface/70 rounded-2xl backdrop-blur-sm border border-line">
                                                <div className="w-7 h-7 shrink-0 bg-indigo-500 rounded-xl flex items-center justify-center text-white text-footnote font-semibold">2</div>
                                                <div>
                                                    <div className="text-footnote font-semibold text-ink">{t('tr.step2_title')}</div>
                                                    <div className="text-caption2 font-medium text-ink-3 mt-0.5">{t('tr.step2_desc')}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Upload zone */}
                                        <TRCsvParser
                                            currentValue={currentValue}
                                            onParsed={setCsvMetrics}
                                            onClear={() => setCsvMetrics(null)}
                                            hasData={false}
                                            compact={false}
                                        />
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}

                    {/* ═══ PARQET-STYLE STATS ═══ */}
                    {hasCsv && (
                        <motion.div variants={fadeInUp}>
                            {/* Top KPI cards — 2x2 on mobile, 4 on desktop */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                <GlassCard className="!p-4">
                                    <div className="text-caption2 font-semibold text-ink-3 mb-1">{t('perf.portfolio_value')}</div>
                                    <div className="text-title3 font-semibold text-ink tabular-nums">{formatNumber(periodMetrics.portfolioValue, 2)} €</div>
                                </GlassCard>
                                <GlassCard className="!p-4">
                                    <div className="text-caption2 font-semibold text-ink-3 mb-1">{t('perf.invested')}</div>
                                    <div className="text-title3 font-semibold text-ink tabular-nums">{formatNumber(periodMetrics.invested, 2)} €</div>
                                </GlassCard>
                                <GlassCard className="!p-4">
                                    <div className="text-caption2 font-semibold text-ink-3 mb-1">{t('perf.cashflow')}</div>
                                    <div className="text-title3 font-semibold text-ink tabular-nums">{formatNumber(periodMetrics.cashFlow, 2)} €</div>
                                </GlassCard>
                                <GlassCard className="!p-4">
                                    <div className="text-caption2 font-semibold text-ink-3 mb-1">{t('perf.total_gross')}</div>
                                    <div className={`text-title3 font-semibold tabular-nums ${periodMetrics.totalGross >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                        {periodMetrics.totalGross >= 0 ? '+' : ''}{formatNumber(periodMetrics.totalGross, 2)} €
                                    </div>
                                    {periodMetrics.totalGrossPct !== 0 && (
                                        <div className="mt-0.5"><Badge value={periodMetrics.totalGrossPct} /></div>
                                    )}
                                </GlassCard>
                            </div>

                            {/* TIR + TTWROR cards */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <GlassCard className="!p-4">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="text-caption2 font-semibold text-ink-3">TIR</div>
                                        <span className="group relative">
                                            <Info size={11} className="text-ink-3 cursor-help" />
                                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-lg bg-slate-900 px-3 py-2 text-caption2 font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">{t('perf.tir_hint')}</span>
                                        </span>
                                    </div>
                                    <div className={`text-title2 font-semibold tabular-nums ${periodMetrics.tir !== null && periodMetrics.tir >= 0 ? 'text-emerald-600 dark:text-emerald-400' : periodMetrics.tir !== null ? 'text-rose-500 dark:text-rose-400' : 'text-ink-3'}`}>
                                        <Badge value={periodMetrics.tir} />
                                    </div>
                                </GlassCard>
                                <GlassCard className="!p-4">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="text-caption2 font-semibold text-ink-3">{t('perf.ttwror')}</div>
                                        <span className="group relative">
                                            <Info size={11} className="text-ink-3 cursor-help" />
                                            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 rounded-lg bg-slate-900 px-3 py-2 text-caption2 font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">{t('perf.ttwror_hint')}</span>
                                        </span>
                                    </div>
                                    <div className={`text-title2 font-semibold tabular-nums`}>
                                        {ttwrorValue !== null ? <Badge value={ttwrorValue} /> : <span className="text-ink-3">—</span>}
                                    </div>
                                </GlassCard>
                            </div>

                            {/* Detailed breakdown — Parqet-style list */}
                            <GlassCard>
                                {/* La plusvalía latente es desde la compra, no del periodo: se
                                    dice en el propio dato en vez de dejar que se lea como del periodo. */}
                                <StatRow label={t('perf.price_gains')} borderBottom
                                    tooltip={period !== 'max' ? t('perf.price_gains_hint') : undefined}
                                    value={<span className={periodMetrics.priceGains >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}>{formatNumber(periodMetrics.priceGains, 2)} €</span>}
                                    badge={<Badge value={periodMetrics.priceGainsPct} />}
                                />
                                <StatRow label={t('perf.realized')} borderBottom
                                    value={<span className={periodMetrics.realizedGross >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}>{formatNumber(periodMetrics.realizedGross, 2)} €</span>}
                                    badge={<Badge value={periodMetrics.realizedPct} />}
                                />
                                <StatRow label={t('perf.dividends')} borderBottom
                                    value={`${formatNumber(periodMetrics.dividends, 2)} €`}
                                    badge={periodMetrics.dividends > 0 ? <Badge value={periodMetrics.dividendPct} /> : <span className="text-caption1 font-bold text-ink-3 bg-surface-2 px-2 py-0.5 rounded">0,00 %</span>}
                                />
                                <StatRow label={t('perf.interest')} borderBottom
                                    value={<span className={periodMetrics.interest > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}>{formatNumber(periodMetrics.interest, 2)} €</span>}
                                    badge={periodMetrics.interest > 0 ? <Badge value={periodMetrics.interestPct} /> : null}
                                />

                                {/* Total gross */}
                                <StatRow label={t('perf.total_gross')} bold borderTop borderBottom
                                    value={<span className={periodMetrics.totalGross >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}>{formatNumber(periodMetrics.totalGross, 2)} €</span>}
                                    badge={<Badge value={periodMetrics.totalGrossPct} />}
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
                                    value={<span className={`text-title3 ${periodMetrics.netTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{formatNumber(periodMetrics.netTotal, 2)} €</span>}
                                />
                            </GlassCard>
                        </motion.div>
                    )}

                    {/* Legacy stats (when no CSV imported) */}
                    {!hasCsv && history.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <GlassCard>
                                <div className="text-caption2 font-semibold text-ink-3 mb-1">{t('perf.invested')}</div>
                                <div className="text-title1 font-semibold text-ink tabular-nums">{formatNumber(legacyMetrics.invested, 2)} €</div>
                            </GlassCard>
                            <GlassCard>
                                <div className="text-caption2 font-semibold text-ink-3 mb-1">{t('perf.gain')}</div>
                                <div className={`text-title1 font-semibold tabular-nums ${legacyMetrics.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{legacyMetrics.gain >= 0 ? '+' : ''}{formatNumber(legacyMetrics.gain, 2)} €</div>
                                <div className="text-caption1 font-bold text-ink-3 mt-1">{legacyMetrics.gain >= 0 ? '+' : ''}{formatNumber(legacyMetrics.gainPct, 2)}%</div>
                            </GlassCard>
                            <GlassCard>
                                <div className="text-caption2 font-semibold text-ink-3 mb-1">TIR</div>
                                <div className={`text-title1 font-semibold tabular-nums ${legacyMetrics.tir !== null && legacyMetrics.tir >= 0 ? 'text-emerald-600 dark:text-emerald-400' : legacyMetrics.tir !== null ? 'text-rose-500 dark:text-rose-400' : 'text-ink-3'}`}>
                                    {legacyMetrics.tir !== null ? `${legacyMetrics.tir >= 0 ? '+' : ''}${formatNumber(legacyMetrics.tir, 2)}%` : '—'}
                                </div>
                                <div className="text-caption1 font-bold text-ink-3 mt-1">{t('perf.tir_hint')}</div>
                            </GlassCard>
                            <GlassCard>
                                <div className="text-caption2 font-semibold text-ink-3 mb-1">{t('perf.simple_return')}</div>
                                <div className={`text-title1 font-semibold tabular-nums ${legacyMetrics.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{legacyMetrics.gain >= 0 ? '+' : ''}{formatNumber(legacyMetrics.gainPct, 2)}%</div>
                            </GlassCard>
                        </div>
                    )}

                    {!hasCsv && !history.length && (
                        <div className="text-center text-ink-3 font-bold py-10 px-6 bg-surface rounded-[2rem] border border-line">{t('perf.no_data')}</div>
                    )}

                    {/* Evolution chart */}
                    {evolution.length > 1 && (
                        <GlassCard>
                            <div className="text-caption2 font-semibold text-ink-3 mb-4">{t('perf.evolution')}</div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={evolution} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={chartUp ? '#10b981' : '#f43f5e'} stopOpacity={0.25} />
                                                <stop offset="95%" stopColor={chartUp ? '#10b981' : '#f43f5e'} stopOpacity={0} />
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
                                        <Area type="monotone" dataKey="value" stroke={chartUp ? '#10b981' : '#f43f5e'} strokeWidth={2.5} fill="url(#perfGrad)" />
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
