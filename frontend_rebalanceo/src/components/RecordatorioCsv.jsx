import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, X } from 'lucide-react';
import { Button } from './UI';
import { ImportarTR } from './ImportarTR';
import { useGlobal } from '../context/GlobalContext';

const nombreMes = (clave) =>
    new Date(`${clave}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

/**
 * Aviso de "ya toca subir el CSV".
 *
 * Sale como hoja inferior y no como diálogo centrado porque el gesto natural en
 * el móvil es descartarla hacia abajo, y porque el importador que lleva dentro
 * necesita alto. Nunca bloquea: se puede cerrar y seguir.
 */
export const RecordatorioCsv = ({ abierto, pendientes = [], portfolioItems, aportacionesPrevias = [], onAplicar, onCerrar }) => {
    const { t } = useGlobal();
    const varios = pendientes.length > 1;

    return (
        <AnimatePresence>
            {abierto && (
                <motion.div
                    className="fixed inset-0 z-[200] flex items-end justify-center"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                >
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCerrar} />

                    <motion.div
                        role="dialog" aria-modal="true" aria-label={t('aviso.title')}
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        className="relative w-full max-w-lg max-h-[88svh] overflow-y-auto app-scroll bg-canvas rounded-t-[20px] pb-[env(safe-area-inset-bottom)] shadow-pop"
                    >
                        <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur px-5 pt-3 pb-3">
                            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
                            <div className="flex items-start gap-3">
                                <span className="shrink-0 grid place-items-center w-9 h-9 rounded-control bg-brand-soft">
                                    <CalendarClock size={18} className="text-brand" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-headline font-semibold text-ink">{t('aviso.title')}</h2>
                                    <p className="text-footnote text-ink-2 mt-0.5">
                                        {varios
                                            ? `${t('aviso.pending_many')} ${pendientes.map(nombreMes).join(', ')}.`
                                            : `${t('aviso.pending_one')} ${nombreMes(pendientes[0] || '')}.`}
                                    </p>
                                </div>
                                <Button size="icon" variant="ghost" onClick={onCerrar} aria-label={t('aviso.later')}>
                                    <X size={18} />
                                </Button>
                            </div>
                        </div>

                        <div className="px-5 pb-5 space-y-3">
                            <ImportarTR
                                portfolioItems={portfolioItems}
                                aportacionesPrevias={aportacionesPrevias}
                                onAplicar={onAplicar}
                            />
                            <Button variant="ghost" className="w-full" onClick={onCerrar}>
                                {t('aviso.later')}
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
