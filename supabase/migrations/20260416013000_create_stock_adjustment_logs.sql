begin;

create extension if not exists pgcrypto;

create table if not exists public.stock_adjustment_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medicine_id uuid null references public.medicines(id) on delete set null,
  inventory_batch_id uuid null references public.inventory_batches(id) on delete set null,
  user_id uuid null references public.profiles(id) on delete set null,
  action_type text not null,
  previous_quantity integer null,
  new_quantity integer null,
  quantity_change integer null,
  note text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

alter table public.stock_adjustment_logs enable row level security;

create index if not exists stock_adjustment_logs_organization_id_idx
  on public.stock_adjustment_logs (organization_id);

create index if not exists stock_adjustment_logs_action_type_idx
  on public.stock_adjustment_logs (action_type);

create index if not exists stock_adjustment_logs_created_at_idx
  on public.stock_adjustment_logs (created_at desc);

create index if not exists stock_adjustment_logs_medicine_id_idx
  on public.stock_adjustment_logs (medicine_id);

drop policy if exists "stock_adjustment_logs_select_org_members" on public.stock_adjustment_logs;
drop policy if exists "stock_adjustment_logs_insert_org_members" on public.stock_adjustment_logs;

create policy "stock_adjustment_logs_select_org_members"
on public.stock_adjustment_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = stock_adjustment_logs.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "stock_adjustment_logs_insert_org_members"
on public.stock_adjustment_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = stock_adjustment_logs.organization_id
      and om.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
