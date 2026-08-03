import React, { useState } from 'react';
import api from '../api'
import { FlaskConical, Briefcase, Coins, Check } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GlassCard, SectionHeader, Segmented, Button, Toggle, NumericField, fadeInUp, staggerContainer } from './UI';
import { motion } from 'framer-motion';
import { useGlobal } from '../context/GlobalContext';
import { ContributionSchedule } from './ContributionSchedule';
import { ContributionPlan } from './ContributionPlan';
import { safeFloat, formatNumber } from '../utils';
import { cn } from '../lib/cn';

const MODEL_HINT = {
    deterministic: 'sim.linear_desc',
    montecarlo: 'sim.montecarlo_desc',
    pessimistic: 'sim.conservative_desc',
};

export const SimulationView = ({
    portfolios = [], activePortfolioId,
    plan, planDefaults, onSavePlan, planSaving, planError, rebalanceHistory = [],
}) => {
    const { t } = useGlobal();
    const [selectedPorts, setSelectedPorts] = useState([]);
    const [years, setYears] = useState(10);
    const [simType, setSimType] = useState('deterministic');
    const [applyTax, setApplyTax] = useState(false);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);

    // La aportación de la proyección sale del plan salvo que se pida lo
    // contrario. Antes había dos campos idénticos en la misma pantalla —el del
    // plan y el de los parámetros— y nada decía cuál mandaba.
    const [useCustom, setUseCustom] = useState(false);
    const [customMonthly, setCustomMonthly] = useState(500);
    const [customGrowth, setCustomGrowth] = useState(0);

    const planActivo = safeFloat(plan?.monthly) > 0;
    const monthlyContrib = useCustom || !planActivo ? safeFloat(customMonthly) : safeFloat(plan.monthly);
    const growthRate = useCustom || !planActivo ? safeFloat(customGrowth) : safeFloat(plan.annualGrowthPct);
    const contribMode = growthRate > 0 ? 'growing' : 'constant';

    // Sin plan no hay nada de donde tirar: se abre directamente en manual.
    React.useEffect(() => { if (!planActivo) setUseCustom(true); }, [planActivo]);

    // Al pasar a manual, se parte de los números del plan en lugar de un valor
    // suelto: así se edita sobre lo real en vez de empezar de cero.
    React.useEffect(() => {
        if (useCustom && planActivo) {
            setCustomMonthly(safeFloat(plan.monthly));
            setCustomGrowth(safeFloat(plan.annualGrowthPct));
        }
    }, [useCustom]);

    React.useEffect(() => {
        if (activePortfolioId && selectedPorts.length === 0) setSelectedPorts([activePortfolioId]);
    }, [activePortfolioId]);

    const togglePortfolio = (id) => {
        if (selectedPorts.includes(id)) setSelectedPorts(selectedPorts.filter(p => p !== id));
        else if (selectedPorts.length < 2) setSelectedPorts([...selectedPorts, id]);
    };

    const portName = (pid) => portfolios.find(p => p.id === pid)?.name || 'Portfolio';

    const runSimulation = async () => {
        if (selectedPorts.length === 0) return alert(t('sim.select_alert'));
        setLoading(true);
        try {
            const res = await api.post(`${import.meta.env.VITE_API_URL}/simulations/run`, {
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

    const currentYear = new Date().getFullYear();

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-5">
                {/* 1. El plan: el compromiso real. Es la única entrada de
                    "cuánto aporto"; la proyección de abajo bebe de aquí en vez
                    de repetir los mismos dos campos. */}
                {onSavePlan && (
                    <ContributionPlan
                        plan={plan}
                        planDefaults={planDefaults}
                        onSave={onSavePlan}
                        history={rebalanceHistory}
                        saving={planSaving}
                        error={planError}
                    />
                )}

                {/* 2. Qué proyectar */}
                <GlassCard>
                    <SectionHeader icon={Briefcase} title={t('sim.select_portfolio')} />
                    <div className="space-y-2">
                        {portfolios.map(p => {
                            const sel = selectedPorts.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => togglePortfolio(p.id)}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-3.5 min-h-tap rounded-control text-left text-body transition-colors',
                                        sel ? 'bg-brand-soft text-brand-ink font-semibold' : 'bg-surface-2 text-ink active:bg-surface-3'
                                    )}
                                >
                                    <span className="truncate">{p.name}</span>
                                    {sel && <Check size={17} className="text-brand shrink-0" strokeWidth={2.5} />}
                                </button>
                            );
                        })}
                    </div>
                </GlassCard>

                {/* 3. Cómo proyectar */}
                <GlassCard className="space-y-5">
                    <div>
                        <SectionHeader icon={FlaskConical} title={t('sim.model')} hint={MODEL_HINT[simType] && t(MODEL_HINT[simType])} />
                        <Segmented
                            value={simType}
                            onChange={setSimType}
                            options={[
                                { value: 'deterministic', label: t('sim.linear') },
                                { value: 'montecarlo', label: t('sim.montecarlo') },
                                { value: 'pessimistic', label: t('sim.conservative') },
                            ]}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-baseline mb-2">
                            <span className="text-subhead text-ink">{t('sim.horizon')}</span>
                            <span className="text-subhead font-semibold text-brand tabular-nums">{years} {t('sim.years')}</span>
                        </div>
                        <input
                            type="range" min="1" max="60" value={years}
                            onChange={e => setYears(parseInt(e.target.value))}
                            className="w-full accent-indigo-600 cursor-pointer"
                        />
                    </div>

                    {/* De dónde salen las aportaciones. Por defecto, del plan:
                        tener los mismos dos campos en dos sitios de la misma
                        pantalla era la principal fuente de confusión. */}
                    <div>
                        <SectionHeader icon={Coins} title={t('sim.source')} className="mb-2.5" />
                        <Segmented
                            value={useCustom ? 'custom' : 'plan'}
                            onChange={(v) => setUseCustom(v === 'custom')}
                            options={[
                                { value: 'plan', label: t('sim.use_plan') },
                                { value: 'custom', label: t('sim.custom') },
                            ]}
                        />

                        {!useCustom ? (
                            <p className="text-footnote text-ink-2 mt-3 leading-snug">
                                {planActivo
                                    ? t('sim.from_plan')
                                        .replace('{m}', formatNumber(safeFloat(plan.monthly)))
                                        .replace('{g}', formatNumber(safeFloat(plan.annualGrowthPct), 1))
                                    : t('sim.no_plan')}
                            </p>
                        ) : (
                            <div className="space-y-3 mt-3">
                                <NumericField
                                    label={t('sim.monthly')} unit="€"
                                    value={customMonthly}
                                    onChange={setCustomMonthly}
                                />
                                <NumericField
                                    label={t('sim.annual_growth')} unit="%"
                                    value={customGrowth}
                                    onChange={setCustomGrowth}
                                />
                            </div>
                        )}
                    </div>

                    <div className="px-3 py-1 bg-surface-2 rounded-control">
                        <Toggle checked={applyTax} onChange={setApplyTax} label={t('sim.apply_tax')} />
                    </div>

                    <Button size="lg" className="w-full" loading={loading} onClick={runSimulation}>
                        {t('sim.calculate')}
                    </Button>
                </GlassCard>

                <ContributionSchedule
                    monthly={monthlyContrib}
                    annualGrowthPct={growthRate}
                    months={years * 12}
                />
            </div>

            <motion.div variants={fadeInUp} className="lg:col-span-2 space-y-6">
                {results ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {results.map((res, i) => (
                                <GlassCard key={i} className="!p-6 border-t-4 border-t-indigo-500">
                                    <div className="text-footnote font-semibold text-ink-3 mb-4">{res.portfolio_name}</div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="text-subhead text-ink-3 font-bold">{t('sim.investment')}</div>
                                            <div className="text-title2 font-semibold text-ink">{res.total_invested.toLocaleString()} €</div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-subhead text-ink-3 font-bold">{t('sim.gross')}</div>
                                            <div className="text-title1 font-semibold text-brand">{res.final_gross.toLocaleString()} €</div>
                                        </div>
                                        {applyTax && (
                                            <div className="flex justify-between items-end pt-2 border-t border-line">
                                                <div className="text-subhead text-ink-3 font-bold">{t('sim.net')}</div>
                                                <div className="text-title1 font-semibold text-emerald-600 dark:text-emerald-400">{res.final_net.toLocaleString()} €</div>
                                            </div>
                                        )}
                                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-caption2 font-semibold uppercase ${res.gain >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400'}`}>
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
                    <div className="h-full flex flex-col items-center justify-center text-ink-3 border-2 border-dashed border-line rounded-card py-20">
                        <FlaskConical size={48} className="mb-4 opacity-50" />
                        <div className="text-subhead font-bold text-center mt-4">{t('sim.empty')}</div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}