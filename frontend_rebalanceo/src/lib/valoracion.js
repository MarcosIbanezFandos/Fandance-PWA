/**
 * Cuánto vale cada posición. Una sola definición para toda la app.
 *
 * El valor sale de multiplicar unidades por cotización, pero la cotización
 * puede faltar: si el activo está dado de alta con un ticker que el proveedor
 * no reconoce, devuelve 0 y la posición desaparece del patrimonio, arrastrando
 * los porcentajes de todas las demás.
 *
 * El CSV del bróker guarda el precio al que ejecutó de verdad, que sirve de
 * respaldo. Vivía repartido entre pantallas y cada una lo aplicaba —o no— por
 * su cuenta: Rentabilidad calculaba el total sin él y daba una TIR distinta a
 * la cartera que se veía en Posiciones. Aquí está una vez y lo usan todas.
 */
import { safeFloat, roundTo } from '../utils.js';

/**
 * @param items       posiciones tal como llegan del servidor
 * @param preciosCsv  { [itemId]: { precio, fecha, preferir } }
 */
export const valorarItems = (items = [], preciosCsv = {}) =>
    (items || []).map(i => {
        const alt = preciosCsv?.[i.id];
        const precioApp = safeFloat(i.current_price);

        // Se usa el precio del bróker si no hay cotización, o si la que hay es
        // de otro instrumento (`preferir`, que marca la importación cuando el
        // precio no se parece al que se pagó).
        if (!alt?.precio || (precioApp > 0 && !alt.preferir)) {
            return { ...i, value: roundTo(safeFloat(i.units_held) * precioApp, 2) };
        }

        const precio = safeFloat(alt.precio);
        return {
            ...i,
            current_price: precio,
            value: roundTo(safeFloat(i.units_held) * precio, 2),
            precioDeCsv: alt.fecha || true,
        };
    });

/** Patrimonio total, con la misma regla de valoración. */
export const patrimonioTotal = (items = [], preciosCsv = {}) =>
    valorarItems(items, preciosCsv).reduce((s, i) => s + safeFloat(i.value), 0);
