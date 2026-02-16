import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, TrendingUp, Loader2 } from 'lucide-react';
// CORRECCIÓN CRÍTICA: Importar desde supabaseClient para romper el bucle infinito
import { supabase } from '../supabaseClient'; 
import { BounceButton, fadeInUp, staggerContainer } from './UI';

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
        if (!error) alert("¡Cuenta creada! Revisa tu email.");
      } else if (authMode === 'login') {
        const res = await supabase.auth.signInWithPassword({ email, password });
        error = res.error;
      }
      if (error) alert(error.message);
    } catch (e) { alert("Error de conexión"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 font-sans text-slate-900">
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100 relative overflow-hidden"
      >
        <motion.div variants={fadeInUp} className="text-center mb-8 relative z-10">
          <div className="inline-block bg-indigo-600 p-4 rounded-3xl mb-4 text-white shadow-xl shadow-indigo-200">
            <TrendingUp size={40}/>
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">
            F<span className="text-indigo-600">AND</span>ANCE
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
            {authMode === 'login' ? 'Bienvenido de nuevo' : 'Crear nueva cuenta'}
          </p>
        </motion.div>

        <form onSubmit={handleAuth} className="space-y-4 relative z-10">
          <motion.div variants={fadeInUp} className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
            <input className="w-full bg-slate-50 p-4 pl-12 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-500 transition-all" type="email" placeholder="Tu Email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </motion.div>
          
          {authMode !== 'recovery' && (
            <motion.div variants={fadeInUp} className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
              <input className="w-full bg-slate-50 p-4 pl-12 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 ring-indigo-500 transition-all" type="password" placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)} required />
            </motion.div>
          )}

          <motion.div variants={fadeInUp}>
            <BounceButton disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-200">
              {loading ? <Loader2 className="animate-spin mx-auto"/> : (authMode === 'login' ? 'Entrar' : 'Crear Cuenta')}
            </BounceButton>
          </motion.div>
        </form>

        <motion.div variants={fadeInUp} className="mt-6 flex flex-col gap-3 text-center relative z-10">
            <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Volver al inicio de sesión'}
            </button>
        </motion.div>
      </motion.div>
    </div>
  );
};