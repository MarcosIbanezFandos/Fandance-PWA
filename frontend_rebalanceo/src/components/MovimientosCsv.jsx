import React, { useMemo, useState } from 'react';
import { Receipt, ChevronDown, Inbox, Trash2 } from 'lucide-react';
import { Card, SectionHeader, Button, Badge, Segmented, EmptyState } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { formatNumber, formatUnits } from '../utils';
import { detectarAportaciones } from '../lib/trImport';
import { cn } from '../lib/cn';

const MESES_POR_TANDA = 4;

/** Verde lo que entra, rojo lo que sale: el mismo criterio que usa el bróker. */
const tono = (importe) => (importe >= 0 ? 'text-positive' : 'text-negative');

const conSigno = (importe) => `${importe >= 0 ? '+' : '−'}${formatNumber(Math.abs(importe), 2)} €`;

const etiquetaTipo = (t, tr) => {
    if (t.categoria === 'TRADING') return t.tipo === 'BUY' ? tr('movs.buy') : tr('movs.sell');
    if (t.tipo === 'DIVIDEND') return tr('movs.dividend');
    if (t.tipo === 'INTEREST') return tr('movs.interest');
    if (/CARD/.test(t.tipo)) return tr('movs.card');
    if (/TRANSFER|DEPOSIT/.test(t.tipo)) return tr('movs.transfer');
    return t.tipo || tr('movs.other');
};

/**
 * Todo lo que contiene el CSV, mes a mes.
 *
 * Las compras del plan se agrupan en una sola línea por día —que es como
 * ocurrieron: cinco ejecuciones simultáneas— y se pueden desplegar. El resto de
 * movimientos van sueltos. Sin agrupar, un export de 477 líneas es ilegible.
 */
