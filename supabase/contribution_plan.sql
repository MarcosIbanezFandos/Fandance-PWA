-- Plan de aportaciones periódicas.
--
-- Sólo guarda la intención: cuánto se aporta al mes y con qué subida anual.
-- Si un mes se ha cumplido NO se guarda aquí — se deduce de rebalance_history,
-- que ya registra lo aportado realmente. Duplicar ese dato sólo crearía dos
-- fuentes de verdad que acabarían discrepando.
--
-- Ejecutar en el SQL editor de Supabase.

alter table public.portfolios
  add column if not exists plan_monthly     numeric(14,2) default 0,
  add column if not exists plan_growth_pct  numeric(6,2)  default 0,
  add column if not exists plan_start       date;

comment on column public.portfolios.plan_monthly    is 'Aportación mensual base del plan, en EUR. 0 = plan desactivado.';
comment on column public.portfolios.plan_growth_pct is 'Subida anual del plan en %, repartida de forma compuesta mes a mes.';
comment on column public.portfolios.plan_start      is 'Primer mes del plan; antes de esta fecha no se exige aportación.';

-- Las políticas RLS existentes de `portfolios` ya cubren estas columnas: se
-- filtran por user_id a nivel de fila, no de columna.
