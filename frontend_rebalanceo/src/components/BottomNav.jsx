import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import {
    HomeIcon, Wallet, Activity, FlaskConical, MoreHorizontal,
    ScanSearch, TrendingUp, History, Newspaper, Settings,
    LogOut, Briefcase, ChevronDown, ChevronRight, Check,
} from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { cn } from '../lib/cn';

// Una pestaña por pregunta recurrente: cómo voy, qué tengo, por qué rinde así,
// a dónde llego. Lo que no se consulta cada semana vive en la hoja "Más".
const tabs = [
    { to: '/', icon: HomeIcon, labelKey: 'nav.home' },
    { to: '/posiciones', icon: Wallet, labelKey: 'nav.positions' },
    { to: '/analisis', icon: Activity, labelKey: 'nav.analysis' },
    { to: '/simulacion', icon: FlaskConical, labelKey: 'nav.simulations' },
];

const moreItems = [
    { to: '/xray', icon: ScanSearch, labelKey: 'nav.xray_full' },
    { to: '/rendimiento', icon: TrendingUp, labelKey: 'nav.performance' },
    { to: '/historial', icon: History, labelKey: 'nav.history' },
    { to: '/noticias', icon: Newspaper, labelKey: 'nav.news' },
    { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export const BottomNav = ({ onLogout, portfolios = [], activePortfolio, setActivePortfolio }) => {
    const { t } = useGlobal();
    const navigate = useNavigate();
    const location = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);
    const [portfolioOpen, setPortfolioOpen] = useState(false);
    // El arrastre arranca sólo desde el tirador. Con drag en toda la hoja,
    // Framer captura el gesto en cuanto el dedo se mueve un par de píxeles y
    // el toque no llega nunca al elemento de abajo: la opción no se pulsaba.
    const dragControls = useDragControls();

    // Con la hoja abierta el fondo no debe desplazarse.
    useEffect(() => {
        document.body.style.overflow = moreOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [moreOpen]);

    useEffect(() => { if (!moreOpen) setPortfolioOpen(false); }, [moreOpen]);

    // La hoja se cierra siempre que cambia la ruta, no sólo al pulsar dentro.
    // Cerrarla y navegar en el mismo gesto depende de que ese estado sobreviva
    // a una navegación que puede suspender mientras llega el trozo de la
    // pantalla nueva; atarlo a la ruta lo hace incondicional. También devuelve
    // el desplazamiento del fondo, que si no podía quedarse bloqueado.
    useEffect(() => {
        setMoreOpen(false);
        setPortfolioOpen(false);
        document.body.style.overflow = '';
    }, [location.pathname]);


    const handlePortfolioSelect = (p) => {
        setActivePortfolio(p);
        setMoreOpen(false);
        navigate('/');
    };

    return (
        <>
            {/* UITabBar: 49pt de alto sobre el área segura, material translúcido
                y hairline superior. Sin subrayado deslizante — iOS marca la
                pestaña activa sólo con el color del icono y la etiqueta. */}
            <nav className={cn(
                'md:hidden fixed bottom-0 left-0 right-0 z-50',
                'bg-surface/80 backdrop-blur-2xl backdrop-saturate-150',
                'pb-[env(safe-area-inset-bottom)]'
            )}
                style={{ borderTop: '0.5px solid rgb(var(--c-line))' }}
            >
                <div className="flex items-stretch justify-around h-tabbar">
                    {tabs.map(({ to, icon: Icon, labelKey }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) => cn(
                                'flex-1 flex flex-col items-center justify-center gap-[0.1875rem] pt-1',
                                'transition-opacity duration-100 active:opacity-40',
                                isActive ? 'text-brand' : 'text-ink-3'
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon size={25} strokeWidth={isActive ? 2.1 : 1.7} />
                                    <span className={cn('text-caption2 leading-[1.15]', isActive ? 'font-semibold' : 'font-medium')}>
                                        {t(labelKey)}
                                    </span>
                                </>
                            )}
                        </NavLink>
                    ))}

                    <button
                        onClick={() => setMoreOpen(true)}
                        aria-label={t('nav.more')}
                        className={cn(
                            'flex-1 flex flex-col items-center justify-center gap-[0.1875rem] pt-1',
                            'transition-opacity duration-100 active:opacity-40',
                            moreOpen ? 'text-brand' : 'text-ink-3'
                        )}
                    >
                        <MoreHorizontal size={25} strokeWidth={1.7} />
                        <span className="text-caption2 font-medium leading-[1.15]">{t('nav.more')}</span>
                    </button>
                </div>
            </nav>

            {/* Hoja "Más" */}
            <AnimatePresence>
                {moreOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                            onClick={() => setMoreOpen(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 34, stiffness: 380 }}
                            drag="y"
                            dragControls={dragControls}
                            dragListener={false}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0, bottom: 0.4 }}
                            onDragEnd={(_, info) => { if (info.offset.y > 90) setMoreOpen(false); }}
                            className={cn(
                                'md:hidden fixed bottom-0 left-0 right-0 z-[70]',
                                'bg-surface border-t border-line rounded-t-[1.75rem] shadow-pop',
                                'pb-[calc(1rem+env(safe-area-inset-bottom))]'
                            )}
                        >
                            {/* Única zona por la que se arrastra la hoja. */}
                            <div
                                onPointerDown={(e) => dragControls.start(e)}
                                className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
                            >
                                <div className="w-9 h-1 rounded-full bg-line-strong" />
                            </div>

                            <div className="px-4 pb-2 space-y-1">
                                {/* Cartera activa */}
                                <button
                                    onClick={() => setPortfolioOpen(v => !v)}
                                    className="w-full flex items-center gap-3 px-3 min-h-tap py-2.5 rounded-card text-left bg-surface-2 active:bg-surface-3 transition-colors"
                                >
                                    <span className="w-9 h-9 rounded-control bg-brand-soft flex items-center justify-center shrink-0">
                                        <Briefcase size={17} className="text-brand" strokeWidth={2.25} />
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-caption1 text-ink-3">{t('nav.portfolio')}</span>
                                        <span className="block text-body text-ink truncate">
                                            {activePortfolio?.name || '—'}
                                        </span>
                                    </span>
                                    <ChevronDown size={17} className={cn('text-ink-3 shrink-0 transition-transform duration-200', portfolioOpen && 'rotate-180')} />
                                </button>

                                <AnimatePresence initial={false}>
                                    {portfolioOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-0.5 py-1 max-h-52 overflow-y-auto no-scrollbar">
                                                {portfolios.map(p => {
                                                    const active = activePortfolio?.id === p.id;
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => handlePortfolioSelect(p)}
                                                            className={cn(
                                                                'w-full flex items-center justify-between gap-2 text-left min-h-tap pl-[3.375rem] pr-4 rounded-control text-body transition-colors',
                                                                active ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-2'
                                                            )}
                                                        >
                                                            <span className="truncate">{p.name}</span>
                                                            {active && <Check size={15} className="text-brand shrink-0" strokeWidth={2.5} />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="h-px bg-line my-2" />

                                {/* Lista agrupada: filas de 44pt, icono en cápsula de
                                    color y galón a la derecha, como en Ajustes. */}
                                <div className="rounded-card bg-surface-2 overflow-hidden">
                                    {moreItems.map(({ to, icon: Icon, labelKey }, i) => (
                                        <NavLink
                                            key={to}
                                            to={to}
                                            onClick={() => setMoreOpen(false)}
                                            className="w-full flex items-center gap-3 px-3 min-h-tap text-left text-ink active:bg-surface-3 transition-colors"
                                            style={i > 0 ? { borderTop: '0.5px solid rgb(var(--c-line))' } : undefined}
                                        >
                                            <span className="w-[1.8125rem] h-[1.8125rem] rounded-[0.4375rem] bg-brand flex items-center justify-center shrink-0">
                                                <Icon size={17} className="text-white" strokeWidth={2} />
                                            </span>
                                            <span className="flex-1 text-body">{t(labelKey)}</span>
                                            <ChevronRight size={17} className="text-ink-3 shrink-0" strokeWidth={2.5} />
                                        </NavLink>
                                    ))}
                                </div>

                                <button
                                    onClick={() => { setMoreOpen(false); onLogout(); }}
                                    className="w-full flex items-center justify-center min-h-tap mt-3 rounded-card bg-surface-2 text-negative text-body font-medium active:bg-surface-3 transition-colors"
                                >
                                    {t('nav.logout')}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
