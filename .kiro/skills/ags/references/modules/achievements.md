---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[statistics.md](statistics.md)'
- '[leaderboards.md](leaderboards.md)'
- '[analytics.md](analytics.md)'
- '[store-entitlements.md](store-entitlements.md)'
---

# Module — Achievements

Configurable achievement and progression systems. Defines achievements in the Admin Portal; tracks player progress against them; emits unlock events when criteria are met.

---

## What it covers

- **Achievement definitions** — admin-configured. Each achievement has criteria (event-driven, score-driven, time-driven), a tier (bronze / silver / gold / legendary or custom), and an unlock effect.
- **Progress tracking** — per-player progress across multiple achievements simultaneously.
- **Statistic-backed progression** — achievements can use a Statistics stat code as the progression source. For counter-style achievements, configure the stat as an incrementing counter, then update that statistic from gameplay; achievement progress advances from the stat value instead of requiring a separate custom achievement counter.
- **Unlock events** — when criteria are met, AGS emits an `Achievement.Unlocked` event. Clients can listen; Extend Event Handlers can react (e.g. post to Discord).
- **Reward grant** — unlocks can be wired to Store / Entitlements grants automatically (give the player an entitlement when they hit gold tier).
- **Seasonal / progression systems** — battle-pass-style progression layered on top.

## Statistic-backed achievement setup

When the user asks to integrate progression with both Statistics and Achievements, treat statistic-backed achievements as the default native path before suggesting custom logic:

1. Create or confirm the backing statistic definition first: stat code, min/max/default, `Set By` authority, increment-only behavior when appropriate, and optional cycle if progress is daily/weekly/seasonal.
2. For cumulative counters such as kills, wins, matches played, assists, items used, or XP earned, use the Statistics increment update strategy from the gameplay event that owns the counter.
3. Configure the achievement criterion to evaluate that statistic value against the target threshold. Use the same stat code and cycle scope the gameplay update writes to.
4. Wire the game to update the statistic, then verify the stat readback and achievement progress/unlock path from the same action.

Do not assume Achievements needs a separate custom counter when a Statistics increment can express the progression. Use Extend only when the achievement rule cannot be expressed as a native statistic or event criterion.

## How Achievements relates to the other modules

| Module | Relationship |
|---|---|
| **Statistics** | Common progression source; increment stat counters for actions such as kills, wins, matches played, item use, or XP, then let achievement criteria evaluate the stat threshold |
| **Leaderboards** | Score-based achievements often use leaderboard placements as criteria |
| **Analytics** | Achievement unlocks emit events into Analytics |
| **Store / Entitlements** | Unlocks can grant entitlements (cosmetics, currency, items) |
| **Extend** | Event Handlers for achievement events are a common Extend pattern (Discord posts, external CRM updates) |

## When custom achievement logic is needed

If the achievement criteria can't be expressed in the Admin Portal's native definition (e.g. it requires aggregating across multiple events with custom weighting), the answer is **Extend Service Extension** for the criteria evaluator + **Event Handler** for AGS-emitted events. Route to `/ags-extend ask`.

`Challenge Suite` in the Extend Apps Directory is a worked example: daily missions, quests, achievements, seasonal events with JSON-configurable rules.

## Where to look in the docs

- AccelByte Achievements docs: `https://docs.accelbyte.io/`
