begin;

alter table public.medicines
  add column if not exists barcode text;

create index if not exists medicines_organization_id_barcode_idx
  on public.medicines (organization_id, barcode);

notify pgrst, 'reload schema';

commit;
