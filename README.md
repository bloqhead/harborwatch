# ⚓ Harborwatch

Alaska cruise ship schedule tracker — search, filter, and visualize port calls across all Alaskan ports.

Data sourced from [Cruise Line Agencies of Alaska](https://claalaska.com/).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vue 3 + Vite + TypeScript + Pinia |
| Backend | Deno + Oak + SQLite |
| Database | SQLite (via `deno_sqlite`) |
| Scraper | Node.js + pdf-parse |
| Map | Leaflet + CartoDB dark tiles |

All dependency versions are pinned.

---

## Quick Start

### 1. Backend
```bash
cd backend
deno run --allow-net --allow-env --allow-read --allow-write main.ts
# → ⚓ Harborwatch API → http://localhost:8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 3. Scrape data
```bash
cd scraper
npm install

node import-pdfs.mjs --year 2026
node import-pdfs.mjs --year 2025
```

---

## Features

- **Schedule** — search by port, ship, date range, berth code; filter chips; CSV export; hours-in-port column; berth code tooltips
- **Map** — interactive Leaflet map with proportional bubbles per port, colored by region, click for port detail
- **Stats** — monthly activity chart, day-of-week breakdown, busiest port/ship rankings
- **Import** — bulk import via scraper or manual JSON paste

---

## Scraper

The scraper auto-discovers PDF links from the CLA schedule page, so it handles mid-season URL changes automatically. It also scrapes the 3 reference PDFs (berth codes, port codes, ship codes).

```bash
# All ports for a year
node import-pdfs.mjs --year 2026

# Single port
node import-pdfs.mjs --year 2026 --port JNU

# Against a deployed API
node import-pdfs.mjs --year 2026 --api https://harborwatch-api.onrender.com
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/years` | Years with data |
| GET | `/api/ports` | Ports with data |
| GET | `/api/ships` | All ship names |
| GET | `/api/schedule` | Search port calls |
| GET | `/api/stats` | Aggregate stats |
| GET | `/api/port/:code` | Single port detail |
| GET | `/api/reference/:type` | Berth/port/ship code lookups |
| POST | `/api/import` | Bulk import records |
| POST | `/api/reference` | Import reference codes |
| DELETE | `/api/data` | Clear a year's data |

### Schedule query params
`year`, `port`, `ship`, `date_from`, `date_to`, `berth`, `day`, `page`, `limit`

---

## Deploy to Render

`render.yaml` is pre-configured for a two-service deploy.

### Steps

1. Push to GitHub
2. Go to [render.com](https://render.com) → **New → Blueprint** → connect your repo
3. Render creates both services automatically:
   - `harborwatch-api` — Deno backend (Docker) with a 1 GB persistent disk
   - `harborwatch-ui` — Vue static site
4. Render auto-generates `HARBORWATCH_API_KEY` on the API service — copy it from the Environment tab
5. Set `VITE_API_BASE` on the **UI service** to your API's URL (e.g. `https://harborwatch-api.onrender.com`), then redeploy the UI
6. Set `ALLOWED_ORIGIN` on the **API service** to your UI's URL (e.g. `https://harborwatch-ui.onrender.com`) to lock down CORS

### Scrape data into production

```bash
# Copy the API key from Render's Environment tab, then:
node import-pdfs.mjs --year 2025 \
  --api https://harborwatch-api.onrender.com \
  --key YOUR_API_KEY

node import-pdfs.mjs --year 2026 \
  --api https://harborwatch-api.onrender.com \
  --key YOUR_API_KEY
```

> **Note:** Render's free tier spins down after inactivity. The $7/mo Starter tier keeps it always-on.

## Production build
```bash
cd frontend && npm run build        # outputs to frontend/dist/

# Compile backend to single binary
cd backend
deno compile --allow-net --allow-read --allow-write main.ts -o harborwatch-api
```
