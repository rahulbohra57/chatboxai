-- ChatboxAI Database Schema
-- Run this in the Supabase SQL Editor to set up all tables

-- Enable UUID extension (usually already enabled in Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- ROOMS
-- ============================================================
create table if not exists rooms (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  name                text not null,
  room_type           text not null check (room_type in ('open', 'secured')),
  secret_code_hash    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by_guest_id text,
  is_active           boolean not null default true,
  closed_by_name      text
);

create unique index if not exists rooms_slug_idx on rooms(slug);
create index if not exists rooms_is_active_idx on rooms(is_active);

-- NOTE: The following REPLICA IDENTITY statement must be run manually on the live DB
-- in the Supabase SQL Editor. It is required for Realtime to include all columns
-- (including closed_by_name) in the UPDATE payload.
-- alter table rooms replica identity full;

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists messages (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references rooms(id) on delete cascade,
  sender_guest_id  text not null,
  sender_name      text not null,
  body             text not null,
  created_at       timestamptz not null default now()
);

create index if not exists messages_room_id_created_at_idx on messages(room_id, created_at);

-- ============================================================
-- PARTICIPANTS (optional but included for future use)
-- ============================================================
create table if not exists participants (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  guest_id     text not null,
  display_name text not null,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists participants_room_id_idx on participants(room_id);
create unique index if not exists participants_room_guest_idx on participants(room_id, guest_id);

-- ============================================================
-- RATE LIMITS (replaces Upstash Redis)
-- ============================================================
create table if not exists rate_limits (
  id           uuid primary key default gen_random_uuid(),
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 1
);

create index if not exists rate_limits_key_window_idx on rate_limits(key, window_start);

-- ============================================================
-- UPDATED_AT trigger for rooms
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger rooms_updated_at
  before update on rooms
  for each row execute function update_updated_at_column();

-- ============================================================
-- GRANTS (required when creating tables via raw SQL editor)
-- Supabase roles need explicit grants on manually-created tables
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;

grant all on table rooms        to anon, authenticated, service_role;
grant all on table messages     to anon, authenticated, service_role;
grant all on table participants to anon, authenticated, service_role;
grant all on table rate_limits  to anon, authenticated, service_role;

grant all on all sequences in schema public to anon, authenticated, service_role;
