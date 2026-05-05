# Workout log

Small React app for daily workouts: exercises with sets and reps, and per-set weight you can fill in during the session. Data lives in [Supabase](https://supabase.com); the static build is meant for [GitHub Pages](https://pages.github.com/).

## Supabase

1. Create a project, then open **SQL** → **New query**, paste `supabase/schema.sql`, and run it.  
   If you already ran an older schema without recurring schedules, also run `supabase/migrations/002_recurring_schedules.sql` (or paste the new tables / `schedule_id` column / policies from `schema.sql`).
2. Under **Authentication** → **Providers**, enable **Email** (password sign-in).
3. Under **Authentication** → **URL configuration**, add your deployed site (for this repo: `https://aschottky.github.io/workout/`) to **Site URL** and **Redirect URLs** if you use email confirmation links.

## Local development

```bash
cp .env.example .env
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

For a **project site** (`username.github.io/repo/`), build with:

`VITE_BASE=/repo-name/ npm run build`

For **local** dev, leave `VITE_BASE` unset (defaults to `/`).

## GitHub Pages (Actions)

Live site (after setup): [https://aschottky.github.io/workout/](https://aschottky.github.io/workout/)

1. Add the workflow file (needed once): create `.github/workflows/deploy-pages.yml` in the repo with the same contents as [`deploy-pages.example.yml`](./deploy-pages.example.yml) in this project root (copy-paste, or `mkdir -p .github/workflows && cp deploy-pages.example.yml .github/workflows/deploy-pages.yml` and push). If your Git client cannot push workflow files, use the GitHub web editor or a token with **workflow** scope.
2. Repo **Settings** → **Secrets and variables** → **Actions**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as in `.env`).
3. **Settings** → **Pages**: set **Source** to **GitHub Actions**.
4. Push to `main`. The workflow sets `VITE_BASE` to `/${{ repository.name }}/` (here: `/workout/`).

The app uses **hash routing** (`#/`, `#/workout/...`) so it works on GitHub Pages without extra `404` handling.

## Manual deploy (`gh-pages` branch)

```bash
VITE_BASE=/your-repo-name/ npm run deploy
```

Then enable Pages from the `gh-pages` branch / `root` if you prefer that over Actions.
