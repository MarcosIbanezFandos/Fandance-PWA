import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Scale, FlaskConical, Newspaper, UserCircle, PlusCircle, LogOut, Briefcase, MoreVertical, Edit2, Copy, Trash2, Settings } from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';

export const Sidebar = ({ portfolios, activePortfolio, setActivePortfolio, onCreatePortfolio, onLogout, onRename, onDuplicate, onDelete }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handlePortfolioClick = (p) => {
    setActivePortfolio(p);
    if (location.pathname !== '/') navigate('/');
  };

  const MenuLink = ({ to, label, icon: Icon }) => (
    <NavLink
      to={to}
      className={({ isActive }) => `relative w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="activeTabBg"
              className="absolute inset-0 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-900/50 -z-10"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <Icon size={20} className="relative z-10" />
          <span className="hidden lg:block font-bold text-sm relative z-10">{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <aside className="w-20 lg:w-72 bg-slate-900 text-white fixed h-full flex flex-col justify-between z-50 border-r border-slate-800 shadow-2xl">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10 text-indigo-400 overflow-hidden">
          <div className="p-2 bg-indigo-600/20 rounded-xl"><TrendingUp size={24} /></div>
          <h1 className="text-xl font-black tracking-tighter uppercase text-white hidden lg:block">F<span className="text-indigo-500">AND</span>ANCE</h1>
        </div>

        <nav className="space-y-2">
          <MenuLink to="/" label="Rebalanceador" icon={Scale} />
          <MenuLink to="/analysis" label="Análisis" icon={FlaskConical} />
          <MenuLink to="/simulations" label="Simulaciones" icon={TrendingUp} />
          <MenuLink to="/settings" label="Ajustes" icon={Settings} />

          <div className="my-6 h-px bg-slate-800/50 mx-2"></div>

          <button onClick={onCreatePortfolio} className="w-full flex items-center gap-4 p-4 rounded-2xl text-indigo-400 hover:bg-indigo-900/20 transition-all border border-dashed border-indigo-900/50 hover:border-indigo-500">
            <PlusCircle size={20} />
            <span className="hidden lg:block font-bold text-sm">Nueva Cartera</span>
          </button>
        </nav>

        <div className="mt-8 hidden lg:block">
          <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4 px-2">Mis Carteras</div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {portfolios.map(p => (
              <PortfolioItem
                key={p.id}
                portfolio={p}
                isActive={activePortfolio?.id === p.id}
                onClick={() => handlePortfolioClick(p)}
                onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <button onClick={onLogout} className="w-full flex items-center gap-4 p-3 text-rose-400 hover:bg-rose-900/20 rounded-xl transition-all group">
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="hidden lg:block font-bold text-xs">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};

const PortfolioItem = ({ portfolio, isActive, onClick, onRename, onDuplicate, onDelete }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  return (
    <div className={`group relative w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${isActive ? 'bg-slate-800 text-white border border-slate-700 shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'}`}>
      <button className="flex-1 flex items-center gap-3 text-left overflow-hidden" onClick={onClick}>
        <Briefcase size={16} className={isActive ? 'text-indigo-400' : ''} />
        <span className="text-xs font-bold truncate">{portfolio.name}</span>
      </button>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }} className="p-1 hover:bg-slate-700 rounded"><MoreVertical size={14} /></button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1" onMouseLeave={() => setMenuOpen(false)}>
            <button onClick={(e) => { e.stopPropagation(); onRename(portfolio.id) }} className="w-full text-left px-3 py-3 text-[10px] font-bold text-slate-300 hover:bg-slate-700 flex gap-2 items-center"><Edit2 size={12} /> Renombrar</button>
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(portfolio.id, portfolio.name) }} className="w-full text-left px-3 py-3 text-[10px] font-bold text-slate-300 hover:bg-slate-700 flex gap-2 items-center"><Copy size={12} /> Duplicar</button>
            <div className="h-px bg-slate-700 my-1"></div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(portfolio.id) }} className="w-full text-left px-3 py-3 text-[10px] font-bold text-rose-400 hover:bg-rose-900/30 flex gap-2 items-center"><Trash2 size={12} /> Eliminar</button>
          </div>
        )}
      </div>
    </div>
  );
}