---
last-verified: 2026-05-09
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

- **Achievement definitions** — admin-configured. Each achievement has criteria (non-incremental/completion-based or incremental/statistic-backed) and an unlock effect. Time-based criteria belong to the Challenges module; multi-tier progressions are handled by Season Pass.
- **Progress tracking** — per-player progress across multiple achievements simultaneously.
- **Statistic-backed progression** — achievements can use a Statistics stat code as the progression source. For counter-style achievements, configure the stat as an incrementing counter, then update that statistic from gameplay; achievement progress advances from the stat value instead of requiring a separate custom achievement counter.
- **Unlock events** — when criteria are met, AGS emits an achievement unlock event (verify the exact topic name in the AGS event catalog). Clients can listen; Extend Event Handlers can react (e.g. post to Discord).
- **Reward grant** — entitlement grants on unlock require configuring the Rewards module to listen to achievement events. The Rewards module manages the reward conditions and grant logic.

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
| **Store / Entitlements** | Unlocks can grant entitlements (cosmetics, currency, items) via the Rewards module |
| **Extend** | Event Handlers for achievement events are a common Extend pattern (Discord posts, external CRM updates) |
| **Season Pass** | Battle-pass-style tier progression; integrates with Commerce for XP-based tier progression. Not part of Achievements. |

## When custom achievement logic is needed

If the achievement criteria can't be expressed in the Admin Portal's native definition (e.g. it requires aggregating across multiple events with custom weighting), the answer is **Extend Service Extension** for the criteria evaluator + **Event Handler** for AGS-emitted events. Route to `/ags-extend ask`.

For worked examples (e.g. daily missions, quests, achievements, seasonal events), check the current Extend Apps Directory — verify the app name and URL at https://docs.accelbyte.io/ as names may change.

## Where to look in the docs

- AccelByte Achievements docs: `https://docs.accelbyte.io/`
