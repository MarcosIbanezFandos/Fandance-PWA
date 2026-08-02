import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

/* ---------------------------------------------------------------- *
 *  Animación
 * ---------------------------------------------------------------- */
export const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

/* ---------------------------------------------------------------- *
 *  Superficies
 * ---------------------------------------------------------------- */
// Tarjeta agrupada al estilo iOS: sin borde visible, la separación la da el
// contraste con el lienzo. El borde marcado hacía que pareciera un panel web.
export const Card = ({ children, className = '', as: As = motion.div, interactive = false, ...props }) => (
  <As
    variants={fadeInUp}
    className={cn(
        'relative bg-surface rounded-card shadow-card',
        // El fondo NO se anima: al cambiar de tema el lienzo cambia al instante
        // y una tarjeta que tarda 200ms en seguirlo se ve clara sobre oscuro.
        'transition-[box-shadow,transform] duration-200',
        interactive && 'active:scale-[0.985] active:bg-surface-2',
        'p-4 md:p-5',
        className
    )}
    {...props}
  >
    {children}
  </As>
);

// Nombre histórico, mantenido para no romper las pantallas que ya lo importan.
export const GlassCard = Card;

/** Cabecera de bloque: etiqueta en versalitas + icono opcional + acción a la derecha. */
export const SectionHeader = ({ icon: Icon, title, hint, action, className = '' }) => (
  <div className={cn('flex items-start justify-between gap-3 mb-3.5', className)}>
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 text-headline font-semibold text-ink">
        {Icon && <Icon size={17} strokeWidth={2} className="text-ink-3 shrink-0" />}
        <span className="truncate">{title}</span>
      </h3>
      {hint && <p className="text-footnote text-ink-2 mt-1 leading-snug">{hint}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/* ---------------------------------------------------------------- *
 *  Botones
 * ---------------------------------------------------------------- */
const BUTTON_VARIANTS = {
  primary: 'bg-brand text-white hover:brightness-110 active:brightness-95 shadow-sm',
  secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  soft: 'bg-brand-soft text-brand-ink hover:brightness-95 dark:hover:brightness-125',
  danger: 'bg-negative text-white hover:brightness-110 active:brightness-95 shadow-sm',
  'danger-ghost': 'text-negative hover:bg-negative-soft',
};

// Ningún tamaño baja de 44pt de zona táctil (HIG). `sm` se ve más pequeño pero
// mantiene el área de toque con .tap-target, que crece sin desplazar el layout.
const BUTTON_SIZES = {
  sm: 'h-9 px-3.5 text-footnote gap-1.5 rounded-field tap-target',
  md: 'h-11 px-4 text-subhead gap-2 rounded-control',
  lg: 'h-[3.25rem] px-6 text-body gap-2.5 rounded-control',
  icon: 'h-11 w-11 rounded-control',
};

export const Button = React.forwardRef(({
  children, className = '', variant = 'primary', size = 'md',
  icon: Icon, iconRight: IconRight, loading = false, disabled = false, ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
        'inline-flex items-center justify-center font-semibold select-none',
        'transition-all duration-150 active:scale-[0.98]',
        'disabled:opacity-50 disabled:pointer-events-none',
        BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className
    )}
    {...props}
  >
    {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
      : Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2.25} />}
    {size !== 'icon' && children}
    {IconRight && !loading && <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={2.25} />}
  </button>
));
Button.displayName = 'Button';

// Botón con rebote, conservado para las pantallas que ya lo usaban.
export const BounceButton = ({ children, onClick, className = '', disabled = false, ...props }) => (
  <motion.button
    whileHover={{ scale: disabled ? 1 : 1.02 }}
    whileTap={{ scale: disabled ? 1 : 0.97 }}
    onClick={onClick}
    disabled={disabled}
    className={cn('transition-colors', disabled && 'opacity-50 cursor-not-allowed', className)}
    {...props}
  >
    {children}
  </motion.button>
);

/* ---------------------------------------------------------------- *
 *  Controles de formulario
 * ---------------------------------------------------------------- */

/** Interruptor accesible. Sustituye a los checkbox sueltos. */
// Medidas del UISwitch nativo: 51×31pt con pomo de 27pt. Cualquier otra
// proporción se nota inmediatamente al lado de un ajuste del sistema.
export const Toggle = ({ checked, onChange, label, hint, disabled = false, className = '' }) => (
  <label className={cn('flex items-center justify-between gap-4 cursor-pointer min-h-tap', disabled && 'opacity-50 cursor-not-allowed', className)}>
    {(label || hint) && (
      <span className="min-w-0">
        {label && <span className="block text-body text-ink">{label}</span>}
        {hint && <span className="block text-footnote text-ink-3 mt-0.5">{hint}</span>}
      </span>
    )}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
          'relative shrink-0 w-[3.1875rem] h-[1.9375rem] rounded-full transition-colors duration-300',
          checked ? 'bg-positive' : 'bg-surface-3'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 40 }}
        className={cn(
            'absolute top-[0.125rem] w-[1.6875rem] h-[1.6875rem] rounded-full bg-white',
            'shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)]',
            checked ? 'left-[1.375rem]' : 'left-[0.125rem]'
        )}
      />
    </button>
  </label>
);

