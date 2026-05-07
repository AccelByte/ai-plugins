---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[lobby.md](lobby.md)'
- '[iam.md](iam.md)'
---

# Module — Social

Friends, blocking, notifications. The relationship-graph layer of AGS — durable across sessions, surfaced in Lobby for presence and invitations.

---

## What it covers

- **Friends** — bidirectional relationship between two players. Scoped per namespace.
- **Blocking** — one-way block. Blocked players can't message, invite, or see each other's presence.
- **Friend requests** — request, accept, reject, cancel.
- **Notifications** — in-platform notifications for friend events (friend online, request received, etc.).
- **Search / suggestion** — find players by display name; surface suggested friends based on co-played sessions.

## How Social relates to the other modules

| Module | Relationship |
|---|---|
| **IAM** | Friend identity is AGS player identity; works across linked platform accounts |
| **Lobby** | Lobby surfaces friend presence and routes friend invites |
| **Achievements** | Some studios trigger achievements off social actions (e.g. "added 5 friends") |
| **Extend** | Custom social features (clans, guilds, custom relationship graphs) are Extend Service Extension territory |

## Where Social ends

- **Voice chat** — not in Social. AccelByte ships a Vivox integration as an Extend Service Extension.
- **Clan / guild systems** — beyond friends graph. Stand up a Service Extension via Extend; route to `/ags-extend ask`.
- **Cross-platform friends** — works because AGS identity is cross-platform. Players linked across PC + console + mobile share one friends graph.

## Where to look in the docs

- AccelByte Social docs: `https://docs.accelbyte.io/`
