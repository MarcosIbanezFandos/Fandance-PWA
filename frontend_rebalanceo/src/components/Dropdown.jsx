import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Select propio del sistema de diseño.
 * props: value, onChange(value), options: [{value, label, hint?}], icon?, label?
 *
 * Navegable por teclado (flechas, Home/End, Enter, Esc) y anunciado como
 * listbox: el <select> nativo no se puede estilar de forma consistente entre
 * navegadores, pero eso no es motivo para perder su comportamiento.
 */
export const Dropdown = ({
    value, onChange, options = [], icon: Icon,
    className = '', placeholder = '—', align = 'left', size = 'md', label,
}) => {
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const ref = useRef(null);
    const listRef = useRef(null);
    const selectedIdx = options.findIndex(o => o.value === value);
    const selected = selectedIdx >= 0 ? options[selectedIdx] : null;

    useEffect(() => {
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    useEffect(() => { if (open) setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0); }, [open, selectedIdx]);

    // Mantener a la vista la opción recorrida con el teclado.
    useEffect(() => {
        if (!open || activeIdx < 0 || !listRef.current) return;
        listRef.current.querySelectorAll('[role="option"]')[activeIdx]?.scrollIntoView({ block: 'nearest' });
    }, [activeIdx, open]);

    const commit = useCallback((idx) => {
        const o = options[idx];
        if (!o) return;
        onChange(o.value);
        setOpen(false);
    }, [options, onChange]);

    const onKeyDown = (e) => {
        if (!open) {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); }
            return;
        }
        switch (e.key) {
            case 'Escape': e.preventDefault(); setOpen(false); break;
            case 'ArrowDown': e.preventDefault(); setActiveIdx(i => Math.min(options.length - 1, i + 1)); break;
            case 'ArrowUp': e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); break;
            case 'Home': e.preventDefault(); setActiveIdx(0); break;
            case 'End': e.preventDefault(); setActiveIdx(options.length - 1); break;
            case 'Enter': case ' ': e.preventDefault(); commit(activeIdx); break;
            default: break;
        }
    };

    const heights = { sm: 'h-9 px-3 text-footnote', md: 'h-11 px-3.5 text-body' };

    return (
        <div className={cn('relative', className)} ref={ref}>
            {label && <span className="label-caps block mb-1.5">{label}</span>}
            <button
                type="button"
                role="combobox"
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={() => setOpen(o => !o)}
                onKeyDown={onKeyDown}
                className={cn(
                    'w-full flex items-center justify-between gap-2 rounded-control font-semibold',
                    'bg-surface-2 text-ink',
                    'transition-all duration-150',
                    'active:bg-surface-3',
                    open && 'bg-surface-3',
                    heights[size]
                )}
            >
                <span className="flex items-center gap-2 min-w-0">
                    {Icon && <Icon size={size === 'sm' ? 14 : 16} className="text-ink-3 shrink-0" strokeWidth={2.25} />}
                    <span className={cn('truncate', !selected && 'text-ink-3 font-medium')}>
                        {selected ? selected.label : placeholder}
                    </span>
                </span>
                <ChevronDown
                    size={size === 'sm' ? 14 : 16}
                    className={cn('text-ink-3 shrink-0 transition-transform duration-200', open && 'rotate-180')}
                />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={listRef}
                        role="listbox"
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                        className={cn(
                            'absolute z-[80] mt-2 min-w-full w-max max-w-[min(20rem,80vw)]',
                            'bg-surface rounded-card shadow-pop',
                            'overflow-y-auto max-h-72 p-1 custom-scrollbar',
                            align === 'right' ? 'right-0' : 'left-0'
                        )}
                    >
                        {options.length === 0 && (
                            <div className="px-3 py-6 text-center text-footnote font-medium text-ink-3">Sin opciones</div>
                        )}
                        {options.map((o, i) => {
                            const active = o.value === value;
                            const highlighted = i === activeIdx;
                            return (
                                <button
                                    key={o.value}
                                    role="option"
                                    aria-selected={active}
                                    onClick={() => commit(i)}
                                    onMouseEnter={() => setActiveIdx(i)}
                                    className={cn(
                                        'w-full text-left px-3 min-h-tap rounded-[0.5rem] flex items-center justify-between gap-3',
                                        'transition-colors duration-100',
                                        highlighted && !active && 'bg-surface-2',
                                        active && 'bg-brand-soft'
                                    )}
                                >
                                    <span className="min-w-0">
                                        <span className={cn(
                                            'block text-body truncate',
                                            active ? 'text-brand-ink' : 'text-ink'
                                            )}>{o.label}</span>
                                        {o.hint && <span className="block text-caption2 font-medium text-ink-3 truncate mt-0.5">{o.hint}</span>}
                                    </span>
                                    {active && <Check size={15} className="text-brand shrink-0" strokeWidth={2.5} />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
