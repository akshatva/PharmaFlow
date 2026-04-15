create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  category text,
  unit text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  batch_number text not null,
  quantity integer not null check (quantity >= 0),
  expiry_date date not null,
  purchase_price numeric,
  selling_price numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  quantity_sold integer not null check (quantity_sold > 0),
  sold_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id, organization_id);

create index if not exists medicines_organization_id_name_idx
  on public.medicines (organization_id, name);

create index if not exists inventory_batches_organization_id_medicine_id_idx
  on public.inventory_batches (organization_id, medicine_id);

create index if not exists inventory_batches_organization_id_expiry_date_idx
  on public.inventory_batches (organization_id, expiry_date);

create index if not exists sales_records_organization_id_sold_at_idx
  on public.sales_records (organization_id, sold_at desc);

create index if not exists sales_records_organization_id_medicine_id_idx
  on public.sales_records (organization_id, medicine_id);

create or replace function public.set_inventory_batches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_batches_set_updated_at on public.inventory_batches;

create trigger inventory_batches_set_updated_at
before update on public.inventory_batches
for each row
execute function public.set_inventory_batches_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.medicines enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.sales_records enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "organizations_select_member"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
  )
);

create policy "organizations_update_member"
on public.organizations
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
  )
);

create policy "organization_members_select_member"
on public.organization_members
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "medicines_select_member"
on public.medicines
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = medicines.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "medicines_insert_member"
on public.medicines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = medicines.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "medicines_update_member"
on public.medicines
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = medicines.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = medicines.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "medicines_delete_member"
on public.medicines
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = medicines.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "inventory_batches_select_member"
on public.inventory_batches
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = inventory_batches.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "inventory_batches_insert_member"
on public.inventory_batches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = inventory_batches.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "inventory_batches_update_member"
on public.inventory_batches
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = inventory_batches.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = inventory_batches.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "inventory_batches_delete_member"
on public.inventory_batches
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = inventory_batches.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "sales_records_select_member"
on public.sales_records
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = sales_records.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "sales_records_insert_member"
on public.sales_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = sales_records.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "sales_records_update_member"
on public.sales_records
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = sales_records.organization_id
      and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = sales_records.organization_id
      and om.user_id = auth.uid()
  )
);

create policy "sales_records_delete_member"
on public.sales_records
for delete
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = sales_records.organization_id
      and om.user_id = auth.uid()
  )
);

create or replace function public.complete_onboarding(
  p_organization_name text,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_existing_organization_id uuid;
  v_organization_name text := nullif(trim(p_organization_name), '');
  v_full_name text := nullif(trim(p_full_name), '');
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_organization_name is null then
    raise exception 'Organization name is required';
  end if;

  select u.email
  into v_user_email
  from auth.users u
  where u.id = v_user_id;

  if v_user_email is null then
    raise exception 'Authenticated user email not found';
  end if;

  insert into public.profiles as p (id, full_name, email)
  values (v_user_id, v_full_name, v_user_email)
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, p.full_name),
    email = excluded.email;

  select om.organization_id
  into v_existing_organization_id
  from public.organization_members om
  where om.user_id = v_user_id
  order by om.created_at asc
  limit 1;

  if v_existing_organization_id is not null then
    return v_existing_organization_id;
  end if;

  insert into public.organizations (name)
  values (v_organization_name)
  returning id into v_existing_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_existing_organization_id, v_user_id, 'owner');

  return v_existing_organization_id;
end;
$$;

revoke all on function public.complete_onboarding(text, text) from public;
grant execute on function public.complete_onboarding(text, text) to authenticated;
