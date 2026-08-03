import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, Check, Flame, Pencil, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, SectionHeader, Button, NumericField, Badge, ProgressBar } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { buildPlanStatus, planAmountFor, formatNumber, safeFloat } from '../utils';
import { cn } from '../lib/cn';

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Plan de aportación periódica con seguimiento mensual.
 *
 * El check de cada mes NO se pulsa: sale de los rebalanceos ya aplicados. Si
 * este mes aportaste al menos lo previsto, el mes queda cumplido solo. Así el
 * plan no puede desalinearse de lo que realmente hiciste.
 */
export const ContributionPlan = ({ plan, planDefaults = null, onSave, history = [], saving = false, error = null, compact = false }) => {
    const { t } = useGlobal();
    const [editing, setEditing] = useState(false);
    // Si la cartera no tiene plan, el formulario arranca con la sugerencia en
    // vez de en blanco: rellenar dos campos desde cero es fricción para algo
    // que casi siempre tiene el mismo valor razonable.
    const seed = (p, d) => (safeFloat(p?.monthly) > 0 ? p : (d || { monthly: 0, annualGrowthPct: 0 }));
    const [monthly, setMonthly] = useState(() => seed(plan, planDefaults).monthly ?? 0);
    const [growth, setGrowth] = useState(() => seed(plan, planDefaults).annualGrowthPct ?? 0);

    useEffect(() => {
        const s = seed(plan, planDefaults);
        setMonthly(s.monthly ?? 0);
        setGrowth(s.annualGrowthPct ?? 0);
    }, [plan?.monthly, plan?.annualGrowthPct, planDefaults]);

    const status = useMemo(
        () => buildPlanStatus({ plan, history, months: compact ? 6 : 12 }),
        [plan, history, compact]
    );

    const active = safeFloat(plan?.monthly) > 0;
    const dueNow = planAmountFor(plan);
    const current = status.currentMonth;

    const save = () => {
        onSave({
            monthly: safeFloat(monthly),
            annualGrowthPct: safeFloat(growth),
            startDate: plan?.startDate || new Date().toISOString().slice(0, 10),
        });
        setEditing(false);
    };

    /* ---------------- Sin plan / editando ---------------- */
    if (!active || editing) {
        return (
            <Card>
                <SectionHeader
                    icon={CalendarCheck}
                    title={t('plan.title')}
                    hint={t('plan.hint')}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NumericField
                        label={t('plan.monthly')} unit="€"
                        value={monthly} onChange={setMonthly} placeholder="300"
                    />
                    <NumericField
                        label={t('plan.growth')} unit="%"
                        value={growth} onChange={setGrowth} placeholder="3"
                    />
                </div>

                {safeFloat(monthly) > 0 && safeFloat(growth) !== 0 && (
                    <p className="text-footnote font-medium text-ink-2 mt-3 flex items-center gap-1.5">
                        <TrendingUp size={13} className="text-positive shrink-0" />
                        {t('plan.preview')
                            .replace('{y5}', formatNumber(safeFloat(monthly) * Math.pow(1 + safeFloat(growth) / 100, 5)))}
                    </p>
                )}

                {error && (
                    <p className="text-footnote font-medium text-negative mt-3 flex items-start gap-1.5">
                        <AlertCircle size={13} className="shrink-0 mt-0.5" />{error}
                    </p>
                )}

                <div className="flex gap-2 mt-4">
                    <Button onClick={save} loading={saving} disabled={safeFloat(monthly) <= 0}>
                        {t('plan.save')}
                    </Button>
                    {editing && (
                        <Button variant="ghost" onClick={() => setEditing(false)}>{t('plan.cancel')}</Button>
                    )}
                </div>
            </Card>
        );
    }

    /* ---------------- Plan activo ---------------- */
    const progressPct = current && current.planned > 0
        ? Math.min(100, (current.contributed / current.planned) * 100)
        : 0;

    return (
        <Card>
            <SectionHeader
                icon={CalendarCheck}
                title={t('plan.title')}
                action={
                    <div className="flex items-center gap-2">
                        {status.streak > 1 && (
                            <Badge tone="warning"><Flame size={11} /> {status.streak}</Badge>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={t('plan.edit')}>
                            <Pencil size={14} />
                        </Button>
                    </div>
                }
            />

            {/* Mes en curso */}
            <div className={cn(
                'rounded-control border p-4 mb-4',
                current?.done ? 'bg-positive-soft border-positive/25' : 'bg-surface-2 border-line'
            )}>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0">
                        <div className="label-caps">{t('plan.this_month')}</div>
                        <div className="text-title1 font-bold tabular-nums text-ink mt-1">
                            {formatNumber(dueNow)} €
                        </div>
                    </div>
                    {current?.done ? (
                        <span className="w-9 h-9 rounded-full bg-positive flex items-center justify-center shrink-0">
                            <Check size={18} className="text-white" strokeWidth={3} />
                        </span>
                    ) : (
                        <span className="w-9 h-9 rounded-full border-2 border-dashed border-line-strong shrink-0" />
                    )}
                </div>

                <ProgressBar pct={progressPct} tone={current?.done ? 5 : 1} height="h-1.5" />
                <p className="text-footnote font-semibold text-ink-2 mt-2 tabular-nums">
                    {current?.done
                        ? t('plan.done_month')
                        : `${formatNumber(current?.contributed || 0)} € ${t('plan.of')} ${formatNumber(dueNow)} €`}
                </p>
            </div>

            {/* Historial de meses */}
            <div className="flex gap-1.5 scroll-x pb-1 custom-scrollbar">
                {status.rows.map(r => (
                    <motion.div
                        key={r.key}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                            'shrink-0 w-[3.25rem] rounded-control border p-2 text-center transition-colors',
                            r.done ? 'bg-positive-soft border-positive/30'
                            : r.partial ? 'bg-warning-soft border-warning/30'
                            : r.isCurrent ? 'bg-surface-2 border-brand/40'
                            : 'bg-surface-2 border-line'
                        )}
                        title={`${formatNumber(r.contributed)} € / ${formatNumber(r.planned)} €`}
                    >
                        <div className="text-caption2 font-bold text-ink-3 uppercase">
                            {MONTH_SHORT[r.date.getMonth()]}
                        </div>
                        <div className="h-5 flex items-center justify-center mt-1">
                            {r.done
                                ? <Check size={14} className="text-positive" strokeWidth={3} />
                                : r.partial
                                    ? <span className="text-caption2 font-bold text-warning tabular-nums">
                                        {Math.round((r.contributed / r.planned) * 100)}%
                                    </span>
                                    : <span className="w-1.5 h-1.5 rounded-full bg-line-strong" />}
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-line">
                <span className="text-footnote font-medium text-ink-2">
                    {status.doneCount}/{status.pastCount} {t('plan.months_met')}
                </span>
                <span className="text-footnote font-bold text-ink tabular-nums">
                    {formatNumber(status.contributedTotal)} € {t('plan.contributed')}
                </span>
            </div>
        </Card>
    );
};
