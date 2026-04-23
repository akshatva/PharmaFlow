begin;

alter table public.medicines
  add column if not exists demand_category text;

update public.medicines
set demand_category = 'general'
where demand_category is null;

notify pgrst, 'reload schema';

commit;
