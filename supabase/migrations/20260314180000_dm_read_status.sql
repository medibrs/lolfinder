-- Track when each user last read each DM conversation
create table if not exists dm_read_status (
  user_id uuid references auth.users(id) on delete cascade not null,
  conversation_id uuid references dm_conversations(id) on delete cascade not null,
  last_read_at timestamptz default now(),
  primary key (user_id, conversation_id)
);

-- RLS
alter table dm_read_status enable row level security;

create policy "Users can view their own read status"
  on dm_read_status for select
  using (auth.uid() = user_id);

create policy "Users can upsert their own read status"
  on dm_read_status for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own read status"
  on dm_read_status for update
  using (auth.uid() = user_id);

-- Grant access
grant select, insert, update on dm_read_status to authenticated;

-- Index for fast lookups
create index idx_dm_read_status_user on dm_read_status(user_id);
