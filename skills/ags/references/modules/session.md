---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[matchmaking.md](matchmaking.md)'
- '[lobby.md](lobby.md)'
- '[ams.md](../ecosystem/ams.md)'
- '[lobby-session.md](../integrate/lobby-session.md)'
---

# Module — Session Management

Session lifecycle, server assignment, reconnection. The thing that wraps a match in progress — pre-game lobby state, server allocation, in-game state, post-game settlement.

---

## What it covers

- **Session lifecycle states** — created, joined, in-game, finished. Game clients move between these.
- **Server assignment** — when a match confirms, Session Management triggers server allocation. AGS routes allocation to AMS by default.
- **Game session vs. party session** — a party session is a group hanging out before/between matches; a game session is the in-progress game with a server. Related but tracked separately.
- **Reconnection** — handles dropped player reconnecting to the same session within a configurable window.
- **Roster management** — tracks who's in the session, who's left, who's been kicked.

## How Session relates to the other modules

| Module | Relationship |
|---|---|
| **Lobby** | Party session in Lobby transitions into a game session here when matchmaking succeeds |
| **Matchmaking** | Match confirmation in matchmaking creates a session in Session Management |
| **AMS** | Session triggers AMS to allocate a server; AMS responds with a server endpoint that goes back into the session |
| **IAM** | Session uses player tokens to authorize join/leave operations |

For the Lobby → Matchmaking → Session flow end-to-end, see `references/integrate/lobby-session.md`.

## Server allocation

Session Management triggers server allocation when a match confirms. The default destination is **AMS**. Studios using their own dedicated-server fleets implement an allocation callback between Session and their fleet — the integration cost AMS eliminates.

For the SDK side (how a game client gets the allocated server's endpoint from a session), the integration belongs in `/ags integrate`. For the AMS side (fleet config, warmed pools, watchdog), hand off to `/ags-ams`.

## Where Session ends

- **Inside-match server logic** — AccelByte doesn't run your gameplay loop; Session manages the wrapper, not the game.
- **Custom session-creation logic** that goes beyond default behavior is an Extend Override conversation. Route to `/ags-extend ask`.
- **Voice chat sessions** — handled by external services like Vivox; AccelByte ships a Vivox integration as an Extend Service Extension.

## Where to look in the docs

- AccelByte Session Management docs: `https://docs.accelbyte.io/`
