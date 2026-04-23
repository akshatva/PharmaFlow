begin;

alter table public.profiles
  add column if not exists alerts_email_enabled boolean not null default true;

notify pgrst, 'reload schema';

commit;