/** Control segmentado: para 2-4 opciones excluyentes (mejor que un select). */
// UISegmentedControl: 32pt de alto, fondo hundido, píldora blanca deslizante y
// texto de 13pt. Ocupa todo el ancho disponible, como en iOS.
export const Segmented = ({ value, onChange, options = [], className = '', size = 'md' }) => {
  const box = size === 'sm' ? 'h-8 p-[0.125rem]' : 'h-[2.25rem] p-[0.1875rem]';
  const item = size === 'sm' ? 'text-caption1 px-2.5' : 'text-footnote px-3';
  return (
    <div className={cn('inline-flex bg-surface-2 rounded-field w-full', box, className)}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
                'relative flex-1 inline-flex items-center justify-center gap-1.5 rounded-[0.4375rem] whitespace-nowrap',
                // El control mide 32pt como en iOS, pero la zona de toque llega
                // a 44pt vía pseudo-elemento: se cumple la HIG sin engordarlo.
                'transition-colors duration-200 tap-target',
                item,
                active ? 'text-ink font-semibold' : 'text-ink-2 font-medium active:opacity-60'
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map(x => x.value).join('-')}`}
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                className="absolute inset-0 bg-surface rounded-[0.4375rem] shadow-[0_3px_8px_rgb(0_0_0/0.12),0_1px_1px_rgb(0_0_0/0.04)]"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {o.icon && <o.icon size={size === 'sm' ? 13 : 15} strokeWidth={2} />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/** Campo de texto con icono opcional, estilo unificado. */
export const Input = React.forwardRef(({ icon: Icon, className = '', wrapperClassName = '', ...props }, ref) => (
  <div className={cn(
      'flex items-center gap-2 bg-surface-2 rounded-field px-3 h-11',
      'transition-colors duration-150',
      'focus-within:bg-surface-3',
      wrapperClassName
  )}>
    {Icon && <Icon size={17} className="text-ink-3 shrink-0" strokeWidth={2} />}
    <input
      ref={ref}
      className={cn(
          'bg-transparent w-full outline-none text-body text-ink',
          'placeholder:text-ink-3',
          className
      )}
      {...props}
    />
  </div>
));
Input.displayName = 'Input';

/* ---------------------------------------------------------------- *
 *  Presentación de datos
 * ---------------------------------------------------------------- */
export const Badge = ({ children, tone = 'neutral', className = '' }) => {
  const tones = {
    neutral: 'bg-surface-2 text-ink-2 border-line',
    brand: 'bg-brand-soft text-brand-ink border-transparent',
    positive: 'bg-positive-soft text-positive border-transparent',
    negative: 'bg-negative-soft text-negative border-transparent',
    warning: 'bg-warning-soft text-warning border-transparent',
  };
  return (
    <span className={cn(
        'inline-flex items-center gap-1 px-2 py-[0.1875rem] rounded-full border',
        'text-caption1 font-semibold whitespace-nowrap',
        tones[tone], className
    )}>
      {children}
    </span>
  );
};

/** Tarjeta de métrica: etiqueta, cifra grande y detalle opcional. */
export const StatTile = ({ label, value, sub, tone = 'default', icon: Icon, className = '' }) => {
  const valueTone = {
    default: 'text-ink',
    positive: 'text-positive',
    negative: 'text-negative',
    brand: 'text-brand',
  }[tone];
  return (
    <Card className={cn('!p-3.5 md:!p-4', className)}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-footnote text-ink-2 truncate">{label}</span>
        {Icon && <Icon size={15} className="text-ink-3 shrink-0" strokeWidth={2} />}
      </div>
      <div className={cn('text-title2 font-semibold tracking-tight tabular-nums truncate', valueTone)}>
        {value}
      </div>
      {sub && <div className="text-caption1 text-ink-3 mt-0.5 truncate">{sub}</div>}
    </Card>
  );
};

// Mapa explícito: Tailwind purga por coincidencia literal, así que una clase
// construida como `bg-viz-${tone}` no llegaría al CSS final.
export const VIZ_BG = {
  1: 'bg-viz-1', 2: 'bg-viz-2', 3: 'bg-viz-3',
  4: 'bg-viz-4', 5: 'bg-viz-5', 6: 'bg-viz-6',
};
export const VIZ_TEXT = {
  1: 'text-viz-1', 2: 'text-viz-2', 3: 'text-viz-3',
  4: 'text-viz-4', 5: 'text-viz-5', 6: 'text-viz-6',
};

/** Barra de proporción con paleta categórica. */
export const ProgressBar = ({ pct = 0, tone = 1, className = '', height = 'h-2' }) => (
  <div className={cn('rounded-full bg-surface-3 overflow-hidden', height, className)}>
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn('h-full rounded-full', VIZ_BG[tone] || VIZ_BG[1])}
    />
  </div>
);

export const Skeleton = ({ className = '' }) => (
  <div className={cn('relative overflow-hidden bg-surface-2 rounded-lg', className)}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-black/[0.04] dark:via-white/[0.06] to-transparent" />
  </div>
);

export const EmptyState = ({ icon: Icon, title, hint, action, className = '' }) => (
  <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
    {Icon && <Icon size={40} className="text-ink-3 mb-3.5" strokeWidth={1.5} />}
    <p className="text-headline font-semibold text-ink">{title}</p>
    {hint && <p className="text-subhead text-ink-2 mt-1.5 max-w-[17rem] leading-snug">{hint}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/* ---------------------------------------------------------------- *
 *  Contador animado
 * ---------------------------------------------------------------- */
export const CountUp = ({ value, prefix = '', suffix = '', decimals = 0, duration = 700 }) => {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const end = parseFloat(value) || 0;
    const start = fromRef.current;
    if (start === end) { setDisplay(end); return; }

    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      // easeOutCubic: arranca rápido y frena, que es como se lee mejor una cifra.
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (end - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {prefix}
      {display.toLocaleString('es-ES', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};
