import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

export const MainLayout = (props) => {
    const { session } = props;
    const location = useLocation();
    const { t } = useGlobal();
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            
            <Sidebar {...props} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            
            <main className="flex-1 w-full md:ml-20 lg:ml-72 p-4 md:p-8 lg:p-12 transition-all min-w-0 overflow-y-auto h-screen">
                <header className="flex justify-between items-center mb-6 lg:mb-10">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button 
                            className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg shrink-0 transition-colors"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white truncate">
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
        </div>
    );
};
