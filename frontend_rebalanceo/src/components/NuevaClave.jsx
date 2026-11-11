import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, TrendingUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { mensajeDeError } from '../lib/erroresAuth';
import { Button, Input, fadeInUp, staggerContainer } from './UI';

/**
 * Contraseña nueva, al volver del enlace de «¿Has olvidado la contraseña?».
 *
 * El enlace ya ha abierto sesión; aquí solo se guarda la contraseña. El campo del
 * email va visible y de solo lectura con `autocomplete="username"`, y el de la
 * contraseña con `new-password`: así Safari propone una contraseña segura y la
 * guarda en Contraseñas con el email correcto. La cuenta es la misma que la de
 * FANDiOS, así que la contraseña nueva vale para las dos apps.
 */
export const NuevaClave = ({ email, onHecho }) => {
  const [clave, setClave] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: clave });
      if (error) setError(mensajeDeError(error));
      else setHecho(true);
    } catch {
      setError('No hay conexión. Prueba otra vez.');
    } finally {
      setGuardando(false);
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
            {hecho ? 'Contraseña cambiada' : 'Contraseña nueva'}
          </h1>
          <p className="text-subhead font-medium text-ink-2 mt-1.5">
            {hecho
              ? 'Vale también para FANDiOS: es la misma cuenta.'
              : 'Elige la contraseña con la que entrarás a partir de ahora.'}
          </p>
        </motion.div>

        {hecho ? (
          <motion.div variants={fadeInUp}>
            <Button size="lg" className="w-full" onClick={onHecho}>
              Entrar en Fandance
            </Button>
          </motion.div>
        ) : (
          <form onSubmit={guardar} className="space-y-3">
            <motion.div variants={fadeInUp}>
              <Input
                icon={Mail} type="email" name="email" autoComplete="username"
                wrapperClassName="h-12" className="text-ink-2"
                value={email} readOnly aria-label="Cuenta"
              />
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Input
                icon={Lock} type="password" name="new-password" autoComplete="new-password"
                placeholder="Contraseña nueva" required minLength={8}
                wrapperClassName="h-12"
                value={clave} onChange={e => setClave(e.target.value)}
              />
            </motion.div>
            <motion.p variants={fadeInUp} className="text-footnote text-ink-3">
              En el iPhone o en el Mac, Safari te propone una contraseña segura al tocar
              el campo. Acéptala y se queda guardada en Contraseñas con tu email.
            </motion.p>
            {error && (
              <p role="alert" className="text-footnote font-semibold text-negative">{error}</p>
            )}
            <motion.div variants={fadeInUp} className="pt-1">
              <Button type="submit" size="lg" loading={guardando} disabled={!clave} className="w-full">
                Guardar contraseña
              </Button>
            </motion.div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
