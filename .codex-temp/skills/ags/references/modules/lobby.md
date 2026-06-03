---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[matchmaking.md](matchmaking.md)'
- '[session.md](session.md)'
- '[social.md](social.md)'
- '[lobby-session.md](../integrate/lobby-session.md)'
---

# Module — Lobby

Realtime features for **party**, **presence**, **chat**, and **invitations**. Note: the current AGS docs split these across two modules — **Parties & Presence** (party management, platform presence, invitations) and **Chat** (party chat, personal DMs, session chat) — rather than under a single "Lobby" module. This page consolidates both. The thing players are connected to between matches and during pre-game flows.

---

## What it covers

- **Party** — a group of players intending to play together. In AGS, a party is a special session type (invite-only) built on the Session framework, surfaced via the Parties & Presence module.
- **Presence** — online / offline / in-game / AFK status. Updated by the Lobby connection state.
- **Chat** — Personal Chat (DM), Party Chat, Session Chat. These live in the AGS Chat module.
- **Invitations** — party invites, friend invites, custom invites.
- **WebSocket lifecycle** — clients connect to Lobby on login, disconnect on logout. Reconnection handled by the SDK. (Verify current WebSocket lifecycle behavior against SDK release notes — no public AGS source confirmed.)

## How Lobby relates to the other modules

| Module | Relationship |
|---|---|
| **IAM** | Lobby authenticates players via the AGS token; no separate Lobby auth |
| **Matchmaking** | A party in Lobby submits a matchmaking ticket; matchmaking groups parties into matches |
| **Session** | When a match confirms, the Session module creates a game session; party members are transferred into it (a session-type change, not a module handoff) |
| **Social** | Friends and presence are surfaced through Lobby |

For the lobby ↔ session flow specifically, see `references/integrate/lobby-session.md`.

## Where Lobby ends

- **Game session lifecycle after match start** belongs in Session Management — see `references/modules/session.md`.
- **Friends graph** lives in Social, not Lobby — see `references/modules/social.md`. Lobby surfaces presence; Social owns the relationship data.
- **Voice chat** is not part of Lobby. Studios typically integrate a third-party voice SDK (e.g. Vivox, Agora) as an Extend Service Extension; that conversation belongs in `/ags-extend`.

## Where to look in the docs

- AccelByte Lobby docs: `https://docs.accelbyte.io/`
