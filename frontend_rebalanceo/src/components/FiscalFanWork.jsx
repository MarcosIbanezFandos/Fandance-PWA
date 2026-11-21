import React, { useEffect, useState } from 'react';
import { Landmark, ArrowUpRight } from 'lucide-react';
import { Card } from './UI';
import { cn } from '../lib/cn';

/**
 * La fiscalidad de la cartera, según FanWork (contrato FANDOS, ver docs/conexiones.md).
 *
 * Fandance sabe qué tienes; FanWork sabe qué hacer con Hacienda: el Freistellungsauftrag,
 * la cosecha fiscal de diciembre, la Vorabpauschale de enero. Esta tarjeta enseña lo
 * próximo de su área de Inversiones y manda allí para resolverlo: aquí no se edita nada.
 *
 * Lo pide el navegador a FanWork en el mismo dominio, con la sesión de FanWork que ya
 * tengas. Sin sesión (o fuera de fandos.vercel.app) no pinta nada.
 */
const URL_VISTAZO = '/fanwork/api/fandos/vistazo?area=inversiones';

// Solo enlaces de FanWork: lo que llega de otra app no puede colar otro destino.
const enlaceFanWork = (href) =>
    typeof href === 'string' && /^\/fanwork(\/|\?|$)/.test(href) && !href.includes('..') && !href.includes('\\') ? href : null;

const texto = (v, max = 180) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export const FiscalFanWork = () => {
    const [v, setV] = useState(null);

    useEffect(() => {
        const ctrl = new AbortController();
        fetch(URL_VISTAZO, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: ctrl.signal, headers: { Accept: 'application/json' } })
            .then(r => (r.ok && (r.headers.get('content-type') || '').includes('application/json') ? r.json() : null))
            .then(json => {
                if (!json || json.v !== 1 || json.app !== 'fanwork') return;
                const avisos = (Array.isArray(json.avisos) ? json.avisos : [])
                    .map(a => ({ texto: texto(a?.texto), href: enlaceFanWork(a?.href), nivel: a?.nivel }))
                    .filter(a => a.texto && a.href)
                    .slice(0, 3);
                setV({
                    titular: texto(json.titular, 160),
                    detalle: texto(json.detalle),
                    href: enlaceFanWork(json.href) || '/fanwork/inversiones',
                    area: enlaceFanWork(json.area?.href) || '/fanwork/inversiones',
                    tono: json.tono,
                    avisos,
                });
            })
            .catch(() => {});
        return () => ctrl.abort();
    }, []);

    if (!v?.titular) return null;
    const urgente = v.tono === 'urgente' || v.tono === 'aviso';
    return (
        <Card className={cn('!p-4 flex items-start gap-3.5', urgente && '!border-warning/30')}>
            <span className={cn(
                'w-9 h-9 rounded-control flex items-center justify-center shrink-0',
                urgente ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-ink-2'
            )}>
                <Landmark size={17} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
                <div className="label-caps">Impuestos de tu cartera · FanWork</div>
                <a href={v.href} className="block text-subhead font-semibold text-ink mt-1 hover:underline underline-offset-2">
                    {v.titular}
                </a>
                {v.detalle && <p className="text-footnote font-medium text-ink-2 mt-0.5 leading-relaxed">{v.detalle}</p>}
                {v.avisos.length > 0 && (
                    <ul className="mt-2 space-y-1">
                        {v.avisos.map(a => (
                            <li key={a.href + a.texto}>
                                <a href={a.href} className="text-footnote font-medium text-ink-2 hover:text-ink">· {a.texto}</a>
                            </li>
                        ))}
                    </ul>
                )}
                <a href={v.area} className="inline-flex items-center gap-1 text-footnote font-bold text-brand mt-2">
                    Ver Inversiones en FanWork <ArrowUpRight size={13} />
                </a>
            </div>
        </Card>
    );
};
