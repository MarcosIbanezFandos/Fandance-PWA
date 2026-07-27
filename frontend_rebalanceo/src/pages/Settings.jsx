import React from 'react';
import { GlassCard, BounceButton } from '../components/UI';
import { Moon, Sun, Globe, Shield, LogOut, Target, Scale, Sparkles, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { safeFloat, formatNumber } from '../utils';

// Parse a loose CSV: each line is "<symbol/ISIN/name> , <units>" (extra columns ok).
const parseHoldingsCsv = (text) => {
    const out = [];
    (text || '').split(/\r?\n/).forEach((line) => {
        const parts = line.split(/[,;\t]+/).map((s) => s.trim()).filter((s) => s !== '');
        if (parts.length < 2) return;
        const isNum = (p) => /^-?\d[\d.,\s]*$/.test(p);
        let units = null;
        const keyParts = [];
        parts.forEach((p) => { if (units === null && isNum(p) && keyParts.length) units = safeFloat(p); else if (isNum(p) && keyParts.length && units === null) units = safeFloat(p); else keyParts.push(p); });
        // Fallback: last column numeric = units.
        if (units === null && isNum(parts[parts.length - 1])) { units = safeFloat(parts[parts.length - 1]); keyParts.length = 0; keyParts.push(...parts.slice(0, -1)); }
        const key = keyParts.join(' ').trim();
        if (key && units !== null && isFinite(units)) out.push({ key, units });
    });
    return out;
};

const SyncHoldingsCard = ({ portfolioItems, handleUpdate, t }) => {
    const [text, setText] = React.useState('');
    const [result, setResult] = React.useState(null);
    const items = portfolioItems || [];

    const apply = () => {
        const parsed = parseHoldingsCsv(text);
        let matched = 0;
        const unmatched = [];
        parsed.forEach(({ key, units }) => {
            const k = key.toLowerCase();
            const item = items.find((i) => {
                const tk = (i.asset?.ticker || '').toLowerCase();
                const nm = (i.asset?.name || '').toLowerCase();
                const kBase = k.replace(/\.[a-z]+$/, ''); // strip .DE / .MC suffixes
                return tk === k || tk === kBase || tk.replace(/\.[a-z]+$/, '') === kBase ||
                    (nm && (nm.includes(k) || k.includes(nm))) ||
                    (nm && k && nm.split(' ')[0] === k.split(' ')[0]);
            });
            if (item) { handleUpdate(item.id, 'units_held', String(units)); matched++; }
            else unmatched.push(key);
        });
        setResult({ matched, unmatched });
    };

    return (
        <GlassCard>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><RefreshCw size={14} /> {t('csv.title')}</h3>
            <p className="text-[11px] font-medium text-slate-400 mb-3 leading-relaxed">{t('csv.hint')}</p>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('csv.placeholder')}
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none focus:ring-2 ring-indigo-500 resize-y"
            />
            <div className="flex items-center gap-3 mt-3 flex-wrap">
                <BounceButton onClick={apply} disabled={!text.trim() || items.length === 0} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wide flex items-center gap-2 hover:bg-indigo-500 shadow-md shadow-indigo-500/20">
                    <RefreshCw size={14} /> {t('csv.apply')}
                </BounceButton>
                {result && (
                    <div className="text-[11px] font-bold">
                        <span className="text-emerald-500">{result.matched} {t('csv.matched')}</span>
                        {result.unmatched.length > 0 && <span className="text-amber-500"> · {result.unmatched.length} {t('csv.unmatched')}: {result.unmatched.slice(0, 5).join(', ')}</span>}
                    </div>
                )}
            </div>
        </GlassCard>
    );
};

