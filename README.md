# Toptimizer

A simplified Linear-style task manager for a 25-person team. It can run locally with browser `localStorage`, or as a shared team workspace with Supabase.

## Features

- Create projects when needed
- Add, edit, delete, and search tasks
- Comment on tasks and reply to comments with a locally remembered commenter name
- Assign tasks to the seeded 25-person team
- Track task status across Todo, In Progress, Review, and Done
- Drag tasks between columns to update status
- Switch to a Google Calendar-style month tab
- Create, edit, delete, and filter synced calendar events by the same team users used for comments
- Delete projects and their tasks
- Store data in Supabase when configured
- Fall back to local browser storage when Supabase is not configured

## Run

First generate `config.js` from `.env` (it is no longer committed):

```bash
npm run config
```

Then start a local server:

```bash
npm start
```

Then open `http://localhost:8000`.

### Workspace password

Set `WORKSPACE_PASSWORD` in `.env` to gate access behind a password prompt, then run `npm run config`. Leave it empty (or omit it) to disable the prompt.

> Note: this is a client-side prompt only. The password is delivered to the browser in `config.js`, so it deters casual access but can be bypassed by anyone who inspects the page. For real protection, use host-level password protection or Supabase Auth.

## Shared Workspace Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run `supabase-schema.sql`.
4. Add your Supabase URL and publishable key to `.env`.
5. Generate `config.js`:

```bash
node scripts/generate-config.js
```

6. Deploy the static files to GitHub Pages.

This setup intentionally has no login. Anyone who can open the app URL can edit the shared workspace.

## Production Migrations

For an existing Supabase project, do not rerun the full bootstrap schema against production. Apply only the additive migration that matches the feature:

```sql
-- Run in the Supabase SQL editor
migrations/20260523140000_add_calendar_events.sql
```

This creates the `calendar_events` table and its public anon policy without changing existing project, task, or comment data.

Calendar events can invite multiple people. If the `calendar_events` table already exists, apply the attendee migration after the table migration:

```sql
-- Run in the Supabase SQL editor
migrations/20260523141000_add_calendar_event_attendees.sql
```
