-- Run once in Supabase SQL Editor (idempotent).
-- Or create bucket in Dashboard: Storage → New bucket → site-media → Public ✓

insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "site_media_select_public" on storage.objects;
drop policy if exists "site_media_insert_authenticated" on storage.objects;
drop policy if exists "site_media_update_authenticated" on storage.objects;
drop policy if exists "site_media_delete_authenticated" on storage.objects;

create policy "site_media_select_public"
  on storage.objects for select
  using (bucket_id = 'site-media');

create policy "site_media_insert_authenticated"
  on storage.objects for insert
  with check (bucket_id = 'site-media' and auth.role() = 'authenticated');

create policy "site_media_update_authenticated"
  on storage.objects for update
  using (bucket_id = 'site-media' and auth.role() = 'authenticated');

create policy "site_media_delete_authenticated"
  on storage.objects for delete
  using (bucket_id = 'site-media' and auth.role() = 'authenticated');
