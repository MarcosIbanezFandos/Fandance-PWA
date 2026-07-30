import axios from 'axios'
import { supabase } from './supabaseClient'

/**
 * Cliente HTTP de la app.
 *
 * Adjunta el access token de Supabase a cada petición: el backend deriva de él
 * el user_id y comprueba la propiedad de cada recurso. Ningún user_id viaja en
 * el body — el cliente no decide quién es.
 *
 * Usar SIEMPRE este `api` en lugar de importar axios directamente.
 */
const api = axios.create()

api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
    }
    return config
})

// Un 401 significa sesión caducada o revocada: cerrar sesión y volver al login.
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        if (error?.response?.status === 401) {
            await supabase.auth.signOut()
        }
        return Promise.reject(error)
    }
)

export default api
