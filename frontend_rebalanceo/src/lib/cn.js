import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases condicionales resolviendo conflictos de Tailwind (la última gana). */
export const cn = (...inputs) => twMerge(clsx(inputs));
