import React, { useState, useEffect } from 'react';
import api from '../api'
import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, XAxis } from 'recharts';
import { GlassCard, staggerContainer } from '../components/UI';
import { Dropdown } from '../components/Dropdown';
import { motion } from 'framer-motion';
import { useGlobal } from '../context/GlobalContext';
import { formatSeriesDates } from '../utils';

export const Analysis = ({ portfolios }) => {
    const { t } = useGlobal();
    const [selectedPortId, setSelectedPortId] = useState('');
    const [period, setPeriod] = useState('1mo');
    const [chartsData, setChartsData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (portfolios.length > 0 && !selectedPortId) setSelectedPortId(portfolios[0].id);
    }, [portfolios]);

    useEffect(() => {
        if (selectedPortId) loadCharts(selectedPortId, period);
    }, [selectedPortId, period]);

    const loadCharts = async (pid, p) => {
        setLoading(true);
        try {
            const res = await api.get(`${import.meta.env.VITE_API_URL}/portfolio/${pid}?t=${Date.now()}`);
            const items = (res.data || []).filter(i => i.asset?.ticker);
            if (items.length === 0) { setChartsData([]); return; }

            // Fetch each asset's OWN price history so every card shows its real
            // series and % change (not the portfolio total repeated).
            const results = await Promise.all(items.map(async (item) => {
                const ticker = item.asset.ticker;
                const r = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/history_chart`, {
                    portfolio_id: pid, period: p, ticker
                }).catch(() => null);

                const data = formatSeriesDates(r?.data?.history, { timeOnlyAxis: p === '1d' });

                return {
                    ticker,
                    name: item.asset.name,
                    price: item.current_price,
                    change_pct: r?.data?.change_pct || 0,
                    change_val: r?.data?.change_val || 0,
                    data
                };
            }));

            results.sort((a, b) => b.change_pct - a.change_pct);
            setChartsData(results);
        } catch (e) {
            console.error("Chart load error:", e);
            setChartsData([]);
        } finally {
            setLoading(false);
        }
    };

    const periodOptions = [
        { id: '1d', label: '1D' },
        { id: '1mo', label: '1M' },
        { id: '1y', label: '1A' },
        { id: 'max', label: 'MAX' },
    ];

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
            <GlassCard className="!p-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                <Dropdown
                    className="w-full md:w-64"
                    value={selectedPortId}
                    onChange={setSelectedPortId}
                    options={portfolios.map(p => ({ value: p.id, label: p.name }))}
                />

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {periodOptions.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setPeriod(opt.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${period === opt.id ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </GlassCard>

            {loading ? (
                <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
            ) : chartsData.length === 0 ? (
                <div className="text-center text-slate-400 font-bold py-12">{t('analysis.no_data')}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {chartsData.map((asset, i) => (
                        <GlassCard key={i} className="flex flex-col h-72 md:h-80 relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-6 relative z-10 px-2 pt-2">
                                <div className="max-w-[60%]">
                                    <div className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100 truncate leading-tight mb-1" title={asset.name}>{asset.name}</div>
                                    <div className="text-[10px] md:text-xs font-bold text-slate-400">{asset.ticker}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm md:text-lg font-black text-slate-800 dark:text-slate-100">{asset.price?.toFixed(2)} €</div>
                                    <div className={`text-[10px] md:text-xs font-black flex items-center justify-end gap-1 ${asset.change_pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {asset.change_pct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                        {asset.change_pct >= 0 ? '+' : ''}{asset.change_pct}%
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 w-[110%] -ml-[5%] relative z-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={asset.data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={asset.change_pct >= 0 ? '#10b981' : '#f43f5e'} stopOpacity={0.2} />
                                                <stop offset="95%" stopColor={asset.change_pct >= 0 ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" hide={true} />
                                        <YAxis domain={['auto', 'auto']} hide={true} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '8px' }}
                                            labelStyle={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '2px' }}
                                            itemStyle={{ fontSize: '12px', color: '#1e293b', fontWeight: '900', padding: 0 }}
                                            formatter={(value) => [`${value.toFixed(2)} €`, t('analysis.position_value')]}
                                            labelFormatter={(label, payload) => payload[0]?.payload?.full || label}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={asset.change_pct >= 0 ? '#10b981' : '#f43f5e'}
                                            strokeWidth={2}
                                            fill={`url(#grad-${i})`}
                                            isAnimationActive={true}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </motion.div>
    );
};
