# Fandance PWA

Fandance is a professional Progressive Web Application (PWA) designed for individual investors to track, manage, and mathematically rebalance their investment portfolios. 

![Fandance Preview](https://github.com/MarcosIbanezFandos/Fandance-PWA/assets/preview.png)

## About
Managing a diversified portfolio can be mathematically complex. Fandance solves this by allowing users to set target allocation weights for their assets (Stocks, ETFs, Crypto). The built-in algorithm calculates exactly what to buy or sell to restore the target balance while minimizing deviations.

Fandance features a modern, responsive "Glassmorphism" UI with real-time financial data fetching, Monte Carlo simulations for future projections, and an AI-assisted sentiment analysis of recent market news.

## Features
- **Smart Rebalancing:** Automatically calculates buy/sell orders to reach target allocations when you add new capital.
- **Real-Time Data:** Live market prices fetched via Yahoo Finance.
- **Financial Projections:** Simulate your portfolio's future using Deterministic (Linear) and Monte Carlo models.
- **Market News & Sentiment:** Fetches recent news for your assets and calculates an aggregated Technical Indicator (RSI) sentiment.
- **PWA Ready:** Installable on iOS/Android and desktop with offline support and caching.
- **Secure Authentication:** User accounts managed via Supabase Auth.
- **Multilingual Support:** Seamless toggling between English and Spanish.
- **Dark Mode:** Full dark mode support for night-time viewing.

## Architecture & Tech Stack
The application uses a serverless monorepo architecture designed for seamless deployment on Vercel.

**Frontend (Client):**
- React 18
- Vite
- Tailwind CSS
- Framer Motion (Animations)
- Recharts (Data Visualization)
- Vite PWA Plugin

**Backend (Serverless Vercel Functions):**
- Python 3.10+
- FastAPI (wrapped in Mangum for Vercel)
- `yfinance` (Market data)
- `pandas` & `numpy` (Calculations & Monte Carlo)
- `feedparser` (News aggregation)

**Database & Auth:**
- Supabase (PostgreSQL + GoTrue Auth)

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.10+
- Supabase project

### Setup Environment
1. Clone the repository
2. Set up your environment variables based on `.env.example`:
   - Create `frontend_rebalanceo/.env.development` (for frontend variables)
   - Create `api/.env` or `.env` in the root (for Python variables)

### Run Locally
```bash
# 1. Install frontend dependencies
cd frontend_rebalanceo
npm install

# 2. Install backend dependencies
cd ../api
pip install -r requirements.txt

# 3. Start development servers
# Terminal 1 (Frontend):
cd frontend_rebalanceo
npm run dev

# Terminal 2 (Backend):
cd api
uvicorn index:app --reload
```

## Deployment
This project is configured to be deployed on **Vercel** as a single project.

1. Connect the repository to Vercel.
2. The `vercel.json` file automatically configures:
   - Frontend build (`cd frontend_rebalanceo && npm ci && npm run build`)
   - Python Serverless Functions (`/api/*`)
   - SPA Routing Rewrites
3. Add your environment variables in the Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (Service Role Key)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL=/api`

## License
MIT License. See `LICENSE` for more information.
