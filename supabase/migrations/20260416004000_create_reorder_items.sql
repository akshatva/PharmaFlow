begin;

create extension if not exists pgcrypto;

create table if not exists public.reorder_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'ordered')),
  created_at timestamptz not null default now()
);

alter table public.reorder_items enable row level security;

drop policy if exists "reorder_items_select_org_members" on public.reorder_items;
drop policy if exists "reorder_items_insert_org_members" on public.reorder_items;
drop policy if exists "reorder_items_update_org_members" on public.reorder_items;

create policy "reorder_items_select_org_members"
on public.reorder_items
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = reorder_items.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "reorder_items_insert_org_members"
on public.reorder_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = reorder_items.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "reorder_items_update_org_members"
on public.reorder_items
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = reorder_items.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = reorder_items.organization_id
      and om.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
