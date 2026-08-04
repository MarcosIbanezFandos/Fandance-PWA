import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Briefcase, Check, ScanSearch, TrendingUp, History, Newspaper, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { Card, SectionHeader, staggerContainer, fadeInUp } from '../components/UI';
import { useGlobal } from '../context/GlobalContext';
import { cn } from '../lib/cn';

export const SECCIONES = [
    { to: '/xray', icon: ScanSearch, labelKey: 'nav.xray_full' },
    { to: '/rendimiento', icon: TrendingUp, labelKey: 'nav.performance' },
    { to: '/historial', icon: History, labelKey: 'nav.history' },
    { to: '/noticias', icon: Newspaper, labelKey: 'nav.news' },
    { to: '/settings', icon: SettingsIcon, labelKey: 'nav.settings' },
];

/**
 * Las secciones que no caben en la barra inferior.
 *
 * Era una hoja deslizante sobre la pantalla, y esa era la razón de que se
 * quedara pillada: una capa flotante con arrastre, animación de salida y estado
 * propio tiene muchas formas de terminar en un estado que no se corresponde con
 * la pantalla que hay debajo. Como pantalla normal no hay nada que sincronizar
 * —se entra y se sale como en cualquier otra— y el botón atrás del móvil
 * funciona igual que en el resto de la app.
 */
export const Mas = ({ portfolios = [], activePortfolio, setActivePortfolio, onLogout }) => {
    const { t } = useGlobal();

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
            {portfolios.length > 0 && (
                <Card className="!p-0 overflow-hidden">
                    <div className="p-5 pb-3">
                        <SectionHeader icon={Briefcase} title={t('nav.portfolio')} className="mb-0" />
                    </div>
                    <ul className="divide-y divide-line">
                        {portfolios.map(p => {
                            const activa = activePortfolio?.id === p.id;
                            return (
                                <li key={p.id}>
                                    <button
                                        type="button"
                                        onClick={() => setActivePortfolio(p)}
                                        className={cn(
                                            'w-full flex items-center justify-between gap-3 px-4 md:px-5 min-h-tap py-3 text-left transition-colors',
                                            activa ? 'text-brand-ink bg-brand-soft' : 'text-ink active:bg-surface-2'
                                        )}
                                    >
                                        <span className="truncate text-body">{p.name}</span>
                                        {activa && <Check size={17} className="text-brand shrink-0" strokeWidth={2.5} />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}

            <Card className="!p-0 overflow-hidden">
                <ul className="divide-y divide-line">
                    {SECCIONES.map(({ to, icon: Icon, labelKey }) => (
                        <li key={to}>
                            <NavLink
                                to={to}
                                className="flex items-center gap-3 px-4 md:px-5 min-h-tap py-3 text-ink active:bg-surface-2 transition-colors"
                            >
                                <span className="w-[1.8125rem] h-[1.8125rem] rounded-[0.4375rem] bg-brand flex items-center justify-center shrink-0">
                                    <Icon size={17} className="text-white" strokeWidth={2} />
                                </span>
                                <span className="flex-1 text-body">{t(labelKey)}</span>
                                <ChevronRight size={17} className="text-ink-3 shrink-0" strokeWidth={2.5} />
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </Card>

            <motion.div variants={fadeInUp}>
                <button
                    type="button"
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 min-h-tap rounded-card bg-surface text-negative text-body font-medium shadow-card active:bg-surface-2 transition-colors"
                >
                    <LogOut size={17} strokeWidth={2} /> {t('nav.logout')}
                </button>
            </motion.div>
        </motion.div>
    );
};
