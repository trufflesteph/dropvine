-- Dropvine schema. Run this in Supabase SQL editor after creating the project.

-- 1) profiles: extends auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  brand text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2) launches
create table if not exists public.launches (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  handle text unique not null,
  title text not null,
  tagline text,
  description text,
  cover_url text,
  launch_at timestamptz not null,
  price_cents integer default 0,
  reservation_enabled boolean default false,
  reservation_hold_cents integer default 0,
  capacity integer,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);
alter table public.launches add column if not exists capacity integer;
create index if not exists launches_creator_idx on public.launches(creator_id);
create index if not exists launches_handle_idx on public.launches(handle);
create index if not exists launches_status_idx on public.launches(status);

-- 3) waitlist_entries
create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.launches(id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (launch_id, email)
);
create index if not exists waitlist_launch_idx on public.waitlist_entries(launch_id);

-- 4) reservations (Stripe placeholder)
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  launch_id uuid not null references public.launches(id) on delete cascade,
  email text not null,
  amount_cents integer not null,
  stripe_session_id text,
  status text not null default 'pending' check (status in ('pending','held','released','captured','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists reservations_launch_idx on public.reservations(launch_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.launches enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.reservations enable row level security;

-- profiles: user can read/update their own
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles for update using (auth.uid() = id);

-- launches: creator full control; public can read published
drop policy if exists launches_creator_all on public.launches;
create policy launches_creator_all on public.launches for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
drop policy if exists launches_public_read on public.launches;
create policy launches_public_read on public.launches for select using (status = 'published');

-- waitlist_entries: anyone can insert; only creator of the launch can read
drop policy if exists waitlist_anyone_insert on public.waitlist_entries;
create policy waitlist_anyone_insert on public.waitlist_entries for insert with check (true);
drop policy if exists waitlist_creator_read on public.waitlist_entries;
create policy waitlist_creator_read on public.waitlist_entries for select using (
  exists (select 1 from public.launches l where l.id = launch_id and l.creator_id = auth.uid())
);

-- reservations: same pattern
drop policy if exists reservations_anyone_insert on public.reservations;
create policy reservations_anyone_insert on public.reservations for insert with check (true);
drop policy if exists reservations_creator_read on public.reservations;
create policy reservations_creator_read on public.reservations for select using (
  exists (select 1 from public.launches l where l.id = launch_id and l.creator_id = auth.uid())
);
