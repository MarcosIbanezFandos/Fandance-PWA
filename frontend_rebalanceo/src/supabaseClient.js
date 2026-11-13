import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Lo que trae en el fragmento de la URL el enlace de un email de Supabase. Se lee
// ANTES de crear el cliente, porque al arrancar el cliente recoge de ahí la
// sesión y limpia la URL. Dice si se llega a elegir contraseña nueva o si el
// enlace ha caducado.
const fragmento = new URLSearchParams(
  typeof window === 'undefined' ? '' : window.location.hash.slice(1)
)
export const llegadaPorEnlace = {
  recuperacion: fragmento.get('type') === 'recovery',
  caducado: fragmento.has('error_code') || fragmento.has('error'),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
