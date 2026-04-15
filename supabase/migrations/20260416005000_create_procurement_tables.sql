begin;

create extension if not exists pgcrypto;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact_person text null,
  phone text null,
  email text null,
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  reorder_source_id uuid null references public.reorder_items(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'placed', 'received')),
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

alter table public.purchase_orders
add column if not exists reorder_source_id uuid null references public.reorder_items(id) on delete set null;

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create index if not exists suppliers_organization_id_idx
  on public.suppliers (organization_id);

create index if not exists purchase_orders_organization_id_idx
  on public.purchase_orders (organization_id);

create index if not exists purchase_orders_supplier_id_idx
  on public.purchase_orders (supplier_id);

create index if not exists purchase_orders_reorder_source_id_idx
  on public.purchase_orders (reorder_source_id);

create index if not exists purchase_order_items_purchase_order_id_idx
  on public.purchase_order_items (purchase_order_id);

create index if not exists purchase_order_items_medicine_id_idx
  on public.purchase_order_items (medicine_id);

drop policy if exists "suppliers_select_org_members" on public.suppliers;
drop policy if exists "suppliers_insert_org_members" on public.suppliers;
drop policy if exists "suppliers_update_org_members" on public.suppliers;

create policy "suppliers_select_org_members"
on public.suppliers
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = suppliers.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "suppliers_insert_org_members"
on public.suppliers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = suppliers.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "suppliers_update_org_members"
on public.suppliers
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = suppliers.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = suppliers.organization_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "purchase_orders_select_org_members" on public.purchase_orders;
drop policy if exists "purchase_orders_insert_org_members" on public.purchase_orders;
drop policy if exists "purchase_orders_update_org_members" on public.purchase_orders;

create policy "purchase_orders_select_org_members"
on public.purchase_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = purchase_orders.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "purchase_orders_insert_org_members"
on public.purchase_orders
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = purchase_orders.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "purchase_orders_update_org_members"
on public.purchase_orders
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = purchase_orders.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = purchase_orders.organization_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "purchase_order_items_select_org_members" on public.purchase_order_items;
drop policy if exists "purchase_order_items_insert_org_members" on public.purchase_order_items;
drop policy if exists "purchase_order_items_update_org_members" on public.purchase_order_items;

create policy "purchase_order_items_select_org_members"
on public.purchase_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.purchase_orders po
    join public.organization_members om
      on om.organization_id = po.organization_id
    where po.id = purchase_order_items.purchase_order_id
      and om.user_id = auth.uid()
  )
);

create policy "purchase_order_items_insert_org_members"
on public.purchase_order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.purchase_orders po
    join public.organization_members om
      on om.organization_id = po.organization_id
    where po.id = purchase_order_items.purchase_order_id
      and om.user_id = auth.uid()
  )
);

create policy "purchase_order_items_update_org_members"
on public.purchase_order_items
for update
to authenticated
using (
  exists (
    select 1
    from public.purchase_orders po
    join public.organization_members om
      on om.organization_id = po.organization_id
    where po.id = purchase_order_items.purchase_order_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.purchase_orders po
    join public.organization_members om
      on om.organization_id = po.organization_id
    where po.id = purchase_order_items.purchase_order_id
      and om.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
