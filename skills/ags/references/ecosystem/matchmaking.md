---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
see-also:
- '[matchmaking.md](../modules/matchmaking.md)'
- '[session.md](../modules/session.md)'
- '[handoff.md](../../subskills/handoff.md)'
---

# Ecosystem — Matchmaking

Pointer reference. Matchmaking is **part of AGS architecturally** — it's one of the AGS modules — but the rule design / MMR tuning / ticket lifecycle / region routing surface is deep enough to warrant its own peer skill, `/ags-matchmaking`. This file describes when an AGS conversation should hand off to that skill.

**Routing rule.** Anything beyond conceptual matchmaking (rule design, MMR formulae, ticket lifecycle internals, region routing logic, scoring algorithms, debugging match formation, ruleset tuning) belongs in `/ags-matchmaking`. `/ags` covers conceptual matchmaking ("what is it?", "how does it fit with Lobby and Sessions?", "should I add it?") in `ask` and the matchmaking module reference.

---

## What AGS Matchmaking is

A rule-based matchmaking service that consumes tickets (player or party requests with attributes — MMR, region, mode, party size, custom attributes) and emits matches when constraints are satisfied. Tightly integrated with Lobby (parties), Sessions (game session creation post-match), and AMS (server allocation when a match confirms).

## Why matchmaking gets its own skill

The "match" concept sounds simple but the surface area is large:

- **Rule expressions** are their own DSL. Studios spend real time writing, testing, and tuning them.
- **MMR / skill modeling** has multiple supported approaches (Elo, TrueSkill-like). Choosing and tuning one is non-trivial.
- **Ticket lifecycle** has timeout, expansion, backfill, and partial-match behaviors that all interact.
- **Region routing** picks regions based on player latency, cost, or custom rules — and matters a lot at scale.
- **Debugging** ("why aren't matches forming?", "why are matches lopsided?", "why is wait time spiking?") is a discipline of its own.

Trying to inline all of this into `/ags` would either bury the rest of the AGS conversation or stay too shallow to be useful. `/ags-matchmaking` exists to give matchmaking the depth it needs.

---

## When to hand off to `/ags-matchmaking`

Strong signals (route immediately):

- "Help me write a matchmaking rule for X."
- "Why aren't matches forming?"
- "Tune my MMR formula."
- "Players are getting unfair matches."
- "Wait times are too long."
- "How do I do region routing for low-latency-first?"
- "Help me design a backfill strategy."
- "Ticket expiration / expansion behavior."

Stay in `/ags` for:

- "What is matchmaking?" (conceptual)
- "Does AGS have matchmaking?" (yes — pointer)
- "Should I add matchmaking?" (conceptual; route to `handoff` for the broader module-selection question)
- "How does matchmaking fit with Lobby and Sessions?" (conceptual; covered in `references/modules/matchmaking.md` and `references/modules/session.md`)

---

## Relationship to Extend

Matchmaking customization that goes beyond what native rule expressions can do is an **Extend Override** problem — you replace the matchmaking decision with your own gRPC handler. That conversation belongs in `/ags-extend ask`, not `/ags-matchmaking`. The handoff order:

1. Native matchmaking rule design → `/ags-matchmaking`.
2. If native rules can't express what's needed → `/ags-extend ask` to confirm Override is the right pattern.
3. Then `/ags-extend wizard` / `init` to scaffold the Override app.

---

## Where to send users for the actual matchmaking work

`/ags` does not own matchmaking depth. When the user has a matchmaking-specific problem, point them at the peer skill:

> Run `/ags-matchmaking` for matchmaking — rule design, MMR tuning, ticket lifecycle, region routing, debugging match formation. Matchmaking is part of AGS architecturally but has its own peer skill because the surface area is deep enough to warrant one.

For broader context outside this repo:

- AccelByte matchmaking docs at `https://docs.accelbyte.io/`.
- `references/modules/matchmaking.md` for the conceptual "what is matchmaking in AGS?" overview.
