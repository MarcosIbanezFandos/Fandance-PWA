import React from 'react';
import { GlassCard, BounceButton } from '../components/UI';
import { Moon, Sun, Globe, Shield, LogOut } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';

export const Settings = ({ session, onLogout }) => {
    const { theme, setTheme, language, setLanguage, t } = useGlobal();

    return (
        <div className="max-w-3xl space-y-6">
            <GlassCard>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{t('settings.appearance')}</h3>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-slate-700 dark:text-slate-200">
                            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                        </div>
                        <div>
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{t('settings.theme')}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{theme === 'dark' ? t('settings.dark') : t('settings.light')}</div>
                        </div>
                    </div>
                    <div className="flex bg-white dark:bg-slate-700 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
                        <button
                            onClick={() => setTheme('light')}
                            className={`p-2 rounded-lg transition-all ${theme === 'light' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        >
                            <Sun size={16} />
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-indigo-900 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        >
                            <Moon size={16} />
                        </button>
                    </div>
                </div>
            </GlassCard>

            <GlassCard>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{t('settings.appearance')}</h3>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 mb-4 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-slate-700 dark:text-slate-200"><Globe size={20} /></div>
                        <div>
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{t('settings.language')}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{language === 'es' ? 'Español (ES)' : 'English (EN)'}</div>
                        </div>
                    </div>
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg py-2 px-4 text-xs font-bold outline-none focus:border-indigo-500 dark:text-slate-200 transition-colors"
                    >
                        <option value="es">Español</option>
                        <option value="en">English</option>
                    </select>
                </div>
            </GlassCard>

            <GlassCard>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{t('settings.account')}</h3>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm text-slate-700 dark:text-slate-200"><Shield size={20} /></div>
                        <div>
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">Sesión Actual</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{session?.user?.email}</div>
                        </div>
                    </div>
                    <BounceButton onClick={onLogout} className="w-full py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-200 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition-colors">
                        <LogOut size={16} /> {t('settings.logout')}
                    </BounceButton>
                </div>
            </GlassCard>

            <GlassCard>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{t('settings.about')}</h3>
                <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 mb-6">
                    <h4 className="text-lg font-black text-indigo-900 mb-2">Sobre Fandance</h4>
                    <p className="text-sm text-indigo-700/80 mb-4 leading-relaxed font-medium">
                        Fandance es una herramienta profesional de rebalanceo de carteras diseñada para inversores particulares.
                        Nuestra misión es simplificar la gestión de activos y optimizar tu patrimonio con datos precisos y una experiencia de usuario superior.
                    </p>
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Preguntas Frecuentes</div>
                        <details className="group">
                            <summary className="cursor-pointer text-sm font-bold text-indigo-800 list-none flex items-center justify-between">
                                ¿Cómo se calculan los rebalanceos?
                                <span className="text-indigo-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <p className="text-xs text-indigo-700/70 mt-2 pl-2 border-l-2 border-indigo-200">
                                Utilizamos un algoritmo que compara tu asignación actual con la objetivo (Target %), sugiriendo compras/ventas para minimizar la desviación y optimizar fiscalmente si es posible.
                            </p>
                        </details>
                        <details className="group mt-2">
                            <summary className="cursor-pointer text-sm font-bold text-indigo-800 list-none flex items-center justify-between">
                                ¿Mis datos están seguros?
                                <span className="text-indigo-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <p className="text-xs text-indigo-700/70 mt-2 pl-2 border-l-2 border-indigo-200">
                                Sí. Toda la información se almacena de forma segura en Supabase con autenticación robusta. No compartimos tus datos con terceros.
                            </p>
                        </details>
                        <div className="mt-4 text-[10px] text-indigo-300 font-bold uppercase text-right">Versión 2.0.0 (SaaS Release)</div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
