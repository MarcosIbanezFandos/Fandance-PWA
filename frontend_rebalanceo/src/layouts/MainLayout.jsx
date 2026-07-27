import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

export const MainLayout = (props) => {
    const { session } = props;
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const getHeaderTitle = () => {
        switch (location.pathname) {
            case '/': return props.activePortfolio?.name || 'Rebalancer';
            case '/analysis': return 'Asset Analysis';
            case '/simulations': return 'Financial Projections';
            case '/news': return 'Market News';
            case '/settings': return 'Account Settings';
            default: return 'Fandance';
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex overflow-hidden">
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            
            <Sidebar {...props} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            
            <main className="flex-1 w-full lg:ml-72 p-4 md:p-8 lg:p-12 transition-all min-w-0 overflow-y-auto h-screen">
                <header className="flex justify-between items-center mb-6 lg:mb-10">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button 
                            className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-200 rounded-lg shrink-0"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter text-slate-900 truncate">
                            {getHeaderTitle()}
                        </h1>
                    </div>
                    <div className="text-right hidden md:block shrink-0">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</div>
                        <div className="text-xs font-bold text-slate-700">{session?.user?.email}</div>
                    </div>
                </header>
                <Outlet />
            </main>
        </div>
    );
};
