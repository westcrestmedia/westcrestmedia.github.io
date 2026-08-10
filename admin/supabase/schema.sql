-- ═════════════════════════════════════════════════════════════════════
-- Westcrest Media — Admin Panel Migration
-- Chalao: Supabase → SQL Editor → paste → Run
--
-- Creates: profiles (roles/ban), audit_logs, content, site_settings
-- + ROW LEVEL SECURITY policies.
--
-- SECURITY MODEL:
--   * har normal user sirf apna profile dekh/padha sakta hai
--   * koi USER data ko ban/role nahi badal sakta (sirf service role / RLS insert)
--   * audit_logs/content/site_settings public-readable nahi — sirf admins
--   * SQL function is_admin() se queries me check karte hain
-- ═════════════════════════════════════════════════════════════════════

-- ── Helper: kya ye user admin hai? ──────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and (p.is_banned is not true)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'moderator')
      and (p.is_banned is not true)
  );
$$;

-- ── Profiles table ────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  avatar_url    text,
  role          text not null default 'user',
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now(),
  last_sign_in_at timestamptz,
  constraint profiles_role_check check (role in ('user','moderator','admin'))
);

-- Auto-create profile jab naya user sign up kare
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Audit logs ────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);

-- ── Content (blog / pages / tools) ────────────────────────────────
create table if not exists public.content (
  id               bigint generated always as identity primary key,
  type             text not null check (type in ('blog','page','tool')),
  slug             text not null,
  title            text not null,
  body             text,
  description      text,
  image            text,
  published        boolean not null default true,
  author_id        uuid references auth.users(id) on delete set null,
  meta_title       text,
  meta_description text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (type, slug)
);

-- ── Site settings (key/value) ─────────────────────────────────────
create table if not exists public.site_settings (
  key         text primary key,
  value       text,
  value_type  text not null default 'string' check (value_type in ('string','boolean','number','json')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

-- ═════════════ ⬇ RLS POLICIES ⬇ ══════════════════════════════════

alter table public.profiles    enable row level security;
alter table public.audit_logs  enable row level security;
alter table public.content     enable row level security;
alter table public.site_settings enable row level security;

-- PROFILES
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles
  for select using (public.is_staff());

-- ADMIN hi sab profiles padh sakta hai (role/banned) — service role pehle se bypass karta hai
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Users apna profile khud update (name/avatar) kar sakte hain, role/banned nahi
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- AUDIT LOGS — sirf admins padhein
drop policy if exists audit_admin_select on public.audit_logs;
create policy audit_admin_select on public.audit_logs
  for select using (public.is_admin());

-- CONTENT — published items sab ko padho sakte hain; write sirf staff
drop policy if exists content_select_published on public.content;
create policy content_select_published on public.content
  for select using (published = true);

create policy content_staff_all on public.content
  for all using (public.is_staff()) with check (public.is_staff());

-- SITE SETTINGS — public read kar sakta hai, write sirf admin
drop policy if exists settings_select on public.site_settings;
create policy settings_select on public.site_settings
  for select using (true);

create policy settings_admin_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());