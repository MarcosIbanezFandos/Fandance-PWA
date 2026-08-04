import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, Check, Flame, Pencil, TrendingUp, AlertCircle, Target, Trash2, Bookmark } from 'lucide-react';
import { Card, SectionHeader, Button, NumericField, Badge, ProgressBar, Segmented, Input } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { buildPlanStatus, planAmountFor, mesesHastaObjetivo, formatNumber, safeFloat } from '../utils';
import { cn } from '../lib/cn';

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cuántos meses por venir se muestran junto a los ya pasados. */
const FUTUROS = 6;

const hoyIso = () => new Date().toISOString().slice(0, 10);

/**
 * Plan de aportación periódica con seguimiento mensual.
 *
 * El check de cada mes NO se pulsa: sale de los rebalanceos ya aplicados. Si
 * este mes aportaste al menos lo previsto, el mes queda cumplido solo. Así el
 * plan no puede desalinearse de lo que realmente hiciste, y el verde significa
 * siempre lo mismo: dinero que ya entró.
 *
 * Los meses por venir se muestran con su importe pero nunca en verde: son
 * previsión, no cumplimiento.
 */
export const ContributionPlan = ({
    plan, planDefaults = null, onSave, history = [], saving = false, error = null, compact = false,
    savedPlans = [], onGuardarConNombre, onBorrarGuardado, onCargarGuardado,
    // Quien ya enseña un resumen aparte abre directamente el editor: pasar
    // por la vista de lectura otra vez sería un toque de más.
    iniciarEditando = false, onCerrarEdicion,
}) => {
    const { t } = useGlobal();
    const [editing, setEditing] = useState(iniciarEditando);

    // Si la cartera no tiene plan, el formulario arranca con la sugerencia en
    // vez de en blanco: rellenar campos desde cero es fricción para algo que
    // casi siempre tiene el mismo valor razonable.
    const seed = (p, d) => (safeFloat(p?.monthly) > 0 ? p : (d || { monthly: 0, annualGrowthPct: 0 }));
    const [monthly, setMonthly] = useState(() => seed(plan, planDefaults).monthly ?? 0);
    const [growth, setGrowth] = useState(() => seed(plan, planDefaults).annualGrowthPct ?? 0);
    const [frequency, setFrequency] = useState(() => plan?.frequency || 'monthly');
    const [targetDate, setTargetDate] = useState(() => (plan?.targetDate || '').slice(0, 10));
    const [nombre, setNombre] = useState('');

    useEffect(() => {
        const s = seed(plan, planDefaults);
        setMonthly(s.monthly ?? 0);
        setGrowth(s.annualGrowthPct ?? 0);
        setFrequency(plan?.frequency || 'monthly');
        setTargetDate((plan?.targetDate || '').slice(0, 10));
    }, [plan?.monthly, plan?.annualGrowthPct, plan?.frequency, plan?.targetDate, planDefaults]);

    const status = useMemo(
        () => buildPlanStatus({ plan, history, months: compact ? 6 : 12, ahead: compact ? 3 : FUTUROS }),
        [plan, history, compact]
    );

    const active = safeFloat(plan?.monthly) > 0;
    const dueNow = planAmountFor(plan);
    const current = status.currentMonth;
    const restantes = mesesHastaObjetivo(plan);

    const borrador = () => ({
        monthly: safeFloat(monthly),
        annualGrowthPct: safeFloat(growth),
        frequency,
        targetDate: targetDate || null,
        startDate: plan?.startDate || hoyIso(),
    });

    const cerrar = () => { setEditing(false); onCerrarEdicion?.(); };
    const save = () => { onSave(borrador()); cerrar(); };

    const guardarConNombre = () => {
        if (!nombre.trim() || !onGuardarConNombre) return;
        onGuardarConNombre(nombre.trim(), borrador());
        setNombre('');
    };

    const etiquetaFrecuencia = {
        monthly: t('plan.freq_monthly'), quarterly: t('plan.freq_quarterly'), biannual: t('plan.freq_biannual'),
    }[plan?.frequency || 'monthly'];

    /* ---------------- Sin plan / editando ---------------- */
    if (!active || editing) {
        return (
            <Card>
                <SectionHeader icon={CalendarCheck} title={t('plan.title')} hint={t('plan.hint')} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NumericField label={t('plan.monthly')} unit="€" value={monthly} onChange={setMonthly} placeholder="300" />
                    <NumericField label={t('plan.growth')} unit="%" value={growth} onChange={setGrowth} placeholder="3" />
                </div>

                <div className="mt-3">
                    <span className="label-caps block mb-1.5">{t('plan.frequency')}</span>
                    <Segmented
                        value={frequency} onChange={setFrequency} size="sm"
                        options={[
                            { value: 'monthly', label: t('plan.freq_monthly') },
                            { value: 'quarterly', label: t('plan.freq_quarterly') },
                            { value: 'biannual', label: t('plan.freq_biannual') },
                        ]}
                    />
                </div>

                <label className="block mt-3">
                    <span className="label-caps block mb-1.5">{t('plan.target_date')}</span>
                    <input
                        type="date"
                        value={targetDate}
                        min={hoyIso()}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="w-full bg-surface-2 rounded-field px-3 h-11 text-body text-ink outline-none focus:bg-surface-3 transition-colors"
                    />
                    <span className="block text-caption1 text-ink-3 mt-1">{t('plan.target_hint')}</span>
                </label>

                {safeFloat(monthly) > 0 && safeFloat(growth) !== 0 && (
                    <p className="text-footnote font-medium text-ink-2 mt-3 flex items-center gap-1.5">
                        <TrendingUp size={13} className="text-positive shrink-0" />
                        {t('plan.preview').replace('{y5}', formatNumber(safeFloat(monthly) * Math.pow(1 + safeFloat(growth) / 100, 5)))}
                    </p>
                )}

                {error && (
                    <p className="text-footnote font-medium text-negative mt-3 flex items-start gap-1.5">
                        <AlertCircle size={13} className="shrink-0 mt-0.5" />{error}
                    </p>
                )}

                <div className="flex gap-2 mt-4">
                    <Button onClick={save} loading={saving} disabled={safeFloat(monthly) <= 0}>{t('plan.save')}</Button>
                    {editing && <Button variant="ghost" onClick={cerrar}>{t('plan.cancel')}</Button>}
                </div>

                {/* Planes con nombre. Guardar el actual y recuperar otro sin
                    volver a teclear los cuatro campos. */}
                {onGuardarConNombre && (
                    <div className="mt-5 pt-4 border-t border-line">
                        <span className="label-caps block mb-2">{t('plan.saved_title')}</span>

                        <div className="flex gap-2">
                            <Input
                                icon={Bookmark} placeholder={t('plan.name_placeholder')}
                                value={nombre} onChange={(e) => setNombre(e.target.value)}
                                wrapperClassName="flex-1"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarConNombre(); } }}
                            />
                            <Button variant="secondary" onClick={guardarConNombre} disabled={!nombre.trim() || safeFloat(monthly) <= 0}>
                                {t('plan.save_as')}
                            </Button>
                        </div>

                        {savedPlans.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                                {savedPlans.map(g => (
                                    <li key={g.id} className="flex items-center gap-2 bg-surface-2 rounded-field pl-3 pr-1.5 min-h-[44px]">
                                        <button
                                            type="button"
                                            onClick={() => { onCargarGuardado?.(g); cerrar(); }}
                                            className="flex-1 min-w-0 text-left py-2"
                                        >
                                            <span className="block text-subhead text-ink truncate">{g.name}</span>
                                            <span className="block text-caption1 text-ink-3 tabular-nums">
                                                {formatNumber(g.monthly)} € · {{
                                                    monthly: t('plan.freq_monthly'), quarterly: t('plan.freq_quarterly'), biannual: t('plan.freq_biannual'),
                                                }[g.freq || 'monthly']}
                                                {safeFloat(g.growth) > 0 && ` · +${formatNumber(g.growth, 1)} %`}
                                            </span>
                                        </button>
                                        <Button
                                            size="icon" variant="danger-ghost"
                                            onClick={() => onBorrarGuardado?.(g.id)}
                                            aria-label={t('plan.delete_saved')}
                                        >
                                            <Trash2 size={15} />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
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
                hint={[
                    etiquetaFrecuencia,
                    restantes > 0 ? `${restantes} ${t('plan.months_left')}` : null,
                ].filter(Boolean).join(' · ')}
                action={
                    <div className="flex items-center gap-2">
                        {status.streak > 1 && <Badge tone="warning"><Flame size={11} /> {status.streak}</Badge>}
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
                        <div className="text-title1 font-bold tabular-nums text-ink mt-1">{formatNumber(dueNow)} €</div>
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
                    {dueNow <= 0
                        ? t('plan.not_due')
                        : current?.done
                            ? t('plan.done_month')
                            : `${formatNumber(current?.contributed || 0)} € ${t('plan.of')} ${formatNumber(dueNow)} €`}
                </p>
            </div>

            {/* Tira de meses: los pasados con su cumplimiento, los que vienen con
                su importe previsto. Verde sólo lo que ya entró. */}
            <div className="flex gap-1.5 scroll-x pb-1 custom-scrollbar">
                {status.rows.map(r => (
                    <motion.div
                        key={r.key}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                            'shrink-0 w-[4.25rem] rounded-control border p-2 text-center transition-colors',
                            r.noAplica ? 'bg-surface-2/50 border-line border-dashed'
                            : r.done ? 'bg-positive-soft border-positive/30'
                            : r.partial ? 'bg-warning-soft border-warning/30'
                            : r.isFuture ? 'bg-surface-2/60 border-line border-dashed'
                            : r.isCurrent ? 'bg-surface-2 border-brand/40'
                            : 'bg-surface-2 border-line'
                        )}
                        title={r.isFuture
                            ? `${formatNumber(r.planned)} €`
                            : `${formatNumber(r.contributed)} € / ${formatNumber(r.planned)} €`}
                    >
                        <div className="text-caption2 font-bold text-ink-3 uppercase">
                            {MONTH_SHORT[r.date.getMonth()]}
                        </div>

                        <div className={cn('text-caption2 font-semibold tabular-nums mt-0.5',
                            r.done ? 'text-positive' : r.isFuture ? 'text-ink-3' : 'text-ink-2')}>
                            {r.noAplica ? '—' : `${formatNumber(r.planned)} €`}
                        </div>

                        <div className="h-4 flex items-center justify-center mt-0.5">
                            {r.noAplica ? null
                                : r.done ? <Check size={13} className="text-positive" strokeWidth={3} />
                                : r.partial ? <span className="text-caption2 font-bold text-warning tabular-nums">
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

            {plan?.targetDate && (
                <p className="flex items-center gap-1.5 text-caption1 text-ink-3 mt-2">
                    <Target size={12} className="shrink-0" />
                    {t('plan.target_until')} {new Date(`${plan.targetDate.slice(0, 10)}T12:00:00`)
                        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </p>
            )}
        </Card>
    );
};
