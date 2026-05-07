---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[analytics.md](../modules/analytics.md)'
- '[observe.md](../../subskills/observe.md)'
---

# Observe — Event Catalog

**Pointer reference.** AGS emits a set of well-typed events from each module. The authoritative catalog of events is on `https://docs.accelbyte.io/` and in the Admin Portal's event browser. **Don't try to mirror the catalog in this repo** — it'll go stale instantly.

---

## What this file does

Tells you where to look. Does not enumerate the events.

| Event family | Source module | Examples (illustrative) |
|---|---|---|
| Identity | IAM | `User.LoggedIn`, `User.Banned`, `User.Linked` |
| Lobby / Social | Lobby, Social | `Party.Created`, `Friend.Added`, `Presence.Updated` |
| Matchmaking | Matchmaking | `Ticket.Created`, `Match.Formed`, `Ticket.Expired` |
| Session | Session Management | `Session.Created`, `Session.Joined`, `Session.Ended` |
| Achievements | Achievements | `Achievement.Unlocked`, `Progression.Updated` |
| Leaderboards | Leaderboards | `Score.Posted`, `Season.Ended` |
| Store / Entitlements | Store | `Order.Created`, `Order.Fulfilled`, `Entitlement.Granted` |

Specific event names, payload shapes, and required scopes change over time. **Always check the Admin Portal's event browser or the AccelByte docs for the current canonical list.**

## When you need event data

- **For Analytics:** events flow into the Analytics pipeline; query there or via the export pipeline.
- **For Extend Event Handlers:** subscribe to the events you care about; those handlers belong in `/ags-extend`.
- **For real-time observability:** the Admin Portal has live event streams; the AGS CLI may also query event activity when the generated command surface exposes it (`references/observe/cli-commands.md`).

## Cross-references

- For Extend's perspective on events (which ones are subscribable as Event Handler triggers, which ones aren't), see `content/skills/ags-extend/references/catalogs/events.md`. That file is also pointer-shaped.

## Where to look

- `https://docs.accelbyte.io/` — authoritative event catalog.
- Admin Portal → events browser — live source-of-truth, namespace-specific.
