---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[lobby.md](../modules/lobby.md)'
- '[matchmaking.md](../modules/matchmaking.md)'
- '[session.md](../modules/session.md)'
- '[ams.md](../ecosystem/ams.md)'
- '[matchmaking.md](../ecosystem/matchmaking.md)'
---

# Integrate — Lobby ↔ Session

End-to-end shape for going from "two players in a party" to "two players connected to a dedicated server in a game session". Three AGS modules + (usually) AMS, in sequence.

---

## The flow

```
   ┌── Lobby ──────────────────────────┐
   │                                   │
   │   Players form a party            │
   │   (invites, accept, presence)     │
   │                                   │
   └──────────────┬────────────────────┘
                  │ Party leader submits matchmaking ticket
                  ▼
   ┌── Matchmaking ────────────────────┐
   │                                   │
   │   Ticket queued                   │
   │   Rule set evaluates pool         │
   │   Match formed when constraints   │
   │   are satisfied                   │
   │                                   │
   └──────────────┬────────────────────┘
                  │ Match confirmed
                  ▼
   ┌── Session Management ─────────────┐
   │                                   │
   │   Game session created            │
   │   Triggers server allocation      │
   │                                   │
   └──────────────┬────────────────────┘
                  │ Allocation request
                  ▼
   ┌── AMS (or studio's own fleet) ────┐
   │                                   │
   │   Server allocated                │
   │   Endpoint returned to Session    │
   │                                   │
   └──────────────┬────────────────────┘
                  │ Server endpoint
                  ▼
   ┌── Lobby / Session Management ─────┐
   │                                   │
   │   Players notified                │
   │   Game clients connect to server  │
   │                                   │
   └───────────────────────────────────┘
```

## Where each module's responsibility ends

- **Lobby** — owns party state, presence, chat, invites. Once matchmaking takes over, Lobby tracks the transition but doesn't drive match formation.
- **Matchmaking** — owns the rule set and ticket lifecycle. Once a match is confirmed, hands off to Session Management.
- **Session Management** — owns the session wrapper end-to-end (creation through completion). Triggers server allocation; tracks roster; handles reconnection.
- **AMS** — owns server fleet operations. Returns a server endpoint when allocated.

For matchmaking depth (rule design, MMR, ticket lifecycle), hand off to `/ags-matchmaking`. For AMS operational work, hand off to `/ags-ams`.

## Common gotchas

- **Reconnection windows** — Session has a configurable window for a dropped player to rejoin. Set this carefully; too short and you punish flaky networks, too long and you tie up server capacity.
- **Stale party → match transitions** — if a party member leaves between matchmaking submission and match confirmation, the rule set may stop being satisfied. Decide whether to fail the match (re-queue) or proceed with smaller team.
- **Server endpoint propagation** — game clients need the server endpoint promptly after allocation. Lobby is the channel that pushes it; ensure the WebSocket is healthy at this moment.
- **Crossplay matchmaking** — region routing must respect platform-policy constraints (e.g. PSN ↔ Xbox crossplay rules apply at platform-level, not AGS-level).

## When custom logic is needed

- Custom matchmaking decision (priority, scoring, segmentation) → Extend Override; route to `/ags-matchmaking` first to confirm native rules can't express it, then `/ags-extend ask`.
- Custom backfill → Extend Service Extension or Event Handler; route to `/ags-extend ask`.
- Custom server fleet (non-AMS) → integration is on the studio side; AGS Session Management exposes hooks for allocation callbacks.
