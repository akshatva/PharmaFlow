begin;

alter table public.medicines
  add column if not exists normalized_name text;

update public.medicines
set normalized_name = lower(
  regexp_replace(
    regexp_replace(
      trim(name),
      '\s*-\s*',
      '-',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  )
)
where normalized_name is null;

create index if not exists medicines_organization_id_normalized_name_idx
  on public.medicines (organization_id, normalized_name);

notify pgrst, 'reload schema';

commit;
