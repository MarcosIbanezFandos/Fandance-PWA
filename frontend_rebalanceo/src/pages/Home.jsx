import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import {
    Scale, ScanSearch, Newspaper, History, Target,
    ArrowRight, CheckCircle2, Inbox, TrendingUp, TrendingDown,
} from 'lucide-react';
import api from '../api';
import { Card, SectionHeader, Button, Badge, Segmented, EmptyState, Skeleton, staggerContainer } from '../components/UI';
import { ContributionPlan } from '../components/ContributionPlan';
import { useGlobal } from '../context/GlobalContext';
import {
    safeFloat, formatNumber, formatSeriesDates, computeDrift, driftBand, driftSeverity,
} from '../utils';
import { cn } from '../lib/cn';

const PERIODS = [
    { value: '1mo', label: '1M' },
    { value: '6mo', label: '6M' },
    { value: '1y', label: '1A' },
    { value: 'max', label: 'MAX' },
];

/**
 * Inicio — el panel de decisión.
 *
 * Responde a una sola pregunta: "¿voy bien y qué tengo que hacer este mes?".
 * Todo lo que no ayude a contestarla vive en otra pestaña.
 */
export const Home = ({
    portfolios = [], activePortfolio, portfolioItems = [], totalValue = 0,
    rebalanceHistory = [], plan, onSavePlan, planSaving, planError,
}) => {
    const { t } = useGlobal();
    const [period, setPeriod] = useState('1y');
    const [evolution, setEvolution] = useState([]);
    const [changePct, setChangePct] = useState(0);
    const [changeVal, setChangeVal] = useState(0);
    const [loading, setLoading] = useState(false);

    const pid = activePortfolio?.id;

    useEffect(() => {
        if (!pid) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const r = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/history_chart`, {
                    portfolio_id: pid, period,
                });
                if (cancelled) return;
                setEvolution(formatSeriesDates(r?.data?.history));
                setChangePct(safeFloat(r?.data?.change_pct));
                setChangeVal(safeFloat(r?.data?.change_val));
            } catch {
                if (!cancelled) { setEvolution([]); setChangePct(0); setChangeVal(0); }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [pid, period]);

    const drift = useMemo(() => computeDrift(portfolioItems), [portfolioItems]);
    const positive = changePct >= 0;

    /* ------------------------------------------------------------------ *
     *  Qué hacer ahora. Sólo se muestra lo accionable: una lista de avisos
     *  que siempre tiene algo dentro deja de leerse a la semana.
     * ------------------------------------------------------------------ */
    const actions = useMemo(() => {
        const out = [];

        const targetSum = portfolioItems.reduce((s, i) => s + safeFloat(i.targetWeight), 0);
        if (portfolioItems.length && Math.abs(targetSum - 100) > 1) {
            out.push({
                key: 'targets',
                tone: 'warning',
                icon: Target,
                title: t('home.act_targets'),
                body: t('home.act_targets_body').replace('{sum}', formatNumber(targetSum, 1)),
                to: '/posiciones',
                cta: t('home.act_targets_cta'),
            });
        }

        const worst = drift.worst;
        if (worst && driftSeverity(worst) !== 'ok') {
            out.push({
                key: 'drift',
                tone: driftSeverity(worst) === 'high' ? 'negative' : 'warning',
                icon: Scale,
                title: t('home.act_drift').replace('{name}', worst.name || worst.ticker),
                body: t('home.act_drift_body')
                    .replace('{drift}', formatNumber(worst.absDrift, 1))
                    .replace('{dir}', worst.drift > 0 ? t('home.overweight') : t('home.underweight'))
                    .replace('{band}', formatNumber(driftBand(worst.target), 1)),
                to: '/posiciones',
                cta: t('home.act_drift_cta'),
            });
        }

        return out;
    }, [portfolioItems, drift, t]);

    if (!activePortfolio) {
        return (
            <Card>
                <EmptyState
                    icon={Inbox}
                    title={portfolios.length ? t('home.select_portfolio') : t('home.no_portfolio')}
                    hint={portfolios.length ? null : t('home.no_portfolio_hint')}
                />
            </Card>
        );
    }

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5 md:space-y-6">

            {/* ---------- Patrimonio + evolución ---------- */}
            <Card className="!p-0 overflow-hidden">
                <div className="p-5 md:p-6 pb-0 flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="label-caps">{t('home.net_worth')}</div>
                        <div className="text-largetitle md:text-largetitle font-bold tracking-tight text-ink tabular-nums mt-1.5">
                            {formatNumber(totalValue)} €
                        </div>
                        {!loading && evolution.length > 1 && (
                            <div className={cn(
                                'flex items-center gap-1.5 mt-2 text-subhead font-bold tabular-nums',
                                positive ? 'text-positive' : 'text-negative'
                            )}>
                                {positive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                                {positive ? '+' : ''}{formatNumber(changePct, 2)}%
                                <span className="text-ink-3 font-semibold">
                                    ({positive ? '+' : ''}{formatNumber(changeVal)} €)
                                </span>
                            </div>
                        )}
                    </div>
                    <Segmented size="sm" value={period} onChange={setPeriod} options={PERIODS} />
                </div>

                <div className={cn("mt-3", evolution.length > 1 || loading ? "h-44 md:h-52" : "h-24")}>
                    {loading ? (
                        <div className="px-5 pb-5"><Skeleton className="h-full w-full" /></div>
                    ) : evolution.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolution} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={`rgb(var(${positive ? '--c-positive' : '--c-negative'}))`} stopOpacity={0.22} />
                                        <stop offset="100%" stopColor={`rgb(var(${positive ? '--c-positive' : '--c-negative'}))`} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <YAxis domain={['auto', 'auto']} hide />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px', border: '1px solid rgb(var(--c-line))',
                                        background: 'rgb(var(--c-surface))', padding: '8px 10px',
                                        boxShadow: '0 8px 24px -12px rgb(15 23 42 / .25)',
                                    }}
                                    labelStyle={{ fontSize: '11px', color: 'rgb(var(--c-ink-3))', fontWeight: 600 }}
                                    itemStyle={{ fontSize: '13px', color: 'rgb(var(--c-ink))', fontWeight: 700, padding: 0 }}
                                    formatter={(v) => [`${formatNumber(v)} €`, t('home.value')]}
                                    labelFormatter={(l, p) => p?.[0]?.payload?.full || l}
                                />
                                <Area
                                    type="monotone" dataKey="value"
                                    stroke={`rgb(var(${positive ? '--c-positive' : '--c-negative'}))`}
                                    strokeWidth={2} fill="url(#homeGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-footnote font-medium text-ink-3">
                            {t('home.no_history')}
                        </div>
                    )}
                </div>
            </Card>

            {/* ---------- Qué hacer ahora ---------- */}
            {actions.length > 0 ? (
                <div className="space-y-3">
                    {actions.map(a => (
                        <Link key={a.key} to={a.to} className="block group">
                            <Card interactive className={cn(
                                '!p-4 flex items-start gap-3.5',
                                a.tone === 'negative' ? '!border-negative/30' : '!border-warning/30'
                            )}>
                                <span className={cn(
                                    'w-9 h-9 rounded-control flex items-center justify-center shrink-0',
                                    a.tone === 'negative' ? 'bg-negative-soft text-negative' : 'bg-warning-soft text-warning'
                                )}>
                                    <a.icon size={17} strokeWidth={2.25} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-subhead font-semibold text-ink">{a.title}</p>
                                    <p className="text-footnote font-medium text-ink-2 mt-0.5 leading-relaxed">{a.body}</p>
                                    <span className="inline-flex items-center gap-1 text-footnote font-bold text-brand mt-2">
                                        {a.cta} <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                                    </span>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : portfolioItems.length > 0 && (
                <Card className="!p-4 flex items-center gap-3.5 !border-positive/30">
                    <span className="w-9 h-9 rounded-control bg-positive-soft text-positive flex items-center justify-center shrink-0">
                        <CheckCircle2 size={17} strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-subhead font-semibold text-ink">{t('home.all_good')}</p>
                        <p className="text-footnote font-medium text-ink-2 mt-0.5">
                            {t('home.all_good_body').replace('{drift}', formatNumber(drift.totalDrift, 1))}
                        </p>
                    </div>
                </Card>
            )}

            {/* ---------- Plan + desviación ---------- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ContributionPlan
                    plan={plan}
                    onSave={onSavePlan}
                    history={rebalanceHistory}
                    saving={planSaving}
                    error={planError}
                    compact
                />

                <Card>
                    <SectionHeader
                        icon={Scale}
                        title={t('home.drift')}
                        hint={t('home.drift_hint')}
                        action={
                            <Badge tone={drift.totalDrift > 5 ? 'negative' : drift.totalDrift > 2 ? 'warning' : 'positive'}>
                                {formatNumber(drift.totalDrift, 1)} pp
                            </Badge>
                        }
                    />
                    {drift.rows.length === 0 ? (
                        <p className="text-footnote font-medium text-ink-3 py-3">{t('home.no_targets')}</p>
                    ) : (
                        <>
                            <ul className="space-y-3">
                                {drift.rows.slice(0, 5).map(r => {
                                    const sev = driftSeverity(r);
                                    return (
                                        <li key={r.id || r.ticker}>
                                            <div className="flex items-baseline justify-between gap-3 mb-1">
                                                <span className="text-subhead font-semibold text-ink truncate">{r.name}</span>
                                                <span className={cn(
                                                    'text-footnote font-bold shrink-0 tabular-nums',
                                                    sev === 'high' ? 'text-negative' : sev === 'warn' ? 'text-warning' : 'text-ink-3'
                                                )}>
                                                    {r.drift > 0 ? '+' : ''}{formatNumber(r.drift, 1)} pp
                                                </span>
                                            </div>
                                            {/* Objetivo vs real, misma escala */}
                                            <div className="relative h-1.5 rounded-full bg-surface-3 overflow-hidden">
                                                <div className="absolute inset-y-0 left-0 bg-brand/35 rounded-full" style={{ width: `${Math.min(100, r.target)}%` }} />
                                                <div className={cn(
                                                    'absolute inset-y-0 left-0 rounded-full',
                                                    sev === 'high' ? 'bg-negative' : sev === 'warn' ? 'bg-warning' : 'bg-brand'
                                                    )} style={{ width: `${Math.min(100, r.current)}%`, opacity: 0.85 }} />
                                            </div>
                                            <div className="flex justify-between text-caption2 font-semibold text-ink-3 mt-1 tabular-nums">
                                                <span>{t('home.actual')} {formatNumber(r.current, 1)}%</span>
                                                <span>{t('home.target')} {formatNumber(r.target, 1)}%</span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            <Link to="/posiciones">
                                <Button variant="ghost" size="sm" className="w-full mt-4" iconRight={ArrowRight}>
                                    {t('home.see_positions')}
                                </Button>
                            </Link>
                        </>
                    )}
                </Card>
            </div>

            {/* ---------- Accesos secundarios ---------- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { to: '/xray', icon: ScanSearch, label: t('nav.xray_full') },
                    { to: '/rendimiento', icon: TrendingUp, label: t('nav.performance') },
                    { to: '/historial', icon: History, label: t('nav.history') },
                    { to: '/noticias', icon: Newspaper, label: t('nav.news') },
                ].map(s => (
                    <Link key={s.to} to={s.to}>
                        <Card interactive className="!p-4 flex flex-col items-center text-center gap-2">
                            <span className="w-10 h-10 rounded-control bg-surface-2 border border-line flex items-center justify-center">
                                <s.icon size={18} className="text-ink-2" strokeWidth={2} />
                            </span>
                            <span className="text-footnote font-semibold text-ink leading-tight">{s.label}</span>
                        </Card>
                    </Link>
                ))}
            </div>
        </motion.div>
    );
};
