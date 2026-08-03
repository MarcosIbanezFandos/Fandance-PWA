import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, ArrowUpRight, ArrowDownRight, Trash2, Calendar, RotateCcw, PlusCircle, History as HistoryIcon, AlertTriangle, CheckCircle2, Target, Undo2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard, Card, StatTile, CountUp, BounceButton, NumericField, Segmented, fadeInUp, staggerContainer } from './UI';
import { safeFloat, formatNumber, formatUnits } from '../utils';
import { useGlobal } from '../context/GlobalContext';
import { ImportarTR } from './ImportarTR';
import _ from 'lodash';

const TYPE_DOT = {
    Stock: 'bg-blue-500', ETF: 'bg-emerald-500', Crypto: 'bg-violet-500',
    Fund: 'bg-amber-500', Bond: 'bg-amber-500', Other: 'bg-slate-400'
};

export const Dashboard = ({
    portfolioItems, planTotals, rebalanceMode, setRebalanceMode,
    totalValue, riskProfile, contribution, setContribution,
    rebalanceHistory, searchResults, isSearching, query, setQuery,
    handleUpdate, deleteItem, applyRebalance, calculating, addAsset, searchAsset, undoRebalance, deleteHistoryItem,
    chartData, overrides = {}, setOverride, clearOverrides, onImportarTR
}) => {
    const { t } = useGlobal();

    const fijado = (id) => overrides[id] !== undefined && overrides[id] !== '';
    const hayFijados = Object.keys(overrides).length > 0;

    // "Sólo este": todo el aporte a un activo y cero al resto. Es el atajo del
    // caso que antes no se podía hacer — el reparto siempre tocaba todos.
    const soloEste = (id) => {
        if (!setOverride) return;
        portfolioItems.forEach(i => setOverride(i.id, i.id === id ? safeFloat(contribution) : 0));
    };

    const assetSummary = React.useMemo(() => {
        if (!portfolioItems || portfolioItems.length === 0) return t('kpi.no_assets');
        const counts = _.countBy(portfolioItems, (i) => {
            const type = i.asset?.type || 'Other';
            return type === 'Stock' ? 'Stocks' : type === 'ETF' ? 'ETFs' : type === 'Crypto' ? 'Crypto' : type === 'Fund' ? 'Funds' : 'Other';
        });
        return Object.entries(counts).map(([key, val]) => `${val} ${key}`).join(', ');
    }, [portfolioItems, t]);

    const getRiskColor = (score) => {
        if (score >= 8) return 'text-rose-500';
        if (score >= 5) return 'text-amber-500';
        return 'text-emerald-500';
    };

    const targetSum = safeFloat(planTotals?.targetSum);
    // Accept 99.5 (Indexa keeps 0.5% cash) as balanced too.
    const targetsBalanced = Math.abs(targetSum - 100) <= 1;
    const investTotal = safeFloat(planTotals?.investTotal);
    const unallocated = safeFloat(planTotals?.unallocated);

    const modeControl = (
        <Segmented
            value={rebalanceMode}
            onChange={setRebalanceMode}
            options={[
                { value: 'contribute', label: t('dash.mode_contribute') },
                { value: 'full', label: t('dash.mode_full') },
            ]}
        />
    );

    const driftColor = (item) => {
        const now = safeFloat(item.currentWeight);
        const tgt = safeFloat(item.targetWeight);
        if (tgt <= 0) return 'text-slate-400';
        if (Math.abs(now - tgt) <= 1) return 'text-emerald-500';
        return now < tgt ? 'text-indigo-500' : 'text-amber-500';
    };

    return (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
            {/* Resumen. Las pastillas de color superpuestas en cada esquina
                aportaban ruido y ninguna información: el dato ya está escrito. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label={t('kpi.total_value')} value={<CountUp value={totalValue} suffix=" €" />} />
                <StatTile
                    label={t('kpi.risk')}
                    value={`${riskProfile}/10`}
                    tone={riskProfile >= 8 ? 'negative' : riskProfile <= 4 ? 'positive' : 'default'}
                    sub={riskProfile >= 8 ? t('kpi.aggressive') : riskProfile <= 4 ? t('kpi.conservative') : t('kpi.moderate')}
                />
                <Card className="!p-3.5 md:!p-4">
                    <span className="block text-footnote text-ink-2 mb-1.5">{t('kpi.contribution')}</span>
                    <div className="flex items-baseline gap-1">
                        <input
                            inputMode="decimal"
                            enterKeyHint="done"
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                            className="min-w-0 flex-1 text-title2 font-semibold text-ink bg-transparent outline-none tabular-nums"
                            value={contribution}
                            onChange={e => setContribution(e.target.value)}
                            onFocus={e => e.target.select()}
                        />
                        <span className="text-title2 font-medium text-ink-3 shrink-0">€</span>
                    </div>
                    <span className="block text-caption1 text-ink-3 mt-0.5">{t('kpi.per_month')}</span>
                </Card>
                <StatTile label={t('kpi.composition')} value={portfolioItems.length} sub={assetSummary} />
            </div>

            {/* 2. SEARCH — full width */}
            <motion.div variants={fadeInUp} className="relative z-50">
                    <div className="bg-surface p-4 rounded-card shadow-card relative z-50">
                        <div className="relative flex items-center gap-2 bg-surface-2 rounded-control px-3.5 h-11 focus-within:bg-surface-3 transition-colors">
                            <Search className="text-ink-3 shrink-0" size={17} strokeWidth={2} />
                            <input className="bg-transparent w-full outline-none text-body text-ink placeholder:text-ink-3" enterKeyHint="search" onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} placeholder={t('dash.search')} value={query} onChange={e => { setQuery(e.target.value); searchAsset(e.target.value) }} />
                            {isSearching && <Loader2 className="animate-spin text-brand" size={18} />}
                        </div>
                        <AnimatePresence>
                            {searchResults.length > 0 && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-full left-0 right-0 mt-3 bg-surface rounded-card shadow-pop border border-line max-h-80 overflow-y-auto z-[100]">
                                    {searchResults.map(r => (
                                        <div key={r.ticker} onClick={() => addAsset(r)} className="p-4 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center border-b border-line last:border-0 transition-colors">
                                            <div><div className="font-bold text-footnote text-ink">{r.name}</div><div className="text-caption2 font-semibold text-brand">{r.ticker} • {r.type_display}</div></div>
                                            <PlusCircle size={18} className="text-brand" />
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* Sincronización con el bróker. Va antes del plan porque el
                    reparto sólo tiene sentido sobre las unidades reales. */}
                {onImportarTR && (
                    <motion.div variants={fadeInUp}>
                        <ImportarTR
                            portfolioItems={portfolioItems}
                            rebalanceHistory={rebalanceHistory}
                            onAplicar={onImportarTR}
                        />
                    </motion.div>
                )}

                {/* PLAN CARD — full width */}
                <motion.div variants={fadeInUp}>
                    <div className="bg-surface rounded-card shadow-card border border-line overflow-hidden">
                        {/* Header: mode toggle + targets badge */}
                        <div className="p-5 md:p-6 border-b border-line flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-headline font-semibold text-ink mb-2.5">{t('dash.plan_title')}</h3>
                                {modeControl}
                                <p className="text-footnote text-ink-2 mt-2">
                                    {rebalanceMode === 'contribute' ? t('dash.mode_contribute_hint') : t('dash.mode_full_hint')}
                                </p>
                            </div>
                            <div className={`shrink-0 rounded-card px-4 py-3 border ${targetsBalanced ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/40' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40'}`}>
                                <div className="flex items-center gap-2">
                                    {targetsBalanced ? <CheckCircle2 size={15} className="text-emerald-500" /> : <AlertTriangle size={15} className="text-amber-500" />}
                                    <span className="text-caption2 font-semibold text-ink-3">{t('dash.target_sum')}</span>
                                </div>
                                <div className={`text-title3 font-semibold ${targetsBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{formatNumber(targetSum, 1)}%</div>
                                {!targetsBalanced && <div className="text-caption2 font-bold text-amber-500 ">{t('dash.fix_settings')}</div>}
                            </div>
                        </div>

                        {/* Resumen del mes */}
                        <div className="px-5 md:px-6 py-3 bg-brand-soft/50 border-b border-line flex items-center justify-between text-footnote">
                            <span className="text-ink-2">{t('dash.to_invest_summary')}</span>
                            <span className="font-semibold text-brand text-body tabular-nums">{formatNumber(investTotal)} €</span>
                        </div>

                        {/* Aviso cuando el reparto lo manda el usuario y no el cálculo. */}
                        {hayFijados && (
                            <div className="px-5 md:px-6 py-2.5 border-b border-line flex items-center justify-between gap-3 bg-brand-soft">
                                <span className="text-footnote text-brand-ink">{t('dash.manual_amounts')}</span>
                                <button
                                    onClick={clearOverrides}
                                    className="flex items-center gap-1.5 text-footnote font-semibold text-brand shrink-0 active:opacity-60"
                                >
                                    <Undo2 size={14} /> {t('dash.back_to_auto')}
                                </button>
                            </div>
                        )}

                        {/* MOBILE: card list (no horizontal scrolling) */}
                        <div className="md:hidden divide-y divide-line">
                            {portfolioItems.map(item => {
                                const isBuy = item.action === 'BUY';
                                const isSell = item.action === 'SELL';
                                const dotM = TYPE_DOT[item.asset?.type] || TYPE_DOT.Other;
                                return (
                                    <div key={item.id} className="p-4">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${dotM}`} />
                                                <div className="min-w-0">
                                                    <div className="font-bold text-subhead text-ink truncate">{item.asset?.name || item.asset?.ticker}</div>
                                                    <div className="text-caption2 font-bold text-indigo-400">{item.asset?.ticker} · {formatNumber(item.current_price, 2)}€</div>
                                                </div>
                                            </div>
                                            {/* Importe editable. Fijar uno y poner el resto a 0
                                                es lo que permite aportar a un solo activo. */}
                                            <div className="text-right shrink-0 flex items-center gap-1.5">
                                                <div>
                                                    <div className="flex items-center gap-0.5 justify-end">
                                                        <input
                                                            inputMode="decimal"
                                                            enterKeyHint="done"
                                                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                            value={fijado(item.id) ? overrides[item.id] : formatNumber(Math.abs(safeFloat(item.allocation)))}
                                                            onChange={e => setOverride?.(item.id, e.target.value)}
                                                            onFocus={e => e.target.select()}
                                                            className={`w-16 text-right bg-transparent outline-none text-subhead font-semibold tabular-nums rounded-field px-1 ${fijado(item.id) ? 'text-brand bg-brand-soft' : isBuy ? 'text-positive' : isSell ? 'text-negative' : 'text-ink-3'}`}
                                                        />
                                                        <span className="text-subhead font-semibold text-ink-3">€</span>
                                                    </div>
                                                    <div className="text-caption2 font-bold text-ink-3">{formatUnits(Math.abs(safeFloat(item.unitsToTrade)))} uds</div>
                                                </div>
                                                <button
                                                    onClick={() => soloEste(item.id)}
                                                    aria-label={t('dash.only_this')}
                                                    title={t('dash.only_this')}
                                                    className="h-9 w-9 flex items-center justify-center rounded-field text-ink-3 active:bg-surface-3 transition-colors shrink-0"
                                                >
                                                    <Target size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* current vs target bar */}
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`text-caption1 font-semibold tabular-nums w-11 ${driftColor(item)}`}>{formatNumber(item.currentWeight, 1)}%</span>
                                            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${driftColor(item).replace('text-', 'bg-')}`} style={{ width: `${Math.min(100, safeFloat(item.currentWeight))}%` }} />
                                            </div>
                                            <span className="text-caption2 font-bold text-ink-3 tabular-nums">→ {formatNumber(item.targetWeight, 1)}%</span>
                                        </div>

                                        {/* Campos de 44pt con la unidad dentro: eran cajitas de
                                            13px donde el dedo no acertaba y el teclado tapaba
                                            la fila entera. */}
                                        <div className="flex items-end gap-2">
                                            <NumericField
                                                className="flex-1"
                                                label={t('th.units')}
                                                value={item.units_held}
                                                onChange={(v) => handleUpdate(item.id, 'units_held', v)}
                                            />
                                            <NumericField
                                                className="flex-1"
                                                label={t('th.value')} unit="€"
                                                value={item.value}
                                                onChange={(v) => handleUpdate(item.id, 'value', v)}
                                            />
                                            <NumericField
                                                className="w-[5.5rem]"
                                                label={t('th.target')} unit="%"
                                                value={item.target_weight}
                                                onChange={(v) => handleUpdate(item.id, 'target_weight', v)}
                                            />
                                            <button
                                                onClick={() => deleteItem(item.id)}
                                                aria-label={t('portfolio.delete')}
                                                className="h-12 w-11 flex items-center justify-center rounded-field text-ink-3 active:bg-negative-soft active:text-negative shrink-0 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {portfolioItems.length > 0 && (
                                <div className="p-4 flex items-center justify-between bg-surface-2/60">
                                    <span className="text-caption2 font-semibold text-ink-2">{t('th.totals')}</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-footnote font-semibold text-ink tabular-nums">{formatNumber(totalValue)}€</span>
                                        <span className="text-footnote font-semibold text-brand tabular-nums">{formatNumber(investTotal)}€</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* DESKTOP TABLE */}
                        <div className="hidden md:block scroll-x">
                            <table className="w-full text-left min-w-[600px]">
                                <thead className="bg-surface-2/80 text-caption2 font-semibold text-slate-400 border-b border-line">
                                    <tr>
                                        <th className="p-3 pl-6">{t('th.asset')}</th>
                                        <th className="p-3 text-right">{t('th.price')}</th>
                                        <th className="p-3 text-center">{t('th.units')}</th>
                                        <th className="p-3 text-center">{t('th.value')}</th>
                                        <th className="p-3 text-center">{t('th.now')} %</th>
                                        <th className="p-3 text-center">{t('th.target')} %</th>
                                        <th className="p-3 pr-6 text-right bg-brand-soft/40 text-indigo-400">{t('th.invest')}</th>
                                        <th className="p-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    <AnimatePresence>
                                        {portfolioItems.map(item => {
                                            const isBuy = item.action === 'BUY';
                                            const isSell = item.action === 'SELL';
                                            const dot = TYPE_DOT[item.asset?.type] || TYPE_DOT.Other;
                                            return (
                                                <motion.tr key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                                    <td className="p-3 pl-6">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-footnote text-ink truncate max-w-[150px]">{item.asset?.name || item.asset?.ticker}</div>
                                                                <div className="text-caption2 font-bold text-indigo-400">{item.asset?.ticker}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right text-footnote font-mono text-ink-3 whitespace-nowrap">{formatNumber(item.current_price, 2)}€</td>
                                                    <td className="p-3 text-center">
                                                        <input className="w-16 h-10 bg-surface-2 text-ink rounded-field px-2 text-center text-subhead font-semibold tabular-nums outline-none focus:bg-surface-3 transition-colors" value={item.units_held} onChange={e => handleUpdate(item.id, 'units_held', e.target.value)} onFocus={e => e.target.select()} />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="relative inline-block">
                                                            <input className="w-24 h-10 bg-surface-2 text-ink rounded-field px-2 pr-5 text-center text-subhead font-semibold tabular-nums outline-none focus:bg-surface-3 transition-colors" value={item.value} onChange={e => handleUpdate(item.id, 'value', e.target.value)} onFocus={e => e.target.select()} />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-caption2 text-ink-3 font-bold">€</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className={driftColor(item)}>
                                                            <div className="text-footnote font-semibold">{formatNumber(item.currentWeight, 1)}%</div>
                                                            <div className="mt-1 h-1 w-12 mx-auto bg-surface-2 rounded-full overflow-hidden">
                                                                <div className="h-full bg-current opacity-70 rounded-full" style={{ width: `${Math.min(100, safeFloat(item.currentWeight))}%` }} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <input className="w-14 h-10 bg-surface-2 text-ink rounded-field px-2 text-center text-subhead font-semibold tabular-nums outline-none focus:bg-surface-3 transition-colors" value={item.target_weight} onChange={e => handleUpdate(item.id, 'target_weight', e.target.value)} onFocus={e => e.target.select()} />
                                                    </td>
                                                    {/* Editable igual que en móvil: el importe manda
                                                        sobre el reparto calculado. */}
                                                    <td className="p-3 pr-6 text-right bg-brand-soft/30 whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-1.5">
                                                            <div className="flex flex-col items-end">
                                                                <div className="flex items-center gap-0.5">
                                                                    <input
                                                                        inputMode="decimal"
                                                                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                                        value={fijado(item.id) ? overrides[item.id] : formatNumber(Math.abs(safeFloat(item.allocation)))}
                                                                        onChange={e => setOverride?.(item.id, e.target.value)}
                                                                        onFocus={e => e.target.select()}
                                                                        className={`w-16 h-9 text-right bg-transparent outline-none rounded-field px-1 text-footnote font-semibold tabular-nums ${fijado(item.id) ? 'text-brand bg-brand-soft' : isBuy ? 'text-positive' : isSell ? 'text-negative' : 'text-ink-3'}`}
                                                                    />
                                                                    <span className="text-footnote font-semibold text-ink-3">€</span>
                                                                </div>
                                                                <span className="text-caption2 font-bold text-ink-3 flex items-center gap-0.5">
                                                                    {isBuy && <ArrowUpRight size={9} />}{isSell && <ArrowDownRight size={9} />}
                                                                    {formatUnits(Math.abs(safeFloat(item.unitsToTrade)))} uds
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => soloEste(item.id)}
                                                                aria-label={t('dash.only_this')}
                                                                title={t('dash.only_this')}
                                                                className="h-8 w-8 flex items-center justify-center rounded-field text-ink-3 hover:text-brand hover:bg-surface-2 transition-colors shrink-0"
                                                            >
                                                                <Target size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <button onClick={() => deleteItem(item.id)} className="text-ink-3 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </AnimatePresence>
                                </tbody>
                                {portfolioItems.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-line bg-surface-2/60 text-footnote">
                                            <td className="p-3 pl-6 font-semibold text-ink-2 text-caption2">{t('th.totals')}</td>
                                            <td></td>
                                            <td></td>
                                            <td className="p-3 text-center font-semibold text-ink whitespace-nowrap">{formatNumber(totalValue)}€</td>
                                            <td className="p-3 text-center font-semibold text-ink-3">100%</td>
                                            <td className={`p-3 text-center font-semibold ${targetsBalanced ? 'text-emerald-500' : 'text-amber-500'}`}>{formatNumber(targetSum, 1)}%</td>
                                            <td className="p-3 pr-6 text-right font-semibold text-brand bg-brand-soft/30 whitespace-nowrap">{formatNumber(investTotal)}€</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {portfolioItems.length === 0 && (
                            <div className="p-10 text-center text-subhead font-bold text-ink-3">{t('dash.empty')}</div>
                        )}

                        <div className="p-5 border-t border-line flex items-center justify-between gap-3 bg-surface">
                            <div className="text-caption1 font-bold text-ink-3">
                                {rebalanceMode === 'contribute' && unallocated > 0.5 && (
                                    <span className="text-amber-500">{t('dash.unallocated')}: {formatNumber(unallocated)}€</span>
                                )}
                            </div>
                            <BounceButton onClick={applyRebalance} disabled={calculating || portfolioItems.length === 0} className="bg-brand hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-8 py-4 rounded-card font-semibold text-footnote shadow-card hover: dark:hover:">
                                {calculating ? <Loader2 className="animate-spin" /> : (rebalanceMode === 'contribute' ? t('dash.apply_contribute') : t('dash.apply_full'))}
                            </BounceButton>
                        </div>
                    </div>
                </motion.div>

                {/* BOTTOM: distribution + history */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    <motion.div variants={fadeInUp} className="xl:col-span-5">
                        <GlassCard className="relative h-full">
                            <div className="text-caption2 font-semibold text-ink-3">{t('dash.distribution')}</div>
                            <div className="w-full h-[160px] md:h-[175px] flex items-center justify-center mt-3">
                                {chartData.length > 0 ? (
                                    <div className="relative w-full h-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={chartData} 
                                                    cx="50%" cy="100%" 
                                                    startAngle={180} endAngle={0}
                                                    innerRadius={104} outerRadius={140}
                                                    paddingAngle={2} dataKey="value" stroke="none" cornerRadius={4}
                                                >
                                                    {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.2)', fontWeight: 'bold', background: '#0f172a', color: '#fff' }}
                                                    itemStyle={{ color: '#fff', fontSize: '13px' }}
                                                    labelStyle={{ display: 'none' }}
                                                    formatter={(val, name) => [`${formatNumber(val)} €`, name]}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute bottom-1 left-0 w-full text-center pointer-events-none px-4">
                                            <div className="text-caption2 font-semibold text-ink-3">{t('kpi.total_value')}</div>
                                            <div className="text-title1 font-semibold text-ink tracking-tight tabular-nums">{formatNumber(totalValue)} €</div>
                                            <div className="text-caption2 font-bold text-ink-3 truncate">{assetSummary}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-footnote font-bold text-ink-3 text-center py-10">{t('dash.empty')}</div>
                                )}
                            </div>

                            {/* Legend: which slice is which */}
                            {chartData.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 justify-center">
                                    {chartData.map((c, i) => (
                                        <div key={i} className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.fill }} />
                                            <span className="text-caption1 font-bold text-ink-2 truncate max-w-[110px]">{c.name}</span>
                                            <span className="text-caption1 font-semibold text-ink-3 tabular-nums">
                                                {totalValue > 0 ? formatNumber((safeFloat(c.value) / totalValue) * 100, 1) : 0}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>

                    <motion.div variants={fadeInUp} className="xl:col-span-7">
                    {/* HISTORY LOG */}
                    <AnimatePresence>
                        {rebalanceHistory.length > 0 && (
                            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="bg-surface p-8 rounded-card shadow-card border border-line">
                                <h3 className="text-footnote font-semibold text-ink-3 mb-6 flex items-center gap-2"><HistoryIcon size={14} /> {t('dash.history')}</h3>
                                <div className="space-y-4">
                                    {rebalanceHistory.map(h => (
                                        <motion.div key={h.id} variants={fadeInUp} className="group border border-line rounded-card overflow-hidden hover:shadow-card transition-all">
                                            <div className="flex justify-between items-center p-5 bg-surface-2/60">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-surface rounded-control border border-line text-ink-3"><Calendar size={16} /></div>
                                                    <div>
                                                        <div className="text-footnote font-semibold text-ink">{new Date(h.created_at).toLocaleDateString()}</div>
                                                        <div className="text-caption2 font-bold text-ink-3 ">{new Date(h.created_at).toLocaleTimeString()}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="text-footnote font-semibold text-brand">+{formatNumber(h.contribution)} €</div>
                                                        <div className="text-caption2 font-bold text-ink-3 ">{t('dash.contribution_short')}</div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => undoRebalance(h.id)} className="p-2 hover:brightness-95 rounded-control text-ink-3 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Undo"><RotateCcw size={18} /></button>
                                                        <button onClick={() => deleteHistoryItem(h.id)} className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-control text-ink-3 hover:text-rose-600 dark:hover:text-rose-400 transition-colors" title="Delete"><Trash2 size={18} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-5 bg-surface border-t border-line grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {h.items?.map(i => (
                                                    <div key={i.id} className="text-caption2 bg-surface-2 p-3 rounded-control flex justify-between items-center border border-line">
                                                        <div>
                                                            <div className="font-bold text-ink truncate w-24">{i.asset_name}</div>
                                                            <div className="font-mono text-ink-3">{i.ticker}</div>
                                                        </div>
                                                        <div className={`text-right font-semibold ${i.action === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {i.action === 'BUY' ? t('act.buy') : t('act.sell')}<br />
                                                            <span className="text-ink-3 font-mono">{formatUnits(safeFloat(i.units))} uds</span>
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
