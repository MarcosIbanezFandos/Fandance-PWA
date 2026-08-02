import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import {
    Activity, ShieldAlert, Layers, ListOrdered, TrendingUp, TrendingDown,
    Copy, ScanSearch, ArrowRight, Info, Inbox, ArrowUpDown,
} from 'lucide-react';
import api from '../api';
import {
    Card, SectionHeader, Segmented, Badge, StatTile, ProgressBar,
    EmptyState, Skeleton, Button, staggerContainer,
} from '../components/UI';
import { Dropdown } from '../components/Dropdown';
import { useGlobal } from '../context/GlobalContext';
import {
    safeFloat, formatNumber, formatSeriesDates, buildXray,
    computeOverlap, computeConcentration,
} from '../utils';
import { cn } from '../lib/cn';

const PERIODS = [
    { value: '1mo', label: '1M' },
    { value: '6mo', label: '6M' },
    { value: '1y', label: '1A' },
    { value: 'max', label: 'MAX' },
];

const BENCH = '^GSPC';

const Delta = ({ value, decimals = 2, suffix = '%' }) => {
    const v = safeFloat(value);
    const up = v >= 0;
    return (
        <span className={cn('inline-flex items-center gap-1 font-bold tabular-nums', up ? 'text-positive' : 'text-negative')}>
            {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {up ? '+' : ''}{formatNumber(v, decimals)}{suffix}
        </span>
    );
};

/* ================================================================== *
 *  Sección: Rendimiento
 * ================================================================== */
const PerformanceSection = ({ stats, relative, loading }) => {
    const { t } = useGlobal();
    const p = stats?.portfolio;
    const b = stats?.[BENCH];

    if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}</div>;
    if (!p) return <Card><EmptyState icon={Inbox} title={t('an.no_data')} /></Card>;

    const excess = safeFloat(p.return_pct) - safeFloat(b?.return_pct);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label={t('an.return')} value={`${safeFloat(p.return_pct) >= 0 ? '+' : ''}${formatNumber(p.return_pct, 2)}%`} tone={p.return_pct >= 0 ? 'positive' : 'negative'} />
                <StatTile label={t('an.cagr')} value={`${formatNumber(p.cagr, 2)}%`} sub={t('an.cagr_sub')} />
                <StatTile label={t('an.vs_bench')} value={`${excess >= 0 ? '+' : ''}${formatNumber(excess, 2)} pp`} tone={excess >= 0 ? 'positive' : 'negative'} sub="S&P 500" />
                <StatTile label={t('an.beta')} value={formatNumber(relative?.[BENCH]?.beta ?? 0, 2)} sub={t('an.beta_sub')} />
            </div>

            <Card className="!p-4 flex items-start gap-3">
                <Info size={16} className="text-ink-3 shrink-0 mt-0.5" />
                <p className="text-footnote font-medium text-ink-2 leading-relaxed">
                    {t('an.perf_note')}{' '}
                    <Link to="/rendimiento" className="font-bold text-brand hover:underline">{t('an.perf_link')}</Link>
                </p>
            </Card>
        </div>
    );
};

/* ================================================================== *
 *  Sección: Riesgo
 * ================================================================== */
