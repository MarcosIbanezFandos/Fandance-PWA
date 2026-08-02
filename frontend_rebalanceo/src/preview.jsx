/**
 * Banco de pruebas (sólo desarrollo).
 * Renderiza las pantallas nuevas con datos sintéticos para revisarlas sin
 * backend ni sesión. No entra en el build de producción.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { MotionGlobalConfig } from 'framer-motion';

// El panel de vista previa corre en segundo plano, donde requestAnimationFrame
// no dispara y framer-motion se queda congelado a mitad de la entrada. Con
// ?static las animaciones se saltan y lo que se ve es el estado final.
if (new URLSearchParams(location.search).has('static')) {
    MotionGlobalConfig.skipAnimations = true;
}
import './index.css';
import { GlobalProvider } from './context/GlobalContext';
import { Card, Button, Segmented } from './components/UI';
import { Home } from './pages/Home';
import { Analysis } from './pages/Analysis';
import { Dashboard } from './components/Dashboard';
import { ContributionPlan } from './components/ContributionPlan';
import { BottomNav } from './components/BottomNav';
import { buildXray, computeOverlap, computeConcentration, computeDrift, buildPlanStatus, formatNumber } from './utils';
import { Sun, Moon } from 'lucide-react';

/* ---- Datos sintéticos ---- */
const mkFund = (ticker, name, value, syms) => ({
    ticker, name, type: 'ETF', value,
    holdings: syms.map((s, i) => ({ symbol: s, name: `${s} Corp`, weight: 0.07 - i * 0.005, country: i % 2 ? 'Japan' : 'United States' })),
    countries: { 'United States': 0.62, Japan: 0.08, Other: 0.3 },
    sectors: { technology: 0.31, financial_services: 0.14, unknown: 0.55 },
    region: 'Global (diversified)', currency: 'USD', countries_estimated: true,
});

const XRAY_POSITIONS = [
    mkFund('CSPX.L', 'iShares Core S&P 500', 42000, ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'AVGO', 'GOOGL', 'TSLA', 'BRK.B', 'JPM']),
    mkFund('IWDA.L', 'iShares Core MSCI World', 28000, ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'TSM', 'NVO', 'ASML', 'V', 'JNJ']),
    mkFund('AGG', 'iShares US Aggregate Bond', 9000, ['UST10', 'UST5', 'FNMA', 'GNMA', 'UST30', 'FHLMC', 'UST2', 'TIPS', 'CORP1', 'CORP2']),
];

// Posiciones con desviación: una dentro de banda y otra claramente fuera.
const ITEMS = [
    { id: '1', asset: { ticker: 'CSPX.L', name: 'iShares Core S&P 500' }, value: 42000, currentWeight: 53.2, targetWeight: 45 },
    { id: '2', asset: { ticker: 'IWDA.L', name: 'iShares Core MSCI World' }, value: 28000, currentWeight: 35.4, targetWeight: 40 },
    { id: '3', asset: { ticker: 'AGG', name: 'US Aggregate Bond' }, value: 9000, currentWeight: 11.4, targetWeight: 15 },
];

// Historial: se aportó en los últimos meses menos en uno, para ver el hueco.
const now = new Date();
const HISTORY = [0, 1, 2, 4, 5].map(back => ({
    id: `h${back}`,
    created_at: new Date(now.getFullYear(), now.getMonth() - back, 12).toISOString(),
    contribution: back === 2 ? 120 : 300,
}));

const PLAN = { monthly: 300, annualGrowthPct: 5, startDate: new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().slice(0, 10) };

