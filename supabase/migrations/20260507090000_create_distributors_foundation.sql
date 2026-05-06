begin;

create extension if not exists pgcrypto;

create table if not exists public.distributors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  distributor_name text not null check (length(trim(distributor_name)) > 0),
  contact_name text null,
  phone text null,
  email text null,
  city text null,
  state text null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.distributor_catalog (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references public.distributors(id) on delete cascade,
  medicine_name text not null check (length(trim(medicine_name)) > 0),
  sku text null,
  category text null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  available_quantity integer null check (available_quantity is null or available_quantity >= 0),
  lead_time_days integer null check (lead_time_days is null or lead_time_days >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.distributors enable row level security;
alter table public.distributor_catalog enable row level security;

create index if not exists distributors_organization_id_idx
  on public.distributors (organization_id);

create index if not exists distributors_active_idx
  on public.distributors (organization_id, active);

create index if not exists distributor_catalog_distributor_id_idx
  on public.distributor_catalog (distributor_id);

create index if not exists distributor_catalog_active_idx
  on public.distributor_catalog (distributor_id, active);

drop policy if exists "distributors_select_org_members" on public.distributors;
drop policy if exists "distributors_insert_org_members" on public.distributors;
drop policy if exists "distributors_update_org_members" on public.distributors;
drop policy if exists "distributors_delete_org_members" on public.distributors;

create policy "distributors_select_org_members"
on public.distributors
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = distributors.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "distributors_insert_org_members"
on public.distributors
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = distributors.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "distributors_update_org_members"
on public.distributors
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = distributors.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = distributors.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "distributors_delete_org_members"
on public.distributors
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = distributors.organization_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "distributor_catalog_select_org_members" on public.distributor_catalog;
drop policy if exists "distributor_catalog_insert_org_members" on public.distributor_catalog;
drop policy if exists "distributor_catalog_update_org_members" on public.distributor_catalog;
drop policy if exists "distributor_catalog_delete_org_members" on public.distributor_catalog;

create policy "distributor_catalog_select_org_members"
on public.distributor_catalog
for select
to authenticated
using (
  exists (
    select 1
    from public.distributors d
    join public.organization_members om
      on om.organization_id = d.organization_id
    where d.id = distributor_catalog.distributor_id
      and om.user_id = auth.uid()
  )
);

create policy "distributor_catalog_insert_org_members"
on public.distributor_catalog
for insert
to authenticated
with check (
  exists (
    select 1
    from public.distributors d
    join public.organization_members om
      on om.organization_id = d.organization_id
    where d.id = distributor_catalog.distributor_id
      and om.user_id = auth.uid()
  )
);

create policy "distributor_catalog_update_org_members"
on public.distributor_catalog
for update
to authenticated
using (
  exists (
    select 1
    from public.distributors d
    join public.organization_members om
      on om.organization_id = d.organization_id
    where d.id = distributor_catalog.distributor_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.distributors d
    join public.organization_members om
      on om.organization_id = d.organization_id
    where d.id = distributor_catalog.distributor_id
      and om.user_id = auth.uid()
  )
);

create policy "distributor_catalog_delete_org_members"
on public.distributor_catalog
for delete
to authenticated
using (
  exists (
    select 1
    from public.distributors d
    join public.organization_members om
      on om.organization_id = d.organization_id
    where d.id = distributor_catalog.distributor_id
      and om.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
