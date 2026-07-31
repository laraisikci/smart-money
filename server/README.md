# smart-money-server

Backend proxy for the Smart Money dashboard. Exists because SEC EDGAR has no CORS support and
requires a compliant `User-Agent` header, and because any paid API keys need to stay off the
client — neither is possible calling these APIs directly from the browser.

## Endpoints

| Route | Source | Notes |
|---|---|---|
| `GET /health` | — | Returns `{"status":"ok"}`. Used by the keep-alive workflow (see below), also handy for manual uptime checks |
| `GET /api/insiders` | SEC EDGAR Form 4 | Only tickers with a resolvable SEC CIK (see `src/data/euAdrMap.ts`) — most EU issuers don't file with the SEC at all |
| `GET /api/institutions` | SEC EDGAR 13F-HR | 10 funds, diffed against the prior quarter's filing for new/increased/decreased/exited |
| `GET /api/markets` | Polymarket Gamma API | Public, no key |
| `GET /api/european` | Static | CNMV/AMF/BaFin/FCA links — no structured API exists for EU PDMR disclosures |
| `GET /api/congress` | Static | Returns `available: false` — House/Senate Stock Watcher (the free data source) is dead; no reliable free replacement exists |

## Local development

```bash
npm install
cp .env.example .env   # fill in SEC_USER_AGENT with a real contact email
npm run dev
```

Runs on `http://localhost:8787` by default.

`SEC_USER_AGENT` is required — SEC EDGAR 403s (and can temporarily block your IP) if requests
don't identify who's making them. Format: `"AppName contact@email.com"`.

## Deploying (Railway)

This repo is a monorepo — the frontend's `package.json` lives at the repo root and the backend's
lives in `server/`. **If you connect this GitHub repo directly in the Railway dashboard, you
must set the service's Root Directory to `server`**, or Railway's Nixpacks builder will
auto-detect the root `package.json` (the Vite frontend), build *that*, and serve its static
`index.html` on every route instead of running the Express server — including on `/health` and
every `/api/*` route, which will silently return HTML instead of JSON.

To set it: in the Railway dashboard, open the service → **Settings → Source → Root Directory** →
set it to `server` → redeploy. `server/railway.json` (committed in this repo) then takes over
and tells Railway exactly how to build and start it (`npm run build`, `npm run start`,
health-checked at `/health`) — no other config needed once Root Directory is correct.

Via CLI instead of the dashboard:

1. `railway login`
2. From this `server/` directory: `railway init` (or `railway link` to an existing project) —
   running these commands from inside `server/` is what makes the CLI treat it as the deploy
   root, equivalent to setting Root Directory in the dashboard.
3. Set env vars: `railway variables set SEC_USER_AGENT="SmartMoneyDashboard you@example.com" CORS_ORIGIN=https://your-frontend-domain.vercel.app`
4. `railway up`
5. Note the deployed URL, then set it as `VITE_API_BASE_URL` in the frontend's Vercel project settings.
6. Set up the keep-alive ping (below) with the same URL so Railway doesn't scale the service to
   zero for inactivity.

**Sanity check after any deploy:** `curl https://your-railway-url/health` should return
`{"status":"ok"}`. If it returns an HTML document instead, Root Directory is still wrong.

## Keep-alive ping

Railway's usage-based billing scales idle services to zero, which means a quiet backend can take
a few seconds to cold-start on the next request. `.github/workflows/keep-alive.yml` pings
`/health` every 10 minutes via GitHub Actions' scheduler to keep it warm, and fails (triggering a
GitHub notification) if the backend doesn't respond — a free uptime check as a side effect.

To wire it up: in the GitHub repo, go to **Settings → Secrets and variables → Actions →
Variables** and add `RAILWAY_BACKEND_URL` set to the deployed backend's base URL (e.g.
`https://smart-money-server-production.up.railway.app`, no trailing slash, no `/health` suffix —
the workflow appends that itself). You can trigger it manually from the Actions tab
(`workflow_dispatch`) to test before waiting for the schedule.

Note: GitHub's cron scheduler is best-effort, not exact — during periods of high load, scheduled
runs can be delayed by several minutes. That's fine here since the goal is "traffic every so
often," not precise timing.

## Known limitations

- **13F parsing** matches holdings to tracked tickers by normalized issuer name (13F filings
  carry no ticker, only a free-text name + CUSIP). This is solid for the ~30 tracked tickers but
  isn't a general-purpose solution.
- **Large filers** (Vanguard, BlackRock, State Street) file 13Fs with thousands of holdings rows;
  fetching + parsing those is slower than the smaller funds. Responses are cached for 30 minutes
  server-side to absorb this.
- **Polymarket route is untested from this sandbox** — the dev environment this was built in has
  gamma-api.polymarket.com blocked at the network/DNS level (unrelated to the code). Verify it
  once running somewhere with normal internet access.
