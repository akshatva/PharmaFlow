create table if not exists public.forecast_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  model_name text not null,
  forecast_7d numeric not null check (forecast_7d >= 0),
  forecast_30d numeric not null check (forecast_30d >= 0),
  daily_demand_avg numeric not null check (daily_demand_avg >= 0),
  confidence_level text,
  generated_at timestamptz not null default now(),
  unique (organization_id, medicine_id, model_name)
);

create index if not exists forecast_results_organization_id_generated_at_idx
  on public.forecast_results (organization_id, generated_at desc);

create index if not exists forecast_results_organization_id_medicine_id_idx
  on public.forecast_results (organization_id, medicine_id);

create index if not exists forecast_results_organization_id_model_name_idx
  on public.forecast_results (organization_id, model_name);

alter table public.forecast_results enable row level security;

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
