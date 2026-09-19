-- FutureWallet schema. Row-level security on every table: user_id = auth.uid().

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  monthly_income numeric not null default 0 check (monthly_income >= 0),
  fixed_costs jsonb not null default '[]'::jsonb,
  persona text not null default 'friendly' check (persona in ('friendly', 'roast', 'coach')),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null check (amount > 0),
  category text not null,
  merchant text not null default '',
  note text not null default '',
  spent_on date not null,
  spent_at time,
  source text not null default 'manual' check (source in ('manual', 'nl', 'csv', 'seed')),
  created_at timestamptz not null default now()
);
create index expenses_user_date_idx on public.expenses (user_id, spent_on desc);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null, -- first day of the month
  category text not null,
  limit_amount numeric not null check (limit_amount >= 0),
  reason text not null default '',
  unique (user_id, month, category)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  target_amount numeric not null check (target_amount > 0),
  saved_amount numeric not null default 0 check (saved_amount >= 0),
  deadline date not null,
  created_at timestamptz not null default now()
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_user_time_idx on public.chat_messages (user_id, created_at desc);

-- Actions the advisor proposed (budget change, new goal, contribution). They run
-- only after the user confirms in the app.
create table public.pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.pending_actions enable row level security;
create policy "own pending actions" on public.pending_actions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.insights enable row level security;
alter table public.chat_messages enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own expenses" on public.expenses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own budgets" on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own goals" on public.goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own insights" on public.insights
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own chat" on public.chat_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create an empty profile row when a user signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
