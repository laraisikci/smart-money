# smart-money

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-xr5dfpoa)

Investment dashboard tracking insider trades (SEC Form 4), institutional 13F holdings, and
Polymarket prediction markets. See [`server/README.md`](server/README.md) for the backend that
sources the live data and its known limitations.

## Local development

```bash
# terminal 1 — backend
cd server
npm install
cp .env.example .env   # set SEC_USER_AGENT to a real contact email
npm run dev

# terminal 2 — frontend
npm install
cp .env.example .env.local
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8787`.

## Data sources

- **Insiders** — SEC EDGAR Form 4, live. Only covers tickers with a resolvable SEC CIK (mostly
  US tickers plus a handful of EU issuers with US listings — see `server/src/data/euAdrMap.ts`).
- **Institutions** — SEC EDGAR 13F-HR, live, for 10 major funds.
- **Markets** — Polymarket Gamma API, live.
- **European insider disclosures** — no structured API exists (CNMV/AMF/BaFin/FCA); the Insiders
  and Parliament tabs link directly to each regulator instead.
- **US Congress trades** — no reliable free structured source currently exists; the Parliament
  tab shows this honestly and links to the official Senate/House disclosure search tools.
