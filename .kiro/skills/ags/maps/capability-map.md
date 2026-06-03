---
last-verified: 2026-05-26
---

# AGS Capability Map

Use this map after the top-level `/ags` router selects AGS as the owning product.

| User intent | Owner |
| --- | --- |
| What is AGS, what module should I use, deployment model, pricing, high-level comparison | `../subskills/ask.md` |
| Connect Admin Portal, namespace, CLI, MCP, SDK install, UI generator | `../subskills/connect-portal.md`, `../subskills/install-cli.md`, `../subskills/install-mcp.md`, `../subskills/install-sdk.md`, `../subskills/generate-ui.md` |
| Broad game-code integration across auth, lobby, session, matchmaking, travel, UI | `../workflows/online-game-flow.md` (planning gate), then `../subskills/integrate.md` (module wiring helper) |
| Skill-based matchmaking, MMR, rule tuning, tickets, X-Ray, backfill | `../capabilities/matchmaking/router.md` |
| Dedicated-server fleet, AMS upload, watchdog, warmed pool, claim keys, local AMS Simulator | `../capabilities/ams/router.md` |
| Login, OAuth clients, identity linking, device auth, namespace access | `../references/modules/iam.md` plus `../subskills/integrate.md` when code changes are needed |
| Stats, stat definitions, progression values used by matchmaking or leaderboard | `../references/modules/statistics.md` plus the owning workflow |
| Leaderboards | `../references/modules/leaderboards.md` |
| Achievements | `../references/modules/achievements.md` |
| Store, entitlements, wallet, catalog | `../references/modules/store-entitlements.md` |
| Analytics events and observability | `../references/modules/analytics.md`, `../references/observe/event-catalog.md`, `../subskills/observe.md` |
| Extend Override, Event Handler, or Service Extension | `/ags-extend` |
| ADT crash, performance, build distribution, or telemetry tooling | `/adt` |
