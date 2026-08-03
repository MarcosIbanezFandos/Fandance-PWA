import { supabase } from '../supabaseClient';

/**
 * Almacén del plan de aportación y del inicio de cada cartera.
 *
 * Vive en los metadatos del usuario de Supabase Auth, no en columnas nuevas de
 * `portfolios`. El motivo es práctico: añadir columnas exige un ALTER TABLE, y
 * eso sólo se puede hacer desde el panel de Supabase o con acceso directo a
 * Postgres. La app quedaba bloqueada esperando una migración manual.
 *
 * Los metadatos del usuario se escriben con la sesión que ya tiene abierta, sin
 * privilegios extra y sincronizados entre dispositivos. Son escribibles por el
 * propio usuario, así que no valdrían para nada que deba protegerse — pero esto
 * son sus preferencias sobre su propia cartera: exactamente el caso de uso.
 *
 * Forma:
 *   user_metadata.portfolio_prefs = {
 *     "<portfolio_id>": { monthly, growth, start, inception }
 *   }
 */
const CLAVE = 'portfolio_prefs';

const leerTodo = (user) => (user?.user_metadata?.[CLAVE] && typeof user.user_metadata[CLAVE] === 'object')
    ? user.user_metadata[CLAVE]
    : {};

/** Preferencias de una cartera a partir del usuario ya cargado en sesión. */
export const getPrefs = (user, portfolioId) => {
    if (!portfolioId) return null;
    const p = leerTodo(user)[portfolioId] || {};
    return {
        monthly: Number(p.monthly) || 0,
        annualGrowthPct: Number(p.growth) || 0,
        startDate: p.start || null,
        // Fecha desde la que tiene sentido dibujar la cartera. Si no se ha
        // fijado, quien llama usa la creación de la cartera.
        inception: p.inception || null,
    };
};

/**
 * Guarda de forma incremental: se relee el bloque entero y se sustituye sólo la
 * cartera tocada, para no borrar las preferencias de las demás si dos pestañas
 * escriben a la vez.
 */
export const savePrefs = async (portfolioId, cambios) => {
    const { data: { user }, error: errUser } = await supabase.auth.getUser();
    if (errUser || !user) throw new Error('Sesión no disponible');

    const todo = leerTodo(user);
    const actual = todo[portfolioId] || {};
    const siguiente = {
        ...actual,
        ...(cambios.monthly !== undefined ? { monthly: Number(cambios.monthly) || 0 } : {}),
        ...(cambios.annualGrowthPct !== undefined ? { growth: Number(cambios.annualGrowthPct) || 0 } : {}),
        ...(cambios.startDate !== undefined ? { start: cambios.startDate || null } : {}),
        ...(cambios.inception !== undefined ? { inception: cambios.inception || null } : {}),
    };

    const { data, error } = await supabase.auth.updateUser({
        data: { [CLAVE]: { ...todo, [portfolioId]: siguiente } },
    });
    if (error) throw error;
    return getPrefs(data.user, portfolioId);
};
