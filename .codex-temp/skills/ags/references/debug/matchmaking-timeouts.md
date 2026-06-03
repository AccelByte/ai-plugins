---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[matchmaking.md](../modules/matchmaking.md)'
- '[matchmaking.md](../ecosystem/matchmaking.md)'
- '[debug.md](../../subskills/debug.md)'
- '[doctor.md](../../subskills/doctor.md)'
---

# Debug — Matchmaking Timeouts

Common matchmaking timeout / failure-to-form symptoms and their usual root causes. Used by `subskills/debug.md` and `subskills/doctor.md`.

> **Anything beyond conceptual matchmaking diagnosis belongs in `/ags matchmaking`.** This file covers first-pass diagnosis: is the ticket reaching matchmaking, is the rule set viable, is server allocation succeeding. For rule design fixes, MMR tuning, ticket lifecycle internals, hand off.

---

## Symptom: Tickets always time out, no matches form

**Likely cause:** rule set is too strict for the current player pool.

Check:

1. Number of active tickets at submission time — if there's only one player in queue, rules requiring N opposing players obviously can't satisfy.
2. Rule set's MMR / region / mode constraints — if the ruleset supports a flex/relax mode, constraints may be configured to loosen; check the match pool's timeout and the ruleset's flex configuration in Admin Portal.
3. Custom-attribute filters — a rule that requires `region=eu-west AND mode=ranked AND skill_band=gold` is multiplicative; few players satisfy all three.

Fix: hand off to `/ags matchmaking` for rule re-design. As a first-aid measure, widen the rule set's opening constraints and add expansion thresholds.

## Symptom: Matches form but server allocation fails

**Likely cause:** AMS fleet (or studio fleet) can't allocate.

Check:

1. AMS fleet capacity in the requested region.
2. AMS fleet capacity in the requested region — check AMS fleet configuration for server pool status and capacity limits.
3. AMS status / incidents.

Fix: hand off to `/ags ams` for fleet-side diagnosis. Studios on their own fleets debug their fleet code.

## Symptom: Matches form sometimes but inconsistently

**Likely cause:** ticket arrival timing relative to rule-set expansion windows.

Check:

1. The rule set's expansion timeline — at what age does the rule loosen? Are tickets timing out before reaching that loosened state?
2. Ticket timeout duration (configured per match pool) — too short and you reject viable matches that would have formed seconds later.

Fix: tune the rule expansion. This is `/ags matchmaking` territory.

## Symptom: One-sided matches (huge skill gaps)

**Likely cause:** rule set is too lax on MMR matching.

Check:

1. MMR distribution in the player pool.
2. Rule-set MMR constraint — maximum MMR delta allowed at match formation.
3. Edge-of-bell-curve players (very high or very low MMR) — these often face match-forming failures because the rule set has too few candidates at their skill level.

Fix: tune MMR constraints. `/ags matchmaking`.

## Symptom: Matches form but players never connect to server

This is no longer a matchmaking issue — it's a Sessions / AMS / network issue. See `references/debug/lobby-disconnects.md` and `/ags ams` if it's specifically server connectivity.

## When to escalate

- Anything in the rule expression layer → `/ags matchmaking`.
- Fleet-side allocation failures → `/ags ams`.
- Sessions-side connection failures → check `references/modules/session.md` and `references/debug/lobby-disconnects.md`.
- Persistent 5xx from matchmaking endpoint → AccelByte support.
