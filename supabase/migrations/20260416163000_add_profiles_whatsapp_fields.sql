begin;

alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists whatsapp_enabled boolean not null default false;

notify pgrst, 'reload schema';

commit;
