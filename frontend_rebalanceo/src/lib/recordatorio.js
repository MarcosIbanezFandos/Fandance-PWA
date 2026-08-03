/**
 * Cuándo pedir el CSV del mes.
 *
 * La regla es la del usuario: en cuanto cierra la bolsa del primer lunes del
 * mes, esa aportación ya está ejecutada y el CSV la contiene. A partir de ahí
 * tiene sentido pedirlo; antes, no.
 *
 * Todo son funciones puras sobre fechas para poder probarlas sin navegador.
 * Se trabaja en hora local a propósito: el "primer lunes" que le importa al
 * usuario es el de su calendario, no el de UTC.
 */

/** Hora local a partir de la cual se considera cerrada la sesión bursátil. */
export const HORA_CIERRE = 18;

export const mesClave = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const desdeClave = (clave) => {
    const [a, m] = String(clave).split('-').map(Number);
    return new Date(a, (m || 1) - 1, 1);
};

/** Primer lunes del mes de esa fecha, a medianoche. */
export const primerLunes = (año, mes) => {
    const d = new Date(año, mes, 1);
    // getDay(): 0 domingo … 6 sábado. Si el día 1 ya es lunes, el salto es 0.
    d.setDate(1 + ((1 - d.getDay() + 7) % 7));
    d.setHours(0, 0, 0, 0);
    return d;
};

/** Momento exacto en que procede pedir el CSV de ese mes. */
export const momentoAviso = (año, mes) => {
    const d = primerLunes(año, mes);
    d.setHours(HORA_CIERRE, 0, 0, 0);
    return d;
};

/**
 * Meses cuya aportación debería estar ya en el CSV y no lo está.
 *
 * Devuelve claves 'AAAA-MM' de más antigua a más reciente. Que sea una lista y
 * no un booleano es lo que resuelve el caso de subir el CSV con retraso: si se
 * saltaron tres meses, el aviso puede decir cuántos y cuáles.
 */
export const mesesPendientes = ({ ahora = new Date(), mesesConAportacion = [] } = {}) => {
    const registrados = new Set(mesesConAportacion);

    // Se empieza a contar desde el mes siguiente al último registrado. Sin
    // ningún dato previo sólo se mira el mes en curso: no tiene sentido
    // reclamar meses anteriores a que el usuario empezara a usar esto.
    const ultimo = [...registrados].sort().pop();
    const cursor = ultimo ? desdeClave(ultimo) : new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    if (ultimo) cursor.setMonth(cursor.getMonth() + 1);

    const pendientes = [];
    const tope = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    // Guarda de seguridad: un CSV muy viejo no debe generar una lista infinita.
    while (cursor <= tope && pendientes.length < 24) {
        const clave = mesClave(cursor);
        if (!registrados.has(clave) && ahora >= momentoAviso(cursor.getFullYear(), cursor.getMonth())) {
            pendientes.push(clave);
        }
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return pendientes;
};

/**
 * Decide si mostrar el aviso.
 *
 * `descartadoHasta` es la clave del mes más reciente que el usuario ya despachó.
 * Se compara contra el pendiente más nuevo: si aparece un mes posterior, el
 * aviso vuelve, pero cerrarlo no lo hace reaparecer hasta el mes siguiente.
 */
export const debeAvisar = ({ ahora = new Date(), mesesConAportacion = [], descartadoHasta = null } = {}) => {
    const pendientes = mesesPendientes({ ahora, mesesConAportacion });
    if (!pendientes.length) return { avisar: false, pendientes: [] };
    const masNuevo = pendientes[pendientes.length - 1];
    if (descartadoHasta && String(descartadoHasta) >= masNuevo) return { avisar: false, pendientes };
    return { avisar: true, pendientes };
};
