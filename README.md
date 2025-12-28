# StockResearchApp

A passwordless stock research dashboard that highlights a daily pick and lets users search tickers for AI-inspired sentiment, catalysts, and multi-source consensus scores. Sessions are cookie-based so users stay signed in after verifying a one-time code.

## Getting started

```bash
npm install
npm run dev # starts the server with nodemon
# or
npm start   # starts the server with node
```

Then visit [http://localhost:3000](http://localhost:3000).

## How it works
- **Passwordless login:** submit an email to receive a one-time code (printed to the server logs in this demo). Verification sets a long-lived, HTTP-only session cookie.
- **Stock of the day:** always pinned with date, direction, thesis bullets, and consensus bars.
- **Research search:** type a ticker or company, pick from autocomplete, and the new tile is added to the top of the board while the daily pick moves down.
- **Persistence:** searched tickers are saved per user in localStorage so tiles are restored on the next visit.

## Configuration
- Set `PORT` to change the server port (default `3000`).
- Set `SESSION_SECRET` to override the session signing secret.

## Notes
This project uses in-memory login code storage and demo research data. For production, swap in a persistent session store, hook the login code sender to an email service, and connect the research endpoints to real AI/market data sources.
