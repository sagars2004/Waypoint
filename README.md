# Waypoint

Waypoint is a multimodal NYC/NJ commute agent that tells commuters when to leave, with a confidence level and a Plan B. It is built on NVIDIA Nemotron through Nebius Token Factory for the Nebius x NVIDIA Global AI Hackathon.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` after the development server starts. Waypoint runs against deterministic replay fixtures by default, so the dashboard and tests do not require external API keys.

## Replay and live modes

Replay mode is the default:

```dotenv
USE_LIVE_FEEDS=false
```

To enable external transit, traffic, weather, and alert lookups, set `USE_LIVE_FEEDS=true` and provide the relevant credentials in `.env.local`. Optional integrations include Nebius for model responses, LangSmith for lead-agent tracing, Tavily for agency-alert research, and Mapbox for map tiles. Missing optional credentials fall back to deterministic local behavior where supported.

## Verification

```bash
npm test
npm run test:e2e
npm run lint
npm run build
npm audit --omit=dev
```

The end-to-end suite uses replay mode and starts its own local Next.js server. API responses include `latencyMs` and a `Server-Timing` header; when LangSmith is configured, lead-agent decisions are traced under the `waypoint` project.
