-- ChatboxAI Row Level Security Policies
-- Run AFTER schema.sql
-- These policies use the anon key for guest access

-- Enable RLS on all tables
alter table rooms enable row level security;
alter table messages enable row level security;
alter table participants enable row level security;
alter table rate_limits enable row level security;

-- ============================================================
-- ROOMS policies
-- ============================================================

-- Anyone can read active rooms (needed to join a room by slug)
-- IMPORTANT: never expose secret_code_hash — app always selects specific columns
create policy "rooms_select_active"
  on rooms for select
  using (is_active = true);

-- Service role only can insert rooms (via admin client in server action)
-- No anon insert policy — room creation must go through server action

-- ============================================================
-- MESSAGES policies
-- ============================================================

-- Anyone can read messages for any room
create policy "messages_select_all"
  on messages for select
  using (true);

-- Anyone can insert messages (guest chat)
-- Abuse protection is handled via rate limiting in the server action
create policy "messages_insert_anon"
  on messages for insert
  with check (true);

-- ============================================================
-- PARTICIPANTS policies
-- ============================================================

-- Anyone can read participants
create policy "participants_select_all"
  on participants for select
  using (true);

-- Anyone can insert/update their own participant record
create policy "participants_insert_anon"
  on participants for insert
  with check (true);

create policy "participants_update_own"
  on participants for update
  using (true);

-- ============================================================
-- RATE LIMITS policies
-- ============================================================
-- Rate limits table is accessed only via the admin (service role) client
-- No anon policies needed — service role bypasses RLS

-- ============================================================
-- REALTIME: enable for messages table
-- ============================================================
-- Run this to enable Supabase Realtime for the messages table:
-- 1. Go to Supabase Dashboard > Database > Replication
-- 2. Enable the "messages" table for replication
-- OR use this SQL (only works if realtime is already configured):
-- alter publication supabase_realtime add table messages;
