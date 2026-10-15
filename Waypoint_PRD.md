# Waypoint — Product Requirements Document

Waypoint is a multimodal NYC/NJ commute agent that tells commuters when to leave, with a confidence level and a Plan B, built on NVIDIA Nemotron through Nebius Token Factory for the Nebius x NVIDIA Global AI Hackathon (Best Apps & Agents track).

## 1. Overview and elevator pitch

**Elevator pitch:** Citymapper tells you how to get there. Waypoint tells you whether you will make it, and what to do if you won't. It reads live PATH, NJ Transit, MTA, ferry, driving and weather data, then gives a leave-by verdict (comfortable, tight but doable, or reroute now) with a confidence level, a ready Plan B, and a chat for follow-ups.

**Core insight:** commuters rarely ask "what's the route?" They ask "will I make it if I leave now?" Waypoint treats commuting as a journey-risk problem, the same reframe that made Concourse work ("will I make my flight if I eat here?").

| Item | Detail |
| --- | --- |
| Product | Waypoint, a multimodal NYC/NJ commute agent |
| Hackathon | Nebius x NVIDIA Global AI Hackathon |
| Track | Best Apps and Agents |
| Platform | Responsive web app, designed phone-first |
| Region | New York City and New Jersey (trains, PATH, light rail, buses, ferries, driving) |
| AI | NVIDIA Nemotron models served on Nebius Token Factory |
| Lineage | Same framework as Concourse: relatable pain, a time-risk reframe, lead agent plus subagents, a scoring API, and one dense bento-grid view with a map and chat |

**What the app does, in one pass:** the user saves a commute (origin, destination, arrive-by time, accepted modes). Waypoint ingests live feeds, scores the candidate routes on time, risk, cost and preference, and returns a verdict with a one-sentence reason and a Plan B. The user can then ask follow-up questions in natural language.

## 2. Problem, users and goals

**Problem:** the NYC/NJ commute crosses several agencies (PATH, NJ Transit, MTA, ferries, Port Authority crossings), and each publishes alerts and delays in a different place and format. Existing apps show arrivals and routes but leave the decision to the rider: leave now, leave earlier, or switch modes. A wrong call costs a missed meeting or a long wait.

### Target users

| Persona | Situation | What they need |
| --- | --- | --- |
| NJ-to-NYC rail and PATH commuter | Same route daily, hit by delays | A leave-by time they can trust and a fallback when a line degrades |
| Multimodal or hybrid commuter | Chooses between train, bus, ferry and driving | A comparison that weighs risk, not just minutes |
| Occasional commuter or visitor | Unfamiliar with agency quirks | Plain-language explanations and a clear next action |

### Goals

1. Give a clear verdict (comfortable, tight, reroute) for a saved commute in under 8 seconds.
2. Show confidence and data freshness with every verdict, and never present a guess as certain.
3. Always offer a Plan B using a different line or mode.
4. Answer follow-up questions grounded in the same live data.
5. Degrade gracefully: if a feed is down, say so and still produce a lower-confidence verdict.
6. Demonstrate Nemotron on Nebius Token Factory in a way judges can verify (traces, README, demo video).

### Non-goals (MVP)

- Ticket purchase or payments.
- Turn-by-turn navigation or step-by-step walking directions.
- Push notifications and background alerts (stretch goal only).
- User accounts with passwords (use a local profile or a simple session).
- Coverage outside NYC/NJ, or every route in the region. The demo needs one or two corridors done well.

### Success metrics

| Metric | Target | How measured |
| --- | --- | --- |
| Verdict latency (p95) | Under 8 seconds | App timing logs |
| Verdict quality | At least 80% agreement with human-labeled scenarios (initial target, tune after first eval) | Toloka labels plus LangSmith eval |
| Data freshness | Every verdict shows feed age; transit feeds refreshed at least every 60 seconds | Ingestion logs |
| Transparency | 100% of verdicts show confidence level, reason and data timestamp | Automated test |
| Resilience | Verdict still returned with one feed disabled | Integration test in replay mode |

### Hackathon judging map

