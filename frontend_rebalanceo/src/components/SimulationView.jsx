import React, { useState } from 'react';
import axios from 'axios';
import { Loader2, ShieldCheck, HelpCircle, FlaskConical, TrendingUp, TrendingDown, Shuffle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GlassCard, BounceButton, fadeInUp, staggerContainer } from './UI';
import { motion } from 'framer-motion';
import { useGlobal } from '../context/GlobalContext';

export const SimulationView = ({ portfolios = [] }) => {
    const { t } = useGlobal();
    const [selectedPorts, setSelectedPorts] = useState([]);
    const [years, setYears] = useState(10);
    const [monthlyContrib, setMonthlyContrib] = useState(500);
    const [simType, setSimType] = useState('deterministic');
    const [contribMode, setContribMode] = useState('constant');
    const [applyTax, setApplyTax] = useState(false);
    const [growthRate, setGrowthRate] = useState(2.0);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);

    const togglePortfolio = (id) => {
        if (selectedPorts.includes(id)) setSelectedPorts(selectedPorts.filter(p => p !== id));
        else if (selectedPorts.length < 2) setSelectedPorts([...selectedPorts, id]);
    };

    const portName = (pid) => portfolios.find(p => p.id === pid)?.name || 'Portfolio';

    const runSimulation = async () => {
        if (selectedPorts.length === 0) return alert(t('sim.select_alert'));
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/simulations/run`, {
                portfolio_ids: selectedPorts,
                years, initial_capital: 0, monthly_contribution: monthlyContrib,
                contribution_mode: contribMode, growth_rate: growthRate,
                tax_rate: applyTax, sim_type: simType
            });
            // Backend returns a generic name; resolve the real portfolio name here.
            const withNames = (res.data || []).map(r => ({ ...r, portfolio_name: portName(r.portfolio_id) }));
            setResults(withNames);
        } catch (e) { alert(t('sim.error')); }
        finally { setLoading(false); }
    };

    const SimTypeButton = ({ type, label, icon: Icon, active, onClick, desc }) => (
        <button
            onClick={onClick}
            className={`w-full p-4 rounded-xl text-left border transition-all relative group ${active ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-white dark:hover:bg-slate-900'}`}
        >
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <span className="text-xs font-black uppercase tracking-wide">{label}</span>
                </div>
                {active && <ShieldCheck size={16} />}
            </div>
            <div className={`text-[10px] ${active ? 'text-indigo-200' : 'text-slate-400'}`}>{desc}</div>
        </button>
    );

    const currentYear = new Date().getFullYear();

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-6">
                <GlassCard className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">{t('sim.select_portfolio')}</label>
                        <div className="space-y-2">
                            {portfolios.map(p => (
                                <button key={p.id} onClick={() => togglePortfolio(p.id)} className={`w-full p-3 rounded-xl text-left text-xs font-bold border transition-all flex justify-between ${selectedPorts.includes(p.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:bg-white dark:hover:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700'}`}>
                                    {p.name}
                                    {selectedPorts.includes(p.id) && <ShieldCheck size={14} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">{t('sim.model')}</label>
                        <div className="space-y-2">
                            <SimTypeButton type="deterministic" label={t('sim.linear')} icon={TrendingUp} active={simType === 'deterministic'} onClick={() => setSimType('deterministic')} desc={t('sim.linear_desc')} />
                            <SimTypeButton type="montecarlo" label={t('sim.montecarlo')} icon={Shuffle} active={simType === 'montecarlo'} onClick={() => setSimType('montecarlo')} desc={t('sim.montecarlo_desc')} />
                            <SimTypeButton type="pessimistic" label={t('sim.conservative')} icon={TrendingDown} active={simType === 'pessimistic'} onClick={() => setSimType('pessimistic')} desc={t('sim.conservative_desc')} />
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">{t('sim.params')}</label>
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between mb-2"><span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('sim.horizon')}</span><span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{years} {t('sim.years')}</span></div>
                                <input type="range" min="1" max="60" value={years} onChange={e => setYears(parseInt(e.target.value))} className="w-full accent-indigo-600 cursor-pointer" />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-2">{t('sim.monthly')}</span>
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-transparent focus-within:border-indigo-500 transition-colors">
                                    <input type="number" value={monthlyContrib} onChange={e => setMonthlyContrib(parseFloat(e.target.value) || 0)} className="bg-transparent outline-none w-full font-bold text-sm text-slate-700 dark:text-slate-200" />
                                    <span className="text-xs font-bold text-slate-400">€</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('sim.growing')}</span>
                                <button onClick={() => setContribMode(contribMode === 'constant' ? 'growing' : 'constant')} className={`w-10 h-6 rounded-full p-1 transition-colors ${contribMode === 'growing' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                    <div className={`w-4 h-4 bg-white dark:bg-slate-300 rounded-full shadow-sm transform transition-transform ${contribMode === 'growing' ? 'translate-x-4 dark:bg-white' : ''}`} />
                                </button>
                            </div>

                            {contribMode === 'growing' && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">{t('sim.annual_growth')}</span>
                                    <input type="number" value={growthRate} onChange={e => setGrowthRate(parseFloat(e.target.value) || 0)} className="w-full bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg font-bold text-sm text-emerald-700 dark:text-emerald-300 outline-none border border-emerald-100 dark:border-emerald-900/40" />
                                </motion.div>
                            )}

                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('sim.apply_tax')}</span>
                                <button onClick={() => setApplyTax(!applyTax)} className={`w-10 h-6 rounded-full p-1 transition-colors ${applyTax ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                    <div className={`w-4 h-4 bg-white dark:bg-slate-300 rounded-full shadow-sm transform transition-transform ${applyTax ? 'translate-x-4 dark:bg-white' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <BounceButton onClick={runSimulation} disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600 shadow-xl transition-all">
                        {loading ? <Loader2 className="animate-spin mx-auto" /> : t('sim.calculate')}
                    </BounceButton>
                </GlassCard>
            </div>

            <motion.div variants={fadeInUp} className="lg:col-span-2 space-y-6">
                {results ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {results.map((res, i) => (
                                <GlassCard key={i} className="!p-6 border-t-4 border-t-indigo-500">
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">{res.portfolio_name}</div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="text-sm text-slate-500 dark:text-slate-400 font-bold">{t('sim.investment')}</div>
                                            <div className="text-xl font-black text-slate-800 dark:text-slate-100">{res.total_invested.toLocaleString()} €</div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-sm text-slate-500 font-bold">{t('sim.gross')}</div>
                                            <div className="text-2xl font-black text-indigo-600">{res.final_gross.toLocaleString()} €</div>
                                        </div>
                                        {applyTax && (
                                            <div className="flex justify-between items-end pt-2 border-t border-slate-50 dark:border-slate-800">
                                                <div className="text-sm text-slate-500 dark:text-slate-400 font-bold">{t('sim.net')}</div>
                                                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{res.final_net.toLocaleString()} €</div>
                                            </div>
                                        )}
                                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase ${res.gain >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400'}`}>
                                            {res.gain >= 0 ? t('sim.profit') : t('sim.loss')}: {res.gain.toLocaleString()} €
                                        </div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                        <GlassCard className="h-96">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={results[0].data}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.2} />
                                    <XAxis
                                        dataKey="year"
                                        fontSize={10}
                                        tick={{ fill: '#94a3b8' }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => val === 0 ? 'Now' : currentYear + val}
                                    />
                                    <YAxis fontSize={10} tick={{ fill: '#94a3b8' }} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.3)', fontWeight: 'bold', background: '#0f172a', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                        labelStyle={{ color: '#94a3b8' }}
                                        formatter={(value) => `${value.toLocaleString()} €`}
                                        labelFormatter={(val) => val === 0 ? 'Today' : `Year ${currentYear + val}`}
                                    />
                                    <Legend />
                                    {results.map((res, i) => (
                                        <Line key={i} type="monotone" data={res.data} dataKey="value" name={res.portfolio_name} stroke={i === 0 ? '#6366f1' : '#10b981'} strokeWidth={3} dot={false} />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </GlassCard>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] py-20">
                        <FlaskConical size={48} className="mb-4 opacity-50" />
                        <div className="text-sm font-bold uppercase tracking-widest text-center mt-4">{t('sim.empty')}</div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}