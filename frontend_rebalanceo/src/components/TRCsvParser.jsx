import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { CheckCircle2, AlertTriangle, Loader2, X, FileUp } from 'lucide-react';
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
 *
 * Props:
 *   compact  — when true, renders only the hidden <input> (the parent handles the UI)
 *   hasData  — whether CSV data has been imported
 */
export const TRCsvParser = ({ currentValue, onParsed, onClear, hasData, compact = false }) => {
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

    // In compact mode, only render the hidden file input (parent handles UI)
    if (compact) {
        return (
            <input
                type="file"
                id="csv-upload-input"
                accept=".csv,.txt,text/csv"
                ref={inputRef}
                onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
                className="hidden"
            />
        );
    }

    // Full mode — premium upload experience
    return (
        <div>
            <input
                type="file"
                id="csv-upload-input"
                accept=".csv,.txt,text/csv"
                ref={inputRef}
                onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
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
                className={`w-full cursor-pointer rounded-card border-2 border-dashed p-6 text-center transition-all duration-200 ${dragging
 ? 'border-indigo-500 bg-brand-soft/80 scale-[1.01]'
 : 'border-line hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 bg-surface/60'}`}
            >
                {busy ? (
                    <div className="flex items-center justify-center gap-2 text-subhead font-bold text-ink-2 py-2">
                        <Loader2 size={18} className="animate-spin text-brand" /> {t('tr.parsing')}
                    </div>
                ) : (
                    <>
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-soft rounded-card mb-3">
                            <FileUp size={22} className="text-brand" />
                        </div>
                        <div className="text-subhead font-semibold text-ink">{t('tr.drop')}</div>
                        <div className="text-caption1 font-medium text-ink-3 mt-1.5">{t('tr.hint')}</div>
                    </>
                )}
            </div>

            {fileName && !error && !busy && (
                <div className="mt-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-control bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
                    <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-caption1 font-bold text-emerald-700 dark:text-emerald-300 truncate">{fileName}</span>
                    </div>
                    {hasData && onClear && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setFileName(''); onClear(); }}
                            className="text-caption2 font-semibold uppercase tracking-wide text-ink-3 hover:text-rose-500 flex items-center gap-1 shrink-0 transition-colors"
                        >
                            <X size={12} /> {t('tr.clear')}
                        </button>
                    )}
                </div>
            )}

            {error && (
                <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-control bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <span className="text-caption1 font-bold text-amber-700 dark:text-amber-300">{error}</span>
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
    const transactions = []; // Individual parsed transactions for period filtering

    (data || []).forEach((row) => {
        const type = String(pick(row, ['type', 'transaction_type', 'tipo']) || '').toUpperCase();
        if (!type) return;
        rows++;

        const category = String(pick(row, ['category', 'categoría', 'categoria']) || '').toUpperCase();
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

        // Store parsed transaction for period-based filtering
        transactions.push({
            date: validDate ? date : new Date(),
            type,
            category,
            symbol,
            shares: Math.abs(shares),
            price,
            amount: rawAmount,
            fee: Math.abs(fee),
            tax: Math.abs(tax),
        });

        totalFee += Math.abs(fee);
        totalTax += Math.abs(tax);

        if (type.includes('DIVIDEND')) {
            totalDividends += (amount + Math.abs(fee) + Math.abs(tax));
            if (validDate) irrFlows.push({ date, amount: rawAmount });
        } else if (type.includes('INTEREST')) {
            totalInterest += (amount + Math.abs(fee) + Math.abs(tax));
            if (validDate) irrFlows.push({ date, amount: rawAmount });
        } else if (type === 'BUY' || type.includes('SAVINGS_PLAN') || type.includes('COMPRA')) {
            if (!assets[symbol]) assets[symbol] = { shares: 0, totalCost: 0 };
            assets[symbol].shares += Math.abs(shares);
            assets[symbol].totalCost += Math.abs(shares) * price;
            if (validDate) {
                irrFlows.push({ date, amount: rawAmount });
                if (!firstBuy || date < firstBuy) firstBuy = date;
            }
        } else if (type === 'SELL' || type.includes('VENTA')) {
            if (!assets[symbol]) assets[symbol] = { shares: 0, totalCost: 0 };
            const absShares = Math.abs(shares);
            const avgCost = assets[symbol].shares > 0 ? (assets[symbol].totalCost / assets[symbol].shares) : 0;
            const costOfSold = absShares * avgCost;
            realizedGross += (absShares * price) - costOfSold;
            assets[symbol].shares -= absShares;
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
        transactions,
    };
}
