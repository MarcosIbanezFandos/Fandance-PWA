-- ============================================================
-- Rebalancer (FANDANCE) — esquema 'fandance' en el Supabase de FANDiOS.
-- Copia de referencia de la migración `create_fandance_schema` (aplicada el
-- 2026-08-30 al fusionar los dos proyectos). Réplica fiel del esquema public
-- del antiguo proyecto rozjdmysesczntcdseho + el rate limiting de su
-- supabase/rate_limits.sql (que allí nunca llegó a aplicarse).
--
-- Acceso: SOLO service_role (el backend FastAPI de api/index.py). El frontend
-- usa únicamente Auth, así que anon/authenticated no tienen grants aquí.
-- Requiere además añadir 'fandance' a "Exposed schemas" en
-- Dashboard > Settings > API para que PostgREST (supabase-py) lo sirva.
-- ============================================================

create schema if not exists fandance;

create table fandance.portfolios (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null,
  name              text not null,
  description       text,
  last_contribution double precision default 1000,
  created_at        timestamptz default now()
);

create table fandance.assets (
  id         uuid primary key default gen_random_uuid(),
  ticker     text not null,
  name       text,
  type       text,
  sector     text,
  country    text,
  currency   text,
  created_at timestamptz default now()
);
create unique index assets_ticker_unique_idx on fandance.assets (ticker);

create table fandance.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid references fandance.portfolios(id) on delete cascade,
  asset_id      uuid references fandance.assets(id) on delete cascade,
  units_held    double precision default 0,
  target_weight double precision default 0,
  updated_at    timestamptz default now()
);

create table fandance.rebalance_history (
  id                 uuid primary key default gen_random_uuid(),
  portfolio_id       uuid references fandance.portfolios(id) on delete cascade,
  contribution       double precision,
  total_value_before double precision,
  total_value_after  double precision,
  created_at         timestamptz default now()
);

create table fandance.rebalance_history_items (
  id         uuid primary key default gen_random_uuid(),
  history_id uuid references fandance.rebalance_history(id) on delete cascade,
  asset_name text,
  ticker     text,
  action     text,
  units      double precision,
  amount     double precision,
  price      double precision
);

-- Rate limiting: el contador vive en Postgres a propósito — en serverless cada
-- petición puede caer en una instancia distinta y la memoria no limita nada.
create table fandance.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);

create or replace function fandance.check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = fandance
as $$
declare
  v_now     timestamptz := now();
  v_expired timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count   integer;
begin
  insert into fandance.rate_limits as r (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set count = case when r.window_start < v_expired then 1 else r.count + 1 end,
        window_start = case when r.window_start < v_expired then v_now else r.window_start end
  returning r.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- RLS activo en todo el esquema. service_role tiene BYPASSRLS en Supabase; las
-- policies explícitas documentan la intención, igual que en el proyecto origen.
alter table fandance.portfolios              enable row level security;
alter table fandance.assets                  enable row level security;
alter table fandance.portfolio_items         enable row level security;
alter table fandance.rebalance_history       enable row level security;
alter table fandance.rebalance_history_items enable row level security;
alter table fandance.rate_limits             enable row level security;

create policy "Service role full access"       on fandance.portfolios              for all to service_role using (true) with check (true);
create policy "Service role full access"       on fandance.assets                  for all to service_role using (true) with check (true);
create policy "Service role full access"       on fandance.portfolio_items         for all to service_role using (true) with check (true);
create policy "Service role full access"       on fandance.rebalance_history       for all to service_role using (true) with check (true);
create policy "Service role full access"       on fandance.rebalance_history_items for all to service_role using (true) with check (true);
-- rate_limits: RLS sin policies para roles de API = solo service_role (bypass).

-- Mínimo privilegio: solo el backend toca este esquema.
grant usage on schema fandance to service_role;
grant all on all tables in schema fandance to service_role;
alter default privileges in schema fandance grant all on tables to service_role;
revoke all on function fandance.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function fandance.check_rate_limit(text, integer, integer) to service_role;

-- Si algún día el frontend consultara estas tablas directamente con supabase-js,
-- habría que añadir grants a authenticated y replicar las policies del proyecto
-- original: portfolios/items con auth.uid() = user_id (directo o vía subselect),
-- assets de solo lectura, history de solo lectura vía cadena de ownership.
