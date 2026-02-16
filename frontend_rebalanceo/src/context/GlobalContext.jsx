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
                'sidebar.analysis': 'Análisis',
                'sidebar.simulations': 'Simulaciones',
                'sidebar.settings': 'Ajustes',
                // Dashboard
                'dashboard.total_value': 'Valor Total',
                'dashboard.contribution': 'Aportación',
                'dashboard.risk': 'Riesgo',
                'dashboard.search': 'Buscar Activo...',
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
                'sidebar.analysis': 'Analysis',
                'sidebar.simulations': 'Simulations',
                'sidebar.settings': 'Settings',
                // Dashboard
                'dashboard.total_value': 'Total Value',
                'dashboard.contribution': 'Contribution',
                'dashboard.risk': 'Risk',
                'dashboard.search': 'Search Asset...',
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
