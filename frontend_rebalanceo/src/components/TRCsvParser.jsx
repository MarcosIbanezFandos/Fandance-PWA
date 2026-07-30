import React, { useState, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, X, FileText, CheckCircle2 } from 'lucide-react';
import { GlassCard } from './UI';
import { formatNumber, xirr } from '../utils';

export const TRCsvParser = ({ currentValue, onParsed }) => {
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    const handleUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        setError('');

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const metrics = processTRCSV(results.data, currentValue);
                    onParsed(metrics);
                } catch (err) {
                    setError('Error procesando CSV. Asegúrate de que es de Trade Republic.');
                    console.error(err);
                }
            },
            error: (err) => {
                setError(err.message);
            }
        });
    };

    return (
        <input 
            type="file" 
            id="csv-upload-input"
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            className="hidden" 
        />
    );
};

function processTRCSV(data, currentValue) {
    let totalFee = 0;
    let totalTax = 0;
    let totalDividends = 0;
    let totalInterest = 0;
    let realizedGross = 0;
    let cashFlows = 0;

    let assets = {}; 
    const irrFlows = [];

    data.forEach(row => {
        const type = (row.type || '').toUpperCase();
        if (!type) return;

        const rawAmount = parseFloat(row.amount || 0);
        const amount = Math.abs(rawAmount);
        const shares = parseFloat(row.shares || 0);
        const price = parseFloat(row.price || 0);
        const fee = parseFloat(row.fee || 0);
        const tax = parseFloat(row.tax || 0);
        const symbol = row.symbol || row.name || 'Unknown';
        const date = new Date(row.datetime || row.date);

        totalFee += fee;
        totalTax += tax;

        if (type.includes('DIVIDEND')) {
            totalDividends += (amount + fee + tax);
            irrFlows.push({ date, amount: rawAmount });
        } else if (type.includes('INTEREST')) {
            totalInterest += (amount + fee + tax);
            irrFlows.push({ date, amount: rawAmount });
        } else if (type === 'BUY' || type.includes('SAVINGS_PLAN')) {
            if (!assets[symbol]) assets[symbol] = { shares: 0, totalCost: 0 };
            const grossCost = shares * price;
            assets[symbol].shares += shares;
            assets[symbol].totalCost += grossCost;
            irrFlows.push({ date, amount: rawAmount });
        } else if (type === 'SELL') {
            if (!assets[symbol]) assets[symbol] = { shares: 0, totalCost: 0 };
            const grossSell = shares * price;
            const avgCost = assets[symbol].shares > 0 ? (assets[symbol].totalCost / assets[symbol].shares) : 0;
            const costOfSold = shares * avgCost;
            
            realizedGross += (grossSell - costOfSold);
            
            assets[symbol].shares -= shares;
            assets[symbol].totalCost -= costOfSold;
            
            if (assets[symbol].shares <= 0.000001) {
                assets[symbol].shares = 0;
                assets[symbol].totalCost = 0;
            }
            irrFlows.push({ date, amount: rawAmount });
        } else if (type.includes('TRANSFER')) {
            cashFlows += rawAmount;
        }
    });

    let invertido = 0;
    for (const sym in assets) {
        invertido += assets[sym].totalCost;
    }

    // Calcular TIR
    let tir = null;
    if (irrFlows.length > 0 && currentValue > 0) {
        irrFlows.push({ date: new Date(), amount: currentValue });
        const rate = xirr(irrFlows);
        if (rate !== null) tir = rate * 100;
    }

    const priceGains = currentValue - invertido;
    const totalGross = priceGains + realizedGross + totalDividends + totalInterest;
    const netTotal = totalGross - totalTax - totalFee;

    return {
        invested: invertido,
        cashFlow: cashFlows,
        tir: tir,
        priceGains: priceGains,
        realizedGross: realizedGross,
        dividends: totalDividends,
        interest: totalInterest,
        totalGross: totalGross,
        taxes: totalTax,
        fees: totalFee,
        netTotal: netTotal
    };
}
