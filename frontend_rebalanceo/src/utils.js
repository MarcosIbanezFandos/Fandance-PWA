export const safeFloat = (input) => {
    if (input === null || input === undefined || input === '') return 0;
    const strVal = String(input).replace(',', '.');
    const num = parseFloat(strVal);
    if (isNaN(num) || !isFinite(num)) return 0;
    return num;
};

export const formatCurrency = (amount) => {
    return safeFloat(amount).toLocaleString('es-ES', { 
        style: 'currency', 
        currency: 'EUR',
        maximumFractionDigits: 0 
    });
};