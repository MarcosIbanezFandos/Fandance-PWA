import React from 'react';
import { Scale, AlertTriangle, Activity } from 'lucide-react';
import { Disclosure, NumericField, Badge } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { formatNumber, safeFloat } from '../utils';
import { LIMITE_PATRIMONIO } from '../lib/reglasReajuste';
import { cn } from '../lib/cn';

/**
 * Por qué la app dice que toca reajustar —o que no.
 *
 * La regla es de Indexa: una banda en puntos porcentuales que depende del
 * tamaño de la cartera, se ensancha con el mercado revuelto y se estrecha si el
 * reparto entre acciones y bonos se ha descolocado. Sin enseñarla, "no toca
 * reajustar" es una orden sin motivo; con ella es una decisión que el usuario
 * puede comprobar.
 *
 * Va plegada porque es una explicación, no un control: el titular basta el 90%
 * de las veces.
 */
export const BandaReajuste = ({ evaluacion, minOperacion = 100, onCambiarMinimo }) => {
    const { t } = useGlobal();
    const [min, setMin] = React.useState(minOperacion);

    React.useEffect(() => { setMin(minOperacion); }, [minOperacion]);

    if (!evaluacion || !evaluacion.filas.length) return null;

    const { patrimonio, umbralBase, vixAlto, agregadoDisparado, desvioAgregado, fueraDeBanda, necesitaReajuste } = evaluacion;
    const umbralFinal = agregadoDisparado ? umbralBase / 2 : umbralBase;

    const titular = necesitaReajuste
        ? t('banda.title_out').replace('{n}', fueraDeBanda.length)
        : t('banda.title_ok');

    const guardarMin = () => {
        const v = Math.max(0, safeFloat(min));
        if (v !== safeFloat(minOperacion)) onCambiarMinimo?.(v);
    };

    return (
        <Disclosure
            icon={necesitaReajuste ? AlertTriangle : Scale}
            tone={necesitaReajuste ? 'warning' : 'neutral'}
            title={`${titular} · ±${formatNumber(umbralFinal, 2)} pp`}
        >
            <div className="space-y-3">
                <p>
                    {t('banda.explain')
                        .replace('{banda}', formatNumber(umbralFinal, 2))
                        .replace('{limite}', formatNumber(LIMITE_PATRIMONIO))
                        .replace('{lado}', patrimonio >= LIMITE_PATRIMONIO ? t('banda.above') : t('banda.below'))}
                </p>

                {/* Correcciones sobre la banda base, sólo cuando aplican. */}
                {(vixAlto || agregadoDisparado) && (
                    <div className="flex flex-wrap gap-1.5">
                        {vixAlto && (
                            <Badge tone="warning"><Activity size={11} /> {t('banda.vix')}</Badge>
                        )}
                        {agregadoDisparado && (
                            <Badge tone="brand">
                                {t('banda.aggregate').replace('{pp}', formatNumber(Math.abs(desvioAgregado), 1))}
                            </Badge>
                        )}
                    </div>
                )}

                {fueraDeBanda.length > 0 && (
                    <ul className="space-y-1">
                        {fueraDeBanda.map(r => (
                            <li key={r.id} className="flex items-center gap-2 tabular-nums">
                                <span className="flex-1 truncate">{r.nombre}</span>
                                <span className={cn('shrink-0 font-semibold', r.desvio > 0 ? 'text-warning' : 'text-brand')}>
                                    {r.desvio > 0 ? '+' : '−'}{formatNumber(Math.abs(r.desvio), 2)} pp
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* El mínimo por operación se edita aquí porque es la otra mitad
                    de la misma regla: cuándo merece la pena mover dinero. */}
                {onCambiarMinimo && (
                    <div className="pt-2 border-t border-line">
                        <NumericField
                            label={t('banda.min_op')}
                            unit="€"
                            value={min}
                            onChange={setMin}
                            onBlur={guardarMin}
                        />
                        <p className="text-caption1 text-ink-3 mt-1.5 leading-snug">{t('banda.min_op_hint')}</p>
                    </div>
                )}
            </div>
        </Disclosure>
    );
};
