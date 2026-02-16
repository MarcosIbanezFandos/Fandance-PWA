import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, XAxis } from 'recharts';
import { GlassCard, staggerContainer } from '../components/UI';
import { motion } from 'framer-motion';
import { useGlobal } from '../context/GlobalContext';

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
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/portfolio/${pid}`);
            const items = res.data || [];
            if (items.length === 0) { setChartsData([]); return; }

            const promises = items.map(async (item) => {
                if (!item.asset?.ticker) return null;
                try {
                    // Mock data with dates
                    const startVal = 100 + Math.random() * 50;
                    let current = startVal;
                    const today = new Date();
                    const data = Array.from({ length: 30 }, (_, i) => {
                        current = current * (1 + (Math.random() * 0.04 - 0.02));
                        const d = new Date();
                        d.setDate(today.getDate() - (29 - i));
                        return {
                            value: current,
                            date: d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
                            fullDate: d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                        };
                    });
                    const endVal = data[data.length - 1].value;
                    const change_pct = ((endVal - startVal) / startVal * 100).toFixed(2);

                    return {
                        ticker: item.asset.ticker,
                        name: item.asset.name,
                        price: item.current_price,
                        data: data,
                        change_pct: parseFloat(change_pct)
                    };
                } catch (e) { return null; }
            });

            const results = await Promise.all(promises);
            const validResults = results.filter(x => x !== null);

            // SORTING: Descending benefit (Highest positive change first)
            validResults.sort((a, b) => b.change_pct - a.change_pct);

            setChartsData(validResults);

        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const periodOptions = [
        { id: '1d', label: '1D' },
        { id: '1mo', label: '1M' },
        { id: '1y', label: '1A' },
        { id: 'max', label: 'MAX' },
    ];

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
            <GlassCard className="!p-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-40 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                        value={selectedPortId}
                        onChange={(e) => setSelectedPortId(e.target.value)}
                        className="w-full md:w-64 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl p-2.5 outline-none focus:border-indigo-500"
                    >
                        {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {periodOptions.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setPeriod(opt.id)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${period === opt.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                                    <div className="text-sm md:text-base font-black text-slate-800 truncate leading-tight mb-1" title={asset.name}>{asset.name}</div>
                                    <div className="text-[10px] md:text-xs font-bold text-slate-400">{asset.ticker}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm md:text-lg font-black text-slate-800">{asset.price?.toFixed(2)} €</div>
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
                                            formatter={(value) => [`${value.toFixed(2)} €`, '']}
                                            labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
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
