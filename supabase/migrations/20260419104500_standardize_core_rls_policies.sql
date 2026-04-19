begin;

create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.medicines enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.sales_records enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "organizations_select_member" on public.organizations;
drop policy if exists "organizations_update_member" on public.organizations;

create policy "organizations_select_member"
on public.organizations
for select
to authenticated
using (public.is_organization_member(id));

create policy "organizations_update_member"
on public.organizations
for update
to authenticated
using (public.is_organization_member(id))
with check (public.is_organization_member(id));

drop policy if exists "organization_members_select_member" on public.organization_members;
drop policy if exists "organization_members_select_own" on public.organization_members;

create policy "organization_members_select_own"
on public.organization_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "medicines_select_member" on public.medicines;
drop policy if exists "medicines_insert_member" on public.medicines;
drop policy if exists "medicines_update_member" on public.medicines;
drop policy if exists "medicines_delete_member" on public.medicines;

create policy "medicines_select_member"
on public.medicines
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy "medicines_insert_member"
on public.medicines
for insert
to authenticated
with check (public.is_organization_member(organization_id));

create policy "medicines_update_member"
on public.medicines
for update
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "medicines_delete_member"
on public.medicines
for delete
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "inventory_batches_select_member" on public.inventory_batches;
drop policy if exists "inventory_batches_insert_member" on public.inventory_batches;
drop policy if exists "inventory_batches_update_member" on public.inventory_batches;
drop policy if exists "inventory_batches_delete_member" on public.inventory_batches;
drop policy if exists "Allow delete inventory" on public.inventory_batches;

create policy "inventory_batches_select_member"
on public.inventory_batches
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy "inventory_batches_insert_member"
on public.inventory_batches
for insert
to authenticated
with check (public.is_organization_member(organization_id));

create policy "inventory_batches_update_member"
on public.inventory_batches
for update
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "inventory_batches_delete_member"
on public.inventory_batches
for delete
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "sales_records_select_member" on public.sales_records;
drop policy if exists "sales_records_insert_member" on public.sales_records;
drop policy if exists "sales_records_update_member" on public.sales_records;
drop policy if exists "sales_records_delete_member" on public.sales_records;

create policy "sales_records_select_member"
on public.sales_records
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy "sales_records_insert_member"
on public.sales_records
for insert
to authenticated
with check (public.is_organization_member(organization_id));

create policy "sales_records_update_member"
on public.sales_records
for update
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create policy "sales_records_delete_member"
on public.sales_records
for delete
to authenticated
using (public.is_organization_member(organization_id));

notify pgrst, 'reload schema';

commit;
