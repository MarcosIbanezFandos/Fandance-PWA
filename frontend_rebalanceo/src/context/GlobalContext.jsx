import React, { createContext, useContext, useState, useEffect } from 'react';

const GlobalContext = createContext();

export const useGlobal = () => useContext(GlobalContext);

export const GlobalProvider = ({ children }) => {
    // Theme State
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'light';
        }
        return 'light';
    });

    // Language State
    const [language, setLanguage] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('language') || 'es';
        return 'es';
    });

    // Apply Theme Side Effect
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Apply Language Side Effect
    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);

    // Simple Translation Helper
    const t = (key) => {
        const translations = {
            es: {
                // Sidebar
                'sidebar.rebalance': 'Rebalanceador',
                'sidebar.performance': 'Rentabilidad',
                'sidebar.xray': 'Radiografía',
                'sidebar.analysis': 'Análisis',
                'sidebar.simulations': 'Simulaciones',
                'sidebar.news': 'Noticias',
                'sidebar.settings': 'Ajustes',
                'header.xray': 'Radiografía de Cartera',
                // X-ray
                'xray.whole': 'Toda la cartera',
                'xray.companies': 'Empresas (look-through)',
                'xray.countries': 'Países / Regiones',
                'xray.currencies': 'Divisas',
                'xray.sectors': 'Sectores',
                'xray.search': 'Busca una empresa (ej. NVIDIA, Toyota)…',
                'xray.no_data': 'Añade activos para radiografiar tu cartera.',
                'xray.holdings': 'Posiciones reales',
                'xray.top_country': 'Mayor país/región',
                'xray.top_sector': 'Mayor sector',
                'xray.exposure': 'Exposición total',
                'xray.direct': 'Directo',
                'xray.no_match': 'Ninguna empresa coincide con la búsqueda.',
                'xray.select_portfolio': 'Selecciona una cartera para radiografiarla.',
                'sidebar.new_portfolio': 'Nueva Cartera',
                'sidebar.my_portfolios': 'Mis Carteras',
                'sidebar.logout': 'Cerrar Sesión',
                'portfolio.rename': 'Renombrar',
                'portfolio.duplicate': 'Duplicar',
                'portfolio.delete': 'Eliminar',
                'header.rebalancer': 'Rebalanceador',
                'header.performance': 'Rentabilidad',
                'header.analysis': 'Análisis de Activos',
                'header.simulations': 'Proyecciones Financieras',
                'header.news': 'Noticias del Mercado',
                'header.settings': 'Ajustes de Cuenta',
                'header.user': 'Usuario',
                // News
                'news.sentiment': 'Sentimiento Global (RSI)',
                'news.score': 'Puntuación global',
                'news.analyzed': 'Noticias analizadas',
                'news.none': 'No hay noticias recientes para tus activos.',
                'news.rsi': 'Indicador RSI',
                'news.read': 'Leer artículo',
                'news.select_portfolio': 'Selecciona una cartera para ver sus noticias.',
                // Simulations
                'sim.select_portfolio': '1. Selecciona cartera',
                'sim.model': '2. Modelo de proyección',
                'sim.params': '3. Parámetros',
                'sim.horizon': 'Horizonte',
                'sim.years': 'Años',
                'sim.monthly': 'Aportación mensual',
                'sim.growing': 'Aportación creciente (IPC)',
                'sim.annual_growth': 'Crecimiento anual (%)',
                'sim.apply_tax': 'Aplicar impuestos (19%)',
                'sim.linear': 'Lineal (7%)',
                'sim.linear_desc': 'Proyección constante estándar.',
                'sim.montecarlo': 'Monte Carlo',
                'sim.montecarlo_desc': 'Simula la volatilidad real del mercado.',
                'sim.conservative': 'Conservador (4%)',
                'sim.conservative_desc': 'Escenario de bajo rendimiento.',
                'sim.empty': 'Configura y simula',
                'sim.profit': 'Beneficio',
                'sim.loss': 'Pérdida',
                'sim.select_alert': 'Selecciona al menos una cartera',
                'sim.error': 'Error al ejecutar la simulación.',
                // Dashboard / KPIs
                'kpi.total_value': 'Valor Total',
                'kpi.current_capital': 'Capital Actual',
                'kpi.risk': 'Perfil de Riesgo',
                'kpi.aggressive': 'Agresivo',
                'kpi.moderate': 'Moderado',
                'kpi.conservative': 'Conservador',
                'kpi.contribution': 'Aportación Mensual',
                'kpi.composition': 'Composición',
                'kpi.no_assets': 'Sin activos',
                'dash.search': 'Buscar (ej. Apple, BTC)...',
                'dash.distribution': 'Distribución',
                'dash.plan_title': 'Plan de Rebalanceo',
                'dash.mode_contribute': 'Solo aportar',
                'dash.mode_full': 'Rebalanceo total',
                'dash.mode_contribute_hint': 'Reparte tu aportación mensual sin vender nada.',
                'dash.mode_full_hint': 'Compra y vende para clavar tus objetivos.',
                'dash.apply_contribute': 'Registrar Aportación',
                'dash.apply_full': 'Aplicar Rebalanceo',
                'dash.target_sum': 'Suma objetivos',
                'dash.balanced': 'equilibrado',
                'dash.fix_settings': 'Ajústalos en Ajustes',
                'dash.empty': 'Añade activos para generar tu plan',
                'dash.history': 'Historial de Operaciones',
                'dash.contribution_short': 'Aportación',
                'dash.to_invest_summary': 'A invertir este mes',
                'dash.unallocated': 'Sin asignar',
                // Table headers
                'th.asset': 'Activo',
                'th.price': 'Precio',
                'th.units': 'Uds',
                'th.value': 'Valor',
                'th.now': 'Actual',
                'th.target': 'Objetivo',
                'th.invest': 'A invertir',
                'th.totals': 'Totales',
                'act.buy': 'Comprar',
                'act.sell': 'Vender',
                'act.hold': 'Mantener',
                // Targets (Settings)
                'targets.title': 'Asignación Objetivo',
                'targets.equal': 'Repartir igual',
                'targets.normalize': 'Ajustar a 100%',
                'targets.sum': 'Suma',
                'targets.balanced': 'Equilibrada (100%)',
                'targets.no_portfolio': 'Selecciona o crea una cartera para fijar sus objetivos.',
                'targets.no_assets': 'Esta cartera aún no tiene activos. Añádelos desde el Rebalanceador.',
                'targets.hint': 'La suma debe ser 100%. También puedes editarlos en la tabla del Rebalanceador.',
                'targets.import': 'Importar posiciones (CSV)',
                // Performance / Rentabilidad
                'perf.title': 'Rentabilidad',
                'perf.since': 'Desde',
                'perf.portfolio_value': 'Valor del portafolio',
                'perf.invested': 'Invertido',
                'perf.cashflow': 'Flujo de caja',
                'perf.gain': 'Ganancia',
                'perf.tir': 'TIR (anual)',
                'perf.tir_hint': 'Tasa interna de retorno, ponderada por dinero y tiempo.',
                'perf.simple_return': 'Rentabilidad total',
                'perf.net_total': 'Total neto',
                'perf.fees': 'Comisiones',
                'perf.taxes': 'Impuestos',
                'perf.evolution': 'Evolución del valor',
                'perf.no_data': 'Aún no hay aportaciones registradas. Registra tu primera aportación en el Rebalanceador para calcular tu rentabilidad.',
                'perf.net_hint': 'Introduce comisiones e impuestos para obtener tu total neto (opcional).',
                'perf.select_portfolio': 'Selecciona una cartera para ver su rentabilidad.',
                // CSV import
                'csv.title': 'Sincronizar posiciones',
                'csv.hint': 'Pega un CSV (símbolo/ISIN/nombre, unidades) de Trade Republic o Parqet para actualizar tus unidades. Como Fandance usa precios de mercado en vivo, si las unidades coinciden el valor será idéntico al de tu bróker.',
                'csv.placeholder': 'AAPL, 3.5\nVWCE, 12\n...',
                'csv.apply': 'Actualizar unidades',
                'csv.matched': 'actualizados',
                'csv.unmatched': 'sin coincidencia',
                // Analysis
                'analysis.title': 'Análisis de Activos',
                'analysis.loading': 'Cargando datos...',
                'analysis.no_data': 'No hay datos disponibles.',
                // Settings
                'settings.appearance': 'Apariencia',
                'settings.theme': 'Tema Visual',
                'settings.dark': 'Oscuro',
                'settings.light': 'Claro',
                'settings.language': 'Idioma',
                'settings.account': 'Cuenta',
                'settings.logout': 'Cerrar Sesión',
                'settings.about': 'Información',
                // Simulations
                'sim.title': 'Proyecciones',
                'sim.calculate': 'Calcular Proyección',
                'sim.investment': 'Inversión Total',
                'sim.gross': 'Valor Bruto',
                'sim.net': 'Neto tras Impuestos'
            },
            en: {
                // Sidebar
                'sidebar.rebalance': 'Rebalancer',
                'sidebar.performance': 'Performance',
                'sidebar.xray': 'X-Ray',
                'sidebar.analysis': 'Analysis',
                'sidebar.simulations': 'Simulations',
                'sidebar.news': 'News',
                'sidebar.settings': 'Settings',
                'header.xray': 'Portfolio X-Ray',
                // X-ray
                'xray.whole': 'Whole portfolio',
                'xray.companies': 'Companies (look-through)',
                'xray.countries': 'Countries / Regions',
                'xray.currencies': 'Currencies',
                'xray.sectors': 'Sectors',
                'xray.search': 'Find a company (e.g. NVIDIA, Toyota)…',
                'xray.no_data': 'Add assets to X-ray your portfolio.',
                'xray.holdings': 'Real holdings',
                'xray.top_country': 'Top country/region',
                'xray.top_sector': 'Top sector',
                'xray.exposure': 'Total exposure',
                'xray.direct': 'Direct',
                'xray.no_match': 'No company matches your search.',
                'xray.select_portfolio': 'Select a portfolio to X-ray it.',
                'sidebar.new_portfolio': 'New Portfolio',
                'sidebar.my_portfolios': 'My Portfolios',
                'sidebar.logout': 'Log Out',
                'portfolio.rename': 'Rename',
                'portfolio.duplicate': 'Duplicate',
                'portfolio.delete': 'Delete',
                'header.rebalancer': 'Rebalancer',
                'header.performance': 'Performance',
                'header.analysis': 'Asset Analysis',
                'header.simulations': 'Financial Projections',
                'header.news': 'Market News',
                'header.settings': 'Account Settings',
                'header.user': 'User',
                // News
                'news.sentiment': 'Global Portfolio Sentiment (RSI)',
                'news.score': 'Global Score',
                'news.analyzed': 'Analyzed News',
                'news.none': 'No recent news for your assets.',
                'news.rsi': 'RSI Indicator',
                'news.read': 'Read Article',
                'news.select_portfolio': 'Select a portfolio to see its news.',
                // Simulations
                'sim.select_portfolio': '1. Select portfolio',
                'sim.model': '2. Projection Model',
                'sim.params': '3. Parameters',
                'sim.horizon': 'Horizon',
                'sim.years': 'Years',
                'sim.monthly': 'Monthly Contribution',
                'sim.growing': 'Growing Contribution (CPI)',
                'sim.annual_growth': 'Annual Growth (%)',
                'sim.apply_tax': 'Apply Tax (19%)',
                'sim.linear': 'Linear (7%)',
                'sim.linear_desc': 'Standard constant projection.',
                'sim.montecarlo': 'Monte Carlo',
                'sim.montecarlo_desc': 'Simulates real market volatility.',
                'sim.conservative': 'Conservative (4%)',
                'sim.conservative_desc': 'Low performance scenario.',
                'sim.empty': 'Configure and simulate',
                'sim.profit': 'Profit',
                'sim.loss': 'Loss',
                'sim.select_alert': 'Select at least one portfolio',
                'sim.error': 'Error running simulation.',
                // Dashboard / KPIs
                'kpi.total_value': 'Total Value',
                'kpi.current_capital': 'Current Capital',
                'kpi.risk': 'Risk Profile',
                'kpi.aggressive': 'Aggressive',
                'kpi.moderate': 'Moderate',
                'kpi.conservative': 'Conservative',
                'kpi.contribution': 'Monthly Contribution',
                'kpi.composition': 'Composition',
                'kpi.no_assets': 'No assets',
                'dash.search': 'Search (e.g. Apple, BTC)...',
                'dash.distribution': 'Distribution',
                'dash.plan_title': 'Rebalancing Plan',
                'dash.mode_contribute': 'Contribute only',
                'dash.mode_full': 'Full rebalance',
                'dash.mode_contribute_hint': 'Spread your monthly money, no selling.',
                'dash.mode_full_hint': 'Buy & sell to hit your targets exactly.',
                'dash.apply_contribute': 'Log Contribution',
                'dash.apply_full': 'Apply Rebalance',
                'dash.target_sum': 'Target sum',
                'dash.balanced': 'balanced',
                'dash.fix_settings': 'Set them in Settings',
                'dash.empty': 'Add assets to build your plan',
                'dash.history': 'Operations History',
                'dash.contribution_short': 'Contribution',
                'dash.to_invest_summary': 'To invest this month',
                'dash.unallocated': 'Unallocated',
                // Table headers
                'th.asset': 'Asset',
                'th.price': 'Price',
                'th.units': 'Units',
                'th.value': 'Value',
                'th.now': 'Now',
                'th.target': 'Target',
                'th.invest': 'To invest',
                'th.totals': 'Totals',
                'act.buy': 'Buy',
                'act.sell': 'Sell',
                'act.hold': 'Hold',
                // Targets (Settings)
                'targets.title': 'Target Allocation',
                'targets.equal': 'Equal split',
                'targets.normalize': 'Scale to 100%',
                'targets.sum': 'Sum',
                'targets.balanced': 'Balanced (100%)',
                'targets.no_portfolio': 'Select or create a portfolio to set its targets.',
                'targets.no_assets': 'This portfolio has no assets yet. Add them from the Rebalancer.',
                'targets.hint': 'The sum should be 100%. You can also edit them in the Rebalancer table.',
                'targets.import': 'Import holdings (CSV)',
                // Performance
                'perf.title': 'Performance',
                'perf.since': 'Since',
                'perf.portfolio_value': 'Portfolio value',
                'perf.invested': 'Invested',
                'perf.cashflow': 'Cash flow',
                'perf.gain': 'Gain',
                'perf.tir': 'IRR (annual)',
                'perf.tir_hint': 'Internal rate of return, weighted by money and time.',
                'perf.simple_return': 'Total return',
                'perf.net_total': 'Net total',
                'perf.fees': 'Fees',
                'perf.taxes': 'Taxes',
                'perf.evolution': 'Value evolution',
                'perf.no_data': 'No contributions logged yet. Log your first contribution in the Rebalancer to compute performance.',
                'perf.net_hint': 'Enter fees and taxes to get your net total (optional).',
                'perf.select_portfolio': 'Select a portfolio to see its performance.',
                // CSV import
                'csv.title': 'Sync holdings',
                'csv.hint': 'Paste a CSV (symbol/ISIN/name, units) from Trade Republic or Parqet to update your units. Since Fandance uses live market prices, when units match the value is identical to your broker.',
                'csv.placeholder': 'AAPL, 3.5\nVWCE, 12\n...',
                'csv.apply': 'Update units',
                'csv.matched': 'updated',
                'csv.unmatched': 'no match',
                // Analysis
                'analysis.title': 'Asset Analysis',
                'analysis.loading': 'Loading data...',
                'analysis.no_data': 'No data available.',
                // Settings
                'settings.appearance': 'Appearance',
                'settings.theme': 'Visual Theme',
                'settings.dark': 'Dark',
                'settings.light': 'Light',
                'settings.language': 'Language',
                'settings.account': 'Account',
                'settings.logout': 'Log Out',
                'settings.about': 'About',
                // Simulations
                'sim.title': 'Projections',
                'sim.calculate': 'Run Projection',
                'sim.investment': 'Total Invested',
                'sim.gross': 'Gross Value',
                'sim.net': 'Net after Tax'
            }
        };
        return translations[language][key] || key;
    };

    return (
        <GlobalContext.Provider value={{ theme, setTheme, language, setLanguage, t }}>
            {children}
        </GlobalContext.Provider>
    );
};
