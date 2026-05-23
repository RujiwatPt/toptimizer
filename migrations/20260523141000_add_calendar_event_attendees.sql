alter table public.calendar_events
add column if not exists attendee_ids text[] not null default '{}';

update public.calendar_events
set attendee_ids = array[user_id]
where user_id is not null
  and coalesce(array_length(attendee_ids, 1), 0) = 0;
