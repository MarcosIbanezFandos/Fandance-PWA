import React, { useState, useRef, useEffect } from 'react';
import {
  HomeIcon, Wallet, Activity, FlaskConical, ScanSearch, TrendingUp, History,
  Newspaper, Settings, PlusCircle, LogOut, Briefcase, MoreVertical, Edit2, Copy, Trash2,
} from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useGlobal } from '../context/GlobalContext';
import { cn } from '../lib/cn';

// Mismo orden y jerarquía que la barra inferior: las cuatro principales arriba
// y las secundarias debajo de una separación, para que la navegación no cambie
// de forma según el tamaño de pantalla.
const NAV_MAIN = [
  { to: '/', icon: HomeIcon, key: 'nav.home' },
  { to: '/posiciones', icon: Wallet, key: 'nav.positions' },
  { to: '/analisis', icon: Activity, key: 'nav.analysis' },
  { to: '/simulacion', icon: FlaskConical, key: 'nav.simulations' },
];

const NAV_SECONDARY = [
  { to: '/xray', icon: ScanSearch, key: 'nav.xray_full' },
  { to: '/rendimiento', icon: TrendingUp, key: 'nav.performance' },
  { to: '/historial', icon: History, key: 'nav.history' },
  { to: '/noticias', icon: Newspaper, key: 'nav.news' },
  { to: '/settings', icon: Settings, key: 'nav.settings' },
];

export const Sidebar = ({
  portfolios = [], activePortfolio, setActivePortfolio, onCreatePortfolio,
  onLogout, onRename, onDuplicate, onDelete, isOpen, setIsOpen,
}) => {
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
      end={to === '/'}
      title={label}
      onClick={() => setIsOpen && setIsOpen(false)}
      className={({ isActive }) => cn(
        'w-full flex items-center gap-3 px-3 h-11 rounded-control relative',
        'md:justify-center lg:justify-start',
        'transition-colors duration-150',
        isActive
          ? 'bg-brand-soft text-brand-ink font-semibold'
          : 'text-ink-2 hover:text-ink hover:bg-surface-2 font-medium'
      )}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand md:hidden lg:block" />}
          <Icon size={19} strokeWidth={isActive ? 2.3 : 1.9} className="shrink-0" />
          <span className="text-subhead truncate md:hidden lg:block">{label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <aside className={cn(
        'fixed top-0 left-0 h-full z-50 flex flex-col justify-between',
        'bg-surface border-r border-line',
        'w-72 md:w-20 lg:w-72',
        'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
        'transition-transform duration-300 ease-out',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    )}>
      <div className="p-4 lg:p-5 min-h-0 flex flex-col">
        {/* Marca */}
        <div className="flex items-center gap-2.5 mb-7 px-1 md:justify-center lg:justify-start">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shrink-0">
            <TrendingUp size={19} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-body font-bold tracking-tight text-ink md:hidden lg:block">
            F<span className="text-brand">and</span>ance
          </h1>
        </div>

        <nav className="space-y-1">
          {NAV_MAIN.map(({ to, icon, key }) => (
            <MenuLink key={to} to={to} label={t(key)} icon={icon} />
          ))}

          <div className="!mt-4 !mb-2 h-px bg-line" />

          {NAV_SECONDARY.map(({ to, icon, key }) => (
            <MenuLink key={to} to={to} label={t(key)} icon={icon} />
          ))}
        </nav>

        <div className="my-5 h-px bg-line" />

        <button
          onClick={onCreatePortfolio}
          title={t('sidebar.new_portfolio')}
          className={cn(
              'w-full flex items-center gap-3 px-3 h-11 rounded-control',
              'md:justify-center lg:justify-start',
              'text-brand font-semibold text-subhead',
              'border border-dashed border-brand/35 hover:border-brand hover:bg-brand-soft',
              'transition-colors duration-150'
          )}
        >
          <PlusCircle size={19} className="shrink-0" strokeWidth={2} />
          <span className="truncate md:hidden lg:block">{t('sidebar.new_portfolio')}</span>
        </button>

        {/* Carteras */}
        <div className="mt-6 md:hidden lg:flex lg:flex-col min-h-0">
          <div className="label-caps px-1 mb-2.5">{t('sidebar.my_portfolios')}</div>
          <div className="space-y-0.5 overflow-y-auto max-h-64 custom-scrollbar pr-1">
            {portfolios.map(p => (
              <PortfolioItem
                key={p.id}
                portfolio={p}
                isActive={activePortfolio?.id === p.id}
                onClick={() => handlePortfolioClick(p)}
                onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete}
              />
            ))}
            {portfolios.length === 0 && (
              <p className="text-footnote font-medium text-ink-3 px-1 py-2">—</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-5 border-t border-line">
        <button
          onClick={onLogout}
          title={t('sidebar.logout')}
          className={cn(
              'w-full flex items-center gap-3 px-3 h-10 rounded-control',
              'md:justify-center lg:justify-start',
              'text-negative hover:bg-negative-soft transition-colors duration-150 group'
          )}
        >
          <LogOut size={18} className="shrink-0 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
          <span className="text-subhead font-semibold truncate md:hidden lg:block">{t('sidebar.logout')}</span>
        </button>
      </div>
    </aside>
  );
};

const PortfolioItem = ({ portfolio, isActive, onClick, onRename, onDuplicate, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const { t } = useGlobal();

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  return (
    <div ref={ref} className={cn(
        'group relative w-full flex items-center gap-2 pl-3 pr-1 h-10 rounded-control transition-colors',
        isActive ? 'bg-surface-2 border border-line' : 'border border-transparent hover:bg-surface-2'
    )}>
      <button className="flex-1 flex items-center gap-2.5 text-left min-w-0" onClick={onClick}>
        <Briefcase size={15} className={cn('shrink-0', isActive ? 'text-brand' : 'text-ink-3')} strokeWidth={2} />
        <span className={cn('text-footnote truncate', isActive ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>
          {portfolio.name}
        </span>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
        aria-label="Opciones"
        className={cn(
            'p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3 transition-all shrink-0',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        )}
      >
        <MoreVertical size={14} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-line rounded-control shadow-pop z-50 overflow-hidden p-1">
          <MenuAction icon={Edit2} label={t('portfolio.rename')} onClick={() => { setMenuOpen(false); onRename(portfolio.id); }} />
          <MenuAction icon={Copy} label={t('portfolio.duplicate')} onClick={() => { setMenuOpen(false); onDuplicate(portfolio.id, portfolio.name); }} />
          <div className="h-px bg-line my-1" />
          <MenuAction icon={Trash2} label={t('portfolio.delete')} danger onClick={() => { setMenuOpen(false); onDelete(portfolio.id); }} />
        </div>
      )}
    </div>
  );
};

const MenuAction = ({ icon: Icon, label, onClick, danger = false }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={cn(
        'w-full text-left px-2.5 py-2 rounded-lg text-footnote font-semibold flex gap-2 items-center transition-colors',
        danger ? 'text-negative hover:bg-negative-soft' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
    )}
  >
    <Icon size={13} strokeWidth={2} /> {label}
  </button>
);
