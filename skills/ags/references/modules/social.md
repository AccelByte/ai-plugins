---
last-verified: 2026-10-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[lobby.md](lobby.md)'
- '[iam.md](iam.md)'
- '[group.md](group.md)'
---

# Module — Social

Friends, blocking, notifications. The relationship-graph layer of AGS — durable across sessions, surfaced in Lobby for presence and invitations.

---

## What it covers

- **Friends** — bidirectional relationship between two players. Scoped per namespace.
- **Blocking** — bidirectional. Once blocked, neither player can send friend requests, party invitations, or be matched together. Effect on presence visibility — verify against Presence module docs.
- **Friend requests** — request, accept, reject, cancel.
- **Notifications** — friend request received and accepted events. Online/availability notifications come from the Presence module.

## How Social relates to the other modules

| Module | Relationship |
|---|---|
| **IAM** | Friend identity is AGS player identity; works across linked platform accounts |
| **Lobby** | Lobby surfaces friend presence and routes friend invites |
| **Achievements** | Some studios trigger achievements off social actions (e.g. "added 5 friends") |
| **Group** | Clans and guilds are the native Group service (Guilds & Clans) — see `group.md` |
| **Extend** | Custom relationship graphs AGS doesn't model natively are Extend Service Extension territory |

## Where Social ends

- **Voice chat** — not in Social. Studios typically integrate a third-party voice SDK (e.g. Vivox, Agora) as an Extend Service Extension.
- **Clan / guild systems** — not Social, but still native: the Group service (Guilds & Clans). See `group.md`.
- **Cross-platform friends** — works because AGS identity is cross-platform. Players linked across PC + console + mobile share one friends graph.

## Where to look in the docs

- AccelByte Social docs: `https://docs.accelbyte.io/`
