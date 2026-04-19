begin;

create extension if not exists pgcrypto;

create table if not exists public.insight_workflow_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  insight_key text not null,
  insight_type text not null check (
    insight_type in ('stockout_risk', 'expiry_risk', 'dead_stock', 'reorder_suggestion')
  ),
  entity_type text not null check (entity_type in ('medicine', 'batch')),
  medicine_id uuid references public.medicines(id) on delete cascade,
  inventory_batch_id uuid references public.inventory_batches(id) on delete cascade,
  status text not null check (status in ('reviewed', 'needs_reorder', 'monitor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, insight_key),
  check (medicine_id is not null or inventory_batch_id is not null)
);

create index if not exists insight_workflow_items_organization_id_idx
  on public.insight_workflow_items (organization_id);

create index if not exists insight_workflow_items_status_idx
  on public.insight_workflow_items (organization_id, status);

create index if not exists insight_workflow_items_insight_type_idx
  on public.insight_workflow_items (organization_id, insight_type);

alter table public.insight_workflow_items enable row level security;

drop policy if exists "insight_workflow_items_select_org_members" on public.insight_workflow_items;
drop policy if exists "insight_workflow_items_insert_org_members" on public.insight_workflow_items;
drop policy if exists "insight_workflow_items_update_org_members" on public.insight_workflow_items;
drop policy if exists "insight_workflow_items_delete_org_members" on public.insight_workflow_items;

create policy "insight_workflow_items_select_org_members"
on public.insight_workflow_items
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = insight_workflow_items.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "insight_workflow_items_insert_org_members"
on public.insight_workflow_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = insight_workflow_items.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "insight_workflow_items_update_org_members"
on public.insight_workflow_items
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = insight_workflow_items.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = insight_workflow_items.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "insight_workflow_items_delete_org_members"
on public.insight_workflow_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = insight_workflow_items.organization_id
      and om.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
