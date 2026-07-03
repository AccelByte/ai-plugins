---
last-verified: 2026-05-26
see-also:
- '[region.md](region.md)'
- '[backfill.md](backfill.md)'
- '[debug.md](debug.md)'
- '[doctor.md](doctor.md)'
---

# AGS Matchmaking Capability Router

This router owns native AGS Matchmaking work inside the canonical `/ags` skill.

## Route Order

1. If the user asks to add, build, configure, tune, or change a matchmaking feature, route to `plan.md`.
2. If the user explicitly asks for ruleset JSON or alliance/matching/flexing rules, route to `ruleset.md`.
3. If the user asks to attach a ruleset to a queue, session template, ticket timing, cross-play setting, or backfill flag, route to `pool.md`.
4. If the user asks about QoS, latency maps, region expansion, or region selection, route to `region.md`.
5. If the user asks about replacing players in an existing session, partial proposal acceptance, or `StopBackfilling`, route to `backfill.md`.
6. If the user asks for SDK ticket submission, cancellation, match-found handling, session join, or game-code wiring, route to `integrate.md`.
7. If the user asks why matches are not forming, why teams are unfair, or why wait time changed, route to `debug.md`.
8. If the symptom is unclear, route to `doctor.md`.
9. If the user asks conceptual questions, route to `ask.md`.

## Cross-Service Gates

- If a matchmaking request includes multiple player-facing game integration slices, stop and route to `../../workflows/online-game-flow.md` before reading deeper capability files.
- Do not inspect matchmaking rules, pools, SDK code, or AGS state for multi-slice game integration until the first slice is confirmed.
- Player-facing matchmaking implementation must use `../../workflows/online-game-flow.md` before game-code edits.
- Skill-based matchmaking must read `../../references/modules/statistics.md`; player-facing implementation must satisfy `../../workflows/online-game-flow.md` before code edits.
- Dedicated-server matchmaking must coordinate `../ams/router.md` and `../../references/modules/session.md`; player-facing implementation must satisfy `../../workflows/online-game-flow.md` before code edits.
- P2P matchmaking implementation in a game project must first satisfy `../../workflows/online-game-flow.md`; after an approved Game Flow Plan exists, use `../../references/modules/session.md` as supporting context. For Unreal P2P or listen-server networking, read `../../references/sdks/game-engine/unreal-p2p.md`.
- Player-facing game flow implementation must use `../../workflows/online-game-flow.md`.

## Extend Boundary

Native rules, pools, ticket lifecycle, region routing, and backfill stay here.

Custom gRPC handlers that replace `GetStatCodes`, `EnrichTicket`, `ValidateTicket`, `MakeMatches`, or `BackfillMatches` belong to `/ags-extend`. This router may explain the boundary, but `/ags-extend` owns the deployment lifecycle.
