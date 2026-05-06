begin;

create extension if not exists pgcrypto;

create table if not exists public.procurement_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reorder_item_id uuid null references public.reorder_items(id) on delete set null,
  medicine_name text not null check (length(trim(medicine_name)) > 0),
  supplier_id uuid not null references public.distributors(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  total_price numeric(12, 2) not null check (total_price >= 0),
  status text not null default 'pending' check (
    status in ('pending', 'ordered', 'in_transit', 'delivered', 'cancelled')
  ),
  expected_delivery_date date null,
  notes text null,
  created_at timestamptz not null default now()
);

create unique index if not exists procurement_orders_reorder_item_id_unique_idx
  on public.procurement_orders (reorder_item_id)
  where reorder_item_id is not null;

create index if not exists procurement_orders_organization_id_idx
  on public.procurement_orders (organization_id);

create index if not exists procurement_orders_supplier_id_idx
  on public.procurement_orders (supplier_id);

create index if not exists procurement_orders_status_idx
  on public.procurement_orders (organization_id, status);

create index if not exists procurement_orders_expected_delivery_date_idx
  on public.procurement_orders (organization_id, expected_delivery_date);

alter table public.procurement_orders enable row level security;

drop policy if exists "procurement_orders_select_org_members" on public.procurement_orders;
drop policy if exists "procurement_orders_insert_org_members" on public.procurement_orders;
drop policy if exists "procurement_orders_update_org_members" on public.procurement_orders;
drop policy if exists "procurement_orders_delete_org_members" on public.procurement_orders;

create policy "procurement_orders_select_org_members"
on public.procurement_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = procurement_orders.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "procurement_orders_insert_org_members"
on public.procurement_orders
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = procurement_orders.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "procurement_orders_update_org_members"
on public.procurement_orders
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = procurement_orders.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = procurement_orders.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "procurement_orders_delete_org_members"
on public.procurement_orders
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = procurement_orders.organization_id
      and om.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
