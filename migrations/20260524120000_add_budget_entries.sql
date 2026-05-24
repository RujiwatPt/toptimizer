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

alter table public.budget_entries enable row level security;

grant select, insert, update, delete on public.budget_entries to anon;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budget_entries'
      and policyname = 'public budget entries access'
  ) then
    create policy "public budget entries access"
    on public.budget_entries
    for all
    to anon
    using (true)
    with check (true);
  end if;
end $$;
