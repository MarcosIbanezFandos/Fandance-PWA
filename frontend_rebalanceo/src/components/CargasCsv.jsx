import React, { useMemo } from 'react';
import { FileText, Trash2, Inbox } from 'lucide-react';
import { Card, SectionHeader, Button, EmptyState, Badge } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { formatNumber } from '../utils';
import { invertidoTotal } from '../lib/trImport';
import { cn } from '../lib/cn';

/**
 * Los ficheros CSV subidos, y qué aportó cada uno.
 *
 * La cifra que importa no es cuántas líneas traía el fichero sino cuánto movió
 * el patrimonio invertido: es lo que permite reconocer al vuelo el mes en que
 * se aportó de más, o detectar que una importación no cuadró. Por eso se
 * calcula el invertido acumulado tras cada carga y se muestra la diferencia.
 *
 * Se puede borrar un fichero suelto: lo que aportó desaparece y el resto se
 * queda, porque cada carga guarda sus propios movimientos.
 */
export const CargasCsv = ({ cargas = [], onBorrar }) => {
    const { t } = useGlobal();

    // Las cargas llegan de más reciente a más antigua. Para saber qué aportó
    // cada una hay que reconstruir el acumulado desde la primera.
    const filas = useMemo(() => {
        const cronologico = [...cargas].reverse();
        let acumulado = [];
        let previo = 0;
        const out = cronologico.map(c => {
            acumulado = [...acumulado, ...(c.txs || [])];
            const invertido = invertidoTotal(acumulado);
            const delta = invertido - previo;
            previo = invertido;
            return { ...c, invertido, delta, operaciones: (c.txs || []).length };
        });
        return out.reverse();
    }, [cargas]);

    if (!filas.length) {
        return (
            <Card>
                <SectionHeader icon={FileText} title={t('cargas.title')} hint={t('cargas.hint')} />
                <EmptyState icon={Inbox} title={t('cargas.empty')} hint={t('cargas.empty_hint')} />
            </Card>
        );
    }

    return (
        <Card className="!p-0 overflow-hidden">
            <div className="p-5 pb-3">
                <SectionHeader
                    icon={FileText}
                    title={t('cargas.title')}
                    hint={t('cargas.hint')}
                    className="mb-0"
                />
            </div>

            <ul className="divide-y divide-line">
                {filas.map(c => (
                    <li key={c.id} className="flex items-center gap-3 px-4 md:px-5 py-3 min-h-[44px]">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-subhead font-semibold text-ink truncate">{c.nombre}</span>
                                {c.operaciones === 0 && <Badge tone="neutral">{t('cargas.nothing_new')}</Badge>}
                            </div>
                            <span className="block text-caption1 text-ink-3 mt-0.5 tabular-nums truncate">
                                {new Date(c.importadoEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {c.operaciones > 0 && ` · ${c.operaciones} ${t('cargas.operations')}`}
                            </span>
                        </div>

                        <div className="text-right shrink-0">
                            {/* Verde si el fichero sumó patrimonio invertido, rojo si
                                lo restó (ventas). Es la lectura de un vistazo. */}
                            <span className={cn('block text-footnote font-semibold tabular-nums whitespace-nowrap',
                                c.delta > 0.005 ? 'text-positive' : c.delta < -0.005 ? 'text-negative' : 'text-ink-3')}>
                                {c.delta > 0.005 ? '+' : c.delta < -0.005 ? '−' : ''}
                                {formatNumber(Math.abs(c.delta), 2)} €
                            </span>
                            <span className="block text-caption2 text-ink-3 tabular-nums whitespace-nowrap">
                                {t('cargas.total')} {formatNumber(c.invertido, 2)} €
                            </span>
                        </div>

                        {onBorrar && (
                            <Button
                                size="icon" variant="danger-ghost"
                                onClick={() => onBorrar(c.id)}
                                aria-label={t('cargas.delete')}
                            >
                                <Trash2 size={15} />
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
        </Card>
    );
};
