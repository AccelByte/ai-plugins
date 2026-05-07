---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[matchmaking.md](matchmaking.md)'
- '[session.md](session.md)'
- '[social.md](social.md)'
- '[lobby-session.md](../integrate/lobby-session.md)'
---

# Module — Lobby

Realtime channel for **party**, **presence**, **chat**, and **invitations**. WebSocket-based. The thing players are connected to between matches and during pre-game queue / draft / character-select / loadout flows.

---

## What it covers

- **Party** — a group of players intending to play together. Created, joined, disbanded around play sessions.
- **Presence** — online / offline / in-game / AFK status. Updated by the Lobby connection state.
- **Chat** — party chat, global chat (where enabled), private DM-style chat.
- **Invitations** — party invites, friend invites, custom invites.
- **WebSocket lifecycle** — clients connect to Lobby on login, disconnect on logout. Reconnection handled by the SDK.

## How Lobby relates to the other modules

| Module | Relationship |
|---|---|
| **IAM** | Lobby authenticates players via the AGS token; no separate Lobby auth |
| **Matchmaking** | A party in Lobby submits a matchmaking ticket; matchmaking groups parties into matches |
| **Session** | When a match confirms, Lobby's party state transitions into a game session |
| **Social** | Friends and presence are surfaced through Lobby |

For the lobby ↔ session flow specifically, see `references/integrate/lobby-session.md`.

## Where Lobby ends

- **Game session lifecycle after match start** belongs in Session Management — see `references/modules/session.md`.
- **Friends graph** lives in Social, not Lobby — see `references/modules/social.md`. Lobby surfaces presence; Social owns the relationship data.
- **Voice chat** is not part of Lobby. AccelByte publishes a Vivox integration as an Extend Service Extension; that conversation belongs in `/ags-extend`.

## Where to look in the docs

- AccelByte Lobby docs: `https://docs.accelbyte.io/`
