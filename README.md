# Toptimizer

A simplified Linear-style task manager for a 25-person team. It can run locally with browser `localStorage`, or as a shared team workspace with Supabase.

## Features

- Create projects when needed
- Add, edit, delete, and search tasks
- Comment on tasks and reply to comments with a locally remembered commenter name
- Assign tasks to the seeded 25-person team
- Track task status across Backlog, Todo, In Progress, Review, and Done
- Drag tasks between columns to update status
- Delete projects and their tasks
- Store data in Supabase when configured
- Fall back to local browser storage when Supabase is not configured

## Run

Open `index.html` in a browser.

For local testing:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

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

If you already created the tables before commenter names were added, run `supabase-schema.sql` again. It includes `alter table ... add column if not exists` statements for the comment author fields.
