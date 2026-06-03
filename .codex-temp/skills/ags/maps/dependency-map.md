---
last-verified: 2026-05-26
---

# AGS Dependency Map

Use this map when a request crosses product-module boundaries.

| Workflow | Required capabilities | Conditional capabilities |
| --- | --- | --- |
| Skill-based matchmaking | Matchmaking, Statistics, Session | AMS for dedicated-server sessions, Analytics for post-match observation |
| Dedicated-server matchmaking | Matchmaking, Session, AMS | Lobby for party flow, Statistics for MMR, Analytics for verification |
| P2P matchmaking | Matchmaking, Session | Lobby for party flow, Statistics for MMR |
| Online game flow | IAM, Lobby, Session | Matchmaking, AMS, Statistics, Analytics |
| Progression and ranked play | Statistics, Leaderboards | Achievements, Matchmaking |
| Commerce-gated access | IAM, Store, Entitlements | Session, Lobby |

## Ownership Rule

One workflow owns the user-facing outcome. Capabilities provide facts, operations, and safety constraints. Do not split a single player-facing outcome into separate public skill handoffs unless the workflow explicitly crosses into `/ags-extend` or `/adt`.
