# Fandance PWA 💸

Fandance is a Progressive Web App (PWA) for individual investors to track and
**rebalance an index-fund portfolio the same way a robo-advisor does** — you set
a target allocation and Fandance tells you exactly how much to put into each
asset every month to stay on plan.

It follows the passive, target-weight rebalancing methodology popularised by
robo-advisors such as **Indexa Capital**
([reference](https://support.indexacapital.com/es/esp/rebalanceo)), and takes UI
cues from broker/aggregator apps like **Trade Republic** and **Parqet**.

> ⚠️ Not investment advice. Fandance is a personal money-management tool; you
> execute any trades yourself in your own broker.

---

## Why it stays in sync with your broker

Fandance prices your holdings with **live market data from Yahoo Finance**
(`units × current price`). Your broker (e.g. Trade Republic) values the *same*
shares with the *same* market prices, so **as long as the number of units
matches, the value in Fandance fluctuates identically to your broker** — no
paid data feed needed. The only thing you keep in sync is the unit count, which
you do once a month when you log your contribution (or via the CSV import).

---

## Features

### Rebalancing
- **Two modes:**
  - **Contribute only** *(default)* — spreads your monthly money across the
    assets that are furthest **below** their target, so you drift back toward
    your plan **without ever selling**. The whole contribution is allocated
    (buys only); nothing is left unspent.
  - **Full rebalance** — also **sells** overweight assets to land exactly on
    the target weights.
- **Target weights set from Settings** — a dedicated *Target Allocation* editor
  with a live "sum = 100%" check, plus **Equal split** and **Scale to 100%**
  helpers. Targets can also be edited inline in the plan table.
- **Clear plan table** — per asset: current %, target %, drift, and the exact
  amount (€ and units) to buy/sell, with a totals row.
- **History & undo** — every applied contribution is logged and reversible.

### Performance (Rentabilidad)
A Trade Republic / Parqet-style performance tab computed from your contribution
history and live value:
- Portfolio value, amount invested, gain (€ and %).
- **IRR / TIR** (money-weighted return, XIRR over your real cash-flow dates).
- Value-evolution chart.
- **Net total** breakdown with optional fees and taxes.
- "Since" date is derived from your first logged contribution (nothing is
  hard-coded).

### Sync & data
- **CSV holdings import** — paste a `symbol/ISIN/name, units` export from
  Trade Republic or Parqet to update your units in one go.
- **Live market data** via `yfinance`; asset search and metadata auto-fetched.
- **Market news & RSI sentiment** per asset.
- **Projections** — deterministic and Monte Carlo future simulations.

### App
- Installable **PWA** (offline caching) for iOS/Android/desktop.
- **Supabase Auth** accounts; multiple portfolios per user.
- **English/Spanish** and full **light/dark mode**.

---

## Architecture & Tech Stack

Serverless monorepo designed to deploy as a single **Vercel** project.

**Frontend** — React 18 · Vite · Tailwind CSS · Framer Motion · Recharts · Vite PWA
**Backend** — Python · FastAPI (Vercel Python Functions) · `yfinance` · `pandas`/`numpy` · `feedparser`
**Data & Auth** — Supabase (PostgreSQL + GoTrue Auth)

```
Fandance-PWA/
├─ frontend_rebalanceo/   # React + Vite SPA (the app)
│  └─ src/
│     ├─ components/       # Dashboard (rebalancer), Sidebar, UI, ...
│     ├─ pages/            # Performance, Analysis, Settings, ...
│     ├─ config/           # allocation.js (target-weight defaults)
│     └─ utils.js          # rebalancing engine (buildRebalancePlan) + XIRR
├─ api/                    # FastAPI serverless functions (index.py)
└─ vercel.json             # build + routing for Vercel
```

The rebalancing math lives client-side in `frontend_rebalanceo/src/utils.js`
(`buildRebalancePlan`), so it is easy to read, test and reuse.

---

## Local Development

### Prerequisites
- Node.js 20+, Python 3.10+
- A Supabase project (free tier is enough)

### Configure environment (use placeholders — never commit real keys)
- `frontend_rebalanceo/.env.development`
  ```
  VITE_API_URL=http://localhost:8000/api
  VITE_SUPABASE_URL=your-project-url
  VITE_SUPABASE_ANON_KEY=your-anon-key      # ANON key only, never service_role
  VITE_ADMIN_EMAIL=you@example.com          # optional: who gets the default targets
  ```
- Backend env (e.g. `api/.env`)
  ```
  SUPABASE_URL=your-project-url
  SUPABASE_KEY=your-service-role-key         # server-side only
  ```

### Run
```bash
# Frontend
cd frontend_rebalanceo && npm install && npm run dev

# Backend (separate terminal)
cd api && pip install -r requirements.txt && uvicorn index:app --reload --port 8000
```

The database schema (tables `portfolios`, `portfolio_items`, `assets`,
`rebalance_history`, `rebalance_history_items`) lives in your Supabase project.

---

## Deployment (Vercel)

`vercel.json` wires everything up as one project: it builds the frontend, serves
the Python API under `/api/*`, and rewrites SPA routes. Set these environment
variables in the Vercel dashboard:

| Variable | Scope | Notes |
|----------|-------|-------|
| `VITE_API_URL` | Frontend | `/api` |
| `VITE_SUPABASE_URL` | Frontend | project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | **anon** key |
| `VITE_ADMIN_EMAIL` | Frontend | optional owner email for default targets |
| `SUPABASE_URL` | Backend | project URL |
| `SUPABASE_KEY` | Backend | **service_role** key (server-side only) |

> 🔐 **Security:** the `service_role` key bypasses Row Level Security — keep it
> in server-side env vars only, **never** in the frontend and **never**
> committed to the repo. If a key was ever committed, rotate it in
> Supabase → *Settings → API*.

---

## License
MIT — see `LICENSE`.