const TargetAllocationCard = ({ activePortfolio, portfolioItems, handleUpdate, onEqualSplit, onNormalize, onApplyDefaults, isAdmin, t }) => {
    const items = portfolioItems || [];
    const sum = items.reduce((s, i) => s + safeFloat(i.target_weight), 0);
    const balanced = Math.abs(sum - 100) <= 1; // 99.5 (Indexa) counts as balanced

    return (
        <GlassCard>
            <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Target size={14} /> {t('targets.title')}</h3>
                {activePortfolio && items.length > 0 && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black ${balanced ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'}`}>
                        {balanced ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        {t('targets.sum')}: {formatNumber(sum, 1)}%
                    </div>
                )}
            </div>

            {!activePortfolio ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-400 text-center">{t('targets.no_portfolio')}</div>
            ) : items.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-400 text-center">{t('targets.no_assets')}</div>
            ) : (
                <>
                    <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mb-3">{activePortfolio.name}</div>
                    <div className="space-y-2">
                        {items.map((i) => {
                            const w = safeFloat(i.target_weight);
                            return (
                                <div key={i.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate">{i.asset?.name || i.asset?.ticker}</div>
                                        <div className="text-[10px] font-bold text-indigo-400">{i.asset?.ticker}</div>
                                    </div>
                                    {/* mini bar */}
                                    <div className="hidden sm:block w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, w)}%` }} />
                                    </div>
                                    <div className="relative">
                                        <input
                                            inputMode="decimal"
                                            className="w-20 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-2 pr-6 text-center text-xs font-bold focus:ring-2 ring-indigo-500 outline-none transition-all dark:text-slate-100"
                                            value={i.target_weight}
                                            onChange={(e) => handleUpdate(i.id, 'target_weight', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-5">
                        <BounceButton onClick={onEqualSplit} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[11px] uppercase tracking-wide flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <Scale size={14} /> {t('targets.equal')}
                        </BounceButton>
                        <BounceButton onClick={onNormalize} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[11px] uppercase tracking-wide flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700">
                            <Target size={14} /> {t('targets.normalize')}
                        </BounceButton>
                        {isAdmin && (
                            <BounceButton onClick={onApplyDefaults} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wide flex items-center gap-2 hover:bg-indigo-500 shadow-md shadow-indigo-500/20">
                                <Sparkles size={14} /> Indexa
                            </BounceButton>
                        )}
                    </div>
                    <p className="text-[11px] font-medium text-slate-400 mt-3">{t('targets.hint')}</p>
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

            {activePortfolio && (portfolioItems || []).length > 0 && (
                <SyncHoldingsCard portfolioItems={portfolioItems} handleUpdate={handleUpdate} t={t} />
            )}

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
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{t('settings.language')}</h3>
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
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">Current Session</div>
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
                    <h4 className="text-lg font-black text-indigo-900 mb-2">About Fandance</h4>
                    <p className="text-sm text-indigo-700/80 mb-4 leading-relaxed font-medium">
                        Fandance is a professional portfolio rebalancing tool designed for individual investors.
                        Our mission is to simplify asset management and optimize your wealth with accurate data and a superior user experience.
                    </p>
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Frequently Asked Questions</div>
                        <details className="group">
                            <summary className="cursor-pointer text-sm font-bold text-indigo-800 list-none flex items-center justify-between">
                                How are rebalances calculated?
                                <span className="text-indigo-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <p className="text-xs text-indigo-700/70 mt-2 pl-2 border-l-2 border-indigo-200">
                                In "Contribute only" mode we spread your monthly money across the assets that are furthest below their Target %, so you drift back toward your plan without ever selling. "Full rebalance" mode also sells to land exactly on target. This follows the passive index-fund rebalancing approach used by robo-advisors like Indexa Capital.
                            </p>
                        </details>
                        <details className="group mt-2">
                            <summary className="cursor-pointer text-sm font-bold text-indigo-800 list-none flex items-center justify-between">
                                Is my data safe?
                                <span className="text-indigo-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <p className="text-xs text-indigo-700/70 mt-2 pl-2 border-l-2 border-indigo-200">
                                Yes. All information is securely stored in Supabase with robust authentication. We do not share your data with third parties.
                            </p>
                        </details>
                        <div className="mt-4 text-[10px] text-indigo-300 font-bold uppercase text-right">Version 2.0.0 (SaaS Release)</div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
