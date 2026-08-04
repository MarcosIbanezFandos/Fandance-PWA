import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ChevronDown } from 'lucide-react';
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
    {/* Los botones de icono también pintan sus hijos: descartarlos dejaba
        mudos los que pasan el icono como hijo en vez de por la prop. */}
    {children}
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
    <div className={cn('flex min-w-0 bg-surface-2 rounded-field w-full', box, className)}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
                // min-w-0 es lo que permite que los botones bajen del ancho de
                // su texto; sin él, cuatro etiquetas largas desbordan la fila.
                'relative flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-[0.4375rem]',
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
            <span className="relative flex items-center gap-1.5 min-w-0">
              {o.icon && <o.icon size={size === 'sm' ? 13 : 15} strokeWidth={2} className="shrink-0" />}
              <span className="truncate">{o.label}</span>
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

/**
 * Campo numérico para importes y porcentajes.
 *
 * Un `<input type=number>` suelto trae de serie las flechitas del navegador, un
 * teclado alfabético en el móvil y ninguna pista de la unidad. Aquí: teclado
 * decimal, unidad visible, cifra grande y tabular, y selección al enfocar para
 * poder sobrescribir de un toque en vez de borrar dígito a dígito.
 */
export const NumericField = React.forwardRef(({
  label, hint, unit, value, onChange, placeholder,
  disabled = false, className = '', align = 'left', ...rest
}, ref) => {
  // Se guarda el texto tal cual lo escribe el usuario, no el número. Si el
  // valor viviera sólo como número, "1," se convertiría en 1 en cuanto se
  // teclea la coma y sería imposible escribir decimales.
  const asText = (v) =>
    v === null || v === undefined || v === '' || Number(v) === 0 ? '' : String(v).replace('.', ',');

  const [text, setText] = useState(() => asText(value));

  // Sólo se re-sincroniza cuando el valor de fuera difiere de verdad; si no,
  // cada render devolvería el cursor al final al escribir.
  useEffect(() => {
    const num = (t) => parseFloat(String(t).replace(',', '.'));
    const a = num(text), b = num(value);
    const bothEmpty = text === '' && (value === '' || value === null || value === undefined || Number(value) === 0);
    if (!bothEmpty && !(Number.isFinite(a) && Number.isFinite(b) && a === b)) setText(asText(value));
  }, [value]);

  const handle = (raw) => {
    // Sólo dígitos y un separador decimal.
    let v = raw.replace(/[^\d.,]/g, '').replace(/[.,]/, '§').replace(/[.,]/g, '').replace('§', ',');
    // El cero a la izquierda es el que se quedaba pegado: al venir el campo con
    // un 0 inicial, teclear "300" dejaba "0300" y no había forma de borrarlo
    // salvo seleccionando todo. Se elimina salvo en "0,algo".
    v = v.replace(/^0+(?=\d)/, '');
    setText(v);
    onChange(v === '' ? '' : v.replace(',', '.'));
  };

  return (
    <label className={cn('block', className)}>
      {label && <span className="block text-footnote text-ink-2 mb-1.5">{label}</span>}
      <span className={cn(
          'flex items-center gap-2 h-12 px-3.5 rounded-field bg-surface-2',
          'transition-colors duration-150 focus-within:bg-surface-3',
          disabled && 'opacity-50'
      )}>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={(e) => e.target.select()}
          onChange={(e) => handle(e.target.value)}
          // Enter cierra el teclado en lugar de enviar el formulario que lo
          // contenga, que es lo que dejaba la vista a medio recolocar.
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
          className={cn(
              'w-full h-full bg-transparent outline-none border-0 p-0',
              'text-title3 font-semibold tabular-nums text-ink',
              'placeholder:text-ink-3 placeholder:font-normal',
              align === 'right' && 'text-right'
          )}
          {...rest}
        />
        {unit && <span className="text-title3 font-medium text-ink-3 shrink-0 select-none">{unit}</span>}
      </span>
      {hint && <span className="block text-caption1 text-ink-3 mt-1.5">{hint}</span>}
    </label>
  );
});
NumericField.displayName = 'NumericField';

/* ---------------------------------------------------------------- *
 *  Presentación de datos
 * ---------------------------------------------------------------- */

/**
 * Slider de rango con la lectura encima.
 *
 * El `<input type=range>` a pelo sólo dice una posición; lo que interesa aquí
 * es a qué equivale esa posición —qué año, qué fecha—, así que el valor
 * traducido va grande y arriba. La marca opcional señala un punto de
 * referencia sobre la pista (por ejemplo, la fecha objetivo del plan).
 */
export const Slider = ({
  value, onChange, min = 0, max = 100, step = 1,
  label, valueLabel, subLabel, marca = null, marcaTitulo = '', className = '',
}) => {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  // La marca se esconde cuando el pulgar ya está encima: dibujarla ahí sólo
  // añade una raya dentro del círculo blanco y no informa de nada nuevo.
  const cerca = marca != null && Math.abs(marca - value) <= (max - min) * 0.02;
  const pctMarca = marca != null && max > min && !cerca
    ? Math.min(100, Math.max(0, ((marca - min) / (max - min)) * 100))
    : null;

  return (
    <div className={className}>
      <div className="flex justify-between items-baseline mb-1.5 gap-3">
        <span className="text-subhead text-ink">{label}</span>
        <span className="text-title3 font-semibold text-brand tabular-nums">{valueLabel}</span>
      </div>

      <div className="relative">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-app relative z-0"
          style={{ '--relleno': `${pct}%` }}
          aria-label={label}
        />
        {pctMarca != null && (
          // Va por encima de la pista —que es opaca y la taparía— pero sin
          // capturar toques: es una referencia, no un control.
          <span
            className="absolute z-10 top-[11px] w-0.5 h-1.5 rounded-full bg-ink-3 pointer-events-none"
            style={{ left: `calc(${pctMarca}% + ${(50 - pctMarca) * 0.28}px)` }}
            title={marcaTitulo}
          />
        )}
      </div>

      {subLabel && <div className="text-caption1 text-ink-3 mt-0.5">{subLabel}</div>}
    </div>
  );
};

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
  <div className={cn('relative overflow-hidden bg-surface-2 rounded-field', className)}>
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

/**
 * Detalle plegable. Para notas y advertencias que importan pero que no deben
 * ocupar sitio hasta que alguien pregunte: una explicación siempre desplegada
 * se convierte en ruido y deja de leerse.
 */
export const Disclosure = ({ icon: Icon, title, children, tone = 'neutral', defaultOpen = false, className = '' }) => {
  const [open, setOpen] = useState(defaultOpen);
  const tones = {
    neutral: 'text-ink-2',
    warning: 'text-warning',
    brand: 'text-brand',
  };
  return (
    <div className={cn('rounded-card bg-surface-2', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 min-h-tap text-left active:opacity-60 transition-opacity"
      >
        {Icon && <Icon size={16} className={cn('shrink-0', tones[tone])} strokeWidth={2} />}
        <span className={cn('flex-1 text-footnote font-medium truncate', tones[tone])}>{title}</span>
        <ChevronDown size={16} className={cn('text-ink-3 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3.5 text-footnote text-ink-2 leading-relaxed">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