function Preview() {
    const [dark, setDark] = useState(false);
    const [view, setView] = useState('home');
    const [plan, setPlan] = useState(PLAN);

    React.useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

    const xray = buildXray(XRAY_POSITIONS, null);
    const overlaps = computeOverlap(XRAY_POSITIONS);
    const conc = computeConcentration(xray.companies);
    const drift = computeDrift(ITEMS);
    const status = buildPlanStatus({ plan, history: HISTORY, months: 12 });

    return (
        <div className="h-full app-scroll bg-canvas text-ink p-4 md:p-8 pb-24 space-y-6">
            <header className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">Banco de pruebas</h1>
                <div className="flex gap-2">
                    <Segmented value={view} onChange={setView} size="sm" options={[
                        { value: 'home', label: 'Inicio' },
                        { value: 'pos', label: 'Posic.' },
                        { value: 'analisis', label: 'Análisis' },
                        { value: 'calc', label: 'Cálculos' },
                    ]} />
                    <Button variant="secondary" size="sm" icon={dark ? Sun : Moon} onClick={() => setDark(d => !d)} />
                </div>
            </header>

            {view === 'pos' ? (
                <Dashboard
                    portfolioItems={ITEMS.map(i => ({ ...i, units_held: 12.5, target_weight: i.targetWeight, current_price: 512.34, allocation: i.targetWeight > i.currentWeight ? 420 : -380, action: i.targetWeight > i.currentWeight ? 'BUY' : 'SELL' }))}
                    planTotals={{ targetSum: 100, investTotal: 800, unallocated: 0 }}
                    rebalanceMode="contribute" setRebalanceMode={() => { }}
                    totalValue={79000} riskProfile={7}
                    contribution={800} setContribution={() => { }}
                    rebalanceHistory={HISTORY} searchResults={[]} isSearching={false}
                    query="" setQuery={() => { }} handleUpdate={() => { }} deleteItem={() => { }}
                    applyRebalance={() => { }} calculating={false} addAsset={() => { }}
                    searchAsset={() => { }} undoRebalance={() => { }} deleteHistoryItem={() => { }}
                    chartData={[]}
                />
            ) : view === 'analisis' ? (
                <Analysis portfolios={[{ id: 'p1', name: 'Cartera principal' }]} activePortfolioId="p1" />
            ) : view === 'home' ? (
                <Home
                    portfolios={[{ id: 'p1', name: 'Cartera principal' }]}
                    activePortfolio={{ id: 'p1', name: 'Cartera principal' }}
                    portfolioItems={ITEMS}
                    totalValue={79000}
                    rebalanceHistory={HISTORY}
                    plan={plan}
                    onSavePlan={setPlan}
                />
            ) : (
                <div className="space-y-5">
                    <Card>
                        <h2 className="label-caps mb-3">Desviación (computeDrift)</h2>
                        <p className="text-sm text-ink-2 mb-2">
                            Total: <b className="tabular-nums">{formatNumber(drift.totalDrift, 2)} pp</b> ·
                            Máx: <b className="tabular-nums">{formatNumber(drift.maxDrift, 2)} pp</b> ({drift.worst?.ticker})
                        </p>
                        <ul className="text-sm space-y-1 tabular-nums">
                            {drift.rows.map(r => (
                                <li key={r.id}>{r.ticker}: real {formatNumber(r.current, 1)}% · obj {formatNumber(r.target, 1)}% · {r.drift > 0 ? '+' : ''}{formatNumber(r.drift, 1)} pp</li>
                            ))}
                        </ul>
                    </Card>

                    <Card>
                        <h2 className="label-caps mb-3">Solapamiento (computeOverlap)</h2>
                        <ul className="text-sm space-y-1 tabular-nums">
                            {overlaps.map(o => (
                                <li key={o.key}>{o.a.ticker} × {o.b.ticker}: <b>{formatNumber(o.pct, 1)}%</b> ({o.sharedCount} comunes: {o.shared.slice(0, 4).join(', ')})</li>
                            ))}
                        </ul>
                    </Card>

                    <Card>
                        <h2 className="label-caps mb-3">Concentración (computeConcentration)</h2>
                        <p className="text-sm tabular-nums">
                            Top1 {formatNumber(conc.top1, 1)}% · Top5 {formatNumber(conc.top5, 1)}% · Top10 {formatNumber(conc.top10, 1)}% ·
                            posiciones efectivas <b>{formatNumber(conc.effectiveHoldings, 1)}</b> de {conc.count}
                        </p>
                    </Card>

                    <Card>
                        <h2 className="label-caps mb-3">Plan (buildPlanStatus)</h2>
                        <p className="text-sm mb-2 tabular-nums">
                            Racha {status.streak} · cumplidos {status.doneCount}/{status.pastCount} · aportado {formatNumber(status.contributedTotal)} € de {formatNumber(status.plannedTotal)} €
                        </p>
                        <ul className="text-sm space-y-1 tabular-nums">
                            {status.rows.map(r => (
                                <li key={r.key}>
                                    {r.key}: plan {formatNumber(r.planned)} € · aportado {formatNumber(r.contributed)} € →{' '}
                                    <b className={r.done ? 'text-positive' : r.partial ? 'text-warning' : 'text-ink-3'}>
                                        {r.done ? 'cumplido' : r.partial ? 'parcial' : 'pendiente'}
                                    </b>
                                </li>
                            ))}
                        </ul>
                    </Card>

                    <ContributionPlan plan={plan} onSave={setPlan} history={HISTORY} />
                </div>
            )}

            <BottomNav
                onLogout={() => { }}
                portfolios={[{ id: 'p1', name: 'Cartera principal' }]}
                activePortfolio={{ id: 'p1', name: 'Cartera principal' }}
                setActivePortfolio={() => { }}
            />
        </div>
    );
}

createRoot(document.getElementById('root')).render(
    <MemoryRouter><GlobalProvider><Preview /></GlobalProvider></MemoryRouter>
);
