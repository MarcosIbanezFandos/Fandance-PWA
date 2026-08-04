import React from 'react';
import { NavLink } from 'react-router-dom';

import { Home as HomeIcon, Wallet, Activity, FlaskConical, MoreHorizontal } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { cn } from '../lib/cn';

// Una pestaña por pregunta recurrente: cómo voy, qué tengo, por qué rinde así,
// a dónde llego. Lo que no se consulta cada semana vive en la pantalla "Más".
const tabs = [
    { to: '/', icon: HomeIcon, labelKey: 'nav.home' },
    { to: '/posiciones', icon: Wallet, labelKey: 'nav.positions' },
    { to: '/analisis', icon: Activity, labelKey: 'nav.analysis' },
    { to: '/simulacion', icon: FlaskConical, labelKey: 'nav.simulations' },
    // "Más" es una pantalla como las demás, no una capa flotante: navegar
    // nunca puede dejar la interfaz en un estado que no corresponde.
    { to: '/mas', icon: MoreHorizontal, labelKey: 'nav.more' },
];

export const BottomNav = () => {
    const { t } = useGlobal();

    return (
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
            </div>
        </nav>
    );
};
