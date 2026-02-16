import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { Outlet, useLocation } from 'react-router-dom';

export const MainLayout = ({
    session,
    portfolios,
    activePortfolio,
    setActivePortfolio,
    onCreatePortfolio,
    onLogout,
    onRename,
    onDuplicate,
    onDelete
}) => {
    const location = useLocation();

    const getHeaderTitle = () => {
        switch (location.pathname) {
            case '/': return activePortfolio?.name || 'Rebalanceador';
            case '/analysis': return 'Análisis de Activos';
            case '/simulations': return 'Proyecciones Financieras';
            case '/settings': return 'Ajustes de Cuenta';
            default: return 'Fandance';
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex">
            <Sidebar
                portfolios={portfolios}
                activePortfolio={activePortfolio}
                setActivePortfolio={setActivePortfolio}
                onCreatePortfolio={onCreatePortfolio}
                onLogout={onLogout}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
            />
            <main className="flex-1 ml-20 lg:ml-72 p-6 lg:p-12 transition-all">
                <header className="flex justify-between items-center mb-10">
                    <h1 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter text-slate-900">
                        {getHeaderTitle()}
                    </h1>
                    <div className="text-right hidden md:block">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Usuario</div>
                        <div className="font-bold text-slate-700">{session?.user?.email}</div>
                    </div>
                </header>
                <Outlet />
            </main>
        </div>
    );
};
