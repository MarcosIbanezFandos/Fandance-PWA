import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { BottomNav } from '../components/BottomNav';
import { Outlet, useLocation } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';

export const MainLayout = (props) => {
    const { session } = props;
    const location = useLocation();
    const { t } = useGlobal();

    const getHeaderTitle = () => {
        switch (location.pathname) {
            case '/': return props.activePortfolio?.name || t('header.rebalancer');
            case '/performance': return t('header.performance');
            case '/xray': return t('header.xray');
            case '/analysis': return t('header.analysis');
            case '/simulations': return t('header.simulations');
            case '/news': return t('header.news');
            case '/settings': return t('header.settings');
            default: return 'Fandance';
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex overflow-hidden transition-colors duration-300">
            {/* Desktop sidebar — completely hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar {...props} isOpen={false} setIsOpen={() => {}} />
            </div>

            {/* Main content */}
            <main className="flex-1 w-full md:ml-20 lg:ml-72 px-4 md:px-8 lg:px-12 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8 md:pt-8 lg:py-12 transition-all min-w-0 overflow-y-auto h-screen">
                <header className="flex justify-between items-center mb-4 md:mb-6 lg:mb-10">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <h1 className="text-lg md:text-3xl lg:text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white truncate">
                            {getHeaderTitle()}
                        </h1>
                    </div>
                    <div className="text-right hidden md:block shrink-0">
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('header.user')}</div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{session?.user?.email}</div>
                    </div>
                </header>
                <Outlet />
            </main>

            {/* Mobile bottom navigation */}
            <BottomNav
                onLogout={props.onLogout}
                portfolios={props.portfolios}
                activePortfolio={props.activePortfolio}
                setActivePortfolio={props.setActivePortfolio}
            />
        </div>
    );
};
