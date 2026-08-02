import React, { useState, useEffect, useMemo, useCallback } from 'react'
import api from './api'
import _ from 'lodash'
import { Loader2 } from 'lucide-react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'

import { supabase } from './supabaseClient'
import { safeFloat, buildRebalancePlan, roundTo } from './utils'
import { isAdmin, applyDefaultTargets } from './config/allocation'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { SimulationView } from './components/SimulationView'
import { NewsView } from './components/NewsView'
import { MainLayout } from './layouts/MainLayout'
import { Analysis } from './pages/Analysis'
import { Home } from './pages/Home'
import { Performance } from './pages/Performance'
import { RebalanceHistoryPage } from './pages/RebalanceHistoryPage'
import { Xray } from './pages/Xray'
import { Settings } from './pages/Settings'

const TYPE_COLORS = {
    'Stock': ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#1d4ed8'],
    'ETF': ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857'],
    'Crypto': ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9'],
    'Bond': ['#f59e0b', '#fbbf24', '#fcd34d', '#d97706', '#b45309'],
    'Other': ['#64748b', '#94a3b8', '#cbd5e1', '#475569', '#334155']
};

function App() {
    const [session, setSession] = useState(null)
    const [appLoading, setAppLoading] = useState(true)
    const [portfolios, setPortfolios] = useState([])
    const [activePortfolio, setActivePortfolio] = useState(null)
    const navigate = useNavigate();

    // Dashboard Data
    const [portfolioItems, setPortfolioItems] = useState([])
    const [contribution, setContribution] = useState(1000)
    // 'contribute' = only buy with the monthly money, 'full' = also sell to hit targets
    const [rebalanceMode, setRebalanceMode] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('rebalanceMode') || 'contribute';
        return 'contribute';
    })
    useEffect(() => { localStorage.setItem('rebalanceMode', rebalanceMode) }, [rebalanceMode])

    const [rebalanceHistory, setRebalanceHistory] = useState([])

    // --- Plan de aportación ---
    // Vive en la cartera activa (columnas plan_*). El cumplimiento mensual NO se
    // guarda: se deduce de rebalanceHistory, que ya sabe lo aportado de verdad.
    const [planSaving, setPlanSaving] = useState(false)
    const [planError, setPlanError] = useState(null)

    const contributionPlan = useMemo(() => {
        if (!activePortfolio) return null
        return {
            monthly: safeFloat(activePortfolio.plan_monthly),
            annualGrowthPct: safeFloat(activePortfolio.plan_growth_pct),
            startDate: activePortfolio.plan_start || null,
        }
    }, [activePortfolio])

    const saveContributionPlan = useCallback(async (next) => {
        if (!activePortfolio) return
        setPlanSaving(true); setPlanError(null)
        const patch = {
            plan_monthly: next.monthly,
            plan_growth_pct: next.annualGrowthPct,
            plan_start: next.startDate,
        }
        try {
            await api.put(`${import.meta.env.VITE_API_URL}/portfolios/contribution_plan`, {
                portfolio_id: activePortfolio.id,
                monthly: next.monthly,
                annual_growth_pct: next.annualGrowthPct,
                start_date: next.startDate,
            })
            setActivePortfolio(p => (p ? { ...p, ...patch } : p))
            setPortfolios(list => list.map(p => (p.id === activePortfolio.id ? { ...p, ...patch } : p)))
        } catch (e) {
            setPlanError(
                e?.response?.status === 501
                    ? 'Falta ejecutar supabase/contribution_plan.sql en tu base de datos.'
                    : 'No se pudo guardar el plan.'
            )
        } finally {
            setPlanSaving(false)
        }
    }, [activePortfolio])

    // UI State
    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [calculating, setCalculating] = useState(false)


    // --- INITIAL LOAD ---
    useEffect(() => {
        const init = async () => {
            setAppLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            if (session) await loadPortfolios(session.user.id, session.user.email);
            setAppLoading(false);
        };
        init();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
            setSession(s);
            if (!s) { setPortfolios([]); setActivePortfolio(null); }
            else if (s && portfolios.length === 0) loadPortfolios(s.user.id, s.user.email);
        });
        return () => subscription.unsubscribe();
    }, [])

    const seedingRef = React.useRef(false);
    const loadPortfolios = async (uid, email) => {
        try {
            let res = await api.get(`${import.meta.env.VITE_API_URL}/portfolios/list`, { timeout: 30000 });

            // First-time NON-admin user with nothing yet → seed 3 starter portfolios.
            if ((res.data || []).length === 0 && email && !isAdmin(email) && !seedingRef.current) {
                seedingRef.current = true;
                try {
                    await api.post(`${import.meta.env.VITE_API_URL}/portfolios/seed_defaults`, {}, { timeout: 90000 });
                    res = await api.get(`${import.meta.env.VITE_API_URL}/portfolios/list`, { timeout: 30000 });
                } catch (e) { /* seeding is best-effort */ }
            }

            setPortfolios(res.data);
            const lastId = localStorage.getItem('lastActiveId');
            const found = res.data.find(p => p.id === lastId);
            if (found) setActivePortfolio(found);
            else if (res.data.length > 0) setActivePortfolio(res.data[0]);
        } catch (e) { console.error(e) }
    }

    useEffect(() => {
        if (activePortfolio) {
            localStorage.setItem('lastActiveId', activePortfolio.id);
            setContribution(activePortfolio.last_contribution || 1000);
            loadItems(activePortfolio.id);
            loadRebalanceHistory(activePortfolio.id);
        }
    }, [activePortfolio])

    const loadItems = async (pid) => {
        try {
            const res = await api.get(`${import.meta.env.VITE_API_URL}/portfolio/${pid}?t=${Date.now()}`);
            setPortfolioItems(res.data || []);
        } catch (e) { setPortfolioItems([]) }
    }


    const loadRebalanceHistory = async (pid) => {
        try {
            const res = await api.get(`${import.meta.env.VITE_API_URL}/portfolio/history/${pid}?t=${Date.now()}`);
            setRebalanceHistory(res.data || []);
        } catch (e) { setRebalanceHistory([]) }
    }

    // --- LOGIC: REBALANCE PLAN ---
    const plan = useMemo(
        () => buildRebalancePlan(portfolioItems, contribution, rebalanceMode),
        [portfolioItems, contribution, rebalanceMode]
    );
    const tableData = useMemo(
        () => _.orderBy(plan.rows, [r => safeFloat(r.value)], ['desc']),
        [plan]
    );

    // --- ACTIONS ---
    const handleUpdate = (id, field, val) => {
        const num = safeFloat(val);
        const newItems = portfolioItems.map(i => {
            if (i.id === id) {
                const copy = { ...i };
                const price = copy.current_price || 0;

                // Keep the field the user is editing as the raw string so they can
                // type freely (clear it, type a decimal point, etc).
                copy[field] = val;

                // Recompute the paired field as a rounded NUMBER (never a string,
                // so downstream .toFixed()/formatting never crashes).
                if (field === 'units_held') {
                    copy.value = roundTo(num * price, 2);
                } else if (field === 'value') {
                    copy.units_held = price > 0 ? roundTo(num / price, 6) : 0;
                }

                return copy;
            }
            return i;
        });
        setPortfolioItems(newItems);
        const updatedItem = newItems.find(x => x.id === id);
        // Persist using the parsed floats only.
        debouncedSave(id, safeFloat(updatedItem.units_held), safeFloat(updatedItem.target_weight));
    }

    // Persist a single item immediately (used by the target-allocation helpers).
    const persistItem = (item) => {
        api.put(`${import.meta.env.VITE_API_URL}/portfolio/update`, {
            item_id: item.id,
            units_held: safeFloat(item.units_held),
            target_weight: safeFloat(item.target_weight)
        }).catch(() => {});
    }

    // Set every asset to the same target weight (adds up to 100%).
    const setEqualTargets = () => {
        if (!portfolioItems.length) return;
        const n = portfolioItems.length;
        const base = Math.floor((100 / n) * 100) / 100;
        const newItems = portfolioItems.map((i, idx) => ({
            ...i,
            // give the rounding remainder to the first asset so the sum is exactly 100
            target_weight: idx === 0 ? roundTo(100 - base * (n - 1), 2) : base
        }));
        setPortfolioItems(newItems);
        newItems.forEach(persistItem);
    }

    // Scale the current targets so they add up to exactly 100%.
    const normalizeTargets = () => {
        const sum = portfolioItems.reduce((s, i) => s + safeFloat(i.target_weight), 0);
        if (sum <= 0) return;
        const newItems = portfolioItems.map(i => ({
            ...i,
            target_weight: roundTo((safeFloat(i.target_weight) / sum) * 100, 2)
        }));
        setPortfolioItems(newItems);
        newItems.forEach(persistItem);
    }

    // Load the owner's default Indexa/Vanguard allocation onto the active portfolio.
    const applyAdminDefaults = () => {
        const newItems = applyDefaultTargets(portfolioItems);
        setPortfolioItems(newItems);
        newItems.forEach(persistItem);
    }

    // Auto-seed the owner's default targets on a fresh portfolio (all targets 0).
    const seededPortfolios = React.useRef(new Set());
    useEffect(() => {
        if (!session || !isAdmin(session.user?.email)) return;
        if (!activePortfolio || !portfolioItems.length) return;
        const pid = activePortfolio.id;
        if (seededPortfolios.current.has(pid)) return;
        const allZero = portfolioItems.every(i => safeFloat(i.target_weight) === 0);
        if (allZero) {
            seededPortfolios.current.add(pid);
            applyAdminDefaults();
        }
    }, [portfolioItems, activePortfolio, session]);

    const debouncedSave = useCallback(_.debounce((id, u, t) => {
        api.put(`${import.meta.env.VITE_API_URL}/portfolio/update`, { item_id: id, units_held: u, target_weight: t });
    }, 500), []);

    const saveContribution = useCallback(_.debounce((pid, amount) => {
        api.put(`${import.meta.env.VITE_API_URL}/portfolios/update_contribution?portfolio_id=${pid}&amount=${amount}`)
    }, 500), []);

    useEffect(() => { if (activePortfolio && contribution) saveContribution(activePortfolio.id, contribution) }, [contribution]);

    const searchAsset = async (q) => {
        setIsSearching(true);
        try { const res = await api.get(`${import.meta.env.VITE_API_URL}/assets/search?q=${q}`); setSearchResults(res.data); }
        catch (e) { } finally { setIsSearching(false); }
    }

    const addAsset = async (asset) => {
        if (!activePortfolio) return;
        await api.post(`${import.meta.env.VITE_API_URL}/portfolio/add`, { portfolio_id: activePortfolio.id, ticker: asset.ticker, name: asset.name });
        loadItems(activePortfolio.id); setQuery(''); setSearchResults([]);
    }

    const deleteItem = async (id) => {
        if (!confirm("Delete this asset?")) return;
        await api.delete(`${import.meta.env.VITE_API_URL}/portfolio/delete/${id}`);
        loadItems(activePortfolio.id);
    }

    const applyRebalance = async () => {
        const msg = rebalanceMode === 'contribute'
            ? `Apply this month's contribution of ${safeFloat(contribution).toLocaleString('es-ES')} €? Units will be updated (buys only).`
            : "Apply full rebalance? Units will be bought and sold to match your targets.";
        if (!confirm(msg)) return;
        setCalculating(true);

        // Only send real orders (skip HOLD rows with a ~0 trade).
        const payloadOrders = tableData
            .filter(o => Math.abs(o.unitsToTrade || 0) > 1e-6)
            .map(o => ({
                id: o.id,
                asset_name: o.asset.name,
                ticker: o.asset.ticker,
                action: o.action,
                units_to_trade: o.unitsToTrade,
                diff_val: o.allocation,
                price: o.current_price
            }));

        try {
            await api.post(`${import.meta.env.VITE_API_URL}/portfolio/apply_rebalance`, {
                portfolio_id: activePortfolio.id, contribution: parseFloat(contribution), orders: payloadOrders
            });
            alert("Applied ✅");
            setTimeout(() => { loadItems(activePortfolio.id); loadRebalanceHistory(activePortfolio.id); setCalculating(false); }, 1000);
        } catch (e) { alert("Error applying rebalance"); setCalculating(false); }
    }

    const undoRebalance = async (histId) => {
        if (!confirm("Undo this operation?")) return;
        try {
            await api.post(`${import.meta.env.VITE_API_URL}/portfolio/history/undo`, { history_id: histId });
            alert("Undone ✅");
            setTimeout(() => { loadItems(activePortfolio.id); loadRebalanceHistory(activePortfolio.id); }, 500);
        } catch (e) { alert("Error undoing operation"); }
    }

    const deleteHistoryItem = async (histId) => {
        if (!confirm("Delete this record?")) return;
        await api.delete(`${import.meta.env.VITE_API_URL}/portfolio/history/delete/${histId}`);
        loadRebalanceHistory(activePortfolio.id);
    }

    const handleCreatePort = async () => { const n = prompt("Portfolio name:"); if (n) { await api.post(`${import.meta.env.VITE_API_URL}/portfolios/create`, { name: n }); loadPortfolios(session.user.id); } }
    const handleRenamePort = async (pid) => { const n = prompt("New name:"); if (n) { await api.put(`${import.meta.env.VITE_API_URL}/portfolios/rename`, { portfolio_id: pid, name: n }); loadPortfolios(session.user.id); } }
    const handleDuplicatePort = async (pid, name) => { await api.post(`${import.meta.env.VITE_API_URL}/portfolios/duplicate`, { portfolio_id: pid, new_name: name + " (Copy)" }); loadPortfolios(session.user.id); }
    const handleDeletePort = async (pid) => { if (confirm("Delete entire portfolio?")) { await api.delete(`${import.meta.env.VITE_API_URL}/portfolios/delete/${pid}`); loadPortfolios(session.user.id); setActivePortfolio(null); } }

    if (appLoading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-semibold uppercase tracking-tight"><Loader2 className="animate-spin mr-3 text-brand" /> Loading Fandance...</div>
    if (!session) return <AuthScreen onLogin={setSession} />

    const totalVal = portfolioItems.reduce((s, i) => s + safeFloat(i.value), 0);
    const totalWeight = portfolioItems.reduce((s, i) => s + safeFloat(i.target_weight), 0);

    let riskScore = 0;
    if (totalWeight > 0) {
        const weightedRisk = portfolioItems.reduce((s, i) => {
            let r = 10;
            const t = (i.asset.type || '').toLowerCase(); const n = (i.asset.name || '').toLowerCase();
            if (n.includes('gold') || n.includes('oro') || n.includes('silver') || t.includes('commodity')) r = 4;
            else if (n.includes('bond') || n.includes('treasury') || n.includes('renta fija')) r = 2;
            return s + (r * safeFloat(i.target_weight));
        }, 0);
        riskScore = Math.round(weightedRisk / totalWeight);
    }

    const chartData = _(portfolioItems).groupBy(i => i.asset.type || 'Stock')
        .map((g, type) => g.map((i, idx) => ({
            name: i.asset.name, value: safeFloat(i.value), fill: (TYPE_COLORS[type] || TYPE_COLORS['Other'])[idx % 5]
        }))).flatten().value().filter(x => x.value > 0);

    return (
        <Routes>
            <Route element={
                <MainLayout
                    session={session}
                    portfolios={portfolios}
                    activePortfolio={activePortfolio}
                    setActivePortfolio={setActivePortfolio}
                    onCreatePortfolio={handleCreatePort}
                    onLogout={() => supabase.auth.signOut()}
                    onRename={handleRenamePort}
                    onDuplicate={handleDuplicatePort}
                    onDelete={handleDeletePort}
                />
            }>
                <Route path="/" element={
                    <Home
                        portfolios={portfolios}
                        activePortfolio={activePortfolio}
                        portfolioItems={tableData}
                        totalValue={totalVal}
                        rebalanceHistory={rebalanceHistory}
                        plan={contributionPlan}
                        onSavePlan={saveContributionPlan}
                        planSaving={planSaving}
                        planError={planError}
                    />
                } />
                <Route path="/posiciones" element={
                    activePortfolio ? (
                        <Dashboard
                            portfolioItems={tableData}
                            planTotals={plan.totals}
                            rebalanceMode={rebalanceMode}
                            setRebalanceMode={setRebalanceMode}
                            totalValue={totalVal}
                            riskProfile={riskScore}
                            contribution={contribution}
                            setContribution={setContribution}
                            rebalanceHistory={rebalanceHistory}
                            searchResults={searchResults}
                            isSearching={isSearching}
                            query={query}
                            setQuery={setQuery}
                            handleUpdate={handleUpdate}
                            deleteItem={deleteItem}
                            applyRebalance={applyRebalance}
                            calculating={calculating}
                            addAsset={addAsset}
                            searchAsset={searchAsset}
                            undoRebalance={undoRebalance}
                            deleteHistoryItem={deleteHistoryItem}
                            chartData={chartData}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-96 text-ink-3 font-bold bg-surface rounded-card border border-line shadow-card">
                            {portfolios.length === 0 ? "Create a portfolio to get started" : "Select a portfolio"}
                        </div>
                    )
                } />

                {/* Rutas antiguas: se conservan redirigidas para no romper enlaces
                    guardados ni la pantalla de inicio de la PWA instalada. */}
                <Route path="/dashboard" element={<Navigate to="/posiciones" replace />} />
                <Route path="/analysis" element={<Navigate to="/analisis" replace />} />
                <Route path="/simulations" element={<Navigate to="/simulacion" replace />} />
                <Route path="/performance" element={<Navigate to="/rendimiento" replace />} />
                <Route path="/news" element={<Navigate to="/noticias" replace />} />

                <Route path="/analisis" element={<Analysis portfolios={portfolios} activePortfolioId={activePortfolio?.id} />} />
                <Route path="/simulacion" element={
                    <SimulationView
                        portfolios={portfolios}
                        activePortfolioId={activePortfolio?.id}
                        plan={contributionPlan}
                        onSavePlan={saveContributionPlan}
                        planSaving={planSaving}
                        planError={planError}
                        rebalanceHistory={rebalanceHistory}
                    />
                } />
                <Route path="/rendimiento" element={<Performance portfolios={portfolios} activePortfolioId={activePortfolio?.id} />} />
                <Route path="/xray" element={<Xray portfolios={portfolios} activePortfolioId={activePortfolio?.id} />} />
                <Route path="/noticias" element={<NewsView portfolios={portfolios} activePortfolioId={activePortfolio?.id} />} />
                <Route path="/historial" element={
                    <RebalanceHistoryPage
                        history={rebalanceHistory}
                        onUndo={undoRebalance}
                        onDelete={deleteHistoryItem}
                    />
                } />
                <Route path="/settings" element={
                    <Settings
                        session={session}
                        onLogout={() => supabase.auth.signOut()}
                        activePortfolio={activePortfolio}
                        portfolioItems={portfolioItems}
                        handleUpdate={handleUpdate}
                        onEqualSplit={setEqualTargets}
                        onNormalize={normalizeTargets}
                        onApplyDefaults={applyAdminDefaults}
                        isAdmin={isAdmin(session.user?.email)}
                    />
                } />
            </Route>
        </Routes>
    )
}

export default App