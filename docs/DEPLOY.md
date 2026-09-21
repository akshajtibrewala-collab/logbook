# Hosting the logbook for free (Vercel + Turso)

The app runs as two pieces, both on free tiers:

| Piece | Where | What it is |
| --- | --- | --- |
| Website (React) | Vercel | The built files in `client/dist`, served as static assets |
| API (Express) | Vercel | `api/index.js` wraps the Express app as one serverless function; `/api/*` is rewritten to it |
| Database | Turso | Hosted SQLite (libSQL), so your flights don't live on a disk that can vanish |

Locally nothing changes: `npm run dev` still uses the SQLite file `server/logbook.db`, and never touches Turso.

## How it maps to the code

- **Routes** (`flights`, `reviews`, `airports`) are unchanged Express routers. Instead of one function per route, the whole
  app is one function (`api/index.js`), which keeps local dev identical to production and avoids many cold starts.
  [vercel.json](../vercel.json) sends `/api/*` to it and every other URL to `index.html` (so `/logbook` works on refresh).
- **Database layer** ([server/src/db.js](../server/src/db.js)): `better-sqlite3` (native, synchronous, needs a disk) was
  replaced by `@libsql/client` (asynchronous). With `TURSO_DATABASE_URL` set it talks to Turso over HTTPS using the
  fetch-based client, so there's no native code on Vercel. Without it, it opens the local file. All routes now `await`
  their queries; the SQL itself is the same. Airport lookups are batched into one round trip.
- **Schema** ([server/src/schema.sql](../server/src/schema.sql), [migrate.js](../server/src/migrate.js)) is applied by
  `npm run migrate`, which the Vercel build runs before building the site. The running API never migrates.
- **Passcode** ([server/src/auth.js](../server/src/auth.js)): with `APP_PASSCODE` set, every API call needs it. The app
  shows a lock screen once per device and remembers it. This matters: the URL is public, and without it anyone who finds
  it could read or delete your logbook. Leave `APP_PASSCODE` unset only for local dev.
- **Client**: no URL changes. The app calls `/api/...` on its own domain, in dev (via the Vite proxy) and in production.

## One-time setup

You'll need a GitHub account (Vercel deploys from a GitHub repo). Everything below is free. Screens change over time, so
if a button is worded differently, look for the closest match.

### 1. Put the code on GitHub

1. Create a **private** repository on github.com (for example `logbook`), empty, without a README.
2. In the project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/logbook.git
   git push -u origin main
   ```
   `.gitignore` already keeps `node_modules`, `.env`, and your local `*.db` files out of the repo.

### 2. Turso (database)

1. Sign up at **turso.tech** (GitHub sign-in is easiest) and open the dashboard.
2. **Create database**: name it `logbook`. For the region, pick **AWS US East (Virginia)**, which is next to Vercel's
   default function region, so queries are fast.
3. Open the database and copy its **URL** (starts with `libsql://`).
4. Create an **auth token** for the database (a "Create token" / "Generate token" button, full access is fine) and copy it.
   You only see it once.

### 3. Load your data into Turso (from your computer)

1. In the project folder, copy `.env.example` to `.env` and fill in `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
2. Create the tables and load the airport list (about 72,000 rows, takes a minute or two):
   ```bash
   npm run db:setup
   ```
3. Copy your existing flights and flight reviews from the local file. It only reads `server/logbook.db`, and refuses to
   run if Turso already has flights:
   ```bash
   npm run db:copy-local
   ```
4. In the Turso dashboard's data browser, check that `flights` has your rows.

### 4. Vercel (hosting)

1. Sign up at **vercel.com** with GitHub, on the free **Hobby** plan.
2. **Add New → Project**, pick your `logbook` repo, **Import**.
3. **Root Directory must stay empty (`./`, the repo root).** Vercel may offer or auto-select `client` because it spots the
   Vite app there. Do not accept that: the API function (`api/`), the server code and the build script all live at the
   repo root, and with `client` as the root Vercel fails with `Missing script: "build:vercel"` and has no API. Leave the
   other build settings alone too. They come from `vercel.json` (framework "Other", build `npm run build:vercel`, output
   `client/dist`). If any of them show an "Override" toggle switched on, switch it off.
4. Open **Environment Variables** and add these three (at least for **Production**):
   | Name | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | the `libsql://...` URL |
   | `TURSO_AUTH_TOKEN` | the token |
   | `APP_PASSCODE` | a long passphrase only you know (16+ characters; there's no lockout on wrong guesses, so make it long) |
5. **Deploy**. The build runs the schema migration against Turso, then builds the site. When it finishes, open the
   `*.vercel.app` address, enter your passcode, and check your flights are there.
6. On your phone, open the address and use **Add to Home Screen** for an app-style icon.

## Deploying after that

- **Git push (recommended):** `git push` to `main` and Vercel builds and publishes it. Other branches get preview URLs.
- **One command:** `npm run deploy` (runs `npx vercel --prod`). The first time it asks you to log in and link the project.

Schema changes: edit `schema.sql` (and `migrate.js` if an existing table needs an `ALTER`). The next deploy applies it.
Use only additive changes (new tables and columns) so a deploy can't break the running version.

## Limits, safety, and troubleshooting

- **Free tiers:** Vercel Hobby is for personal, non-commercial use. Turso's free plan has storage and monthly read/write
  caps that are far above one person's logbook, but plans change, so check the current numbers on their pricing pages.
- **Cold starts:** Vercel functions don't "sleep" like Render's free servers, but the first request after idle may take
  about a second longer. Turso's free databases can also take a moment on the first query after being idle.
- **Backups:** Use **Logbook → Import & export → Export CSV** now and then. Turso also has its own backup/restore options.
- **Changing the passcode:** change `APP_PASSCODE` in Vercel and redeploy. Each device asks for the new one.
- **Lock screen keeps coming back:** the passcode in Vercel doesn't match what you typed. Re-enter it.
- **`Missing script: "build:vercel"` / location `.../client`:** the project's Root Directory is set to `client`. Clear it under
  Project Settings > General > Root Directory, save, and redeploy.
- **Blank data or errors:** open the deployment in Vercel and read **Logs**. A build that says `TURSO_DATABASE_URL is not
  set` means the environment variable is missing for that environment.
- **Preview deployments** run the migration too, against the same database, so only add the Turso variables to
  environments you want to be able to build.