| Criterion | How Waypoint addresses it |
| --- | --- |
| Technological Implementation | Lead agent on Nemotron 3 Ultra, fast subagents on Nano or Super, tool calling, live feed ingestion, LangSmith tracing and evals |
| Design | One coherent bento-grid product: verdict card, map, timeline, chat; light and dark themes; phone-first |
| Potential Impact | Real daily pain for NYC/NJ commuters, a specific audience, demonstrated on real feeds |
| Quality of the Idea | Risk-adjusted departure and confidence-aware reasoning instead of an arrivals list |

## 3. Features

Priorities: **P0** = must work in the demo, **P1** = build if P0 is stable, **P2** = stretch. Feature IDs are referenced later in the plan and tests.

| ID | Feature | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| F1 | Commute profile: origin, destination, arrive-by time, accepted modes, preferences (avoid transfers, budget cap, accept ferry) | P0 | A saved profile persists across reloads and drives every verdict |
| F2 | Live data ingestion for NJ Transit (rail, bus, light rail), MTA, and PATH, cached with a freshness timestamp | P0 | Cache refreshes at least every 60 seconds; each source reports its last-updated age |
| F3 | Candidate route generation from static GTFS plus live updates (2 to 4 candidates per request) | P0 | At least two distinct candidates for the demo corridor; each has legs, times, transfers, cost |
| F4 | Verdict engine: comfortable, tight but doable, or reroute now, with confidence and a one-sentence reason | P0 | Every verdict includes state, confidence (high, medium, low), reason, and data timestamp |
| F5 | Plan B: the next-best route on a different line or mode, with its own verdict | P0 | Plan B is always shown when a second candidate exists and is never the same primary line |
| F6 | Map and departure timeline (Mapbox) showing the primary route, Plan B, and the leave-by window | P0 | Map resizes correctly in the bento grid and on theme change |
| F7 | Chat panel for follow-ups ("can I grab coffee and still make the 8:12?") grounded in live data through tools | P0 | Answers cite the data used and state uncertainty; no invented departures |
| F8 | Degraded mode: if a feed is down or stale, say so and lower confidence | P0 | With one feed disabled, a verdict still returns with a visible warning |
| F9 | Replay mode: run the whole app from recorded feed snapshots | P0 | App runs end to end with no network access to transit feeds |
| F10 | Alerts subagent: Tavily pulls agency alert and incident text; a fast model normalizes it to line, severity, expected duration | P1 | Alerts appear as structured items and influence the verdict reason |
| F11 | Reliability layer from NJ Transit on-time performance data, enabling risk-adjusted departure ("leave 8 minutes earlier to be about 90% safe") | P1 | A per-line reliability score is shown and changes the leave-by time |
| F12 | Driving option using NYC DOT traffic speeds and Mapbox traffic-aware directions, plus a toll note | P1 | Driving appears as a candidate with a traffic-adjusted time |
| F13 | Ferry option (NYC Ferry, NY Waterway) as a Plan B | P1 | A ferry candidate is generated where service exists |
| F14 | Weather awareness (NWS or Open-Meteo) that adjusts risk for walking and ferries | P1 | Severe weather changes confidence or the reason text |
| F15 | Light and dark themes, phone-first layout | P1 | Both themes pass a visual check at phone and desktop widths |
| F16 | Meeting-aware mode through Google Calendar: the real deadline versus the comfortable one | P2 | Reads one next event and sets the arrive-by time |
| F17 | Human escalation through Tendem for conflicting or ambiguous sources | P2 | A low-confidence case can be sent for review, with the result shown |
| F18 | Watch mode: re-check a saved commute and surface a change in verdict | P2 | Verdict change shows in the UI without a manual refresh |
| F19 | Bike share first-mile option | P2 | Optional leg added to a candidate |

## 4. Use cases

### User stories

1. As a daily rail commuter, I want one verdict for my saved commute so I know when to leave without checking three apps.
2. As a commuter during a delay, I want a Plan B on a different line or mode so I can switch immediately.
3. As a driver or hybrid commuter, I want driving compared against transit with traffic and tolls considered.
4. As a cautious commuter, I want a risk-adjusted leave-by time ("leave 8 minutes earlier to be about 90% safe") instead of a single ETA.
5. As a user with a question, I want to ask in plain language and get an answer grounded in live data, with uncertainty stated.
6. As a user when data is missing, I want to be told clearly which source is down and how that affects the answer.

