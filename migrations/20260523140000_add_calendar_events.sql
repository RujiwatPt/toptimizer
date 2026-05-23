create table if not exists public.calendar_events (
  id text primary key,
  title text not null,
  description text not null default '',
  user_id text,
  date date not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

grant select, insert, update, delete on public.calendar_events to anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'calendar_events'
      and policyname = 'public calendar events access'
  ) then
    create policy "public calendar events access"
    on public.calendar_events
    for all
    to anon
    using (true)
    with check (true);
  end if;
end $$;
