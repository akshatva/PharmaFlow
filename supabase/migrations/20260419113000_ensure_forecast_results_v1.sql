begin;

create table if not exists public.forecast_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  model_name text not null,
  forecast_7d numeric not null check (forecast_7d >= 0),
  forecast_30d numeric not null check (forecast_30d >= 0),
  daily_demand_avg numeric not null check (daily_demand_avg >= 0),
  confidence_level text,
  error_metric_name text,
  error_metric_value numeric,
  history_days_used integer,
  generated_at timestamptz not null default now()
);

alter table public.forecast_results
  add column if not exists model_name text,
  add column if not exists forecast_7d numeric,
  add column if not exists forecast_30d numeric,
  add column if not exists daily_demand_avg numeric,
  add column if not exists confidence_level text,
  add column if not exists error_metric_name text,
  add column if not exists error_metric_value numeric,
  add column if not exists history_days_used integer,
  add column if not exists generated_at timestamptz default now();

update public.forecast_results
set
  model_name = coalesce(model_name, 'unknown'),
  forecast_7d = coalesce(forecast_7d, 0),
  forecast_30d = coalesce(forecast_30d, 0),
  daily_demand_avg = coalesce(daily_demand_avg, 0),
  generated_at = coalesce(generated_at, now())
where
  model_name is null
  or forecast_7d is null
  or forecast_30d is null
  or daily_demand_avg is null
  or generated_at is null;

alter table public.forecast_results
  alter column model_name set not null,
  alter column forecast_7d set not null,
  alter column forecast_30d set not null,
  alter column daily_demand_avg set not null,
  alter column generated_at set not null;

with ranked_forecasts as (
  select
    id,
    row_number() over (
      partition by organization_id, medicine_id
      order by generated_at desc, id desc
    ) as row_rank
  from public.forecast_results
)
delete from public.forecast_results
where id in (
  select id
  from ranked_forecasts
  where row_rank > 1
);

alter table public.forecast_results
  drop constraint if exists forecast_results_organization_id_medicine_id_model_name_key;

alter table public.forecast_results
  drop constraint if exists forecast_results_organization_id_medicine_id_key;

alter table public.forecast_results
  add constraint forecast_results_organization_id_medicine_id_key
  unique (organization_id, medicine_id);

create index if not exists forecast_results_organization_id_generated_at_idx
  on public.forecast_results (organization_id, generated_at desc);

create index if not exists forecast_results_organization_id_medicine_id_idx
  on public.forecast_results (organization_id, medicine_id);

create index if not exists forecast_results_organization_id_model_name_idx
  on public.forecast_results (organization_id, model_name);

create index if not exists forecast_results_organization_id_confidence_level_idx
  on public.forecast_results (organization_id, confidence_level);

alter table public.forecast_results enable row level security;

drop policy if exists "forecast_results_select_member" on public.forecast_results;
drop policy if exists "forecast_results_insert_member" on public.forecast_results;
drop policy if exists "forecast_results_update_member" on public.forecast_results;
drop policy if exists "forecast_results_delete_member" on public.forecast_results;

create policy "forecast_results_select_member"
on public.forecast_results
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = forecast_results.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "forecast_results_insert_member"
on public.forecast_results
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = forecast_results.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "forecast_results_update_member"
on public.forecast_results
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = forecast_results.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = forecast_results.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "forecast_results_delete_member"
on public.forecast_results
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = forecast_results.organization_id
      and om.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
