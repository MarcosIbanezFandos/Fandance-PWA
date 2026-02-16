import React, { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import _ from 'lodash'
import { Loader2 } from 'lucide-react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'

// --- IMPORTACIONES ---
import { supabase } from './supabaseClient'
import { safeFloat } from './utils'
import { AuthScreen } from './components/AuthScreen'
import { Dashboard } from './components/Dashboard'
import { SimulationView } from './components/SimulationView'
import { MainLayout } from './layouts/MainLayout'
import { Analysis } from './pages/Analysis'
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

    const [rebalanceHistory, setRebalanceHistory] = useState([])

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
            if (session) await loadPortfolios(session.user.id);
            setAppLoading(false);
        };
        init();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
            setSession(s);
            if (!s) { setPortfolios([]); setActivePortfolio(null); }
            else if (s && portfolios.length === 0) loadPortfolios(s.user.id);
        });
        return () => subscription.unsubscribe();
    }, [])

    const loadPortfolios = async (uid) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/portfolios/list?user_id=${uid}`);
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
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/portfolio/${pid}`);
            setPortfolioItems(res.data || []);
        } catch (e) { setPortfolioItems([]) }
    }


    const loadRebalanceHistory = async (pid) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/portfolio/history/${pid}`);
            setRebalanceHistory(res.data || []);
        } catch (e) { setRebalanceHistory([]) }
    }

    // --- LOGIC: REBALANCE TABLE DATA ---
    const tableData = useMemo(() => {
        const currentTotal = (portfolioItems || []).reduce((sum, i) => sum + safeFloat(i.value), 0);
        const futureTotal = currentTotal + safeFloat(contribution);

        const calculated = (portfolioItems || []).map(item => {
            const price = item.current_price || 0;
            const targetVal = futureTotal * (safeFloat(item.target_weight) / 100);
            const diff = targetVal - safeFloat(item.value);
            const unitsToTrade = price > 0 ? diff / price : 0;

            return {
                ...item,
                action: diff > 0 ? 'BUY' : 'SELL',
                diffVal: diff,
                unitsToTrade: unitsToTrade
            };
        });

        return _.orderBy(calculated, ['value'], ['desc']);
    }, [portfolioItems, contribution]);

    // --- ACTIONS ---
    const handleUpdate = (id, field, val) => {
        const num = safeFloat(val);
        const newItems = portfolioItems.map(i => {
            if (i.id === id) {
                const copy = { ...i };
                const price = copy.current_price || 0;
                if (field === 'units_held') {
                    copy.units_held = num;
                    copy.value = num * price;
                } else if (field === 'value') {
                    copy.value = num;
                    copy.units_held = price > 0 ? num / price : 0;
                } else if (field === 'target_weight') {
                    copy.target_weight = num;
                }
                return copy;
            }
            return i;
        });
        setPortfolioItems(newItems);
        const updatedItem = newItems.find(x => x.id === id);
        debouncedSave(id, updatedItem.units_held, updatedItem.target_weight);
    }

    const debouncedSave = useCallback(_.debounce((id, u, t) => {
        axios.put(`${import.meta.env.VITE_API_URL}/portfolio/update`, { item_id: id, units_held: u, target_weight: t });
    }, 500), []);

    const saveContribution = useCallback(_.debounce((pid, amount) => {
        axios.put(`${import.meta.env.VITE_API_URL}/portfolios/update_contribution?portfolio_id=${pid}&amount=${amount}`)
    }, 500), []);

    useEffect(() => { if (activePortfolio && contribution) saveContribution(activePortfolio.id, contribution) }, [contribution]);

    const searchAsset = async (q) => {
        setIsSearching(true);
        try { const res = await axios.get(`${import.meta.env.VITE_API_URL}/assets/search?q=${q}`); setSearchResults(res.data); }
        catch (e) { } finally { setIsSearching(false); }
    }

    const addAsset = async (asset) => {
        if (!activePortfolio) return;
        await axios.post(`${import.meta.env.VITE_API_URL}/portfolio/add`, { portfolio_id: activePortfolio.id, ticker: asset.ticker, name: asset.name });
        loadItems(activePortfolio.id); setQuery(''); setSearchResults([]);
    }

    const deleteItem = async (id) => {
        if (!confirm("¿Eliminar activo?")) return;
        await axios.delete(`${import.meta.env.VITE_API_URL}/portfolio/delete/${id}`);
        loadItems(activePortfolio.id);
    }

    const applyRebalance = async () => {
        if (!confirm("¿Aplicar rebalanceo? Se actualizarán las unidades.")) return;
        setCalculating(true);

        const payloadOrders = tableData.map(o => ({
            id: o.id,
            asset_name: o.asset.name,
            ticker: o.asset.ticker,
            action: o.action,
            units_to_trade: o.unitsToTrade,
            diff_val: o.diffVal,
            price: o.current_price
        }));

        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/portfolio/apply_rebalance`, {
                portfolio_id: activePortfolio.id, contribution: parseFloat(contribution), orders: payloadOrders
            });
            alert("Aplicado ✅");
            setTimeout(() => { loadItems(activePortfolio.id); loadRebalanceHistory(activePortfolio.id); setCalculating(false); }, 1000);
        } catch (e) { alert("Error"); setCalculating(false); }
    }

    const undoRebalance = async (histId) => {
        if (!confirm("¿Deshacer operación?")) return;
        try {
            await axios.post(`${import.meta.env.VITE_API_URL}/portfolio/history/undo`, { history_id: histId });
            alert("Deshecho ✅");
            setTimeout(() => { loadItems(activePortfolio.id); loadRebalanceHistory(activePortfolio.id); }, 500);
        } catch (e) { alert("Error al deshacer"); }
    }

    const deleteHistoryItem = async (histId) => {
        if (!confirm("¿Borrar registro?")) return;
        await axios.delete(`${import.meta.env.VITE_API_URL}/portfolio/history/delete/${histId}`);
        loadRebalanceHistory(activePortfolio.id);
    }

    const handleCreatePort = async () => { const n = prompt("Nombre:"); if (n) { await axios.post(`${import.meta.env.VITE_API_URL}/portfolios/create`, { user_id: session.user.id, name: n }); loadPortfolios(session.user.id); } }
    const handleRenamePort = async (pid) => { const n = prompt("Nuevo nombre:"); if (n) { await axios.put(`${import.meta.env.VITE_API_URL}/portfolios/rename`, { portfolio_id: pid, name: n }); loadPortfolios(session.user.id); } }
    const handleDuplicatePort = async (pid, name) => { await axios.post(`${import.meta.env.VITE_API_URL}/portfolios/duplicate`, { portfolio_id: pid, user_id: session.user.id, new_name: name + " (Copia)" }); loadPortfolios(session.user.id); }
    const handleDeletePort = async (pid) => { if (confirm("¿Borrar cartera entera?")) { await axios.delete(`${import.meta.env.VITE_API_URL}/portfolios/delete/${pid}`); loadPortfolios(session.user.id); setActivePortfolio(null); } }

    if (appLoading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-black uppercase tracking-tighter"><Loader2 className="animate-spin mr-3 text-indigo-500" /> Cargando Fandance...</div>
    if (!session) return <AuthScreen onLogin={setSession} />

    const totalVal = portfolioItems.reduce((s, i) => s + (i.value || 0), 0);
    const totalWeight = portfolioItems.reduce((s, i) => s + (i.target_weight || 0), 0);

    let riskScore = 0;
    if (totalWeight > 0) {
        const weightedRisk = portfolioItems.reduce((s, i) => {
            let r = 10;
            const t = (i.asset.type || '').toLowerCase(); const n = (i.asset.name || '').toLowerCase();
            if (n.includes('gold') || n.includes('oro') || n.includes('silver') || t.includes('commodity')) r = 4;
            else if (n.includes('bond') || n.includes('treasury') || n.includes('renta fija')) r = 2;
            return s + (r * (i.target_weight || 0));
        }, 0);
        riskScore = Math.round(weightedRisk / totalWeight);
    }

    const chartData = _(portfolioItems).groupBy(i => i.asset.type || 'Stock')
        .map((g, type) => g.map((i, idx) => ({
            name: i.asset.name, value: i.value, fill: (TYPE_COLORS[type] || TYPE_COLORS['Other'])[idx % 5]
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
                    activePortfolio ? (
                        <Dashboard
                            portfolioItems={tableData}
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
                        <div className="flex items-center justify-center h-96 text-slate-400 font-bold bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                            {portfolios.length === 0 ? "Crea una cartera para empezar" : "Selecciona una cartera"}
                        </div>
                    )
                } />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />
                <Route path="/analysis" element={<Analysis portfolios={portfolios} />} />
                <Route path="/simulations" element={<SimulationView portfolios={portfolios} />} />
                <Route path="/settings" element={<Settings session={session} onLogout={() => supabase.auth.signOut()} />} />
            </Route>
        </Routes>
    )
}

export default App