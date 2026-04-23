begin;

alter table public.organizations
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists district text,
  add column if not exists country text,
  add column if not exists pincode text;

alter table public.medicines
  add column if not exists demand_category text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medicines_demand_category_check'
  ) then
    alter table public.medicines
      add constraint medicines_demand_category_check
      check (
        demand_category is null
        or demand_category in (
          'fever_flu',
          'respiratory',
          'hydration',
          'gastro',
          'allergy',
          'pain_relief',
          'general'
        )
      );
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
