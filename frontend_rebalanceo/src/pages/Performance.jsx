import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, TrendingDown, Wallet, PiggyBank, Percent, Receipt } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import { GlassCard, staggerContainer, fadeInUp } from '../components/UI';
import { Dropdown } from '../components/Dropdown';
import { BenchmarkCompare } from '../components/BenchmarkCompare';
import { CostBasis } from '../components/CostBasis';
import { useGlobal } from '../context/GlobalContext';
import { safeFloat, formatNumber, xirr } from '../utils';

const PERIODS = [
    { id: '1mo', label: '1M' },
    { id: '3mo', label: '3M' },
    { id: '1y', label: '1A' },
    { id: 'max', label: 'MAX' },
];

const Stat = ({ label, value, sub, tone = 'default', icon: Icon }) => {
    const toneCls = tone === 'up' ? 'text-emerald-600 dark:text-emerald-400'
        : tone === 'down' ? 'text-rose-500 dark:text-rose-400'
            : 'text-slate-800 dark:text-slate-100';
    return (
        <GlassCard>
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
                {Icon && <Icon size={16} className="text-slate-300 dark:text-slate-600" />}
            </div>
            <div className={`text-2xl font-black ${toneCls}`}>{value}</div>
            {sub && <div className="text-[11px] font-bold text-slate-400 mt-1">{sub}</div>}
        </GlassCard>
    );
};

