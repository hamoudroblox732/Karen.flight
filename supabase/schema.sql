-- Karen Flight database schema
-- Apply this file in Supabase SQL Editor or with the Supabase migration tool.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  flight_number text not null unique,
  origin_code text not null,
  origin_name text,
  destination_code text not null,
  destination_name text,
  departure_at timestamptz not null,
  aircraft text,
  seats_total integer not null default 30 check (seats_total between 1 and 500),
  status text not null default 'scheduled' check (status in ('scheduled','boarding','delayed','cancelled','closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (origin_code <> destination_code)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references public.flights(id) on delete restrict,
  roblox_username text not null check (char_length(roblox_username) between 3 and 30),
  passenger_name text not null check (char_length(passenger_name) between 1 and 70),
  notes text check (notes is null or char_length(notes) <= 250),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  roblox_username text not null unique,
  employee_id text not null unique,
  email text not null unique,
  role text not null default 'pilot' check (role in ('pilot','co_pilot','cabin_crew','ground_staff','admin','owner')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.flight_logs (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid references public.flights(id) on delete set null,
  actor_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists flights_departure_idx on public.flights(departure_at);
create index if not exists bookings_flight_idx on public.bookings(flight_id);
create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists employees_user_idx on public.employees(user_id);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_employee_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select e.role
  from public.employees e
  where e.user_id = (select auth.uid())
    and e.active = true
  limit 1
$$;
revoke all on function private.current_employee_role() from public, anon;
grant execute on function private.current_employee_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.flights enable row level security;
alter table public.bookings enable row level security;
alter table public.employees enable row level security;
alter table public.flight_logs enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "public can read active flight schedule" on public.flights;
create policy "public can read active flight schedule" on public.flights for select to anon, authenticated using (status in ('scheduled','boarding','delayed'));
drop policy if exists "staff can read all flights" on public.flights;
create policy "staff can read all flights" on public.flights for select to authenticated using (private.current_employee_role() in ('owner','admin','pilot','co_pilot','cabin_crew','ground_staff'));
drop policy if exists "managers create flights" on public.flights;
create policy "managers create flights" on public.flights for insert to authenticated with check (private.current_employee_role() in ('owner','admin') and created_by = (select auth.uid()));
drop policy if exists "managers update flights" on public.flights;
create policy "managers update flights" on public.flights for update to authenticated using (private.current_employee_role() in ('owner','admin')) with check (private.current_employee_role() in ('owner','admin'));

drop policy if exists "public can submit booking requests" on public.bookings;
create policy "public can submit booking requests" on public.bookings for insert to anon, authenticated with check (
  status = 'pending'
  and exists (select 1 from public.flights f where f.id = flight_id and f.status in ('scheduled','boarding'))
);
drop policy if exists "staff can view bookings" on public.bookings;
create policy "staff can view bookings" on public.bookings for select to authenticated using (private.current_employee_role() in ('owner','admin','ground_staff','cabin_crew'));
drop policy if exists "managers update bookings" on public.bookings;
create policy "managers update bookings" on public.bookings for update to authenticated using (private.current_employee_role() in ('owner','admin','ground_staff')) with check (private.current_employee_role() in ('owner','admin','ground_staff'));

drop policy if exists "staff can view employee directory" on public.employees;
create policy "staff can view employee directory" on public.employees for select to authenticated using (
  user_id = (select auth.uid()) or private.current_employee_role() in ('owner','admin')
);
drop policy if exists "owner manages employees" on public.employees;
create policy "owner manages employees" on public.employees for all to authenticated using (private.current_employee_role() = 'owner') with check (private.current_employee_role() = 'owner');

drop policy if exists "staff can view logs" on public.flight_logs;
create policy "staff can view logs" on public.flight_logs for select to authenticated using (private.current_employee_role() in ('owner','admin'));
drop policy if exists "staff can add logs" on public.flight_logs;
create policy "staff can add logs" on public.flight_logs for insert to authenticated with check (actor_id = (select auth.uid()) and private.current_employee_role() in ('owner','admin','pilot','co_pilot','ground_staff','cabin_crew'));

grant select on public.flights to anon, authenticated;
grant insert on public.bookings to anon, authenticated;
grant select, insert, update on public.flights to authenticated;
grant select, insert, update on public.bookings to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert on public.profiles to authenticated;
grant select, insert on public.flight_logs to authenticated;

-- Create the first owner employee record after creating the owner's Auth user:
-- insert into public.employees (user_id, roblox_username, employee_id, email, role)
-- values ('AUTH-USER-UUID', 'YOUR_ROBLOX_USERNAME', 'KRN-OWNER', 'YOUR_EMAIL', 'owner');
