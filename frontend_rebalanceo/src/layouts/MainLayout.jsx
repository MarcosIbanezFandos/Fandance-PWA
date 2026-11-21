import React, { useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { BottomNav } from '../components/BottomNav';
import { Outlet, useLocation } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';
import { cn } from '../lib/cn';

// El lanzador de la familia FANDOS: un botón que abre las cinco apps con su vistazo de
// hoy y un buscador que busca dentro de todas. Lo pinta este script del portal (mismo
// dominio); en desarrollo o fuera de fandos.vercel.app no existe y no se ve nada.
const LANZADOR = '/fandios/portal/lanzador.js';
const useLanzadorFandos = () => {
    useEffect(() => {
        if (window.customElements?.get('fandos-lanzador') || document.querySelector(`script[src="${LANZADOR}"]`)) return;
        const s = document.createElement('script');
        s.src = LANZADOR;
        s.async = true;
        document.head.appendChild(s);
    }, []);
};

export const MainLayout = (props) => {
    useLanzadorFandos();
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
                    <div className="flex items-center gap-2.5 shrink-0 pb-1">
                        <span className="text-ink-2 flex"><fandos-lanzador app="fandance"></fandos-lanzador></span>
                        <div className="hidden md:block text-right">
                            <div className="text-caption1 text-ink-3">{t('header.user')}</div>
                            <div className="text-footnote font-medium text-ink-2 mt-0.5">{session?.user?.email}</div>
                        </div>
                        <div className="hidden md:flex w-9 h-9 rounded-full bg-brand-soft items-center justify-center shrink-0">
                            <span className="text-caption1 font-semibold text-brand-ink uppercase">
                                {(session?.user?.email || '?').slice(0, 2)}
                            </span>
                        </div>
                    </div>
                </header>
                <Outlet />
            </main>

            {/* Mobile bottom navigation */}
            <BottomNav />
        </div>
    );
};
