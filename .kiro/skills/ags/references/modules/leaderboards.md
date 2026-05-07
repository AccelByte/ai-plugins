---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[statistics.md](statistics.md)'
- '[achievements.md](achievements.md)'
- '[analytics.md](analytics.md)'
---

# Module — Leaderboards

Global and seasonal leaderboards, score ingestion. Tracks player scores per leaderboard, surfaces ranked queries, and supports time-bound seasons with reset behavior.

---

## What it covers

- **Leaderboard configuration** — name, scope (global / per-namespace / per-cohort), tie-breaking rules, ordering (high-to-low or low-to-high).
- **Score ingestion** — clients or game servers post scores; leaderboard ranks update.
- **Seasonal leaderboards** — time-bound; reset behavior at season end (carry-over, soft reset, full reset).
- **Querying** — top-N, around-me, ranked lookup for a specific player.

## How Leaderboards relates to the other modules

| Module | Relationship |
|---|---|
| **IAM** | Score ingestion and queries are scoped to the player via the IAM token |
| **Statistics** | Native leaderboards commonly rank a configured stat code, optionally from a statistic cycle for time-based rankings |
| **Achievements** | Often paired — leaderboard placement triggers achievements |
| **Analytics** | Score events flow into Analytics for retention / engagement reporting |
| **Extend** | Custom leaderboard logic (e.g. weighted scoring, anti-cheat post-validation) is an Extend conversation |

## Statistics-backed leaderboards

When the user asks to integrate Statistics and Leaderboards together, wire Statistics first. Confirm the stat code exists, the update authority is correct (client vs. server), the update strategy matches the score model, and any daily/weekly/seasonal cycle is active. Then wire the leaderboard query path against that stat/cycle and verify a posted or updated stat appears in ranking queries.

## When custom leaderboard logic is needed

Common pattern: a studio wants score ingestion to do something more than the native leaderboard supports — anti-cheat validation, rolling averages, MMR-shaped ranking. That's an **Extend Service Extension** (own API for posting scores, internally writes to AGS Leaderboards) or **Extend Event Handler** (react to a score-posted event and post-process). Route to `/ags-extend ask` after the user confirms the native leaderboard can't express what they need.

`Rank Suite` in the Extend Apps Directory is a worked example of MMR-based ranking on top of AGS Leaderboards.

## Where to look in the docs

- AccelByte Leaderboards docs: `https://docs.accelbyte.io/`
