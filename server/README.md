# smart-money-server

Backend proxy for the Smart Money dashboard. Exists because SEC EDGAR has no CORS support and
requires a compliant `User-Agent` header, and because any paid API keys need to stay off the
client — neither is possible calling these APIs directly from the browser.

## Endpoints

| Route | Source | Notes |
|---|---|---|
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

1. `railway login`
2. From this `server/` directory: `railway init` (or link to an existing project)
3. Set env vars: `railway variables set SEC_USER_AGENT="SmartMoneyDashboard you@example.com" CORS_ORIGIN=https://your-frontend-domain.vercel.app`
4. `railway up`
5. Note the deployed URL, then set it as `VITE_API_BASE_URL` in the frontend's Vercel project settings.

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
