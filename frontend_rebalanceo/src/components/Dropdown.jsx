import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Custom themed select — consistent with the app (rounded, dark-aware, animated).
 * props: value, onChange(value), options: [{value, label, hint?}], icon?, className?, placeholder?
 */
export const Dropdown = ({ value, onChange, options = [], icon: Icon, className = '', placeholder = '—', align = 'left' }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = options.find(o => o.value === value);

    useEffect(() => {
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    return (
        <div className={`relative ${className}`} ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 text-sm font-bold rounded-xl px-4 py-2.5 outline-none hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
            >
                <span className="flex items-center gap-2 min-w-0">
                    {Icon && <Icon size={16} className="text-slate-400 shrink-0" />}
                    <span className="truncate">{selected ? selected.label : placeholder}</span>
                </span>
                <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.12 }}
                        className={`absolute z-[80] mt-2 min-w-full w-max max-w-[280px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden py-1.5 max-h-72 overflow-y-auto custom-scrollbar ${align === 'right' ? 'right-0' : 'left-0'}`}
                    >
                        {options.map(o => {
                            const active = o.value === value;
                            return (
                                <button
                                    key={o.value}
                                    onClick={() => { onChange(o.value); setOpen(false); }}
                                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                >
                                    <span className="min-w-0">
                                        <span className={`block text-sm font-bold truncate ${active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>{o.label}</span>
                                        {o.hint && <span className="block text-[10px] font-bold text-slate-400 truncate">{o.hint}</span>}
                                    </span>
                                    {active && <Check size={15} className="text-indigo-500 shrink-0" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
