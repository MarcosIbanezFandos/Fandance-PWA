import React from 'react';
import { motion } from 'framer-motion';
import { History, Undo2, Trash2, Inbox } from 'lucide-react';
import { Card, SectionHeader, Button, Badge, EmptyState, staggerContainer } from '../components/UI';
import { useGlobal } from '../context/GlobalContext';
import { MovimientosCsv } from '../components/MovimientosCsv';
import { formatNumber, safeFloat } from '../utils';

/**
 * Historial de rebalanceos.
 *
 * Vive aparte de Posiciones porque responde a otra pregunta ("¿qué he hecho y
 * cuánto llevo aportado?") y porque es la fuente que marca los meses del plan
 * de aportación: conviene poder auditarla sin ruido alrededor.
 */
export const RebalanceHistoryPage = ({ history = [], onUndo, onDelete, csvTxs = [], csvImportadoEn, onBorrarCsv }) => {
    const { t } = useGlobal();

    const totalContributed = history.reduce((s, h) => s + safeFloat(h.contribution), 0);

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <Card className="!p-4">
                    <div className="label-caps">{t('hist.count')}</div>
                    <div className="text-title1 font-bold text-ink tabular-nums mt-1">{history.length}</div>
                </Card>
                <Card className="!p-4">
                    <div className="label-caps">{t('hist.total')}</div>
                    <div className="text-title1 font-bold text-ink tabular-nums mt-1">{formatNumber(totalContributed)} €</div>
                </Card>
            </div>

            <Card className="!p-0 overflow-hidden">
                <div className="p-5 pb-4">
                    <SectionHeader icon={History} title={t('hist.title')} hint={t('hist.hint')} className="mb-0" />
                </div>

                {history.length === 0 ? (
                    <EmptyState icon={Inbox} title={t('hist.empty')} hint={t('hist.empty_hint')} />
                ) : (
                    <ul className="divide-y divide-line">
                        {history.map((h, idx) => {
                            const d = h.created_at ? new Date(h.created_at) : null;
                            return (
                                <li key={h.id} className="px-4 md:px-5 py-3.5 flex items-center gap-3 hover:bg-surface-2/60 transition-colors">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-subhead font-semibold text-ink">
                                            {d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {safeFloat(h.contribution) > 0 && (
                                                <Badge tone="positive">+{formatNumber(h.contribution)} €</Badge>
                                            )}
                                            {idx === 0 && <Badge tone="brand">{t('hist.latest')}</Badge>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {idx === 0 && onUndo && (
                                            <Button size="sm" variant="secondary" icon={Undo2} onClick={() => onUndo(h.id)}>
                                                {t('hist.undo')}
                                            </Button>
                                        )}
                                        {onDelete && (
                                            <Button
                                                size="icon" variant="danger-ghost"
                                                onClick={() => onDelete(h.id)}
                                                aria-label={t('hist.delete')}
                                            >
                                                <Trash2 size={15} />
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>

            {/* Todo lo que trae el CSV: compras, dividendos, intereses y gastos. */}
            <MovimientosCsv txs={csvTxs} importadoEn={csvImportadoEn} onBorrar={onBorrarCsv} />
        </motion.div>
    );
};
