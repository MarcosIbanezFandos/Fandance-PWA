import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Scale, FlaskConical, Newspaper, PieChart, ScanSearch, PlusCircle, LogOut, Briefcase, MoreVertical, Edit2, Copy, Trash2, Settings } from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';

export const Sidebar = ({ portfolios, activePortfolio, setActivePortfolio, onCreatePortfolio, onLogout, onRename, onDuplicate, onDelete, isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useGlobal();

  const handlePortfolioClick = (p) => {
    setActivePortfolio(p);
    if (setIsOpen) setIsOpen(false);
    if (location.pathname !== '/') navigate('/');
  };

  const MenuLink = ({ to, label, icon: Icon }) => (
    <NavLink
      to={to}
      onClick={() => setIsOpen(false)}
      className={({ isActive }) =>
        `w-full flex items-center gap-4 p-4 md:p-3 lg:p-4 md:justify-center lg:justify-start rounded-2xl transition-all relative group ${isActive ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}`
      }
    >  {({ isActive }) => (
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
          <span className="font-bold text-sm relative z-10 md:hidden lg:block truncate">{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <aside className={`fixed top-0 left-0 h-full bg-slate-900 text-white flex flex-col justify-between z-50 border-r border-slate-800 shadow-2xl transition-all duration-300 ease-in-out w-72 md:w-20 lg:w-72 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="p-6 md:p-3 lg:p-6">
        <div className="flex items-center gap-3 mb-10 text-indigo-400 overflow-hidden md:justify-center lg:justify-start">
          <div className="p-2 bg-indigo-600/20 rounded-xl shrink-0"><TrendingUp size={24} /></div>
          <h1 className="text-xl font-black tracking-tighter uppercase text-white md:hidden lg:block truncate">F<span className="text-indigo-500">AND</span>ANCE</h1>
        </div>

        <nav className="space-y-2">
          <MenuLink to="/" label={t('sidebar.rebalance')} icon={Scale} />
          <MenuLink to="/performance" label={t('sidebar.performance')} icon={PieChart} />
          <MenuLink to="/xray" label={t('sidebar.xray')} icon={ScanSearch} />
          <MenuLink to="/analysis" label={t('sidebar.analysis')} icon={FlaskConical} />
          <MenuLink to="/simulations" label={t('sidebar.simulations')} icon={TrendingUp} />
          <MenuLink to="/news" label={t('sidebar.news')} icon={Newspaper} />
          <MenuLink to="/settings" label={t('sidebar.settings')} icon={Settings} />

          <div className="my-6 h-px bg-slate-800/50 mx-2"></div>

          <button onClick={onCreatePortfolio} className="w-full flex items-center gap-4 p-4 md:p-3 lg:p-4 md:justify-center lg:justify-start rounded-2xl text-indigo-400 hover:bg-indigo-900/20 transition-all border border-dashed border-indigo-900/50 hover:border-indigo-500">
            <PlusCircle size={20} className="shrink-0" />
            <span className="font-bold text-sm md:hidden lg:block truncate">{t('sidebar.new_portfolio')}</span>
          </button>
        </nav>

        <div className="mt-8 md:hidden lg:block">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 px-2">{t('sidebar.my_portfolios')}</div>
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

      <div className="p-4 md:p-3 lg:p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <button onClick={onLogout} className="w-full flex items-center gap-4 p-3 md:p-2 lg:p-3 md:justify-center lg:justify-start text-rose-400 hover:bg-rose-900/20 rounded-xl transition-all group">
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform shrink-0" />
          <span className="font-bold text-xs md:hidden lg:block truncate">{t('sidebar.logout')}</span>
        </button>
      </div>
    </aside>
  );
};

const PortfolioItem = ({ portfolio, isActive, onClick, onRename, onDuplicate, onDelete }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { t } = useGlobal();
  return (
    <div className={`group relative w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${isActive ? 'bg-slate-800 text-white border border-slate-700 shadow-md' : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'}`}>
      <button className="flex-1 flex items-center gap-3 text-left overflow-hidden" onClick={onClick}>
        <Briefcase size={16} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
        <span className="text-xs font-bold truncate">{portfolio.name}</span>
      </button>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }} className="p-1 hover:bg-slate-700 rounded"><MoreVertical size={14} /></button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1" onMouseLeave={() => setMenuOpen(false)}>
            <button onClick={(e) => { e.stopPropagation(); onRename(portfolio.id) }} className="w-full text-left px-3 py-3 text-[10px] font-bold text-slate-300 hover:bg-slate-700 flex gap-2 items-center"><Edit2 size={12} /> {t('portfolio.rename')}</button>
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(portfolio.id, portfolio.name) }} className="w-full text-left px-3 py-3 text-[10px] font-bold text-slate-300 hover:bg-slate-700 flex gap-2 items-center"><Copy size={12} /> {t('portfolio.duplicate')}</button>
            <div className="h-px bg-slate-700 my-1"></div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(portfolio.id) }} className="w-full text-left px-3 py-3 text-[10px] font-bold text-rose-400 hover:bg-rose-900/30 flex gap-2 items-center"><Trash2 size={12} /> {t('portfolio.delete')}</button>
          </div>
        )}
      </div>
    </div>
  );
}