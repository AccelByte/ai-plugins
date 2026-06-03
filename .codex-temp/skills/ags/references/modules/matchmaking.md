---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
see-also:
- '[matchmaking.md](../ecosystem/matchmaking.md)'
- '[lobby.md](lobby.md)'
- '[session.md](session.md)'
---

# Module — Matchmaking

Rule-based matchmaking. Consumes **tickets** (player or party requests with attributes — MMR, region, mode, party size, custom attributes) and emits **matches** when the ticket pool satisfies the configured rule set.

> **Deep work routes through `/ags matchmaking`.** This file covers the conceptual shape only — what matchmaking is and how it fits with Lobby, Sessions, and AMS. For rule design, MMR tuning, ticket lifecycle internals, region routing, scoring algorithms, or debugging match formation, route via the matchmaking redirect in `SKILL.md` or `references/ecosystem/matchmaking.md`.

---

## What it covers (at the conceptual level)

- **Tickets** — a player's or party's request to be placed in a match, with attributes.
- **Rule sets** — a configured expression that decides when a set of tickets should form a match (e.g. "two parties of equal MMR within 200 points, in the same region").
- **Match formation** — the matchmaking service produces a match when the rule set is satisfied; the match carries the player roster and triggers session creation.
- **Region routing** — picks a deployment region for the match; configurable per match pool (see Configure region-based matchmaking in AGS docs).
- **Backfill** — slot-filling strategies for matches in progress.
- **Custom attributes** — per-game data on tickets (loadout, preferred mode, skill bands, etc.) that rule sets can reference.

## How matchmaking flows with the rest of AGS

```
   Lobby (party formation)
        │
        ▼
   Matchmaking (ticket → match)
        │
        ▼
   Session (game session creation)
        │
        ▼
   AMS (server allocation)
        │
        ▼
   game clients connect
```

Each step is a separate AGS module / product. Native rule sets cover most matchmaking needs; when they don't, the answer is **Extend Override**, not custom server-side glue. That conversation routes to `/ags-extend ask` after `/ags matchmaking` confirms the native rule ceiling has been hit.

## When to hand off

| Question | Route |
|---|---|
| "What is matchmaking?" | Stays here |
| "How does matchmaking fit with Lobby and Sessions?" | Stays here (also see `references/integrate/lobby-session.md`) |
| "Should I add matchmaking?" | `/ags handoff` |
| Anything about rule expressions, MMR, ticket lifecycle, region routing, debugging match formation | `/ags matchmaking` |
| Customizing the matchmaking decision beyond what native rules can express | `/ags-extend ask` (Override pattern) |

## Where to look in the docs

- AccelByte matchmaking docs: `https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/`
- For depth: `/ags matchmaking` (capability route).
