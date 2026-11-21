-- Fandance · el vistazo de la cartera (contrato FANDOS, ver docs/conexiones.md).
--
-- Una fila por usuario con el último resumen que calculó la app en el navegador:
-- cifras agregadas (valor, coste, plusvalía estimada, pesos por posición) y avisos.
-- Nunca los movimientos del CSV, que siguen solo en el navegador.
--
-- La escribe y la lee la API de Fandance (service_role, POST/GET /api/fandos/vistazo)
-- y la lee FanWork a través de fanwork.fandance_vistazo(), que exige su propia clave.
-- Como el resto del esquema fandance: RLS activo y sin permisos para anon/authenticated.
-- Se puede aplicar más de una vez.

create table if not exists fandance.vistazos (
  user_id uuid primary key references auth.users (id) on delete cascade,
  datos jsonb not null,
  actualizado timestamptz not null default now(),
  constraint vistazos_datos_acotados check (pg_column_size(datos) < 32768)
);

alter table fandance.vistazos enable row level security;
revoke all on table fandance.vistazos from anon, authenticated;
grant select, insert, update, delete on table fandance.vistazos to service_role;

-- La misma política que el resto de tablas de fandance (service_role ya se salta RLS;
-- queda explícito quién entra y el linter de Supabase no la marca como «sin políticas»).
drop policy if exists "Service role full access" on fandance.vistazos;
create policy "Service role full access" on fandance.vistazos
  for all to service_role using (true) with check (true);

comment on table fandance.vistazos is
  'Contrato FANDOS: último vistazo de la cartera por usuario (cifras agregadas, sin movimientos). Lo escribe la API de Fandance; lo lee FanWork vía fanwork.fandance_vistazo().';
