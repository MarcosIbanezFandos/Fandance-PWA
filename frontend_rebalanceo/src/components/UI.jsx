import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// Variantes de animación estándar (para reusar)
export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

// Tarjeta con efecto "glass" y entrada suave
export const GlassCard = ({ children, className = "" }) => (
  <motion.div
    variants={fadeInUp}
    className={`relative bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300 ${className}`}
  >
    {children}
  </motion.div>
);

// Botón con efecto de rebote al pulsar
export const BounceButton = ({ children, onClick, className = "", disabled = false, ...props }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    disabled={disabled}
    className={`transition-colors ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    {...props}
  >
    {children}
  </motion.button>
);

// Contador de números animado (ej: 0 -> 10,000 €)
export const CountUp = ({ value, prefix = "", suffix = "", decimals = 0 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseFloat(value) || 0;
    if (start === end) return;

    let totalDuration = 1000; // 1 segundo
    let incrementTime = (totalDuration / Math.abs(end - start)) * 10;
    if (incrementTime === 0) incrementTime = 1;

    let timer = setInterval(() => {
      start += (end - start) / 10; // Aproximación suave
      if (Math.abs(end - start) < 1) {
        start = end;
        clearInterval(timer);
      }
      setDisplayValue(start);
    }, 30);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>{prefix}{displayValue.toLocaleString('es-ES', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</span>
  );
};