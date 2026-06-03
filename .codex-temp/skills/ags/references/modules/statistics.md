---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/implementing-server-authoritative-player-statistics/
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/utilizing-statistic-cycle-to-track-users-progress-within-specific-time-frame/
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/store-additional-data-in-user-statistic/
see-also:
- '[leaderboards.md](leaderboards.md)'
- '[achievements.md](achievements.md)'
- '[matchmaking.md](matchmaking.md)'
- '[analytics.md](analytics.md)'
---

# Module - Statistics

Persistent user-stat tracking for gameplay values such as wins, MMR, XP, item usage, and seasonal progress. Statistics is often the source data for Leaderboards, Achievements, Matchmaking rules, and Rewards.

---

## What it covers

- **Statistic configuration** - per-stat rules such as stat code, display metadata, default value, min/max bounds, increment-only behavior, global aggregation, and client/server update authority. Additional config fields (visibility, access level) may be available — verify current options in the Admin Portal statistics configuration page.
- **Stat code** - developer-owned identifier for a tracked value, such as `total-wins`, `mmr`, `xp`, or `potions-consumed`.
- **User statistic value** - persistent value associated with a player account; bounded by the configured default/min/max rules.
- **Global statistics** - optional game-wide aggregation across users for stats that should also track a namespace-wide total.
- **Update strategies** - update methods such as increment, min, max, or override; exact enum names vary by SDK version, so always verify against the selected SDK docs.
- **Set By** - configuration that decides whether a stat can be updated by game client calls or only by trusted server-side calls. Use server authority for competitive, ranked, economy-sensitive, or anti-cheat-sensitive stats.
- **Statistic cycles** - time windows such as daily, weekly, monthly, seasonal, and annual cycles. Cycles let the same stat code track progress within a time frame and reset when the cycle rolls over.
- **Additional data** - optional structured metadata stored with a user statistic, such as character, weapon, vehicle, mode, or display-name context.

## How Statistics relates to other modules

| Module | Relationship |
|---|---|
| **IAM** | User statistics are associated with player accounts and require authenticated calls |
| **Leaderboards** | Leaderboards commonly rank players from a stat code, optionally within a statistic cycle |
| **Achievements** | Achievement criteria can evaluate statistic updates such as item use, wins, XP, or milestones |
| **Matchmaking** | Rulesets can use stats such as MMR or skill bands |
| **Rewards** | The Rewards module listens to stat update events and grants rewards when configured conditions are met |
| **Cloud Save** | Use Cloud Save instead when the value is only player attribute storage and does not need stat-driven integrations |
| **Extend** | Use Extend for custom validation, scoring formulas, post-processing, or APIs that native Statistics cannot express |

## Integration decisions

Before wiring Statistics, identify:

1. **Stat codes** - exact stat codes already configured in the namespace, or the Admin Portal work needed before code can be useful.
2. **Authority model** - client update for low-risk solo/P2P stats; server update for competitive, ranked, MMR, economy, or dedicated-server results.
3. **Update strategy** - increment for counters, max/min for best-record style values, override for authoritative final values.
4. **Batching model** - use batch/bulk update statistics APIs when a flow updates multiple stats, multiple users, or repeated match-result values in a short window. Per-stat update calls are acceptable for genuinely isolated, low-volume updates, but avoid loops that issue one API call per stat item because stat updates are a common source of high API call volume.
5. **Bounds** - default, min, max, and increment-only rules; do not assume negative or unlimited values are valid.
6. **Cycles** - whether the stat participates in daily/weekly/monthly/seasonal progress or a time-based leaderboard.
7. **Additional data** - whether metadata should always update, or only update when the stat value update is accepted.

## TIED configuration risk

Once player data is associated with a statistic configuration, the configuration can become `TIED`. Changes to a TIED configuration (any structural field) can affect live player data and dependent systems. Treat all changes to TIED configs as migration-sensitive — deleting can wipe associated user stats.

When a requested integration depends on a missing or unclear stat configuration, route to `/ags connect-portal` or the Admin Portal owner before adding game code that cannot pass.

## Smoke tests

Statistics is wired only when a real AGS call proves the target stat can be used end-to-end:

- **Client-authoritative stat** - authenticated player updates the stat, then reads the value back.
- **Server-authoritative stat** - trusted server path updates a user's stat, using batch/bulk update when the gameplay flow writes multiple stat items, then reads the value back from the server API.
- **Cycle-backed stat** - list or get the target cycle, update/read the stat cycle item, and confirm the value lands in the expected active cycle.
- **Additional data** - update the stat with metadata, then confirm the stored metadata matches the configured update behavior.

## Where to look in the docs

- Statistics overview: `https://docs.accelbyte.io/gaming-services/modules/online/statistics/`
- Server-authoritative statistics: `https://docs.accelbyte.io/gaming-services/modules/online/statistics/implementing-server-authoritative-player-statistics/`
- Statistic cycles: `https://docs.accelbyte.io/gaming-services/modules/online/statistics/utilizing-statistic-cycle-to-track-users-progress-within-specific-time-frame/`
- Additional data: `https://docs.accelbyte.io/gaming-services/modules/online/statistics/store-additional-data-in-user-statistic/`
