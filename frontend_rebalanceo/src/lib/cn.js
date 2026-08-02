import clsx from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge resuelve conflictos agrupando clases por familia, pero sólo
 * conoce la escala por defecto. Con nombres propios no sabe si `text-title3` es
 * un tamaño o un color, asume color, y al encontrar `text-ink` en la misma
 * llamada se queda con el último: el tamaño desaparecía sin avisar.
 *
 * Declarando las dos escalas, cada clase vuelve a su grupo y dejan de pisarse.
 */
const FONT_SIZES = [
  'caption2', 'caption1', 'footnote', 'subhead', 'callout',
  'body', 'title3', 'title2', 'title1', 'largetitle', 'label', 'micro',
];

const TEXT_COLORS = [
  'ink', 'ink-2', 'ink-3',
  'brand', 'brand-soft', 'brand-ink',
  'positive', 'positive-soft', 'negative', 'negative-soft',
  'warning', 'warning-soft',
  'canvas', 'surface', 'surface-2', 'surface-3', 'line', 'line-strong',
  'viz-1', 'viz-2', 'viz-3', 'viz-4', 'viz-5', 'viz-6',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
      'text-color': [{ text: TEXT_COLORS }],
    },
  },
});

/** Une clases condicionales resolviendo conflictos de Tailwind (la última gana). */
export const cn = (...inputs) => twMerge(clsx(inputs));
