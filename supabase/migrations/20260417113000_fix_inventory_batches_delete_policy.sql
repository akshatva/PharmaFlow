begin;

drop policy if exists "Allow delete inventory" on public.inventory_batches;
drop policy if exists "inventory_batches_delete_member" on public.inventory_batches;

create policy "Allow delete inventory"
on public.inventory_batches
for delete
to authenticated
using (
  organization_id in (
    select organization_id
    from public.organization_members
    where user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';

commit;
