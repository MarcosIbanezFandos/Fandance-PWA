import React, { useRef, useState, useCallback } from 'react';
import { FileUp, Check, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, SectionHeader, Button, Badge, Disclosure } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { formatNumber, formatUnits, safeFloat } from '../utils';
import {
    parseTradeRepublicRows, detectarAportaciones, posicionesDesdeCsv,
    emparejarPosiciones, aportacionesNuevas,
} from '../lib/trImport';
import { cn } from '../lib/cn';

/**
 * Importación del CSV de Trade Republic.
 *
 * Sustituye al tecleo mensual: las unidades salen de lo que Trade Republic
 * ejecutó de verdad, así que dejan de acumularse céntimos de desfase por
 * convertir euros a unidades con el precio del momento.
 *
 * El fichero se procesa entero en el navegador; no se sube a ningún sitio.
 */
export const ImportarTR = ({ portfolioItems = [], aportacionesPrevias = [], onAplicar, resumenNovedades }) => {
    const { t } = useGlobal();
    const inputRef = useRef(null);
    const [analisis, setAnalisis] = useState(null);
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [aplicando, setAplicando] = useState(false);
    const [hecho, setHecho] = useState(false);
    // Qué trae este fichero que no estuviera ya guardado.
    const resumen = analisis && resumenNovedades ? resumenNovedades(analisis.movimientos) : null;

    // papaparse se trae sólo cuando hay un CSV que leer. Es la única pantalla
    // que lo usa y no tiene por qué pesar en el arranque de la app.
    const procesar = useCallback(async (file) => {
        if (!file) return;
        setError(''); setHecho(false); setOcupado(true);
        const { default: Papa } = await import('papaparse');
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => String(h || '').trim().toLowerCase(),
            complete: ({ data }) => {
                try {
                    const txs = parseTradeRepublicRows(data);
                    if (!txs.length) { setError(t('tr.err_empty')); return; }

                    const aportaciones = detectarAportaciones(txs);
                    const posCsv = posicionesDesdeCsv(txs);
                    const { emparejadas, sinEmparejar, soloEnCsv } = emparejarPosiciones(portfolioItems, posCsv);

                    // Sólo se ofrecen los cambios reales: si las unidades ya
                    // coinciden, no hay nada que aplicar.
                    const cambios = emparejadas
                        .map(e => ({
                            ...e,
                            actual: safeFloat(e.item.units_held),
                            nuevas: e.csv.unidades,
                            delta: e.csv.unidades - safeFloat(e.item.units_held),
                        }))
                        .filter(c => Math.abs(c.delta) > 1e-6);

                    // Precio al que el bróker ejecutó cada activo, para poder
                    // valorar la posición aunque el mercado no dé cotización.
                    // `preferir` marca los activos que hay que valorar con el
                    // precio del bróker porque la cotización de la app es de
                    // otro instrumento.
                    const precios = {};
                    for (const e of emparejadas) {
                        if (e.csv.ultimoPrecio > 0) {
                            precios[e.item.id] = {
                                precio: e.csv.ultimoPrecio,
                                fecha: e.csv.ultimaFecha,
                                preferir: !!e.precioDiscrepa,
                            };
                        }
                    }
                    const precioRaro = emparejadas.filter(e => e.precioDiscrepa);

                    // Activos que conviene reapuntar a un símbolo con cotización
                    // real. El ISIN del CSV identifica el fondo sin ambigüedad.
                    const aResolver = precioRaro
                        .filter(e => e.csv.isin && e.csv.ultimoPrecio > 0)
                        .map(e => ({ item_id: e.item.id, isin: e.csv.isin, precio_ref: e.csv.ultimoPrecio }));

                    setAnalisis({
                        precios, precioRaro,
                        txs: txs.length,
                        movimientos: txs,
                        nombreFichero: file.name,
                        aportaciones,
                        nuevas: aportacionesNuevas(aportaciones, aportacionesPrevias),
                        cambios, sinEmparejar, soloEnCsv, aResolver,
                    });
                } catch (e) {
                    console.error(e);
                    setError(t('tr.err_parse'));
                } finally { setOcupado(false); }
            },
            error: (e) => { setError(e.message); setOcupado(false); },
        });
    }, [portfolioItems, aportacionesPrevias, t]);

    const aplicar = async () => {
        if (!analisis || !onAplicar) return;
        setAplicando(true);
        try {
            await onAplicar(
                analisis.cambios.map(c => ({ id: c.item.id, unidades: c.nuevas })),
                {
                    movimientos: analisis.movimientos,
                    aportaciones: analisis.aportaciones,
                    nombreFichero: analisis.nombreFichero,
                    precios: analisis.precios,
                    aResolver: analisis.aResolver,
                },
            );
            setHecho(true);
            setAnalisis(null);
        } catch (e) {
            setError(e?.message || t('sync.err_apply'));
        } finally { setAplicando(false); }
    };

    return (
        <Card>
            <SectionHeader icon={FileUp} title={t('sync.title')} hint={t('sync.hint')} />

            <input
                type="file" accept=".csv,text/csv" ref={inputRef} className="hidden"
                onChange={(e) => { procesar(e.target.files?.[0]); e.target.value = ''; }}
            />

            {!analisis && (
                <Button
                    variant="secondary" className="w-full" size="lg"
                    icon={ocupado ? undefined : FileUp} loading={ocupado}
                    onClick={() => inputRef.current?.click()}
                >
                    {t('sync.choose')}
                </Button>
            )}

            {hecho && (
                <p className="flex items-center gap-2 text-subhead text-positive mt-1">
                    <Check size={16} strokeWidth={2.5} /> {t('sync.done')}
                </p>
            )}

            {error && (
                <p className="flex items-start gap-2 text-footnote text-negative mt-3">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
                </p>
            )}

            {analisis && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{analisis.txs} {t('sync.transactions')}</Badge>
                        {resumen && resumen.nuevas.length > 0 && (
                            <Badge tone="positive">{resumen.nuevas.length} {t('sync.new_ops')}</Badge>
                        )}
                        {resumen && resumen.repetidas > 0 && (
                            <Badge tone="neutral">{resumen.repetidas} {t('sync.already')}</Badge>
                        )}
                        <Badge tone="brand">{analisis.aportaciones.length} {t('sync.contributions')}</Badge>
                        {analisis.nuevas.length > 0 && (
                            <Badge tone="positive">{analisis.nuevas.length} {t('sync.new')}</Badge>
                        )}
                    </div>

                    {/* Aportaciones encontradas. Cada una lleva su fecha, así que
                        subir el CSV con retraso o cada dos meses funciona igual. */}
                    {analisis.nuevas.length > 0 && (
                        <ul className="rounded-card bg-surface-2 divide-y divide-line overflow-hidden">
                            {analisis.nuevas.slice(0, 4).map(a => (
                                <li key={a.fecha} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                                    <span className="min-w-0">
                                        <span className="block text-footnote text-ink-2">
                                            {new Date(a.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                        <span className="block text-caption2 text-ink-3">
                                            {a.activos} {t('sync.assets')}
                                            {a.esPlan && <span className="text-brand"> · {t('sync.dca')}</span>}
                                        </span>
                                    </span>
                                    <span className="text-subhead font-semibold text-ink tabular-nums shrink-0">
                                        {formatNumber(a.total, 2)} €
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Diferencias de unidades: lo que de verdad se va a aplicar. */}
                    {analisis.cambios.length > 0 ? (
                        <div>
                            <p className="text-footnote text-ink-2 mb-2">{t('sync.will_update')}</p>
                            <ul className="space-y-1.5">
                                {analisis.cambios.map(c => (
                                    <li key={c.item.id} className="flex items-center gap-2 text-footnote">
                                        <span className="flex-1 truncate text-ink">{c.item.asset?.name}</span>
                                        <span className="text-ink-3 tabular-nums">{formatUnits(c.actual)}</span>
                                        <ArrowRight size={12} className="text-ink-3 shrink-0" />
                                        <span className="font-semibold text-ink tabular-nums">{formatUnits(c.nuevas)}</span>
                                        <span className={cn('tabular-nums shrink-0 w-16 text-right',
                                            c.delta > 0 ? 'text-positive' : 'text-negative')}>
                                            {c.delta > 0 ? '+' : ''}{formatUnits(c.delta)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="text-footnote text-ink-2">{t('sync.up_to_date')}</p>
                    )}

                    {analisis.precioRaro?.length > 0 && (
                        <Disclosure icon={AlertTriangle} tone="warning" title={t('sync.stale_price')}>
                            <p>{t('sync.stale_price_hint')}</p>
                            <ul className="mt-1.5 space-y-0.5 tabular-nums">
                                {analisis.precioRaro.map(e => (
                                    <li key={e.item.id}>
                                        {e.item.asset?.name}: {formatNumber(safeFloat(e.item.current_price), 2)} €
                                        {' → '}{formatNumber(e.csv.ultimoPrecio, 2)} €
                                    </li>
                                ))}
                            </ul>
                        </Disclosure>
                    )}

                    {(analisis.sinEmparejar.length > 0 || analisis.soloEnCsv.length > 0) && (
                        <Disclosure icon={AlertTriangle} tone="warning" title={t('sync.unmatched')}>
                            {analisis.sinEmparejar.length > 0 && (
                                <p className="mb-2">{t('sync.only_app')}: {analisis.sinEmparejar.map(i => i.asset?.name).join(', ')}</p>
                            )}
                            {analisis.soloEnCsv.length > 0 && (
                                <p>{t('sync.only_csv')}: {analisis.soloEnCsv.map(p => p.nombre || p.isin).join(', ')}</p>
                            )}
                        </Disclosure>
                    )}

                    <div className="flex gap-2">
                        <Button onClick={aplicar} loading={aplicando}>
                            {analisis.cambios.length ? t('sync.apply') : t('sync.save_only')}
                        </Button>
                        <Button variant="ghost" onClick={() => setAnalisis(null)}>{t('plan.cancel')}</Button>
                    </div>
                </div>
            )}
        </Card>
    );
};
