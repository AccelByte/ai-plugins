---
last-verified: 2026-10-09
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/modules/online/leaderboards/
- https://docs.accelbyte.io/gaming-services/modules/online/leaderboards/new-cycled-leaderboard/
- https://docs.accelbyte.io/gaming-services/modules/online/leaderboards/new-leaderboard-specific-ranking/
- https://www.npmjs.com/package/@accelbyte/sdk-leaderboard
see-also:
- '[statistics.md](statistics.md)'
- '[achievements.md](achievements.md)'
- '[analytics.md](analytics.md)'
---

# Module — Leaderboards

Global and seasonal leaderboards, score ingestion. Tracks player scores per leaderboard, surfaces ranked queries, and supports time-bound seasons with reset behavior.

---

## What it covers

- **Leaderboard configuration** — name, stat code, ordering (high-to-low or low-to-high), all-time ranking plus any statistic cycles to rank by (v3). The legacy version configured daily/weekly/monthly/seasonal periods on the leaderboard itself.
- **Score ingestion** — clients or game servers update player statistics; the Leaderboard service listens for stat-update events and updates rankings automatically. Direct score posting to a leaderboard is not supported.
- **Time-windowed leaderboards** — in v3, daily/weekly/seasonal rankings come from statistic cycles with their own start/end and reset schedule.
- **Querying** — top-N, around-me, ranked lookup for a specific player.

## API version — use v3

AGS has two leaderboard versions. The **new** one is v3: new namespaces can only create configurations in it, and the docs say to use the v3 endpoints. v1 and v2 are the **legacy** version, still callable by namespaces that already used it. The docs call v1/v2 legacy, not deprecated — say legacy.

v3 is all-time plus **statistic cycles**: a time-windowed ranking (daily, weekly, seasonal) comes from a cycle on the underlying statistic, read by cycle ID, rather than from v1's separate today/week/month/season endpoints.

v3 public reads (`/leaderboard/v3/public/namespaces/{namespace}/leaderboards/{leaderboardCode}/...`): `alltime`, `cycles/{cycleId}`, `users/{userId}`, and `POST users/bulk`.

**The SDKs' unsuffixed names are the legacy API.** Nothing marks them legacy, so the obvious name is the wrong one:

| SDK | v3 — use this | Legacy — don't default to it |
|---|---|---|
| TypeScript Web SDK (`@accelbyte/sdk-leaderboard`) | `LeaderboardDataV3Api`: `getAlltime_ByLeaderboardCode_v3` (top N), `getUser_ByLeaderboardCode_ByUserId_v3` (one player's rank), `getCycle_ByLeaderboardCode_ByCycleId_v3`, `createUserBulk_ByLeaderboardCode_v3`; `LeaderboardConfigurationV3Api` for configs | `LeaderboardDataApi`: `getAlltime_ByLeaderboardCode`, `getUser_ByLeaderboardCode_ByUserId`, `getToday_…`/`getWeek_…`/`getMonth_…`/`getSeason_…` (v1); `getAlltime_ByLeaderboardCode_v2` (v2) |
| Unity | `GetApi().GetLeaderboard()`: `GetRankingsV3`, `GetUserRankingV3` | The unsuffixed ranking methods |
| Unreal | `ApiClient->Leaderboard`: `GetRankingsV3`, `GetUserRankingV3` | The unsuffixed ranking methods |

When writing leaderboard code, name the v3 class or method explicitly, and say in the answer that the unsuffixed names (e.g. `LeaderboardDataApi.getAlltime_ByLeaderboardCode`) call the legacy **v1** endpoints — `GET /leaderboard/v1/public/.../alltime` — not v3. If the user's existing code calls one, point out that it is on v1.

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

For worked examples of custom ranking logic (e.g. MMR-based ranking on top of AGS Leaderboards), check the current Extend Apps Directory — verify the app name and URL at https://docs.accelbyte.io/ as names may change.

## Where to look in the docs

- AccelByte Leaderboards docs: `https://docs.accelbyte.io/`
