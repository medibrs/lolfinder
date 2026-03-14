-- Create dm_conversations table to track direct message conversations between players
create table if not exists dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid references auth.users(id) on delete cascade not null,
  user2_id uuid references auth.users(id) on delete cascade not null,
  room_name text unique not null,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint unique_conversation unique(user1_id, user2_id),
  constraint different_users check (user1_id <> user2_id)
);

-- Indexes for fast lookups
create index if not exists idx_dm_conversations_user1 on dm_conversations(user1_id);
create index if not exists idx_dm_conversations_user2 on dm_conversations(user2_id);
create index if not exists idx_dm_conversations_room on dm_conversations(room_name);
create index if not exists idx_dm_conversations_last_message on dm_conversations(last_message_at desc);

-- Enable RLS
alter table dm_conversations enable row level security;

-- RLS: users can only see conversations they are part of
create policy "Users can view own conversations"
  on dm_conversations for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

-- RLS: authenticated users can create conversations
create policy "Users can create conversations"
  on dm_conversations for insert
  with check (auth.uid() = user1_id or auth.uid() = user2_id);

-- RLS: users can update conversations they are part of (for last_message_at)
create policy "Users can update own conversations"
  on dm_conversations for update
  using (auth.uid() = user1_id or auth.uid() = user2_id);
