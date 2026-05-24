create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id text,
  priority text not null default 'medium',
  status text not null default 'todo',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id text primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  parent_id text references public.comments(id) on delete cascade,
  author_id text,
  author_name text not null default 'Unknown',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id text primary key,
  title text not null,
  description text not null default '',
  user_id text,
  attendee_ids text[] not null default '{}',
  date date not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_entries (
  id text primary key,
  type text not null default 'income',
  label text not null default '',
  amount numeric not null default 0,
  reference text not null default '',
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comments add column if not exists author_id text;
alter table public.comments add column if not exists author_name text not null default 'Unknown';

update public.tasks set status = 'todo' where status = 'backlog';

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.calendar_events enable row level security;
alter table public.budget_entries enable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on public.projects to anon;
grant select, insert, update, delete on public.tasks to anon;
grant select, insert, update, delete on public.comments to anon;
grant select, insert, update, delete on public.calendar_events to anon;
grant select, insert, update, delete on public.budget_entries to anon;

drop policy if exists "public projects access" on public.projects;
drop policy if exists "public tasks access" on public.tasks;
drop policy if exists "public comments access" on public.comments;
drop policy if exists "public calendar events access" on public.calendar_events;
drop policy if exists "public budget entries access" on public.budget_entries;

create policy "public projects access"
on public.projects
for all
to anon
using (true)
with check (true);

create policy "public tasks access"
on public.tasks
for all
to anon
using (true)
with check (true);

create policy "public comments access"
on public.comments
for all
to anon
using (true)
with check (true);

create policy "public calendar events access"
on public.calendar_events
for all
to anon
using (true)
with check (true);

create policy "public budget entries access"
on public.budget_entries
for all
to anon
using (true)
with check (true);
