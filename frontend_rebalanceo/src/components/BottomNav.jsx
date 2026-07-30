import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, ScanSearch, FlaskConical, Newspaper, MoreHorizontal, TrendingUp, PieChart, Settings, LogOut, X, Briefcase } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

const tabs = [
    { to: '/', icon: Scale, labelKey: 'nav.rebalance' },
    { to: '/xray', icon: ScanSearch, labelKey: 'nav.xray' },
    { to: '/analysis', icon: FlaskConical, labelKey: 'nav.analysis' },
    { to: '/news', icon: Newspaper, labelKey: 'nav.news' },
];

const moreItems = [
    { to: '/performance', icon: PieChart, labelKey: 'nav.performance' },
    { to: '/simulations', icon: TrendingUp, labelKey: 'nav.simulations' },
    { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export const BottomNav = ({ onLogout, portfolios, activePortfolio, setActivePortfolio }) => {
    const { t } = useGlobal();
    const navigate = useNavigate();
    const [moreOpen, setMoreOpen] = useState(false);
    const [portfolioOpen, setPortfolioOpen] = useState(false);

    const handleMore = (to) => {
        setMoreOpen(false);
        navigate(to);
    };

    const handlePortfolioSelect = (p) => {
        setActivePortfolio(p);
        setPortfolioOpen(false);
        navigate('/');
    };

    return (
        <>
            {/* Bottom Tab Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
                <div className="flex items-stretch justify-around h-14">
                    {tabs.map(({ to, icon: Icon, labelKey }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) =>
                                `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 active:text-slate-600'}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <motion.div
                                            layoutId="bottomNavActive"
                                            className="absolute -top-px left-3 right-3 h-[3px] bg-indigo-600 dark:bg-indigo-400 rounded-b-full"
                                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                        />
                                    )}
                                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                    <span className="text-[9px] font-bold leading-none">{t(labelKey)}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                    {/* More button */}
                    <button
                        onClick={() => setMoreOpen(true)}
                        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-slate-400 dark:text-slate-500 active:text-slate-600 transition-colors"
                    >
                        <MoreHorizontal size={20} />
                        <span className="text-[9px] font-bold leading-none">{t('nav.more')}</span>
                    </button>
                </div>
            </nav>

            {/* More Sheet Overlay */}
            <AnimatePresence>
                {moreOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                            onClick={() => setMoreOpen(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                            className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white dark:bg-slate-900 rounded-t-3xl pb-[env(safe-area-inset-bottom)] shadow-2xl"
                        >
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <div className="px-6 py-4 space-y-1">
                                {/* Portfolio selector */}
                                <button
                                    onClick={() => setPortfolioOpen(!portfolioOpen)}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-left bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 mb-3"
                                >
                                    <Briefcase size={18} className="text-indigo-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('nav.portfolio')}</div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{activePortfolio?.name || '—'}</div>
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {portfolioOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-2">
                                            <div className="space-y-1 pb-2">
                                                {portfolios.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => handlePortfolioSelect(p)}
                                                        className={`w-full text-left p-3 pl-12 rounded-xl text-xs font-bold transition-all ${activePortfolio?.id === p.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                    >
                                                        {p.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Nav items */}
                                {moreItems.map(({ to, icon: Icon, labelKey }) => (
                                    <button
                                        key={to}
                                        onClick={() => handleMore(to)}
                                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-left text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <Icon size={20} />
                                        <span className="text-sm font-bold">{t(labelKey)}</span>
                                    </button>
                                ))}

                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

                                <button
                                    onClick={() => { setMoreOpen(false); onLogout(); }}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-left text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                >
                                    <LogOut size={20} />
                                    <span className="text-sm font-bold">{t('nav.logout')}</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