export const Performance = ({ portfolios, activePortfolioId }) => {
    const { t } = useGlobal();
    const [pid, setPid] = useState('');
    const [items, setItems] = useState([]);
    const [history, setHistory] = useState([]);
    const [evolution, setEvolution] = useState([]);
    const [period, setPeriod] = useState('max');
    const [loading, setLoading] = useState(false);
    const [fees, setFees] = useState('0');
    const [taxes, setTaxes] = useState('0');

    // Pick a default portfolio
    useEffect(() => {
        if (!pid) {
            if (activePortfolioId) setPid(activePortfolioId);
            else if (portfolios.length) setPid(portfolios[0].id);
        }
    }, [portfolios, activePortfolioId]);

    // Load fees/taxes overrides per portfolio
    useEffect(() => {
        if (!pid) return;
        setFees(localStorage.getItem(`perf_fees_${pid}`) ?? '0');
        setTaxes(localStorage.getItem(`perf_taxes_${pid}`) ?? '0');
    }, [pid]);

    useEffect(() => { if (pid) localStorage.setItem(`perf_fees_${pid}`, fees); }, [fees, pid]);
    useEffect(() => { if (pid) localStorage.setItem(`perf_taxes_${pid}`, taxes); }, [taxes, pid]);

    useEffect(() => {
        if (!pid) return;
        const load = async () => {
            setLoading(true);
            try {
                const [itemsRes, histRes] = await Promise.all([
                    axios.get(`${import.meta.env.VITE_API_URL}/portfolio/${pid}?t=${Date.now()}`),
                    axios.get(`${import.meta.env.VITE_API_URL}/portfolio/history/${pid}?t=${Date.now()}`),
                ]);
                setItems(itemsRes.data || []);
                setHistory(histRes.data || []);
            } catch (e) { setItems([]); setHistory([]); }
            finally { setLoading(false); }
        };
        load();
    }, [pid]);

    // Evolution chart (value over time) — separate so period changes don't reload the rest
    useEffect(() => {
        if (!pid) return;
        const load = async () => {
            try {
                const res = await axios.post(`${import.meta.env.VITE_API_URL}/portfolio/history_chart`, { portfolio_id: pid, period });
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

    const metrics = useMemo(() => {
        const currentValue = items.reduce((s, i) => s + safeFloat(i.value), 0);
        const invested = history.reduce((s, h) => s + safeFloat(h.contribution), 0);
        const gain = currentValue - invested;
        const gainPct = invested > 0 ? (gain / invested) * 100 : 0;

        // XIRR: each contribution is money out (negative), current value is money in today.
        const flows = history
            .map(h => ({ amount: -safeFloat(h.contribution), date: new Date(h.created_at) }))
            .sort((a, b) => a.date - b.date);
        if (currentValue > 0) flows.push({ amount: currentValue, date: new Date() });
        const rate = xirr(flows);
        const tir = rate === null ? null : rate * 100;

        const startDate = history.length
            ? new Date(Math.min(...history.map(h => new Date(h.created_at).getTime())))
            : null;

        const feesN = safeFloat(fees);
        const taxesN = safeFloat(taxes);
        const netResult = gain - feesN - taxesN;

        return { currentValue, invested, gain, gainPct, tir, startDate, feesN, taxesN, netResult };
    }, [items, history, fees, taxes]);

    const hasData = history.length > 0;
    const up = metrics.gain >= 0;

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
            {/* Selector + period */}
            <GlassCard className="!p-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-40">
                <Dropdown
                    className="w-full md:w-64"
                    value={pid}
                    onChange={setPid}
                    options={portfolios.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="—"
                />
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {PERIODS.map(opt => (
                        <button key={opt.id} onClick={() => setPeriod(opt.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${period === opt.id ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
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
                        <GlassCard className="text-center py-10">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('perf.portfolio_value')}</div>
                            <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">{formatNumber(metrics.currentValue, 2)} €</div>
                            {hasData && (
                                <div className={`mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-black ${up ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400'}`}>
                                    {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {up ? '+' : ''}{formatNumber(metrics.gain, 2)} € ({up ? '+' : ''}{formatNumber(metrics.gainPct, 2)}%)
                                </div>
                            )}
                            {metrics.startDate && (
                                <div className="mt-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                    {t('perf.since')} {metrics.startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>

                    {!hasData ? (
                        <div className="text-center text-slate-400 font-bold py-10 px-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">{t('perf.no_data')}</div>
                    ) : (
                        <>
                            {/* Stat grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                <Stat label={t('perf.invested')} value={`${formatNumber(metrics.invested, 2)} €`} icon={PiggyBank} />
                                <Stat label={t('perf.gain')} value={`${up ? '+' : ''}${formatNumber(metrics.gain, 2)} €`} tone={up ? 'up' : 'down'} sub={`${up ? '+' : ''}${formatNumber(metrics.gainPct, 2)}%`} icon={Wallet} />
                                <Stat label={t('perf.tir')} value={metrics.tir === null ? '—' : `${metrics.tir >= 0 ? '+' : ''}${formatNumber(metrics.tir, 2)}%`} tone={metrics.tir === null ? 'default' : metrics.tir >= 0 ? 'up' : 'down'} sub={t('perf.tir_hint')} icon={Percent} />
                                <Stat label={t('perf.simple_return')} value={`${up ? '+' : ''}${formatNumber(metrics.gainPct, 2)}%`} tone={up ? 'up' : 'down'} icon={TrendingUp} />
                            </div>

                            {/* Evolution chart */}
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

                            {/* Net total breakdown (Trade Republic style) */}
                            <GlassCard>
                                <div className="flex items-center gap-2 mb-5">
                                    <Receipt size={15} className="text-slate-400" />
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('perf.net_total')}</h3>
                                </div>
                                <div className="space-y-1 text-sm">
                                    <Row label={t('perf.portfolio_value')} value={`${formatNumber(metrics.currentValue, 2)} €`} />
                                    <Row label={t('perf.invested')} value={`${formatNumber(metrics.invested, 2)} €`} muted />
                                    <Row label={t('perf.gain')} value={`${up ? '+' : ''}${formatNumber(metrics.gain, 2)} €`} tone={up ? 'up' : 'down'} />
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
                                    <EditRow label={t('perf.fees')} value={fees} onChange={setFees} />
                                    <EditRow label={t('perf.taxes')} value={taxes} onChange={setTaxes} />
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
                                    <div className="flex items-center justify-between py-2">
                                        <span className="font-black text-slate-700 dark:text-slate-200 uppercase text-xs tracking-widest">{t('perf.net_total')}</span>
                                        <span className={`text-xl font-black ${metrics.netResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                            {metrics.netResult >= 0 ? '+' : ''}{formatNumber(metrics.netResult, 2)} €
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[11px] font-medium text-slate-400 mt-3">{t('perf.net_hint')}</p>
                            </GlassCard>
                        </>
                    )}

                    {/* Benchmark comparison + profit-since-purchase (independent of contribution history) */}
                    <BenchmarkCompare holdings={items.map(i => ({ ticker: i.asset?.ticker, units: i.units_held }))} period={period} />
                    <CostBasis items={items} pid={pid} />
                </>
            )}
        </motion.div>
    );
};

const Row = ({ label, value, tone = 'default', muted = false }) => {
    const cls = tone === 'up' ? 'text-emerald-600 dark:text-emerald-400'
        : tone === 'down' ? 'text-rose-500 dark:text-rose-400'
            : muted ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200';
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="font-bold text-slate-500 dark:text-slate-400">{label}</span>
            <span className={`font-black ${cls}`}>{value}</span>
        </div>
    );
};

const EditRow = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between py-1.5">
        <span className="font-bold text-slate-500 dark:text-slate-400">{label}</span>
        <div className="relative">
            <input
                inputMode="decimal"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 pr-6 text-right text-xs font-black text-slate-700 dark:text-slate-200 focus:ring-2 ring-indigo-500 outline-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">€</span>
        </div>
    </div>
);
