---
last-verified: 2026-05-26
---

# AGS Service Map

This map connects product language, AGS CLI groups, and backend service names. It is a lookup layer, not the skill architecture.

| Product concept | AGS CLI surface | Backend/service label seen in specs or logs | Canonical skill owner |
| --- | --- | --- | --- |
| IAM and namespaces | `iam`, `basic` | IAM, Basic | `/ags` |
| Lobby and party | `lobby` | Lobby | `/ags` |
| Session | `session` | Session | `/ags` |
| Matchmaking | `matchmaking`, `match2` | Match v2, Justice Match Service v2 | `/ags` via `../capabilities/matchmaking/router.md` |
| Statistics | `social stat-definitions`, stats APIs | Statistic, Social | `/ags` |
| Leaderboards | `leaderboard` | Leaderboard | `/ags` |
| Achievements | `achievement` | Achievement | `/ags` |
| Store and entitlements | `platform`, commerce APIs | Platform, Entitlement, Store | `/ags` |
| Analytics | analytics APIs and event sinks | Analytics | `/ags` |
| AccelByte Multiplayer Servers | AMS CLI and `amssim` | fleet-commander, AMS | `/ags` via `../capabilities/ams/router.md` |
| Extend | Extend helper CLI | Extend | `/ags-extend` |
| ADT | ADT tooling | ADT | `/adt` |
