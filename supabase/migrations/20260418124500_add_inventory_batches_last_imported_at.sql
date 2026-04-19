begin;

alter table public.inventory_batches
  add column if not exists last_imported_at timestamptz;

create index if not exists inventory_batches_organization_id_last_imported_at_idx
  on public.inventory_batches (organization_id, last_imported_at desc);

notify pgrst, 'reload schema';

commit;