### Example flows

| # | Scenario | User action | Waypoint response |
| --- | --- | --- | --- |
| UC1 | Normal morning | Opens the app with a saved commute | Verdict "comfortable", leave-by time, reason, Plan B, map |
| UC2 | PATH delay | Opens during a signal problem | Verdict "tight", leave-by moved earlier, Plan B on NJ Transit or ferry, alert summarized |
| UC3 | Line suspended | Opens during a suspension | Verdict "reroute now", Plan B promoted to primary, one-sentence explanation |
| UC4 | Chat follow-up | Asks "can I grab coffee and still make the 8:12?" | Answer using the current verdict and walking time, with a stated safety margin |
| UC5 | Feed outage | NJ Transit feed unreachable | Warning banner, lower confidence, verdict from remaining sources |
| UC6 | Driving alternative | Enables driving mode | Driving candidate with traffic-adjusted time and toll note, compared against transit |

### Example chat prompts (for demo and tests)

- "When should I leave to be at my desk by 9:00?"
- "What if I walk to a different station?"
- "Is it worth taking the ferry instead?"
- "How reliable is this line in the mornings?"
- "Why did the verdict change?"

## 5. System architecture and data flow

**Design principle:** deterministic code computes times, transfers and risk scores from feed data. The LLM reasons over those structured results, resolves ambiguity, writes the explanation, and answers chat. The model never invents departure times; it may only use values returned by tools.

### Components

| Component | Responsibility | Runs on |
| --- | --- | --- |
| Web client | Bento-grid UI: verdict card, map, timeline, preferences, chat | Next.js (React, Tailwind, shadcn/ui) |
| API layer | Endpoints for commutes, verdicts, chat; calls the orchestrator | Next.js route handlers |
| Orchestrator | Lead agent loop: calls subagents and tools, assembles the verdict and explanation | Server-side module (TypeScript or Python service) |
| Ingestion worker | Polls GTFS-RT and agency feeds on an interval, normalizes, writes snapshots | Nebius Serverless Job or a scheduled process |
| Candidate generator and scorer | Builds routes from static GTFS plus live updates; computes leave-by times, risk and confidence inputs | Deterministic library |
| Alerts subagent | Fetches alert and incident text through Tavily; normalizes with a fast model | Orchestrator tool |
| Reliability job | Aggregates NJ Transit on-time performance into per-line scores | Nightly Nebius Serverless Job |
| Database | Commutes, feed snapshots, alerts, reliability scores, verdict history | Postgres (Nebius managed or Supabase) |
| Model gateway | Nemotron inference over an OpenAI-compatible API | Nebius Token Factory |
| Observability | Traces and evals for every agent run | LangSmith |

### Request flow (verdict)

1. Client calls `POST /api/verdict` with a commute ID (or an inline commute) and the current time.
2. API layer loads the commute and the latest feed snapshots from the database. It does not call agency feeds directly.
3. Candidate generator builds 2 to 4 routes and computes times, transfers, walking legs and base risk.
4. Orchestrator calls the alerts tool (Tavily plus a fast model) for incidents on the lines involved.
5. Orchestrator calls the reliability lookup for those lines.
6. Lead agent (Nemotron 3 Ultra) receives the structured candidates, alerts and reliability data, and returns the verdict state, confidence, reason, and Plan B ranking as JSON.
7. Server validates the JSON against a schema, checks that every time and line it cites exists in the tool data, and stores the result.
8. Client renders the verdict card, map and timeline.

### Request flow (chat)

1. Client calls `POST /api/chat` with the message and commute ID.
2. Orchestrator gives the model the current verdict plus tools: `get_departures`, `get_alerts`, `get_reliability`, `estimate_walk`, `compare_routes`.
3. Model calls tools, then answers with the data it used and any uncertainty. The reply streams back to the client.

### Ingestion and caching rules

- Poll transit real-time feeds every 30 to 60 seconds; poll alerts every 60 to 120 seconds.
- Store the latest snapshot per source with `fetched_at`. Verdict requests read snapshots only.
- Staleness defaults (tune later): under 90 seconds = fresh; 90 to 300 seconds = stale, lower confidence one level; over 300 seconds or a failed source = treat as down, show a warning.
- Replay mode swaps the ingestion worker for recorded snapshots served from disk, so the whole stack runs offline.
- Never store API keys in the repository; read them from environment variables.

