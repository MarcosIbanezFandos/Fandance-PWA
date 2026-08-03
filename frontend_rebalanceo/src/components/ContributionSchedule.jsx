import React, { useMemo } from 'react';
import { CalendarClock, TrendingUp } from 'lucide-react';
import { GlassCard } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { buildContributionSchedule, formatNumber } from '../utils';

/**
 * "Cuánto pongo cada mes": the contribution calendar behind the projection.
 *
 * Live by design — it reacts to the sliders instead of waiting for "Calcular",
 * because its whole point is answering "¿cómo me afecta subir el IPC?" before
 * running anything.
 */
export const ContributionSchedule = ({ monthly, annualGrowthPct = 0, months }) => {
    const { t } = useGlobal();

    const { rows, total, step, lastAmount, monthlyGrowthPct } = useMemo(
        () => buildContributionSchedule({ monthly, annualGrowthPct, months }),
        [monthly, annualGrowthPct, months]
    );

    const growing = annualGrowthPct > 0 && rows.length > 0;
    const byYear = step === 12;

    return (
        <GlassCard className="space-y-4">
            <div>
                <div className="flex items-center gap-2">
                    <CalendarClock size={15} className="text-ink-3" />
                    <h3 className="text-caption2 font-semibold text-ink-3">{t('sched.title')}</h3>
                </div>
                {rows.length > 0 && (
                    <p className="mt-1.5 text-caption1 font-medium text-ink-3">
                        {growing
                            ? `${t('sched.growing_hint')} +${formatNumber(annualGrowthPct, 1)}% ${t('sched.per_year')} (+${formatNumber(monthlyGrowthPct, 2)}% ${t('sched.per_month')}).`
                            : t('sched.constant_hint')}
                    </p>
                )}
            </div>

            {rows.length === 0 ? (
                <div className="rounded-card border border-dashed border-line px-4 py-6 text-center">
                    <p className="text-caption1 font-bold text-ink-3">{t('sched.empty')}</p>
                </div>
            ) : (
                <>
                    <div className="flex gap-2 scroll-x pb-2 -mx-1 px-1 snap-x custom-scrollbar">
                        {rows.map((r, i) => {
                            const last = i === rows.length - 1;
                            return (
                                <div
                                    key={r.month}
                                    className={`shrink-0 snap-start min-w-[88px] rounded-card px-3 py-2.5 border transition-colors ${last && rows.length > 1
                                ? 'bg-brand-soft border-brand/25'
                                : 'bg-surface-2 border-transparent'}`}
                                >
                                    <div className={`text-caption2 font-semibold ${last && rows.length > 1 ? 'text-brand' : 'text-slate-400'}`}>
                                        {byYear ? `${t('sched.year')} ${r.year}` : `${t('sched.month')} ${r.month}`}
                                    </div>
                                    <div className="text-caption2 font-bold text-ink-3 h-3">
                                        {byYear ? `${t('sched.month')} ${r.month}` : ''}
                                    </div>
                                    <div className={`mt-0.5 text-subhead font-semibold tabular-nums ${last && rows.length > 1 ? 'text-brand' : 'text-ink'}`}>
                                        {formatNumber(r.amount)} €
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-caption2 font-semibold text-ink-3">{t('sched.total')}</span>
                        <span className="text-subhead font-semibold tabular-nums text-ink">{formatNumber(total)} €</span>
                    </div>
                    {growing && (
                        <div className="flex items-center gap-1.5 text-caption2 font-bold text-emerald-600 dark:text-emerald-400">
                            <TrendingUp size={12} className="shrink-0" />
                            {`${t('sched.ends_at')} ${formatNumber(lastAmount)} € ${t('sched.per_month')}`}
                        </div>
                    )}
                </>
            )}
        </GlassCard>
    );
};