const RiskSection = ({ stats, relative, loading }) => {
    const { t } = useGlobal();
    const p = stats?.portfolio;
    const b = stats?.[BENCH];
    const rel = relative?.[BENCH];

    if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}</div>;
    if (!p) return <Card><EmptyState icon={Inbox} title={t('an.no_data')} /></Card>;

    const vol = safeFloat(p.volatility);
    const dd = safeFloat(p.max_drawdown);
    // Rentabilidad por unidad de riesgo. No es Sharpe (no descuenta el activo
    // libre de riesgo), y por eso se llama de otra forma.
    const perUnit = vol > 0 ? safeFloat(p.cagr) / vol : 0;

    const rows = [
        { key: 'vol', label: t('an.volatility'), value: `${formatNumber(vol, 1)}%`, bench: b ? `${formatNumber(b.volatility, 1)}%` : '—', worse: b && vol > safeFloat(b.volatility) },
        { key: 'dd', label: t('an.max_dd'), value: `${formatNumber(dd, 1)}%`, bench: b ? `${formatNumber(b.max_drawdown, 1)}%` : '—', worse: b && dd < safeFloat(b.max_drawdown) },
        { key: 'beta', label: t('an.beta'), value: formatNumber(rel?.beta ?? 0, 2), bench: '1,00', worse: (rel?.beta ?? 0) > 1 },
        { key: 'corr', label: t('an.correlation'), value: formatNumber(rel?.correlation ?? 0, 2), bench: '1,00', worse: false },
    ];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label={t('an.volatility')} value={`${formatNumber(vol, 1)}%`} sub={t('an.annualised')} />
                <StatTile label={t('an.max_dd')} value={`${formatNumber(dd, 1)}%`} tone="negative" sub={t('an.max_dd_sub')} />
                <StatTile label={t('an.per_unit')} value={formatNumber(perUnit, 2)} tone={perUnit >= 0.5 ? 'positive' : 'default'} sub={t('an.per_unit_sub')} />
                <StatTile label={t('an.correlation')} value={formatNumber(rel?.correlation ?? 0, 2)} sub="S&P 500" />
            </div>

            <Card className="!p-0 overflow-hidden">
                <div className="p-5 pb-3"><SectionHeader icon={ShieldAlert} title={t('an.vs_bench_table')} className="mb-0" /></div>
                <table className="w-full text-subhead">
                    <thead>
                        <tr className="border-y border-line bg-surface-2">
                            <th className="text-left label-caps px-5 py-2 font-semibold">{t('an.metric')}</th>
                            <th className="text-right label-caps px-3 py-2 font-semibold">{t('an.yours')}</th>
                            <th className="text-right label-caps px-5 py-2 font-semibold">S&P 500</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        {rows.map(r => (
                            <tr key={r.key}>
                                <td className="px-5 py-3 font-semibold text-ink">{r.label}</td>
                                <td className={cn('px-3 py-3 text-right font-bold tabular-nums', r.worse ? 'text-warning' : 'text-ink')}>{r.value}</td>
                                <td className="px-5 py-3 text-right font-semibold text-ink-3 tabular-nums">{r.bench}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

/* ================================================================== *
 *  Sección: Composición (concentración + solapamiento)
 * ================================================================== */
const CompositionSection = ({ xray, positions, loading }) => {
    const { t } = useGlobal();
    const conc = useMemo(() => computeConcentration(xray?.companies || []), [xray]);
    const overlaps = useMemo(() => computeOverlap(positions || []), [positions]);

    if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}</div>;
    if (!xray?.companies?.length) return <Card><EmptyState icon={Inbox} title={t('an.no_data')} /></Card>;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label={t('an.top10')} value={`${formatNumber(conc.top10, 1)}%`} tone={conc.top10 > 50 ? 'negative' : 'default'} sub={t('an.top10_sub')} />
                <StatTile label={t('an.effective')} value={formatNumber(conc.effectiveHoldings, 0)} sub={t('an.effective_sub').replace('{n}', conc.count)} />
                <StatTile label={t('an.top1')} value={`${formatNumber(conc.top1, 1)}%`} sub={xray.companies[0]?.name?.slice(0, 18)} />
                <StatTile label={t('an.regions')} value={xray.regions?.length || 0} sub={xray.regions?.[0]?.name} />
            </div>

            {/* Solapamiento entre fondos: la decisión de consolidar */}
            <Card>
                <SectionHeader
                    icon={Copy}
                    title={t('an.overlap')}
                    hint={t('an.overlap_hint')}
                />
                {overlaps.length === 0 ? (
                    <p className="text-footnote font-medium text-ink-3 py-2">{t('an.overlap_none')}</p>
                ) : (
                    <ul className="space-y-4">
                        {overlaps.slice(0, 5).map(o => (
                            <li key={o.key}>
                                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                                    <span className="text-subhead font-semibold text-ink truncate">
                                        {o.a.ticker} <span className="text-ink-3 font-medium">×</span> {o.b.ticker}
                                    </span>
                                    <Badge tone={o.pct > 60 ? 'negative' : o.pct > 30 ? 'warning' : 'neutral'}>
                                        {formatNumber(o.pct, 0)}%
                                    </Badge>
                                </div>
                                <ProgressBar pct={o.pct} tone={o.pct > 60 ? 6 : o.pct > 30 ? 4 : 2} height="h-1.5" />
                                <p className="text-caption2 font-medium text-ink-3 mt-1.5">
                                    {o.sharedCount} {t('an.shared')}: {o.shared.slice(0, 5).join(', ')}
                                </p>
                                {o.pct > 60 && (
                                    <p className="text-footnote font-semibold text-warning mt-1.5">
                                        {t('an.overlap_warn')}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card className="!p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-control bg-surface-2 border border-line flex items-center justify-center shrink-0">
                        <ScanSearch size={17} className="text-ink-2" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-subhead font-semibold text-ink">{t('an.xray_cta')}</p>
                        <p className="text-footnote font-medium text-ink-2">{t('an.xray_cta_sub')}</p>
                    </div>
                </div>
                <Link to="/xray" className="shrink-0">
                    <Button variant="secondary" size="sm" iconRight={ArrowRight}>{t('an.open')}</Button>
                </Link>
            </Card>
        </div>
    );
};

/* ================================================================== *
 *  Sección: Activos
 * ================================================================== */
const AssetsSection = ({ assets, loading, totalValue }) => {
    const { t } = useGlobal();
    const [sort, setSort] = useState('impact');

    const sorted = useMemo(() => {
        const list = [...(assets || [])];
        if (sort === 'change') return list.sort((a, b) => b.change_pct - a.change_pct);
        if (sort === 'weight') return list.sort((a, b) => b.value - a.value);
        // Impacto = cuánto movió la aguja de la cartera, no cuánto subió el activo.
        return list.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    }, [assets, sort]);

    if (loading) return <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 rounded-card" />)}</div>;
    if (!assets?.length) return <Card><EmptyState icon={Inbox} title={t('an.no_data')} /></Card>;

    const best = sorted.filter(a => a.impact > 0)[0];
    const worst = [...sorted].reverse().filter(a => a.impact < 0)[0];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[[t('an.best'), best, 'positive'], [t('an.worst'), worst, 'negative']].map(([label, a, tone]) => (
                    <Card key={label} className="!p-4">
                        <div className="label-caps mb-2">{label}</div>
                        {a ? (
                            <>
                                <div className="text-subhead font-semibold text-ink truncate">{a.name}</div>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <Delta value={a.change_pct} />
                                    <span className="text-footnote font-semibold text-ink-3 tabular-nums">
                                        {a.impact >= 0 ? '+' : ''}{formatNumber(a.impact, 2)} pp {t('an.on_portfolio')}
                                    </span>
                                </div>
                            </>
                        ) : <p className="text-footnote font-medium text-ink-3">—</p>}
                    </Card>
                ))}
            </div>

            <Card className="!p-0 overflow-hidden">
                <div className="p-4 md:p-5 border-b border-line flex items-center justify-between gap-3">
                    <SectionHeader icon={ListOrdered} title={t('an.assets')} className="mb-0" />
                    <Segmented
                        size="sm" value={sort} onChange={setSort}
                        options={[
                            { value: 'impact', label: t('an.sort_impact') },
                            { value: 'change', label: t('an.sort_change') },
                            { value: 'weight', label: t('an.sort_weight') },
                        ]}
                    />
                </div>
                <ul className="divide-y divide-line">
                    {sorted.map(a => (
                        <li key={a.ticker} className="px-4 md:px-5 py-3 flex items-center gap-3 md:gap-4 hover:bg-surface-2/60 transition-colors">
                            <div className="min-w-0 flex-1">
                                <div className="text-subhead font-semibold text-ink truncate">{a.name}</div>
                                <div className="text-caption2 font-bold text-brand mt-0.5">{a.ticker}</div>
                            </div>

                            <div className="w-20 h-9 shrink-0 hidden sm:block">
                                {a.data?.length > 1 && (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={a.data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id={`sg-${a.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={`rgb(var(${a.change_pct >= 0 ? '--c-positive' : '--c-negative'}))`} stopOpacity={0.25} />
                                                    <stop offset="100%" stopColor={`rgb(var(${a.change_pct >= 0 ? '--c-positive' : '--c-negative'}))`} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <YAxis domain={['auto', 'auto']} hide />
                                            <Area type="monotone" dataKey="value" strokeWidth={1.5}
                                                stroke={`rgb(var(${a.change_pct >= 0 ? '--c-positive' : '--c-negative'}))`}
                                                fill={`url(#sg-${a.ticker})`} isAnimationActive={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            <div className="w-20 text-right shrink-0">
                                <Delta value={a.change_pct} />
                                <div className="text-caption2 font-semibold text-ink-3 tabular-nums mt-0.5">
                                    {a.impact >= 0 ? '+' : ''}{formatNumber(a.impact, 2)} pp
                                </div>
                            </div>

                            <div className="w-20 md:w-24 text-right shrink-0">
                                <div className="text-subhead font-bold text-ink tabular-nums">{formatNumber(a.value)} €</div>
                                <div className="text-caption2 font-semibold text-ink-3 tabular-nums">
                                    {totalValue > 0 ? formatNumber((a.value / totalValue) * 100, 1) : 0}%
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </Card>
        </div>
    );
};

/* ================================================================== *
 *  Página
 * ================================================================== */
const SECTIONS = [
    { value: 'performance', labelKey: 'an.tab_perf', icon: Activity },
    { value: 'risk', labelKey: 'an.tab_risk', icon: ShieldAlert },
    { value: 'composition', labelKey: 'an.tab_comp', icon: Layers },
    { value: 'assets', labelKey: 'an.tab_assets', icon: ListOrdered },
];

export const Analysis = ({ portfolios = [], activePortfolioId }) => {
    const { t } = useGlobal();
    const [pid, setPid] = useState('');
    const [period, setPeriod] = useState('1y');
    const [section, setSection] = useState('performance');

    const [items, setItems] = useState([]);
    const [bench, setBench] = useState({ stats: null, relative: null });
    const [benchLoading, setBenchLoading] = useState(false);
    const [xrayPositions, setXrayPositions] = useState([]);
    const [xrayLoading, setXrayLoading] = useState(false);
    const [assets, setAssets] = useState([]);
    const [assetsLoading, setAssetsLoading] = useState(false);

    useEffect(() => {
        if (!pid) {
            if (activePortfolioId) setPid(activePortfolioId);
            else if (portfolios.length) setPid(portfolios[0].id);
        }
    }, [portfolios, activePortfolioId]);

    // Posiciones base: las necesitan todas las secciones.
    useEffect(() => {
        if (!pid) return;
        let off = false;
        (async () => {
            try {
                const r = await api.get(`${import.meta.env.VITE_API_URL}/portfolio/${pid}?t=${Date.now()}`);
                if (!off) setItems((r.data || []).filter(i => i.asset?.ticker));
            } catch { if (!off) setItems([]); }
        })();
        return () => { off = true; };
    }, [pid]);

    const totalValue = useMemo(() => items.reduce((s, i) => s + safeFloat(i.value), 0), [items]);

    // Rendimiento y riesgo comparten la misma llamada.
    const needsBench = section === 'performance' || section === 'risk';
    useEffect(() => {
        if (!pid || !needsBench || !items.length) return;
        let off = false;
        (async () => {
            setBenchLoading(true);
            try {
                const r = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/benchmark`, {
                    holdings: items.map(i => ({ ticker: i.asset.ticker, units: safeFloat(i.units_held) })),
                    benchmarks: [BENCH], period, portfolio_id: pid,
                }, { timeout: 60000 });
                if (!off) setBench({ stats: r.data?.stats || null, relative: r.data?.relative || null });
            } catch { if (!off) setBench({ stats: null, relative: null }); }
            finally { if (!off) setBenchLoading(false); }
        })();
        return () => { off = true; };
    }, [pid, period, needsBench, items]);

    // Composición: look-through.
    useEffect(() => {
        if (!pid || section !== 'composition' || !items.length) return;
        let off = false;
        (async () => {
            setXrayLoading(true);
            try {
                const payload = items
                    .filter(i => safeFloat(i.value) > 0)
                    .map(i => ({
                        ticker: i.asset.ticker, name: i.asset.name || i.asset.ticker,
                        type: i.asset.type || 'Stock', value: safeFloat(i.value), sector: i.asset.sector,
                    }));
                const r = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/xray`, { positions: payload }, { timeout: 60000 });
                if (!off) setXrayPositions(r.data?.positions || []);
            } catch { if (!off) setXrayPositions([]); }
            finally { if (!off) setXrayLoading(false); }
        })();
        return () => { off = true; };
    }, [pid, section, items]);

    const xray = useMemo(() => buildXray(xrayPositions, null), [xrayPositions]);

    // Activos: una serie por posición.
    useEffect(() => {
        if (!pid || section !== 'assets' || !items.length) return;
        let off = false;
        (async () => {
            setAssetsLoading(true);
            try {
                const total = items.reduce((s, i) => s + safeFloat(i.value), 0) || 1;
                const out = await Promise.all(items.map(async (i) => {
                    const r = await api.post(`${import.meta.env.VITE_API_URL}/portfolio/history_chart`, {
                        portfolio_id: pid, period, ticker: i.asset.ticker,
                    }).catch(() => null);
                    const value = safeFloat(i.value);
                    const changePct = safeFloat(r?.data?.change_pct);
                    return {
                        ticker: i.asset.ticker,
                        name: i.asset.name || i.asset.ticker,
                        value,
                        change_pct: changePct,
                        // Aportación de este activo al movimiento total, en puntos
                        // porcentuales de cartera: subir un 40% en algo que pesa el
                        // 1% no es lo mismo que subir un 4% en algo que pesa la mitad.
                        impact: (value / total) * changePct,
                        data: formatSeriesDates(r?.data?.history),
                    };
                }));
                if (!off) setAssets(out);
            } catch { if (!off) setAssets([]); }
            finally { if (!off) setAssetsLoading(false); }
        })();
        return () => { off = true; };
    }, [pid, section, period, items]);

    const portfolioOptions = portfolios.map(p => ({ value: p.id, label: p.name }));

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">
            {/* Cabecera anclada. Se pega al borde superior del scroller y se
                extiende hasta los márgenes para que el contenido pase por
                debajo sin asomar por los lados. Nada de aquí hace scroll
                propio: los cuatro apartados caben, así que se reparten el
                ancho en lugar de desplazarse. */}
            {/* Sólo lo que identifica la vista se queda anclado: cartera y
                apartado. Cada control ocupa su propia fila para que las
                etiquetas quepan enteras — truncar "Composición" a "Comp…" es
                peor que ocupar una línea más. */}
            <div className="sticky -top-2 md:top-0 z-40 -mx-4 px-4 md:-mx-8 md:px-8 pt-2 pb-3 bg-canvas/85 backdrop-blur-xl space-y-2.5">
                <Dropdown className="w-full md:max-w-xs" value={pid} onChange={setPid} options={portfolioOptions} placeholder="—" />
                <Segmented
                    value={section}
                    onChange={setSection}
                    options={SECTIONS.map(s => ({ value: s.value, label: t(s.labelKey) }))}
                />
            </div>

            {/* El periodo va con los datos, no con la navegación: cambia lo que
                se mide, no dónde estás. */}
            <Segmented size="sm" value={period} onChange={setPeriod} options={PERIODS} />

            {!pid ? (
                <Card><EmptyState icon={Inbox} title={t('an.select_portfolio')} /></Card>
            ) : section === 'performance' ? (
                <PerformanceSection stats={bench.stats} relative={bench.relative} loading={benchLoading} />
            ) : section === 'risk' ? (
                <RiskSection stats={bench.stats} relative={bench.relative} loading={benchLoading} />
            ) : section === 'composition' ? (
                <CompositionSection xray={xray} positions={xrayPositions} loading={xrayLoading} />
            ) : (
                <AssetsSection assets={assets} loading={assetsLoading} totalValue={totalValue} />
            )}
        </motion.div>
    );
};