## 6. Tech stack and integrations

**Language choice:** TypeScript end to end (one language, shared types between client, API and workers). Python is acceptable for the ingestion worker if preferred.

### Application stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router), React, TypeScript | Same base as Concourse |
| Styling and UI | Tailwind CSS, shadcn/ui | Light and dark themes via CSS variables |
| Map | Mapbox GL JS | Needs a ResizeObserver hook so the map resizes inside the bento grid and on theme change (a lesson from Concourse) |
| Validation | Zod | Validate every model output and every external payload |
| Database | Postgres (Nebius managed, or Supabase as in Concourse) | Tables defined in section 9 |
| Feed parsing | `gtfs-realtime-bindings` (protobuf) | Decodes GTFS-RT from NJ Transit, MTA, and ferries |
| Unit and integration tests | Vitest | Section 13 |
| End-to-end tests | Playwright | Replay mode only |
| License | MIT (or Apache 2.0) | Must be visible at the top of the repository |

### Nebius and NVIDIA

| Capability | Use in Waypoint | Notes |
| --- | --- | --- |
| Nebius Token Factory | All LLM inference through an OpenAI-compatible API, so the standard OpenAI SDK works with a changed base URL | Nebius shows the base URL pattern `https://api.tokenfactory.us-central1.nebius.com/v1/` and the model ID `nvidia/nemotron-3-super-120b-a12b`; confirm both in the console for your account and region |
| NVIDIA Nemotron 3 Ultra | Lead agent: verdict reasoning, tool orchestration, chat | Confirm the exact model ID in the Token Factory catalog |
| NVIDIA Nemotron 3 Super (120B, 12B active, long context, built for tool calling and multi-agent work) | Fallback for the lead agent if Ultra exceeds the latency budget; also a strong subagent | Listed on Token Factory with the Nano, Nano Omni and Ultra models |
| NVIDIA Nemotron 3 Nano | Fast calls: alert normalization, classification, short rewrites | Run in parallel to protect the latency budget |
| Nebius Serverless Endpoints | Host the web app and API | Encouraged by the track, not required |
| Nebius Serverless Jobs | Ingestion worker and the nightly reliability job | Encouraged by the track, not required |

### Model routing

| Task | Model | Reason |
| --- | --- | --- |
| Verdict and Plan B reasoning | Nemotron 3 Ultra | Needs real reasoning over several candidates and alerts |
| Chat with tool calling | Nemotron 3 Ultra (or Super if slow) | Multi-step tool use |
| Alert text to structured fields | Nemotron 3 Nano | Cheap and fast |
| Short explanation rewrite, intent classification | Nemotron 3 Nano | Cheap and fast |

Latency budget: call Ultra once per verdict with compact structured input; run Nano calls in parallel before it; stream chat replies.

### Hackathon sponsor tools

| Tool | Role in Waypoint | Integration notes |
| --- | --- | --- |
| LangSmith | Trace every agent run; run offline evals on verdict accuracy; show before and after results in the demo | Wrap the OpenAI client and key functions with the LangSmith SDK; set the tracing and API key environment variables; use a dedicated project name |
| Tavily | Search and extract agency alert and incident pages and news, which supplement the structured feeds | Use as the unstructured-alerts source; cross-check against GTFS-RT alerts; never use it for arrival times |
| Toloka | Human labelers rate whether a verdict and explanation were reasonable given a snapshot of data; labels become the eval set | Build a small labeling project from replay snapshots; export labels to the eval dataset |
| Tendem.ai | Human-in-the-loop escalation for low-confidence or conflicting-source cases (P2 feature F17) | Confirm the integration method from the credit documentation; keep behind a feature flag |

### External services

| Service | Use |
| --- | --- |
| Mapbox | Map rendering, geocoding, traffic-aware driving directions (confirm current routing profile names in its docs) |
| NWS API or Open-Meteo | Weather |
| Google Calendar OAuth | Meeting-aware mode (P2, optional) |

All data feeds (NJ Transit, MTA, PATH, ferries, NYC DOT) are listed in section 7.
