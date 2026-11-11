import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, TrendingUp } from 'lucide-react';
// CORRECCIÓN CRÍTICA: Importar desde supabaseClient para romper el bucle infinito
import { supabase } from '../supabaseClient';
import { mensajeDeError } from '../lib/erroresAuth';
import { Button, Input, fadeInUp, staggerContainer } from './UI';

const SUBTITULOS = {
  login: 'Bienvenido de nuevo',
  register: 'Crea tu cuenta',
  recovery: 'Te mando un enlace para elegir otra',
};

const BOTONES = {
  login: 'Entrar',
  register: 'Crear cuenta',
  recovery: 'Mandarme el enlace',
};

/**
 * Entrar, registrarse o pedir el enlace de «¿Has olvidado la contraseña?».
 *
 * Los campos llevan `name` y `autocomplete` para el llavero de Apple: Fandance
 * comparte dominio (fandos.vercel.app) y cuenta con FANDiOS, así que Safari
 * ofrece y guarda la misma contraseña con el email como usuario.
 */
export const AuthScreen = ({ onLogin, enlaceCaducado = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState(enlaceCaducado ? 'recovery' : 'login');
  // { tipo: 'ok' | 'error', texto }
  const [aviso, setAviso] = useState(
    enlaceCaducado
      ? { tipo: 'error', texto: 'Ese enlace ha caducado o ya se ha usado. Pide otro aquí.' }
      : null
  );

  const cambiarModo = (modo) => {
    setAuthMode(modo);
    setAviso(null);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAviso(null);
    try {
      let error = null;
      if (authMode === 'register') {
        const res = await supabase.auth.signUp({ email, password });
        error = res.error;
        if (!error) setAviso({ tipo: 'ok', texto: 'Cuenta creada. Mira tu email para confirmarla.' });
      } else if (authMode === 'login') {
        const res = await supabase.auth.signInWithPassword({ email, password });
        error = res.error;
      } else if (authMode === 'recovery') {
        // El enlace vuelve a esta misma app (sin la barra final, que el
        // despliegue quita con otra redirección): Supabase lo recoge al
        // arrancar y App enseña la pantalla de contraseña nueva.
        const res = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: (window.location.origin + import.meta.env.BASE_URL).replace(/\/$/, ''),
        });
        error = res.error;
        if (!error) {
          setAviso({ tipo: 'ok', texto: `Te he mandado un enlace a ${email}. Ábrelo y elige la contraseña nueva.` });
        }
      }
      if (error) setAviso({ tipo: 'error', texto: mensajeDeError(error) });
    } catch {
      setAviso({ tipo: 'error', texto: 'No hay conexión. Prueba otra vez.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4 font-sans text-ink">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="bg-surface p-8 md:p-10 rounded-card shadow-card max-w-sm w-full border border-line"
      >
        <motion.div variants={fadeInUp} className="text-center mb-7">
          <div className="inline-flex w-14 h-14 rounded-card bg-brand items-center justify-center mb-4 text-white">
            <TrendingUp size={26} strokeWidth={2.5} />
          </div>
          <h1 className="text-title1 font-bold tracking-tight">
            F<span className="text-brand">and</span>ance
          </h1>
          <p className="text-subhead font-medium text-ink-2 mt-1.5">
            {SUBTITULOS[authMode]}
          </p>
        </motion.div>

        <form onSubmit={handleAuth} className="space-y-3">
          <motion.div variants={fadeInUp}>
            <Input
              icon={Mail} type="email" name="email" autoComplete="username"
              placeholder="Email" required
              wrapperClassName="h-12"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </motion.div>

          {authMode !== 'recovery' && (
            <motion.div variants={fadeInUp}>
              <Input
                icon={Lock} type="password" name="password"
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                placeholder="Contraseña" required
                wrapperClassName="h-12"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </motion.div>
          )}

          {aviso && (
            <p
              role={aviso.tipo === 'error' ? 'alert' : 'status'}
              className={`text-footnote font-semibold ${aviso.tipo === 'error' ? 'text-negative' : 'text-ink-2'}`}
            >
              {aviso.texto}
            </p>
          )}

          <motion.div variants={fadeInUp} className="pt-1">
            <Button type="submit" size="lg" loading={loading} className="w-full">
              {BOTONES[authMode]}
            </Button>
          </motion.div>
        </form>

        <motion.div variants={fadeInUp} className="mt-5 flex flex-col items-center gap-3 text-center">
          {authMode === 'login' && (
            <button
              type="button"
              onClick={() => cambiarModo('recovery')}
              className="text-footnote font-semibold text-ink-2 hover:text-brand transition-colors"
            >
              ¿Has olvidado la contraseña?
            </button>
          )}
          <button
            type="button"
            onClick={() => cambiarModo(authMode === 'login' ? 'register' : 'login')}
            className="text-footnote font-semibold text-ink-2 hover:text-brand transition-colors"
          >
            {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Volver a iniciar sesión'}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};
