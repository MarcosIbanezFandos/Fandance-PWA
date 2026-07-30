import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { Upload, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { useGlobal } from '../context/GlobalContext';
import { xirr, safeFloat } from '../utils';

/**
 * Trade Republic CSV importer.
 *
 * Drag & drop (or tap) a transactions export and it derives your real history:
 * invested, realized P/L, dividends, interest, fees/taxes, money-weighted IRR
 * and the date of your very first purchase — so every stat runs from the day
 * you actually started investing.
 *
 * The file is parsed 100% in the browser; nothing is uploaded anywhere.
 */
export const TRCsvParser = ({ currentValue, onParsed, onClear, hasData }) => {
    const { t } = useGlobal();
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef(null);

    const handleFile = useCallback((file) => {
        if (!file) return;
        if (!/\.(csv|txt)$/i.test(file.name)) {
            setError(t('tr.err_type'));
            return;
        }
        setFileName(file.name);
        setError('');
        setBusy(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => String(h || '').trim().toLowerCase(),
            complete: (results) => {
                try {
                    const metrics = processTRCSV(results.data, currentValue);
                    if (!metrics.rows) setError(t('tr.err_empty'));
                    else onParsed(metrics);
                } catch (err) {
                    setError(t('tr.err_parse'));
                    console.error(err);
                } finally {
                    setBusy(false);
                }
            },
            error: (err) => { setError(err.message); setBusy(false); }
        });
    }, [currentValue, onParsed, t]);

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer?.files?.[0]);
    };

    return (
        <div>
            {/* Kept for the header shortcut button that triggers this input by id */}
            <input
                type="file"
                id="csv-upload-input"
                accept=".csv,.txt,text/csv"
                ref={inputRef}
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="hidden"
            />

            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                className={`w-full cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${dragging
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/50'}`}
            >
                {busy ? (
                    <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-300">
                        <Loader2 size={16} className="animate-spin text-indigo-500" /> {t('tr.parsing')}
                    </div>
                ) : (
                    <>
                        <Upload size={22} className="mx-auto mb-2 text-indigo-500" />
                        <div className="text-sm font-black text-slate-700 dark:text-slate-200">{t('tr.drop')}</div>
                        <div className="text-[11px] font-medium text-slate-400 mt-1">{t('tr.hint')}</div>
                    </>
                )}
            </div>

            {fileName && !error && !busy && (
                <div className="mt-3 flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                    <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 truncate">{fileName}</span>
                    </div>
                    {hasData && onClear && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setFileName(''); onClear(); }}
                            className="text-[10px] font-black uppercase tracking-wide text-slate-400 hover:text-rose-500 flex items-center gap-1 shrink-0"
                        >
                            <X size={12} /> {t('tr.clear')}
                        </button>
                    )}
                </div>
            )}

            {error && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{error}</span>
                </div>
            )}
        </div>
    );
};

// Pick the first present key from a row (TR exports vary between versions/locales).
const pick = (row, keys) => {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    return undefined;
};
const num = (v) => safeFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));

export function processTRCSV(data, currentValue) {
    let totalFee = 0, totalTax = 0, totalDividends = 0, totalInterest = 0;
    let realizedGross = 0, cashFlows = 0, rows = 0;
    let firstBuy = null;

    const assets = {};
    const irrFlows = [];

    (data || []).forEach((row) => {
        const type = String(pick(row, ['type', 'transaction_type', 'tipo']) || '').toUpperCase();
        if (!type) return;
        rows++;

        const rawAmount = num(pick(row, ['amount', 'importe', 'value']));
        const amount = Math.abs(rawAmount);
        const shares = num(pick(row, ['shares', 'quantity', 'cantidad', 'units']));
        const price = num(pick(row, ['price', 'precio', 'share_price']));
        const fee = num(pick(row, ['fee', 'fees', 'comision', 'comisión']));
        const tax = num(pick(row, ['tax', 'taxes', 'impuesto', 'impuestos']));
        const symbol = pick(row, ['symbol', 'ticker', 'isin', 'name', 'nombre']) || 'Unknown';
        const rawDate = pick(row, ['datetime', 'date', 'fecha', 'timestamp']);
        const date = rawDate ? new Date(rawDate) : new Date();
        const validDate = !isNaN(date);

        totalFee += fee;
        totalTax += tax;

        if (type.includes('DIVIDEND')) {
            totalDividends += (amount + fee + tax);
            if (validDate) irrFlows.push({ date, amount: rawAmount });
        } else if (type.includes('INTEREST')) {
            totalInterest += (amount + fee + tax);
            if (validDate) irrFlows.push({ date, amount: rawAmount });
        } else if (type === 'BUY' || type.includes('SAVINGS_PLAN') || type.includes('COMPRA')) {
            if (!assets[symbol]) assets[symbol] = { shares: 0, totalCost: 0 };
            assets[symbol].shares += shares;
            assets[symbol].totalCost += shares * price;
            if (validDate) {
                irrFlows.push({ date, amount: rawAmount });
                if (!firstBuy || date < firstBuy) firstBuy = date;
            }
        } else if (type === 'SELL' || type.includes('VENTA')) {
            if (!assets[symbol]) assets[symbol] = { shares: 0, totalCost: 0 };
            const avgCost = assets[symbol].shares > 0 ? (assets[symbol].totalCost / assets[symbol].shares) : 0;
            const costOfSold = shares * avgCost;
            realizedGross += (shares * price) - costOfSold;
            assets[symbol].shares -= shares;
            assets[symbol].totalCost -= costOfSold;
            if (assets[symbol].shares <= 0.000001) { assets[symbol].shares = 0; assets[symbol].totalCost = 0; }
            if (validDate) irrFlows.push({ date, amount: rawAmount });
        } else if (type.includes('TRANSFER') || type.includes('DEPOSIT')) {
            cashFlows += rawAmount;
        }
    });

    const invested = Object.values(assets).reduce((s, a) => s + a.totalCost, 0);

    let tir = null;
    if (irrFlows.length > 0 && currentValue > 0) {
        const flows = [...irrFlows, { date: new Date(), amount: currentValue }].sort((a, b) => a.date - b.date);
        const rate = xirr(flows);
        if (rate !== null) tir = rate * 100;
    }

    const priceGains = currentValue - invested;
    const totalGross = priceGains + realizedGross + totalDividends + totalInterest;

    return {
        rows,
        invested,
        cashFlow: cashFlows,
        tir,
        priceGains,
        realizedGross,
        dividends: totalDividends,
        interest: totalInterest,
        totalGross,
        taxes: totalTax,
        fees: totalFee,
        netTotal: totalGross - totalTax - totalFee,
        firstPurchase: firstBuy ? firstBuy.toISOString() : null,
    };
}
