import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import api from './api'
import _ from 'lodash'
import { Loader2 } from 'lucide-react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'

import { supabase } from './supabaseClient'
import { safeFloat, buildRebalancePlan, roundTo } from './utils'
import { isAdmin, applyDefaultTargets, DEFAULT_CONTRIBUTION_PLAN } from './config/allocation'
import { getPrefs, savePrefs, mesActual, planGuardadoAActivo } from './lib/planStore'
import { guardarTxs, leerTxs, borrarTxs, mesesConAportacion, leerDescarte, guardarDescarte, borrarTodoElCsv } from './lib/csvStore'
import { debeAvisar, mesClave } from './lib/recordatorio'
import { aportadoPorMes, detectarAportaciones } from './lib/trImport'
import { RecordatorioCsv } from './components/RecordatorioCsv'
import { PageSkeleton } from './components/UI'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { MainLayout } from './layouts/MainLayout'

// Cada pantalla viaja en su propio trozo: entrar en la app no debería
// descargar el análisis, la radiografía ni las simulaciones.
const SimulationView = lazy(() => import('./components/SimulationView').then(m => ({ default: m.SimulationView })))
const NewsView = lazy(() => import('./components/NewsView').then(m => ({ default: m.NewsView })))
const Analysis = lazy(() => import('./pages/Analysis').then(m => ({ default: m.Analysis })))
const Performance = lazy(() => import('./pages/Performance').then(m => ({ default: m.Performance })))
const RebalanceHistoryPage = lazy(() => import('./pages/RebalanceHistoryPage').then(m => ({ default: m.RebalanceHistoryPage })))
const Xray = lazy(() => import('./pages/Xray').then(m => ({ default: m.Xray })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
import { Home } from './pages/Home'

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

    // Las preferencias por cartera (plan de aportación e inicio) viven en los
    // metadatos del usuario, no en columnas nuevas: así no hace falta ninguna
    // migración manual en Supabase para que la app funcione.
    const [prefsUser, setPrefsUser] = useState(null)
    const prefsSource = prefsUser || session?.user || null

    const contributionPlan = useMemo(
        () => (activePortfolio ? getPrefs(prefsSource, activePortfolio.id) : null),
        [prefsSource, activePortfolio]
    )

    // Desde cuándo dibujar la cartera. Si no se ha fijado, su fecha de creación.
    const portfolioInception = useMemo(() => {
        if (!activePortfolio) return null
        return contributionPlan?.inception || activePortfolio.created_at || null
    }, [activePortfolio, contributionPlan])

    // Sugerencia con la que se precarga el formulario si la cartera no tiene
    // plan. Es sólo el punto de partida del editor; hasta que no se guarda, no
    // hay plan y el seguimiento mensual no cuenta nada.
    const planDefaults = useMemo(
        () => (isAdmin(session?.user?.email) ? DEFAULT_CONTRIBUTION_PLAN : null),
        [session]
    )

    const saveContributionPlan = useCallback(async (next) => {
        if (!activePortfolio) return
        setPlanSaving(true); setPlanError(null)
        try {
            await savePrefs(activePortfolio.id, {
                monthly: next.monthly,
                annualGrowthPct: next.annualGrowthPct,
                startDate: next.startDate,
                targetDate: next.targetDate,
                frequency: next.frequency,
            })
            const { data: { user } } = await supabase.auth.getUser()
            setPrefsUser(user)
        } catch (e) {
            setPlanError(e?.message || 'No se pudo guardar el plan.')
        } finally {
            setPlanSaving(false)
        }
    }, [activePortfolio])

    const refrescarPrefs = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setPrefsUser(user)
    }, [])

    const guardarPlanConNombre = useCallback(async (nombre, datos) => {
        if (!activePortfolio) return
        // Mismo nombre sustituye, no duplica: renombrar a mano una lista de
        // planes casi iguales es justo lo que se quiere evitar.
        const previos = (contributionPlan?.savedPlans || []).filter(g => g.name !== nombre)
        const nuevo = {
            id: `${Date.now()}`,
            name: nombre,
            monthly: datos.monthly,
            growth: datos.annualGrowthPct,
            start: datos.startDate || null,
            target: datos.targetDate || null,
            freq: datos.frequency || 'monthly',
        }
        try {
            await savePrefs(activePortfolio.id, { savedPlans: [...previos, nuevo] })
            await refrescarPrefs()
        } catch (e) { setPlanError(e?.message || 'No se pudo guardar el plan.') }
    }, [activePortfolio, contributionPlan, refrescarPrefs])

    const borrarPlanGuardado = useCallback(async (id) => {
        if (!activePortfolio) return
        const quedan = (contributionPlan?.savedPlans || []).filter(g => g.id !== id)
        try {
            await savePrefs(activePortfolio.id, { savedPlans: quedan })
            await refrescarPrefs()
        } catch (e) { setPlanError(e?.message || 'No se pudo borrar el plan.') }
    }, [activePortfolio, contributionPlan, refrescarPrefs])

    const cargarPlanGuardado = useCallback((g) => {
        saveContributionPlan(planGuardadoAActivo(g))
    }, [saveContributionPlan])

    const saveInception = useCallback(async (fecha) => {
        if (!activePortfolio) return
        try {
            await savePrefs(activePortfolio.id, { inception: fecha })
            const { data: { user } } = await supabase.auth.getUser()
            setPrefsUser(user)
        } catch (e) { console.error(e) }
    }, [activePortfolio])

    // Movimientos del CSV de Trade Republic. Viven en localStorage, no en el
    // servidor: son datos financieros personales y no hacen falta fuera del móvil.
    const [csvTxs, setCsvTxs] = useState(null)
    const [avisoCerrado, setAvisoCerrado] = useState(false)

    useEffect(() => {
        setAvisoCerrado(false)
        setCsvTxs(activePortfolio ? leerTxs(activePortfolio.id) : null)
    }, [activePortfolio])

    // El aviso sólo aparece cuando la aportación del mes ya está ejecutada y no
    // consta en el CSV guardado. Cerrarlo lo silencia hasta el mes siguiente.
    const aviso = useMemo(() => {
        if (!activePortfolio || avisoCerrado) return { avisar: false, pendientes: [] }
        return debeAvisar({
            mesesConAportacion: mesesConAportacion(csvTxs?.txs || []),
            descartadoHasta: leerDescarte(activePortfolio.id),
        })
    }, [activePortfolio, csvTxs, avisoCerrado])

    // Lo aportado de verdad, según el CSV. Es lo que hace que el plan se marque
    // solo para quien aporta con el plan automático del bróker y nunca pulsa
    // "aplicar rebalanceo" aquí dentro.
    // Fechas ya importadas: lo que permite distinguir aportaciones nuevas de
    // las que ya estaban en el CSV anterior.
    const aportacionesPrevias = useMemo(
        () => (csvTxs?.txs?.length ? detectarAportaciones(csvTxs.txs).map(a => a.fecha) : []),
        [csvTxs]
    )

    const aportadoCsv = useMemo(
        () => (csvTxs?.txs?.length ? aportadoPorMes(csvTxs.txs) : null),
        [csvTxs]
    )

    const cerrarAviso = () => {
        if (activePortfolio) guardarDescarte(activePortfolio.id, mesClave(new Date()))
        setAvisoCerrado(true)
    }

    // Cerrar sesión no debe dejar los movimientos del bróker en el disco.
    const cerrarSesion = useCallback(async () => {
        borrarTodoElCsv()
        setCsvTxs(null)
        await supabase.auth.signOut()
    }, [])

    const olvidarCsv = () => {
        if (!activePortfolio) return
        borrarTxs(activePortfolio.id)
        setCsvTxs(null)
    }

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
    // Importes fijados a mano por activo. Sólo valen para el mes en curso: si
    // se guardaron en julio, en agosto se ignoran y vuelve el reparto normal.
    const pendiente = contributionPlan?.pending
    const overrides = useMemo(
        () => (pendiente?.month === mesActual() ? (pendiente.amounts || {}) : {}),
        [pendiente]
    )

    const setOverride = useCallback(async (itemId, valor) => {
        const base = pendiente?.month === mesActual() ? (pendiente.amounts || {}) : {}
        const next = { ...base }
        if (valor === '' || valor === null || valor === undefined) delete next[itemId]
        else next[itemId] = safeFloat(valor)
        if (!activePortfolio) return
        try {
            await savePrefs(activePortfolio.id, { pending: { month: mesActual(), amounts: next } })
            const { data: { user } } = await supabase.auth.getUser()
            setPrefsUser(user)
        } catch (e) { console.error(e) }
    }, [activePortfolio, pendiente])

    const clearOverrides = useCallback(async () => {
        if (!activePortfolio) return
        try {
            await savePrefs(activePortfolio.id, { pending: null })
            const { data: { user } } = await supabase.auth.getUser()
            setPrefsUser(user)
        } catch (e) { console.error(e) }
    }, [activePortfolio])

    const plan = useMemo(
        () => buildRebalancePlan(portfolioItems, contribution, rebalanceMode, overrides),
        [portfolioItems, contribution, rebalanceMode, overrides]
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

    // Vuelca las unidades leídas del CSV de Trade Republic sobre la cartera.
    // A diferencia de persistItem, aquí los fallos se propagan: el importador
    // sólo puede decir "actualizado" si el backend lo confirmó.
    const aplicarImportacionTR = async (cambios, contexto = {}) => {
        // El CSV se guarda aunque no cambie ninguna unidad: es lo que alimenta
        // el histórico de movimientos y silencia el aviso del mes.
        if (contexto.movimientos && activePortfolio) {
            setCsvTxs(guardarTxs(activePortfolio.id, contexto.movimientos));
            setAvisoCerrado(true);
        }
        if (!cambios?.length) return;
        const porId = new Map(cambios.map(c => [c.id, safeFloat(c.unidades)]));

        const actualizados = portfolioItems.map(i => {
            if (!porId.has(i.id)) return i;
            const u = porId.get(i.id);
            return { ...i, units_held: u, value: roundTo(u * safeFloat(i.current_price), 2) };
        });

        await Promise.all(actualizados
            .filter(i => porId.has(i.id))
            .map(i => api.put(`${import.meta.env.VITE_API_URL}/portfolio/update`, {
                item_id: i.id,
                units_held: safeFloat(i.units_held),
                target_weight: safeFloat(i.target_weight),
            })));

        setPortfolioItems(actualizados);
    };

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
        <>
        <Suspense fallback={<PageSkeleton />}>
        <Routes>
            <Route element={
                <MainLayout
                    session={session}
                    portfolios={portfolios}
                    activePortfolio={activePortfolio}
                    setActivePortfolio={setActivePortfolio}
                    onCreatePortfolio={handleCreatePort}
                    onLogout={cerrarSesion}
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
                        planDefaults={planDefaults}
                        onSavePlan={saveContributionPlan}
                        planSaving={planSaving}
                        planError={planError}
                        inception={portfolioInception}
                        onSaveInception={saveInception}
                        aportadoCsv={aportadoCsv}
                        onGuardarPlanConNombre={guardarPlanConNombre}
                        onBorrarPlanGuardado={borrarPlanGuardado}
                        onCargarPlanGuardado={cargarPlanGuardado}
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
                            onImportarTR={aplicarImportacionTR}
                            aportacionesPrevias={aportacionesPrevias}
                            overrides={overrides}
                            setOverride={setOverride}
                            clearOverrides={clearOverrides}
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
                        planDefaults={planDefaults}
                        onSavePlan={saveContributionPlan}
                        planSaving={planSaving}
                        planError={planError}
                        rebalanceHistory={rebalanceHistory}
                        aportadoCsv={aportadoCsv}
                        onGuardarPlanConNombre={guardarPlanConNombre}
                        onBorrarPlanGuardado={borrarPlanGuardado}
                        onCargarPlanGuardado={cargarPlanGuardado}
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
                        csvTxs={csvTxs?.txs || []}
                        csvImportadoEn={csvTxs?.importadoEn}
                        onBorrarCsv={olvidarCsv}
                    />
                } />
                <Route path="/settings" element={
                    <Settings
                        session={session}
                        onLogout={cerrarSesion}
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
        </Suspense>

        {/* Recordatorio del CSV. Fuera de <Routes> para que aparezca esté donde
            esté el usuario cuando entra tras la ejecución del plan. */}
        <RecordatorioCsv
            abierto={aviso.avisar}
            pendientes={aviso.pendientes}
            portfolioItems={portfolioItems}
            aportacionesPrevias={aportacionesPrevias}
            onAplicar={aplicarImportacionTR}
            onCerrar={cerrarAviso}
        />
        </>
    )
}

export default App