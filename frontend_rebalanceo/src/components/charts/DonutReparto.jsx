import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber } from '../../utils';

/** Semicírculo del reparto de la cartera. Aparte para no arrastrar recharts al arranque. */
export const DonutReparto = ({ data = [] }) => (
    <ResponsiveContainer width="100%" height="100%">
        <PieChart>
            <Pie
                data={data}
                cx="50%" cy="100%"
                startAngle={180} endAngle={0}
                innerRadius={104} outerRadius={140}
                paddingAngle={2} dataKey="value" stroke="none" cornerRadius={4}
            >
                {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Pie>
            <Tooltip
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.2)', fontWeight: 'bold', background: '#0f172a', color: '#fff' }}
                itemStyle={{ color: '#fff', fontSize: '13px' }}
                labelStyle={{ display: 'none' }}
                formatter={(val, name) => [`${formatNumber(val)} €`, name]}
            />
        </PieChart>
    </ResponsiveContainer>
);
