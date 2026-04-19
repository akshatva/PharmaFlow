begin;

with ranked_batches as (
  select
    id,
    row_number() over (
      partition by organization_id, medicine_id, batch_number
      order by updated_at desc, created_at desc, id desc
    ) as row_rank
  from public.inventory_batches
)
delete from public.inventory_batches
where id in (
  select id
  from ranked_batches
  where row_rank > 1
);

create unique index if not exists inventory_batches_org_medicine_batch_unique_idx
  on public.inventory_batches (organization_id, medicine_id, batch_number);

notify pgrst, 'reload schema';

commit;
