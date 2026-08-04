import React from 'react';
import { GlassCard, BounceButton, Disclosure } from '../components/UI';
import { Moon, Sun, Globe, Shield, LogOut, Target, Scale, Sparkles, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { Dropdown } from '../components/Dropdown';
import { safeFloat, formatNumber } from '../utils';



const TargetAllocationCard = ({ activePortfolio, portfolioItems, handleUpdate, onEqualSplit, onNormalize, onApplyDefaults, isAdmin, t }) => {
    const items = portfolioItems || [];
    const sum = items.reduce((s, i) => s + safeFloat(i.target_weight), 0);
    const balanced = Math.abs(sum - 100) <= 1; // 99.5 (Indexa) counts as balanced

    return (
        <GlassCard>
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <h3 className="text-footnote font-semibold text-ink-3 flex items-center gap-2"><Target size={14} /> {t('targets.title')}</h3>
                {activePortfolio && items.length > 0 && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-control text-caption1 font-semibold ${balanced ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
                        {balanced ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        {t('targets.sum')}: {formatNumber(sum, 1)}%
                    </div>
                )}
            </div>

            {!activePortfolio ? (
                <div className="p-6 bg-surface-2 rounded-card text-subhead font-bold text-ink-3 text-center">{t('targets.no_portfolio')}</div>
            ) : items.length === 0 ? (
                <div className="p-6 bg-surface-2 rounded-card text-subhead font-bold text-ink-3 text-center">{t('targets.no_assets')}</div>
            ) : (
                <>
                    <div className="text-caption1 font-bold text-indigo-400 mb-3">{activePortfolio.name}</div>
                    <div className="space-y-2">
                        {items.map((i) => {
                            const w = safeFloat(i.target_weight);
                            return (
                                <div key={i.id} className="flex items-center gap-3 p-3 bg-surface-2 rounded-card border border-line">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-footnote text-ink truncate">{i.asset?.name || i.asset?.ticker}</div>
                                        <div className="text-caption2 font-bold text-indigo-400">{i.asset?.ticker}</div>
                                    </div>
                                    {/* mini bar */}
                                    <div className="hidden sm:block w-24 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, w)}%` }} />
                                    </div>
                                    <div className="relative">
                                        <input
                                            inputMode="decimal"
                                            className="w-20 bg-surface border border-line-strong rounded-field p-2 pr-6 text-center text-footnote font-bold focus:ring-2 ring-brand outline-none transition-all text-ink"
                                            value={i.target_weight}
                                            onChange={(e) => handleUpdate(i.id, 'target_weight', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-caption2 text-ink-3 font-bold">%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-5">
                        <BounceButton onClick={onEqualSplit} className="px-4 py-2.5 bg-surface-2 text-ink-2 rounded-control font-bold text-caption1 uppercase tracking-wide flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <Scale size={14} /> {t('targets.equal')}
                        </BounceButton>
                        <BounceButton onClick={onNormalize} className="px-4 py-2.5 bg-surface-2 text-ink-2 rounded-control font-bold text-caption1 uppercase tracking-wide flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <Target size={14} /> {t('targets.normalize')}
                        </BounceButton>
                        {isAdmin && (
                            <BounceButton onClick={onApplyDefaults} className="px-4 py-2.5 bg-indigo-600 text-white rounded-control font-bold text-caption1 uppercase tracking-wide flex items-center gap-2 hover:bg-indigo-500 shadow-card">
                                <Sparkles size={14} /> Indexa
                            </BounceButton>
                        )}
                    </div>
                    <p className="text-caption1 font-medium text-ink-3 mt-3">{t('targets.hint')}</p>
                </>
            )}
        </GlassCard>
    );
};

export const Settings = ({ session, onLogout, activePortfolio, portfolioItems, handleUpdate, onEqualSplit, onNormalize, onApplyDefaults, isAdmin }) => {
    const { theme, setTheme, language, setLanguage, t } = useGlobal();

    return (
        <div className="max-w-3xl space-y-6">
            <TargetAllocationCard
                activePortfolio={activePortfolio}
                portfolioItems={portfolioItems}
                handleUpdate={handleUpdate}
                onEqualSplit={onEqualSplit}
                onNormalize={onNormalize}
                onApplyDefaults={onApplyDefaults}
                isAdmin={isAdmin}
                t={t}
            />

            <GlassCard>
                <h3 className="text-footnote font-semibold text-ink-3 mb-6">{t('settings.appearance')}</h3>
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-card border border-line transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-surface rounded-control shadow-card text-ink">
                            {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                        </div>
                        <div>
                            <div className="font-bold text-ink text-subhead">{t('settings.theme')}</div>
                            <div className="text-caption2 text-ink-3 font-bold uppercase">{theme === 'dark' ? t('settings.dark') : t('settings.light')}</div>
                        </div>
                    </div>
                    <div className="flex bg-surface p-1 rounded-control border border-line-strong">
                        <button
                            onClick={() => setTheme('light')}
                            className={`p-2 rounded-field transition-all ${theme === 'light' ? 'bg-brand-soft text-brand shadow-card' : 'text-ink-3 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        >
                            <Sun size={16} />
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={`p-2 rounded-field transition-all ${theme === 'dark' ? 'bg-indigo-900 text-indigo-400 shadow-card' : 'text-ink-3 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        >
                            <Moon size={16} />
                        </button>
                    </div>
                </div>
            </GlassCard>

            <GlassCard>
                <h3 className="text-footnote font-semibold text-ink-3 mb-6">{t('settings.language')}</h3>
                <div className="flex items-center justify-between p-4 bg-surface-2 rounded-card border border-line mb-4 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-surface rounded-control shadow-card text-ink"><Globe size={20} /></div>
                        <div>
                            <div className="font-bold text-ink text-subhead">{t('settings.language')}</div>
                            <div className="text-caption2 text-ink-3 font-bold uppercase">{language === 'es' ? 'Español (ES)' : 'English (EN)'}</div>
                        </div>
                    </div>
                    <Dropdown
                        className="w-40"
                        align="right"
                        value={language}
                        onChange={setLanguage}
                        options={[{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }]}
                    />
                </div>
            </GlassCard>

            <GlassCard>
                <h3 className="text-footnote font-semibold text-ink-3 mb-6">{t('settings.account')}</h3>
                <div className="p-4 bg-surface-2 rounded-card border border-line mb-6 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 bg-surface rounded-control shadow-card text-ink"><Shield size={20} /></div>
                        <div>
                            <div className="font-bold text-ink text-subhead">Current Session</div>
                            <div className="text-caption2 text-ink-3 font-bold uppercase">{session?.user?.email}</div>
                        </div>
                    </div>
                    <BounceButton onClick={onLogout} className="w-full py-3 bg-surface border border-line-strong text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-200 rounded-control font-bold text-footnote uppercase flex items-center justify-center gap-2 transition-colors">
                        <LogOut size={16} /> {t('settings.logout')}
                    </BounceButton>
                </div>
            </GlassCard>

            <GlassCard>
                <h3 className="text-footnote font-semibold text-ink-3 mb-6">{t('settings.about')}</h3>
                {/* Se usa Disclosure y tokens del sistema: este bloque llevaba
                    colores indigo fijos, ilegibles sobre el fondo oscuro, y el
                    texto en inglés en una app que está en castellano. */}
                <div className="space-y-2">
                    <p className="text-subhead text-ink-2 leading-relaxed">{t('about.what')}</p>

                    <Disclosure icon={HelpCircle} title={t('about.q_rebalance')}>
                        {t('about.a_rebalance')}
                    </Disclosure>

                    <Disclosure icon={Shield} title={t('about.q_data')}>
                        {t('about.a_data')}
                    </Disclosure>

                    <p className="text-caption2 text-ink-3 uppercase tracking-wide text-right pt-2">
                        {t('about.version')} 1.2.1
                    </p>
                </div>
            </GlassCard>
        </div>
    );
};