export const MovimientosCsv = ({ txs = [], importadoEn, onBorrar }) => {
    const { t } = useGlobal();
    const [filtro, setFiltro] = useState('todo');
    const [visibles, setVisibles] = useState(MESES_POR_TANDA);
    const [abierto, setAbierto] = useState({});

    const meses = useMemo(() => {
        const diasAportacion = new Map(detectarAportaciones(txs).map(a => [a.fecha, a]));
        const sueltos = txs.filter(x => !(x.categoria === 'TRADING' && x.tipo === 'BUY' && diasAportacion.has(x.fecha)));

        // Cada entrada es o una aportación del día (agrupada) o un movimiento suelto.
        const entradas = [
            ...[...diasAportacion.values()].map(a => ({
                clase: 'aportacion', clave: `a-${a.fecha}`, fecha: a.fecha,
                importe: -a.total, aportacion: a,
            })),
            ...sueltos.map(x => ({
                clase: 'movimiento', clave: `m-${x.id}`, fecha: x.fecha,
                importe: x.importe, tx: x,
            })),
        ].filter(e => {
            if (filtro === 'aportaciones') return e.clase === 'aportacion';
            if (filtro === 'ingresos') return e.importe > 0;
            return true;
        }).sort((a, b) => b.fecha.localeCompare(a.fecha));

        const porMes = new Map();
        for (const e of entradas) {
            const m = e.fecha.slice(0, 7);
            if (!porMes.has(m)) porMes.set(m, { mes: m, entradas: [], neto: 0 });
            const g = porMes.get(m);
            g.entradas.push(e);
            g.neto += e.importe;
        }
        return [...porMes.values()];
    }, [txs, filtro]);

    const nombreMes = (m) => {
        const d = new Date(`${m}-01T12:00:00`);
        return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    if (!txs.length) {
        return (
            <Card>
                <SectionHeader icon={Receipt} title={t('movs.title')} hint={t('movs.hint')} />
                <EmptyState icon={Inbox} title={t('movs.empty')} hint={t('movs.empty_hint')} />
            </Card>
        );
    }

    return (
        <Card className="!p-0 overflow-hidden">
            <div className="p-5 pb-3">
                <SectionHeader
                    icon={Receipt}
                    title={t('movs.title')}
                    hint={importadoEn
                        ? `${txs.length} ${t('movs.movements')} · ${t('movs.imported')} ${new Date(importadoEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                        : `${txs.length} ${t('movs.movements')}`}
                    action={onBorrar && (
                        <Button size="icon" variant="danger-ghost" onClick={onBorrar} aria-label={t('movs.clear')}>
                            <Trash2 size={15} />
                        </Button>
                    )}
                    className="mb-3"
                />
                <Segmented
                    value={filtro}
                    onChange={(v) => { setFiltro(v); setVisibles(MESES_POR_TANDA); }}
                    size="sm"
                    options={[
                        { value: 'todo', label: t('movs.f_all') },
                        { value: 'aportaciones', label: t('movs.f_contrib') },
                        { value: 'ingresos', label: t('movs.f_income') },
                    ]}
                />
            </div>

            {meses.slice(0, visibles).map(g => (
                <section key={g.mes}>
                    <header className="flex items-baseline justify-between gap-3 px-4 md:px-5 py-2 bg-surface-2 border-y border-line">
                        <h4 className="text-caption1 font-semibold uppercase tracking-wide text-ink-2">{nombreMes(g.mes)}</h4>
                        <span className={cn('text-caption1 font-semibold tabular-nums', tono(g.neto))}>{conSigno(g.neto)}</span>
                    </header>

                    <ul className="divide-y divide-line">
                        {g.entradas.map(e => e.clase === 'aportacion' ? (
                            <li key={e.clave}>
                                <button
                                    type="button"
                                    onClick={() => setAbierto(o => ({ ...o, [e.clave]: !o[e.clave] }))}
                                    className="w-full min-h-[44px] flex items-center gap-3 px-4 md:px-5 py-3 text-left active:bg-surface-2 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-subhead font-semibold text-ink">
                                                {new Date(`${e.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                            </span>
                                            {e.aportacion.esPlan && <Badge tone="brand">{t('movs.plan')}</Badge>}
                                        </div>
                                        <span className="block text-caption1 text-ink-3 mt-0.5">
                                            {e.aportacion.activos} {t('movs.assets')}
                                        </span>
                                    </div>
                                    <span className={cn('text-subhead font-semibold tabular-nums shrink-0', tono(e.importe))}>
                                        {conSigno(e.importe)}
                                    </span>
                                    <ChevronDown
                                        size={16}
                                        className={cn('text-ink-3 shrink-0 transition-transform', abierto[e.clave] && 'rotate-180')}
                                    />
                                </button>

                                {abierto[e.clave] && (
                                    <ul className="bg-surface-2/60 px-4 md:px-5 pb-3 pt-1 space-y-1.5">
                                        {e.aportacion.lineas.map(l => (
                                            <li key={l.id} className="flex items-center gap-3 text-caption1">
                                                <span className="flex-1 truncate text-ink-2">{l.nombre}</span>
                                                <span className="text-ink-3 tabular-nums shrink-0">{formatUnits(l.unidades)} ud.</span>
                                                <span className="text-ink tabular-nums shrink-0 w-20 text-right">
                                                    {formatNumber(Math.abs(l.importe), 2)} €
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ) : (
                            <li key={e.clave} className="min-h-[44px] flex items-center gap-3 px-4 md:px-5 py-3">
                                <div className="min-w-0 flex-1">
                                    <span className="block text-subhead text-ink truncate">
                                        {e.tx.nombre || etiquetaTipo(e.tx, t)}
                                    </span>
                                    <span className="block text-caption1 text-ink-3 mt-0.5">
                                        {new Date(`${e.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                        {e.tx.nombre ? ` · ${etiquetaTipo(e.tx, t)}` : ''}
                                    </span>
                                </div>
                                <span className={cn('text-subhead font-semibold tabular-nums shrink-0', tono(e.importe))}>
                                    {conSigno(e.importe)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}

            {visibles < meses.length && (
                <div className="p-4">
                    <Button variant="secondary" className="w-full" onClick={() => setVisibles(v => v + MESES_POR_TANDA)}>
                        {t('movs.more')} ({meses.length - visibles})
                    </Button>
                </div>
            )}
        </Card>
    );
};
