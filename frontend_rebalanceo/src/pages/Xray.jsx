import React, { useState, useEffect, useMemo } from 'react';
import api from '../api'
import { motion } from 'framer-motion';
import { Loader2, Search, Globe2, Coins, PieChart, Layers, Building2, Map, ChevronDown } from 'lucide-react';
import { GlassCard } from '../components/UI';
import { Dropdown } from '../components/Dropdown';
import { useGlobal } from '../context/GlobalContext';
import { safeFloat, formatNumber, buildXray } from '../utils';

const prettySector = (s) => {
    if (!s || s === 'unknown') return 'Other / Unknown';
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const BAR_TONE = {
    country: 'bg-indigo-500',
    currency: 'bg-emerald-500',
    sector: 'bg-violet-500',
    region: 'bg-amber-500',
};

const BarList = ({ items, tone = 'country', pretty = (x) => x }) => {
    return (
        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {items.map((it) => (
                <div key={it.key}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate pr-2">{pretty(it.name)}</span>
                        <span className="font-black text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">{formatNumber(it.pct, 1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, it.pct)}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className={`h-full rounded-full ${BAR_TONE[tone]}`} />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">{formatNumber(it.value)} €</div>
                </div>
            ))}
            {items.length === 0 && <div className="text-xs font-bold text-slate-400 py-2">—</div>}
        </div>
    );
};

const BreakdownCard = ({ title, icon: Icon, items, tone, pretty }) => (
    <GlassCard>
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2"><Icon size={14} /> {title}</h3>
        <BarList items={items} tone={tone} pretty={pretty} />
    </GlassCard>
);

const PAGE_SIZE = 50;

export const Xray = ({ portfolios, activePortfolioId }) => {
    const { t } = useGlobal();
    const [pid, setPid] = useState('');
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {
        if (!pid) {
            if (activePortfolioId) setPid(activePortfolioId);
            else if (portfolios.length) setPid(portfolios[0].id);
        }
    }, [portfolios, activePortfolioId]);

    useEffect(() => {
        if (!pid) return;
        const load = async () => {
            setLoading(true);
            setFilter('all');
            setVisibleCount(PAGE_SIZE);
            try {
                const itemsRes = await api.get(`${import.meta.env.VITE_API_URL}/portfolio/${pid}?t=${Date.now()}`);
                const items = (itemsRes.data || []).filter(i => i.asset?.ticker && safeFloat(i.value) > 0);
                if (items.length === 0) { setPositions([]); setLoading(false); return; }
                const payload = items.map(i => ({
                    ticker: i.asset.ticker, name: i.asset.name || i.asset.ticker,
                    type: i.asset.type || 'Stock', value: safeFloat(i.value), sector: i.asset.sector
                }));
                const res = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/xray`, { positions: payload }, { timeout: 60000 });
                setPositions(res.data?.positions || []);
            } catch (e) { setPositions([]); }
            finally { setLoading(false); }
        };
        load();
    }, [pid]);

    const xray = useMemo(() => buildXray(positions, filter === 'all' ? null : filter), [positions, filter]);

    const etfOptions = useMemo(() => {
        const funds = positions.filter(p => ['ETF', 'Fund'].includes(p.type));
        return [{ value: 'all', label: t('xray.whole') }, ...funds.map(p => ({ value: p.ticker, label: p.name, hint: p.ticker }))];
    }, [positions, t]);

    const portfolioOptions = portfolios.map(p => ({ value: p.id, label: p.name }));

    const allCompanies = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return xray.companies;
        return xray.companies.filter(c => (c.name || '').toLowerCase().includes(q) || (c.symbol || '').toLowerCase().includes(q));
    }, [xray.companies, query]);

    const companies = allCompanies.slice(0, visibleCount);
    const hasMore = visibleCount < allCompanies.length;

    const realHoldings = xray.companies.filter(c => !c.other).length;
    const topCountry = xray.countries.find(c => !/diversified|other/i.test(c.name)) || xray.countries[0];
    const topSector = xray.sectors.find(s => s.key !== 'unknown') || xray.sectors[0];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="space-y-6 md:space-y-8">
            {/* Controls */}
            <GlassCard className="!p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3 sticky top-0 md:top-4 z-40">
                <Dropdown className="w-full md:w-64" value={pid} onChange={setPid} options={portfolioOptions} icon={Building2} placeholder="—" />
                <div className="md:ml-auto w-full md:w-72">
                    <Dropdown value={filter} onChange={(v) => { setFilter(v); setVisibleCount(PAGE_SIZE); }} options={etfOptions} icon={Layers} align="right" />
                </div>
            </GlassCard>

            {!pid ? (
                <div className="text-center py-16 text-slate-400 font-bold">{t('xray.select_portfolio')}</div>
            ) : loading ? (
                <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
            ) : positions.length === 0 ? (
                <div className="text-center py-16 px-6 text-slate-400 font-bold bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">{t('xray.no_data')}</div>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <GlassCard>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('xray.exposure')}</div>
                            <div className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">{formatNumber(xray.total)} €</div>
                        </GlassCard>
                        <GlassCard>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('xray.holdings')}</div>
                            <div className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">{realHoldings}</div>
                        </GlassCard>
                        <GlassCard>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('xray.top_country')}</div>
                            <div className="text-sm md:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{topCountry ? topCountry.name : '—'}</div>
                            {topCountry && <div className="text-xs font-bold text-indigo-500">{formatNumber(topCountry.pct, 1)}%</div>}
                        </GlassCard>
                        <GlassCard>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('xray.top_sector')}</div>
                            <div className="text-sm md:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{topSector ? prettySector(topSector.name) : '—'}</div>
                            {topSector && <div className="text-xs font-bold text-violet-500">{formatNumber(topSector.pct, 1)}%</div>}
                        </GlassCard>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
                        {/* Companies look-through */}
                        <div className="xl:col-span-7">
                            <GlassCard className="!p-0 overflow-hidden">
                                <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800">
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Building2 size={14} /> {t('xray.companies')}</h3>
                                    <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                                        <Search size={16} className="text-slate-400 mr-2" />
                                        <input value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }} placeholder={t('xray.search')} className="bg-transparent w-full outline-none text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400" />
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {companies.length === 0 ? (
                                        <div className="p-8 text-center text-xs font-bold text-slate-400">{t('xray.no_match')}</div>
                                    ) : companies.map((c, idx) => (
                                        <div key={c.key} className="p-3 md:p-4 px-4 md:px-5 flex items-center gap-3 md:gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                            <div className="w-5 md:w-6 text-center text-[10px] md:text-[11px] font-black text-slate-300 dark:text-slate-600 shrink-0">{idx + 1}</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs md:text-sm font-bold truncate text-slate-800 dark:text-slate-100">{c.name}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5 md:mt-1 flex-wrap">
                                                    {c.symbol && <span className="text-[9px] md:text-[10px] font-black text-indigo-400">{c.symbol}</span>}
                                                    {c.sources.map(s => (
                                                        <span key={s} className="text-[8px] md:text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 md:px-1.5 py-0.5 rounded">{s === c.symbol ? t('xray.direct') : s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="w-20 md:w-28 shrink-0">
                                                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-1">
                                                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, c.pct)}%` }} />
                                                </div>
                                                <div className="text-right text-[9px] md:text-[10px] font-black text-slate-400 tabular-nums">{formatNumber(c.pct, 2)}%</div>
                                            </div>
                                            <div className="w-16 md:w-20 text-right text-xs md:text-sm font-black text-slate-700 dark:text-slate-200 shrink-0 tabular-nums">{formatNumber(c.value)}€</div>
                                        </div>
                                    ))}
                                </div>
                                {/* Load more + counter */}
                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {t('xray.showing')} {Math.min(visibleCount, allCompanies.length)} {t('xray.of')} {allCompanies.length}
                                    </span>
                                    {hasMore && (
                                        <button
                                            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                        >
                                            <ChevronDown size={14} />
                                            {t('xray.load_more')}
                                        </button>
                                    )}
                                </div>
                            </GlassCard>
                        </div>

                        {/* Breakdowns */}
                        <div className="xl:col-span-5 space-y-6">
                            <BreakdownCard title={t('xray.regions')} icon={Map} items={xray.regions} tone="region" pretty={(x) => x} />
                            <BreakdownCard title={t('xray.countries')} icon={Globe2} items={xray.countries} tone="country" pretty={(x) => x} />
                            <BreakdownCard title={t('xray.sectors')} icon={PieChart} items={xray.sectors} tone="sector" pretty={prettySector} />
                            <BreakdownCard title={t('xray.currencies')} icon={Coins} items={xray.currencies} tone="currency" pretty={(x) => x} />
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
};
