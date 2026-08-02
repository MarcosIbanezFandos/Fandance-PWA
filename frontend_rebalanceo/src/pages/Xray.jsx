import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { motion } from 'framer-motion';
import {
    Loader2, Search, Globe2, Coins, PieChart, Layers, Building2, Map,
    ChevronDown, Info, SearchX, Inbox,
} from 'lucide-react';
import { Card, SectionHeader, Button, Badge, StatTile, ProgressBar, EmptyState, Skeleton } from '../components/UI';
import { Dropdown } from '../components/Dropdown';
import { useGlobal } from '../context/GlobalContext';
import { safeFloat, formatNumber, buildXray } from '../utils';
import { cn } from '../lib/cn';

const prettySector = (s) => {
    if (!s || s === 'unknown') return '—';
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const PAGE_SIZE = 50;
const BREAKDOWN_PREVIEW = 8;

/* ------------------------------------------------------------------ *
 *  Desglose por dimensión (países, sectores, divisas, regiones)
 * ------------------------------------------------------------------ */
const BarList = ({ items, tone = 1, pretty = (x) => x }) => (
    <ul className="space-y-3.5">
        {items.map((it) => (
            <li key={it.key}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <span className="text-subhead font-semibold text-ink truncate">{pretty(it.name)}</span>
                    <span className="text-footnote font-bold text-ink-2 shrink-0 tabular-nums">{formatNumber(it.pct, 1)}%</span>
                </div>
                <ProgressBar pct={it.pct} tone={tone} height="h-1.5" />
                <div className="text-caption2 font-semibold text-ink-3 mt-1 tabular-nums">{formatNumber(it.value)} €</div>
            </li>
        ))}
    </ul>
);

const BreakdownCard = ({ title, icon: Icon, items, tone, pretty, note, unclassifiedPct }) => {
    const { t } = useGlobal();
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? items : items.slice(0, BREAKDOWN_PREVIEW);
    const hidden = items.length - shown.length;

    return (
        <Card>
            <SectionHeader
                icon={Icon}
                title={title}
                hint={note}
                action={<Badge tone="neutral">{items.length}</Badge>}
            />

            {items.length === 0 ? (
                <p className="text-footnote font-medium text-ink-3 py-3">—</p>
            ) : (
                <>
                    <div className={cn(expanded && 'max-h-[26rem] overflow-y-auto custom-scrollbar pr-1')}>
                        <BarList items={shown} tone={tone} pretty={pretty} />
                    </div>

                    {(hidden > 0 || expanded) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-4"
                            onClick={() => setExpanded(v => !v)}
                            iconRight={ChevronDown}
                        >
                            {expanded ? t('xray.collapse') : `${t('xray.show_all')} (${hidden})`}
                        </Button>
                    )}
                </>
            )}

            {unclassifiedPct > 0.5 && (
                <p className="text-caption2 font-medium text-ink-3 mt-4 pt-3 border-t border-line">
                    {formatNumber(unclassifiedPct, 1)}% {t('xray.unclassified')}
                </p>
            )}
        </Card>
    );
};

