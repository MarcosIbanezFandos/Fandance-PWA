import React, { useState, useEffect, useMemo } from 'react';
import { Receipt, Upload, Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import { GlassCard, BounceButton } from './UI';
import { useGlobal } from '../context/GlobalContext';
import { safeFloat, formatNumber } from '../utils';

// Parse "ticker, date, units, price" rows into per-ticker aggregates.
const parsePurchases = (text) => {
    const map = {};
    (text || '').split(/\r?\n/).forEach((line) => {
        const parts = line.split(/[,;\t]+/).map(s => s.trim()).filter(Boolean);
        if (parts.length < 3) return;
        const ticker = parts[0].toUpperCase();
        if (/^(ticker|symbol|s[ií]mbolo)$/i.test(ticker)) return; // header
        // date = first token that looks like a date; the two numbers = units, price
        const dateTok = parts.find(p => /\d{4}-\d{1,2}-\d{1,2}/.test(p) || /\d{1,2}[/.]\d{1,2}[/.]\d{2,4}/.test(p));
        const nums = parts.slice(1).filter(p => p !== dateTok && /^-?\d[\d.,]*$/.test(p)).map(safeFloat);
        const units = nums[0]; const price = nums[1];
        if (!units || price === undefined) return;
        const cur = map[ticker] || { sumCost: 0, units: 0, firstDate: null };
        cur.sumCost += units * price;
        cur.units += units;
        if (dateTok) {
            const d = new Date(dateTok.replace(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/, '$3-$2-$1'));
            if (!isNaN(d) && (!cur.firstDate || d < new Date(cur.firstDate))) cur.firstDate = d.toISOString().slice(0, 10);
        }
        map[ticker] = cur;
    });
    const out = {};
    Object.entries(map).forEach(([tk, v]) => {
        out[tk] = { avgCost: v.units > 0 ? v.sumCost / v.units : 0, unitsBought: v.units, firstDate: v.firstDate };
    });
    return out;
};

const norm = (s) => (s || '').toUpperCase().replace(/\.[A-Z]+$/, '').replace('-EUR', '').replace('-USD', '');

export const CostBasis = ({ items, pid }) => {
    const { t } = useGlobal();
    const [text, setText] = useState('');
    const [cost, setCost] = useState({});

    useEffect(() => {
        if (!pid) return;
        try { setCost(JSON.parse(localStorage.getItem(`costbasis_${pid}`) || '{}')); }
        catch { setCost({}); }
    }, [pid]);

    const apply = () => {
        const parsed = parsePurchases(text);
        const merged = { ...cost, ...parsed };
        setCost(merged);
        localStorage.setItem(`costbasis_${pid}`, JSON.stringify(merged));
    };

    const onFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => setText(String(reader.result || ''));
        reader.readAsText(f);
    };

    const rows = useMemo(() => {
        const costByKey = {};
        Object.entries(cost).forEach(([tk, v]) => { costByKey[norm(tk)] = v; });
        const out = [];
        (items || []).forEach((i) => {
            const tk = i.asset?.ticker;
            const c = costByKey[norm(tk)];
            if (!c || !c.avgCost) return;
            const held = safeFloat(i.units_held);
            const price = safeFloat(i.current_price);
            const invested = c.avgCost * held;
            const value = held * price;
            const profit = value - invested;
            out.push({
                ticker: tk, name: i.asset?.name || tk, avgCost: c.avgCost,
                invested, value, profit, pct: invested > 0 ? (profit / invested) * 100 : 0,
                since: c.firstDate,
            });
        });
        return out.sort((a, b) => b.value - a.value);
    }, [cost, items]);

    const totals = useMemo(() => {
        const invested = rows.reduce((s, r) => s + r.invested, 0);
        const value = rows.reduce((s, r) => s + r.value, 0);
        return { invested, value, profit: value - invested, pct: invested > 0 ? ((value - invested) / invested) * 100 : 0 };
    }, [rows]);

    return (
        <GlassCard>
            <div className="flex items-center gap-2 mb-2">
                <Receipt size={15} className="text-slate-400" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('cost.title')}</h3>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mb-3 leading-relaxed">{t('cost.hint')}</p>

            <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t('cost.placeholder')} rows={3}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none focus:ring-2 ring-indigo-500 resize-y" />
            <div className="flex items-center gap-3 mt-3 flex-wrap">
                <BounceButton onClick={apply} disabled={!text.trim()} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wide flex items-center gap-2 hover:bg-indigo-500 shadow-md shadow-indigo-500/20">
                    <Calculator size={14} /> {t('cost.apply')}
                </BounceButton>
                <label className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[11px] uppercase tracking-wide flex items-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Upload size={14} /> CSV
                    <input type="file" accept=".csv,.txt" onChange={onFile} className="hidden" />
                </label>
            </div>

            {rows.length > 0 && (
                <>
                    <div className="flex items-center justify-between mt-6 mb-3">
                        <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">{t('cost.profit_title')}</h4>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('cost.total_profit')}</span>
                            <span className={`text-sm font-black ${totals.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                {totals.profit >= 0 ? '+' : ''}{formatNumber(totals.profit)}€ ({totals.profit >= 0 ? '+' : ''}{formatNumber(totals.pct, 1)}%)
                            </span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[520px]">
                            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="py-2 pr-2">{t('cost.asset')}</th>
                                    <th className="py-2 px-2 text-right">{t('cost.avg_cost')}</th>
                                    <th className="py-2 px-2 text-right">{t('cost.invested')}</th>
                                    <th className="py-2 px-2 text-right">{t('cost.value')}</th>
                                    <th className="py-2 pl-2 text-right">{t('cost.profit')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {rows.map(r => (
                                    <tr key={r.ticker}>
                                        <td className="py-3 pr-2">
                                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[160px]">{r.name}</div>
                                            <div className="text-[10px] font-bold text-indigo-400">{r.ticker}{r.since ? ` · ${t('cost.since')} ${new Date(r.since).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}` : ''}</div>
                                        </td>
                                        <td className="py-3 px-2 text-right text-xs font-mono text-slate-500 dark:text-slate-400">{formatNumber(r.avgCost, 2)}€</td>
                                        <td className="py-3 px-2 text-right text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">{formatNumber(r.invested)}€</td>
                                        <td className="py-3 px-2 text-right text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{formatNumber(r.value)}€</td>
                                        <td className="py-3 pl-2 text-right">
                                            <div className={`text-xs font-black tabular-nums flex items-center justify-end gap-1 ${r.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                                {r.profit >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                                {r.profit >= 0 ? '+' : ''}{formatNumber(r.profit)}€
                                            </div>
                                            <div className={`text-[10px] font-bold tabular-nums ${r.profit >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>{r.pct >= 0 ? '+' : ''}{formatNumber(r.pct, 1)}%</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            {rows.length === 0 && Object.keys(cost).length === 0 && (
                <p className="text-[11px] font-medium text-slate-400 mt-4">{t('cost.none')}</p>
            )}
        </GlassCard>
    );
};
