-- Tracks per-user daily AI message counts to enforce a free-tier rate limit
-- while Karadev runs on free OpenRouter models.

create table if not exists public.daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.daily_usage enable row level security;

-- Users can read their own usage (e.g. to show "x/30 messages used today" in UI)
create policy "Users can view their own daily usage"
  on public.daily_usage
  for select
  using (auth.uid() = user_id);

-- Inserts/updates are performed by the edge function using the service role,
-- which bypasses RLS, so no insert/update policy is needed for normal users.
