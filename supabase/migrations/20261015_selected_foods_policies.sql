-- Delete
create policy "Users can delete their own food logs"
  on public.selected_foods
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Insert
drop policy if exists "Enable insert for authenticated users only" on public.selected_foods;
create policy "Users can add their own food logs"
  on public.selected_foods
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
