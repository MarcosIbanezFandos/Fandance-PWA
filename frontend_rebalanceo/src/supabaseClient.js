import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// En producción el navegador no llama a *.supabase.co: va por el propio dominio
// (VITE_SUPABASE_PROXY=/sb, que el proyecto de Vercel reenvía a Supabase desde sus
// servidores). En España, las operadoras bloquean IPs de Cloudflare en días de
// partido de LaLiga, y Supabase va por Cloudflare. Sin la variable (desarrollo,
// modo demo, el repo Fandance-PWA), la URL directa de siempre.
const proxy = import.meta.env.VITE_SUPABASE_PROXY
const urlNavegador =
  proxy && typeof window !== 'undefined' ? `${window.location.origin}${proxy}` : supabaseUrl

// La sesión se guarda con la clave de siempre (sb-<ref>-auth-token): si saliera de
// la URL del proxy, cambiaría y cerraría las sesiones abiertas.
const claveSesion = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(urlNavegador, supabaseAnonKey, {
  auth: { storageKey: claveSesion },
})
