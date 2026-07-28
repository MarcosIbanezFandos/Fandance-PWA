import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Scale } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GlassCard } from './UI';
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

const signCls = (v) => v > 0 ? 'text-emerald-600 dark:text-emerald-400' : v < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400';
const pct = (v) => (v === undefined || v === null) ? '—' : `${v > 0 ? '+' : ''}${formatNumber(v, 2)}%`;

export const BenchmarkCompare = ({ holdings, period }) => {
    const { t } = useGlobal();
    const [selected, setSelected] = useState(['^GSPC', 'URTH']);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const list = (holdings || []).filter(h => h.ticker && safeFloat(h.units) > 0);
        if (list.length === 0 || selected.length === 0) { setData(null); return; }
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const res = await axios.post(`${import.meta.env.VITE_API_URL}/portfolio/benchmark`,
                    { holdings: list, benchmarks: selected, period }, { timeout: 60000 });
                if (!cancelled) setData(res.data);
            } catch (e) { if (!cancelled) setData(null); }
            finally { if (!cancelled) setLoading(false); }
        };
        run();
        return () => { cancelled = true; };
    }, [JSON.stringify(holdings), period, selected.join(',')]);

    const toggle = (ticker) => setSelected(s => s.includes(ticker) ? s.filter(x => x !== ticker) : [...s, ticker].slice(0, 6));

    const colorFor = (ticker) => COLORS[selected.indexOf(ticker) % COLORS.length];
    const rows = data?.stats ? ['portfolio', ...selected.filter(s => data.stats[s])] : [];

    const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });

    return (
        <GlassCard>
            <div className="flex items-center gap-2 mb-2">
                <Scale size={15} className="text-slate-400" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('bench.title')}</h3>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mb-4">{t('bench.hint')}</p>

            {/* Benchmark chips */}
            <div className="flex flex-wrap gap-2 mb-5">
                {BENCHMARKS.map(b => {
                    const on = selected.includes(b.ticker);
                    return (
                        <button key={b.ticker} onClick={() => toggle(b.ticker)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all border ${on ? 'text-white border-transparent' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            style={on ? { backgroundColor: colorFor(b.ticker) } : undefined}>
                            {b.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="h-72 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
            ) : !data || !data.series || data.series.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm font-bold text-slate-400">
                    {selected.length === 0 ? t('bench.select_hint') : t('bench.no_data')}
                </div>
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
                                    formatter={(val, key) => [`${formatNumber(val, 1)}`, key === 'portfolio' ? t('bench.your_portfolio') : (data.labels[key] || key)]}
                                />
                                <Legend formatter={(key) => key === 'portfolio' ? t('bench.your_portfolio') : (data.labels[key] || key)} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                                <Line type="monotone" dataKey="portfolio" name="portfolio" stroke="#6366f1" strokeWidth={3} dot={false} isAnimationActive={false} />
                                {selected.map(b => data.series[0][b] !== undefined && (
                                    <Line key={b} type="monotone" dataKey={b} name={b} stroke={colorFor(b)} strokeWidth={2} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Stats table */}
                    <div className="overflow-x-auto mt-4">
                        <table className="w-full text-left min-w-[560px]">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="py-3 pr-2">{t('bench.asset')}</th>
                                    <th className="py-3 px-2 text-right">{t('bench.return')}</th>
                                    <th className="py-3 px-2 text-right">{t('bench.cagr')}</th>
                                    <th className="py-3 px-2 text-right">{t('bench.vol')}</th>
                                    <th className="py-3 px-2 text-right">{t('bench.maxdd')}</th>
                                    <th className="py-3 px-2 text-right">{t('bench.beta')}</th>
                                    <th className="py-3 pl-2 text-right">{t('bench.corr')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {rows.map(key => {
                                    const s = data.stats[key];
                                    if (!s) return null;
                                    const isPort = key === 'portfolio';
                                    return (
                                        <tr key={key} className={isPort ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}>
                                            <td className="py-3 pr-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: isPort ? '#6366f1' : colorFor(key) }} />
                                                    <span className={`text-xs font-black ${isPort ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>{isPort ? t('bench.your_portfolio') : (data.labels[key] || key)}</span>
                                                </div>
                                            </td>
                                            <td className={`py-3 px-2 text-right text-xs font-black tabular-nums ${signCls(s.return_pct)}`}>{pct(s.return_pct)}</td>
                                            <td className={`py-3 px-2 text-right text-xs font-bold tabular-nums ${signCls(s.cagr)}`}>{pct(s.cagr)}</td>
                                            <td className="py-3 px-2 text-right text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">{formatNumber(s.volatility, 1)}%</td>
                                            <td className="py-3 px-2 text-right text-xs font-bold tabular-nums text-rose-500 dark:text-rose-400">{formatNumber(s.max_drawdown, 1)}%</td>
                                            <td className="py-3 px-2 text-right text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">{s.beta !== undefined ? formatNumber(s.beta, 2) : '—'}</td>
                                            <td className="py-3 pl-2 text-right text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">{s.correlation !== undefined ? formatNumber(s.correlation, 2) : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </GlassCard>
    );
};
