import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Activity, ListFilter, Plus, Search, Loader2, ArrowUpRight, ArrowDownRight, Trash2, Calendar, RotateCcw, XCircle, PlusCircle, History as HistoryIcon, HelpCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard, CountUp, BounceButton, fadeInUp, staggerContainer } from './UI';
import { safeFloat } from '../utils';
import _ from 'lodash';

// Configuración de formatos de fecha según el periodo


export const Dashboard = ({
    portfolioItems, totalValue, riskProfile, contribution, setContribution,
    rebalanceHistory, searchResults, isSearching, query, setQuery,
    handleUpdate, deleteItem, applyRebalance, calculating, addAsset, searchAsset, undoRebalance, deleteHistoryItem,
    chartData
}) => {

    const assetSummary = React.useMemo(() => {
        if (!portfolioItems || portfolioItems.length === 0) return "Sin activos";
        const counts = _.countBy(portfolioItems, (i) => {
            const type = i.asset?.type || 'Otro';
            return type === 'Stock' ? 'Acciones' : type === 'ETF' ? 'ETFs' : type === 'Crypto' ? 'Cripto' : 'Otros';
        });
        return Object.entries(counts).map(([key, val]) => `${val} ${key}`).join(', ');
    }, [portfolioItems]);

    const getRiskColor = (score) => {
        if (score >= 8) return 'text-rose-500';
        if (score >= 5) return 'text-amber-500';
        return 'text-emerald-500';
    };

    return (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
            {/* 1. KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <GlassCard>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total</div>
                    <div className="text-3xl font-black text-slate-800"><CountUp value={totalValue} suffix=" €" /></div>
                    <div className="mt-2 text-[10px] font-black uppercase text-slate-400">
                        Capital Actual
                    </div>
                    <div className="absolute top-6 right-6 p-3 bg-slate-50 rounded-xl text-indigo-600"><Wallet /></div>
                </GlassCard>

                <GlassCard>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Perfil Riesgo</div>
                    <div className={`text-3xl font-black ${getRiskColor(riskProfile)}`}>{riskProfile}/10</div>
                    <div className="text-xs font-bold text-slate-400 mt-1">{riskProfile >= 8 ? 'Agresivo' : riskProfile <= 4 ? 'Conservador' : 'Moderado'}</div>
                    <div className={`absolute top-6 right-6 p-3 rounded-xl ${riskProfile >= 8 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}><Activity /></div>
                </GlassCard>

                <GlassCard className="flex flex-col justify-between">
                    <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aportación</div>
                        <div className="flex items-center"><input className="text-3xl font-black text-slate-800 w-32 bg-transparent outline-none" value={contribution} onChange={e => setContribution(e.target.value)} /><span className="text-xl text-slate-400 font-bold">€</span></div></div>
                    <div className="absolute top-6 right-6 p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Plus /></div>
                </GlassCard>

                <GlassCard>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Composición</div>
                    <div className="text-3xl font-black text-slate-800">{portfolioItems.length}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase truncate">{assetSummary}</div>
                    <div className="absolute top-6 right-6 p-3 bg-emerald-50 text-emerald-600 rounded-xl"><ListFilter /></div>
                </GlassCard>
            </div>

            {/* 2. MAIN AREA */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* LEFT COLUMN */}
                <motion.div variants={fadeInUp} className="xl:col-span-4 space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm relative z-50 border border-slate-100">
                        <div className="relative flex items-center bg-slate-50 rounded-2xl p-3 border border-slate-100 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                            <Search className="text-slate-400 mr-3" size={20} />
                            <input className="bg-transparent w-full outline-none font-bold text-sm text-slate-700 placeholder:text-slate-400" placeholder="Buscar (Ej: Apple, BTC)..." value={query} onChange={e => { setQuery(e.target.value); searchAsset(e.target.value) }} />
                            {isSearching && <Loader2 className="animate-spin text-indigo-600" size={18} />}
                        </div>
                        <AnimatePresence>
                            {searchResults.length > 0 && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-80 overflow-y-auto z-[100]">
                                    {searchResults.map(r => (
                                        <div key={r.ticker} onClick={() => addAsset(r)} className="p-4 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors">
                                            <div><div className="font-bold text-xs text-slate-800">{r.name}</div><div className="text-[10px] font-black text-indigo-500">{r.ticker} • {r.type_display}</div></div>
                                            <PlusCircle size={18} className="text-indigo-600" />
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <GlassCard className="h-72 hidden md:block flex flex-col items-center justify-center relative">
                        <h3 className="absolute top-6 left-6 text-xs font-black text-slate-400 uppercase tracking-widest">Distribución</h3>
                        <div className="w-full h-full flex items-center justify-center mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="70%"
                                        startAngle={180}
                                        endAngle={0}
                                        innerRadius={80}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                        cornerRadius={4}
                                    >
                                        {chartData.map((e, i) => <Cell key={i} fill={e.fill} stroke="none" />)}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                        formatter={(val) => `${val.toLocaleString()} €`}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Overlay for Total or Center Text if needed */}
                        </div>
                    </GlassCard>
                </motion.div>

                {/* RIGHT COLUMN */}
                <motion.div variants={fadeInUp} className="xl:col-span-8 space-y-6">

                    {/* CHART EVOLUCIÓN */}


                    {/* TABLA PRINCIPAL */}
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr><th className="p-5 pl-8">Activo</th><th className="p-5 text-right">Precio</th><th className="p-5 text-center">Uds</th><th className="p-5 text-center">Valor</th><th className="p-5 text-center">Target %</th><th className="p-5 text-center bg-indigo-50/30 text-indigo-400">Acción</th><th className="p-5 text-right bg-indigo-50/30 text-indigo-400">Coste</th><th className="p-5"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    <AnimatePresence>
                                        {portfolioItems.map(item => (
                                            <motion.tr key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-5 pl-8"><div className="font-bold text-xs text-slate-800">{item.asset?.name || item.asset?.ticker}</div><div className="text-[10px] font-bold text-indigo-400">{item.asset?.ticker}</div></td>
                                                <td className="p-5 text-right text-xs font-mono text-slate-500">{item.current_price?.toFixed(2)}€</td>
                                                <td className="p-5 text-center"><input className="w-16 bg-slate-100 rounded-lg p-2 text-center text-xs font-bold focus:bg-white focus:ring-2 ring-indigo-500 outline-none transition-all" value={item.units_held} onChange={e => handleUpdate(item.id, 'units_held', e.target.value)} onFocus={e => e.target.select()} /></td>
                                                <td className="p-5 text-center"><div className="relative inline-block"><input className="w-24 bg-white border border-slate-200 rounded-lg p-2 text-center text-xs font-bold focus:ring-2 ring-emerald-500 outline-none transition-all" value={item.value?.toFixed(2)} onChange={e => handleUpdate(item.id, 'value', e.target.value)} onFocus={e => e.target.select()} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">€</span></div></td>
                                                <td className="p-5 text-center"><input className="w-12 bg-slate-100 rounded-lg p-2 text-center text-xs font-bold focus:bg-white focus:ring-2 ring-indigo-500 outline-none transition-all" value={item.target_weight} onChange={e => handleUpdate(item.id, 'target_weight', e.target.value)} onFocus={e => e.target.select()} /></td>
                                                <td className="p-5 text-center bg-indigo-50/10"><div className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-black uppercase ${item.action === 'BUY' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>{item.action === 'BUY' ? <ArrowUpRight size={10} className="mr-1" /> : <ArrowDownRight size={10} className="mr-1" />}{Math.abs(item.unitsToTrade || 0).toFixed(3)}</div></td>
                                                <td className={`p-5 text-right text-xs font-bold font-mono bg-indigo-50/10 ${item.action === 'BUY' ? 'text-slate-700' : 'text-rose-500'}`}>{Math.abs(item.diffVal || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</td>
                                                <td className="p-5 text-right"><button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                        <div className="p-5 border-t border-slate-100 flex justify-end bg-white">
                            <BounceButton onClick={applyRebalance} disabled={calculating} className="bg-slate-900 hover:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:shadow-indigo-200">
                                {calculating ? <Loader2 className="animate-spin" /> : 'Aplicar Rebalanceo'}
                            </BounceButton>
                        </div>
                    </div>

                    {/* HISTORY LOG */}
                    <AnimatePresence>
                        {rebalanceHistory.length > 0 && (
                            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><HistoryIcon size={14} /> Historial de Operaciones</h3>
                                <div className="space-y-4">
                                    {rebalanceHistory.map(h => (
                                        <motion.div key={h.id} variants={fadeInUp} className="group border border-slate-100 rounded-2xl overflow-hidden hover:shadow-md transition-all">
                                            <div className="flex justify-between items-center p-5 bg-slate-50/50">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-white rounded-xl border border-slate-100 text-slate-400"><Calendar size={16} /></div>
                                                    <div>
                                                        <div className="text-xs font-black text-slate-700">{new Date(h.created_at).toLocaleDateString()}</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">{new Date(h.created_at).toLocaleTimeString()}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="text-xs font-black text-indigo-600">+{h.contribution?.toLocaleString()} €</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Aportación</div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => undoRebalance(h.id)} className="p-2 hover:bg-indigo-100 rounded-xl text-slate-300 hover:text-indigo-600 transition-colors" title="Deshacer"><RotateCcw size={18} /></button>
                                                        <button onClick={() => deleteHistoryItem(h.id)} className="p-2 hover:bg-rose-100 rounded-xl text-slate-300 hover:text-rose-600 transition-colors" title="Borrar"><Trash2 size={18} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-5 bg-white border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {h.items?.map(i => (
                                                    <div key={i.id} className="text-[10px] bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-100">
                                                        <div>
                                                            <div className="font-bold text-slate-700 truncate w-24">{i.asset_name}</div>
                                                            <div className="font-mono text-slate-400">{i.ticker}</div>
                                                        </div>
                                                        <div className={`text-right font-black ${i.action === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {i.action === 'BUY' ? 'COMPRA' : 'VENTA'}<br />
                                                            <span className="text-slate-500 font-mono">{safeFloat(i.units).toFixed(4)} uds</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </motion.div>
    );
};