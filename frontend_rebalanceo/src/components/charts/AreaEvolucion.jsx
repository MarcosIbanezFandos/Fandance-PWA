import React from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { formatNumber } from '../../utils';

/**
 * Evolución del valor de la cartera.
 *
 * Vive en su propio fichero para poder cargarse aparte: recharts pesa más que
 * todo el código de la app junta, y esperarlo antes de pintar la pantalla de
 * inicio es lo que hacía que arrancar se notara lento.
 */
export const AreaEvolucion = ({ data = [], positive = true, etiquetaValor = 'Valor' }) => (
    <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
                <linearGradient id="homeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`rgb(var(${positive ? '--c-positive' : '--c-negative'}))`} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={`rgb(var(${positive ? '--c-positive' : '--c-negative'}))`} stopOpacity={0} />
                </linearGradient>
            </defs>
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip
                contentStyle={{
                    borderRadius: '12px', border: '1px solid rgb(var(--c-line))',
                    background: 'rgb(var(--c-surface))', padding: '8px 10px',
                    boxShadow: '0 8px 24px -12px rgb(15 23 42 / .25)',
                }}
                labelStyle={{ fontSize: '11px', color: 'rgb(var(--c-ink-3))', fontWeight: 600 }}
                itemStyle={{ fontSize: '13px', color: 'rgb(var(--c-ink))', fontWeight: 700, padding: 0 }}
                formatter={(v) => [`${formatNumber(v)} €`, etiquetaValor]}
                labelFormatter={(l, p) => p?.[0]?.payload?.full || l}
            />
            <Area
                type="monotone" dataKey="value"
                stroke={`rgb(var(${positive ? '--c-positive' : '--c-negative'}))`}
                strokeWidth={2} fill="url(#homeGrad)"
            />
        </AreaChart>
    </ResponsiveContainer>
);
