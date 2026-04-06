-- QADER PRODUCTION — run in Supabase SQL Editor
-- Enable Realtime: Dashboard → Database → Replication → site_settings

create table if not exists public.site_settings (
  id text primary key,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.site_settings enable row level security;
alter table public.contact_submissions enable row level security;

create policy "site_settings_select_public"
  on public.site_settings for select
  using (true);

create policy "site_settings_insert_authenticated"
  on public.site_settings for insert
  with check (auth.role() = 'authenticated');

create policy "site_settings_update_authenticated"
  on public.site_settings for update
  using (auth.role() = 'authenticated');

create policy "contact_submissions_insert_public"
  on public.contact_submissions for insert
  with check (true);

create policy "contact_submissions_select_authenticated"
  on public.contact_submissions for select
  using (auth.role() = 'authenticated');

insert into public.site_settings (id, content)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;
