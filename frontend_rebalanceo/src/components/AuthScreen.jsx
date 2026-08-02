import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, TrendingUp } from 'lucide-react';
// CORRECCIÓN CRÍTICA: Importar desde supabaseClient para romper el bucle infinito
import { supabase } from '../supabaseClient';
import { Button, Input, fadeInUp, staggerContainer } from './UI';

export const AuthScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let error = null;
      if (authMode === 'register') {
        const res = await supabase.auth.signUp({ email, password });
        error = res.error;
        if (!error) alert("Account created! Check your email.");
      } else if (authMode === 'login') {
        const res = await supabase.auth.signInWithPassword({ email, password });
        error = res.error;
      }
      if (error) alert(error.message);
    } catch (e) { alert("Connection error"); } 
    finally { setLoading(false); }
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
          <div className="inline-flex w-14 h-14 rounded-2xl bg-brand items-center justify-center mb-4 text-white">
            <TrendingUp size={26} strokeWidth={2.5} />
          </div>
          <h1 className="text-title1 font-bold tracking-tight">
            F<span className="text-brand">and</span>ance
          </h1>
          <p className="text-subhead font-medium text-ink-2 mt-1.5">
            {authMode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
          </p>
        </motion.div>

        <form onSubmit={handleAuth} className="space-y-3">
          <motion.div variants={fadeInUp}>
            <Input
              icon={Mail} type="email" placeholder="Email" required
              wrapperClassName="h-12"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </motion.div>

          {authMode !== 'recovery' && (
            <motion.div variants={fadeInUp}>
              <Input
                icon={Lock} type="password" placeholder="Contraseña" required
                wrapperClassName="h-12"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </motion.div>
          )}

          <motion.div variants={fadeInUp} className="pt-1">
            <Button type="submit" size="lg" loading={loading} className="w-full">
              {authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </Button>
          </motion.div>
        </form>

        <motion.div variants={fadeInUp} className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="text-footnote font-semibold text-ink-2 hover:text-brand transition-colors"
          >
            {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Volver a iniciar sesión'}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};