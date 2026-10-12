-- SafeTube Kids — align Supabase with the current app.
-- Safe to run more than once in the SQL editor.

create extension if not exists pgcrypto;

-- Parent account profile used at login.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Shared catalog. The daily job writes this. The app reads it.
create table if not exists public.catalog_videos (
  id text primary key,
  title text not null,
  channel_id text,
  channel_title text,
  category text,
  category_id text,
  age_group text not null,
  language text not null default 'en',
  duration_seconds integer,
  view_count bigint,
  thumbnail text,
  approved boolean not null default true,
  added_at timestamptz not null default now()
);

alter table public.catalog_videos add column if not exists channel_id text;
alter table public.catalog_videos add column if not exists channel_title text;
alter table public.catalog_videos add column if not exists category text;
alter table public.catalog_videos add column if not exists category_id text;
alter table public.catalog_videos add column if not exists age_group text;
alter table public.catalog_videos add column if not exists language text default 'en';
alter table public.catalog_videos add column if not exists duration_seconds integer;
alter table public.catalog_videos add column if not exists view_count bigint;
alter table public.catalog_videos add column if not exists thumbnail text;
alter table public.catalog_videos add column if not exists approved boolean default true;
alter table public.catalog_videos add column if not exists added_at timestamptz default now();

create index if not exists catalog_videos_age_idx on public.catalog_videos (age_group, approved);
create index if not exists catalog_videos_category_idx on public.catalog_videos (category_id, language);
create index if not exists catalog_videos_added_idx on public.catalog_videos (added_at desc);

alter table public.profiles enable row level security;
alter table public.catalog_videos enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "catalog_read" on public.catalog_videos;
create policy "catalog_read" on public.catalog_videos for select to anon, authenticated using (approved = true);

grant usage on schema public to anon, authenticated, service_role;
grant select on public.profiles to anon, authenticated;
grant update (email, role) on public.profiles to authenticated;
grant select on public.catalog_videos to anon, authenticated;
grant select, insert, update on public.catalog_videos to service_role;
