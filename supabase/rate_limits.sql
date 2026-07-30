-- Fandance — Rate limiting.
--
-- Ejecutar una vez en el SQL Editor de Supabase.
--
-- El contador vive en Postgres y no en memoria del proceso a propósito: en
-- serverless (Vercel) cada petición puede caer en una instancia distinta, así
-- que un diccionario en memoria no limitaría nada — bastaría con repetir la
-- petición hasta que te toque una instancia fría.

create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);

-- Solo la service_role (el backend) toca esta tabla. RLS activo y sin
-- políticas = nadie más puede leerla ni escribirla, ni siquiera autenticado.
alter table public.rate_limits enable row level security;

-- Incremento atómico: devuelve true si la petición entra dentro del límite.
-- Al hacerlo en una sola sentencia evitamos la condición de carrera del
-- patrón leer-comprobar-escribir con peticiones concurrentes.
create or replace function public.check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now     timestamptz := now();
  v_expired timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count   integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case when r.window_start < v_expired then 1 else r.count + 1 end,
        window_start = case when r.window_start < v_expired then v_now else r.window_start end
  returning r.count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;

-- Limpieza de ventanas viejas (opcional: programar con pg_cron).
-- delete from public.rate_limits where window_start < now() - interval '1 day';
