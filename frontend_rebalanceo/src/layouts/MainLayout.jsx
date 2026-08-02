import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { BottomNav } from '../components/BottomNav';
import { Outlet, useLocation } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';
import { cn } from '../lib/cn';

export const MainLayout = (props) => {
    const { session } = props;
    const location = useLocation();
    const { t } = useGlobal();

    const getHeaderTitle = () => {
        switch (location.pathname) {
            case '/': return props.activePortfolio?.name || t('header.home');
            case '/posiciones': return t('header.positions');
            case '/analisis': return t('header.analysis');
            case '/simulacion': return t('header.simulations');
            case '/rendimiento': return t('header.performance');
            case '/xray': return t('header.xray');
            case '/historial': return t('nav.history');
            case '/noticias': return t('header.news');
            case '/settings': return t('header.settings');
            default: return 'Fandance';
        }
    };

    return (
        <div className="h-full bg-canvas text-ink font-sans flex overflow-hidden">
            {/* Desktop sidebar — completely hidden on mobile */}
            <div className="hidden md:block">
                <Sidebar {...props} isOpen={false} setIsOpen={() => {}} />
            </div>

            {/* Main content — márgenes de 16pt en iPhone, como una app nativa */}
            <main className={cn(
                'flex-1 w-full md:ml-20 lg:ml-72 min-w-0 h-full app-scroll',
                'px-4 md:px-8 lg:px-12',
                'pt-[calc(0.5rem+env(safe-area-inset-top))] md:pt-8 lg:py-12',
                // Hueco para la tab bar (49pt) + área segura, y algo de aire.
                'pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8',
                'transition-all'
            )}>
                {/* Large title: el patrón de navegación de iOS. Se encoge al
                    hacer scroll para dejar sitio al contenido. */}
                <header className="flex justify-between items-end gap-4 pt-2 pb-4 md:pb-7">
                    <h1 className={cn(
                        'min-w-0 truncate text-ink font-bold tracking-tight',
                        'text-largetitle md:text-title1'
                    )}>
                        {getHeaderTitle()}
                    </h1>
                    <div className="hidden md:flex items-center gap-2.5 shrink-0 pb-1">
                        <div className="text-right">
                            <div className="text-caption1 text-ink-3">{t('header.user')}</div>
                            <div className="text-footnote font-medium text-ink-2 mt-0.5">{session?.user?.email}</div>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-brand-soft flex items-center justify-center shrink-0">
                            <span className="text-caption1 font-semibold text-brand-ink uppercase">
                                {(session?.user?.email || '?').slice(0, 2)}
                            </span>
                        </div>
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
