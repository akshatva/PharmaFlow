begin;

alter table public.procurement_orders
  add column if not exists medicine_id uuid null references public.medicines(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  alter column supplier_id drop not null,
  alter column unit_price drop not null,
  alter column total_price drop not null;

create index if not exists procurement_orders_medicine_id_idx
  on public.procurement_orders (medicine_id);

-- Add updated_at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_procurement_orders_updated_at on public.procurement_orders;
create trigger set_procurement_orders_updated_at
  before update on public.procurement_orders
  for each row
  execute function public.handle_updated_at();

notify pgrst, 'reload schema';

commit;