/* ------------------------------------------------------------------ *
 *  Página
 * ------------------------------------------------------------------ */
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

    // Los fondos no publican su desglose por país en Yahoo: para esa parte se
    // usan los pesos del índice que replican. Se dice, no se disimula.
    const geoNote = xray.estimatedGeoPct > 1
        ? `${t('xray.geo_estimated')} (${formatNumber(xray.estimatedGeoPct, 0)}%).`
        : null;

    const topCountry = xray.countries[0];
    const topSector = xray.sectors[0];
    const hasFunds = positions.some(p => ['ETF', 'Fund'].includes(p.type));

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="space-y-5 md:space-y-6">
            {/* Controles */}
            <Card className="!p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sticky top-0 md:top-4 z-40 !bg-surface/85 backdrop-blur-xl">
                <Dropdown className="w-full md:w-64" value={pid} onChange={setPid} options={portfolioOptions} icon={Building2} placeholder="—" />
                <div className="md:ml-auto w-full md:w-72">
                    <Dropdown value={filter} onChange={(v) => { setFilter(v); setVisibleCount(PAGE_SIZE); }} options={etfOptions} icon={Layers} align="right" />
                </div>
            </Card>

            {!pid ? (
                <Card><EmptyState icon={Inbox} title={t('xray.select_portfolio')} /></Card>
            ) : loading ? (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                        <Skeleton className="xl:col-span-7 h-96 rounded-card" />
                        <Skeleton className="xl:col-span-5 h-96 rounded-card" />
                    </div>
                </div>
            ) : positions.length === 0 ? (
                <Card><EmptyState icon={Inbox} title={t('xray.no_data')} /></Card>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        <StatTile label={t('xray.exposure')} value={`${formatNumber(xray.total)} €`} />
                        <StatTile label={t('xray.holdings')} value={xray.companies.length} />
                        <StatTile
                            label={t('xray.top_country')}
                            value={topCountry ? topCountry.name : '—'}
                            sub={topCountry ? `${formatNumber(topCountry.pct, 1)}%` : null}
                            className="[&_.tabular-nums]:text-body md:[&_.tabular-nums]:text-title3"
                        />
                        <StatTile
                            label={t('xray.top_sector')}
                            value={topSector ? prettySector(topSector.name) : '—'}
                            sub={topSector ? `${formatNumber(topSector.pct, 1)}%` : null}
                            className="[&_.tabular-nums]:text-body md:[&_.tabular-nums]:text-title3"
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-6">
                        {/* Empresas (look-through) */}
                        <div className="xl:col-span-7">
                            <Card className="!p-0 overflow-hidden">
                                <div className="p-4 md:p-5 border-b border-line">
                                    <SectionHeader
                                        icon={Building2}
                                        title={t('xray.companies')}
                                        className="mb-3"
                                        action={<Badge tone="brand">{allCompanies.length}</Badge>}
                                    />
                                    <div className="flex items-center gap-2 bg-surface-2 border border-line rounded-control px-3 h-10 transition-all focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                                        <Search size={16} className="text-ink-3 shrink-0" />
                                        <input
                                            value={query}
                                            onChange={e => { setQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
                                            placeholder={t('xray.search')}
                                            className="bg-transparent w-full outline-none text-subhead font-medium text-ink placeholder:text-ink-3 placeholder:font-normal"
                                        />
                                    </div>
                                </div>

                                {companies.length === 0 ? (
                                    <EmptyState icon={SearchX} title={t('xray.no_match')} />
                                ) : (
                                    <ul className="divide-y divide-line">
                                        {companies.map((c, idx) => (
                                            <li key={c.key} className="px-4 md:px-5 py-3 flex items-center gap-3 md:gap-4 hover:bg-surface-2/60 transition-colors">
                                                <span className="w-6 text-right text-caption2 font-bold text-ink-3 shrink-0 tabular-nums">{idx + 1}</span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-subhead font-semibold truncate text-ink">{c.name}</div>
                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                        {c.symbol && <span className="text-caption2 font-bold text-brand">{c.symbol}</span>}
                                                        {c.sources.map(s => (
                                                            <Badge key={s} tone="neutral">{s === c.symbol ? t('xray.direct') : s}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="w-16 md:w-24 shrink-0">
                                                    <ProgressBar pct={c.pct} tone={1} height="h-1.5" />
                                                    <div className="text-right text-caption2 font-bold text-ink-3 mt-1 tabular-nums">{formatNumber(c.pct, 2)}%</div>
                                                </div>
                                                <div className="w-16 md:w-20 text-right text-subhead font-bold text-ink shrink-0 tabular-nums">{formatNumber(c.value)}€</div>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="p-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <span className="text-caption2 font-semibold text-ink-3 tabular-nums">
                                        {t('xray.showing')} {Math.min(visibleCount, allCompanies.length)} {t('xray.of')} {allCompanies.length}
                                    </span>
                                    {hasMore && (
                                        <Button variant="soft" size="sm" iconRight={ChevronDown} onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
                                            {t('xray.load_more')}
                                        </Button>
                                    )}
                                </div>
                            </Card>

                            {/* Límite real de la fuente de datos: mejor decirlo que dejar
                                que el usuario cuente 10 empresas por fondo y no entienda. */}
                            {hasFunds && (
                                <div className="mt-4 flex items-start gap-3 p-4 rounded-card bg-warning-soft border border-warning/25">
                                    <Info size={16} className="text-warning shrink-0 mt-0.5" strokeWidth={2.25} />
                                    <div className="min-w-0">
                                        <p className="text-footnote font-bold text-ink mb-1">{t('xray.coverage')}</p>
                                        <p className="text-footnote font-medium text-ink-2 leading-relaxed">{t('xray.coverage_note')}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Desgloses */}
                        <div className="xl:col-span-5 space-y-5">
                            <BreakdownCard title={t('xray.regions')} icon={Map} items={xray.regions} tone={4} note={geoNote} unclassifiedPct={xray.unclassified?.regions} />
                            <BreakdownCard title={t('xray.countries')} icon={Globe2} items={xray.countries} tone={1} note={geoNote} unclassifiedPct={xray.unclassified?.countries} />
                            <BreakdownCard title={t('xray.sectors')} icon={PieChart} items={xray.sectors} tone={3} pretty={prettySector} unclassifiedPct={xray.unclassified?.sectors} />
                            <BreakdownCard title={t('xray.currencies')} icon={Coins} items={xray.currencies} tone={5} unclassifiedPct={xray.unclassified?.currencies} />
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
};
