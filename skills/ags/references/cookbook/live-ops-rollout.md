---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[store-entitlements.md](../modules/store-entitlements.md)'
- '[achievements.md](../modules/achievements.md)'
- '[analytics.md](../modules/analytics.md)'
---

# Cookbook — Live-Ops Rollout

Pattern for rolling out an AGS-backed feature (a new Store item, a new Achievement, a new Leaderboard season, a balance change) safely. The pattern is generic; the AGS-specific bits are which knobs you turn in the Admin Portal vs. which you wire through code.

---

## The rollout shape

```
   1. Internal: enable in dev namespace, validate end-to-end.
   2. Limited: enable in staging or to a small cohort of prod players.
   3. Full: enable in prod for all players.
   4. Watch: dashboards / alerts during the first hours / days.
   5. Roll back: have a clear rollback path before step 3 — not after step 5.
```

## What lives in the Admin Portal vs. code

| Change type | Where it happens |
|---|---|
| New Store item | Admin Portal — catalog edit, then publish |
| New Achievement | Admin Portal — definition + criteria |
| New Leaderboard season | Admin Portal — leaderboard config + season schedule |
| New IAM role / permission | Admin Portal — IAM config |
| New event triggering custom logic | Admin Portal (event subscription) + Extend Event Handler (the code) |
| Balance change to existing logic | Game build — code change behind a feature flag (where possible) |
| New module enable | Admin Portal — namespace config |

## Cohort / staged rollout patterns

AGS doesn't ship a built-in "rollout to 5% of players" mechanism. Studios use these patterns:

- **Per-namespace gating** — keep a "production-canary" namespace for early-access features, promote to the main prod namespace once validated.
- **Custom-attribute gating** — tag players with a cohort attribute via IAM; gate Store item visibility or access where the attribute model supports it. Achievement criteria don't support attribute expressions — use an Extend Override to intercept the unlock trigger for attribute-based achievement gating.
- **Extend Override gating** — for finer control, an Override on the relevant AGS service can read a feature-flag service and gate behavior. Keep external flag lookups fast (cache locally); Override calls are synchronous and their latency adds directly to the AGS API response time. That's an Extend conversation; route to `/ags-extend ask`.

## Observability during rollout

- **Analytics dashboards** — watch login rate, match-formation rate, store-conversion rate during the rollout window.
- **Custom in-game telemetry** — emit events around the new feature; check the data lands.
- **CLI** — for quick spot-checks: list recent orders, recent achievements, recent matches. See `references/observe/cli-commands.md`.
- **Extend Event Handlers** for routing critical events to ops channels (Slack, PagerDuty). That's `/ags-extend` territory.

## Rollback patterns

- **Admin Portal toggle** — for catalog changes, the simplest rollback is "unpublish" from the Admin Portal. Players stop seeing the item.
- **Cohort attribute removal** — if a feature was gated by a cohort attribute, removing the attribute disables the feature for those players.
- **Hotfix build** — for code-level rollbacks, ship a build. Slowest path; have a contingency for time-to-cert on console.
- **Extend Override toggle** — feature flags inside an Override let you flip behavior without a code deploy.

## Common pitfalls

- **No rollback plan** — "we'll just not make a mistake" is not a strategy.
- **Forgetting platform IAP** — Store changes that affect IAP need platform-side validation (Apple, Google, console stores) before they're effective on those platforms.
- **Skipping the staging step** — dev → prod skips the namespace where you'd notice cross-module interactions.
- **Telemetry built into the rollout** — if your dashboards are informed by the same code you're rolling out, you can't trust them. Have orthogonal observability.

## Where this hands off

- Anything custom-logic-shaped during rollout (custom rule, custom override, event-driven gating) → `/ags-extend ask`.
- Build distribution / playtest of a new build → `/adt`.
- Live-ops fleet capacity tuning before a rollout → `/ags-ams`.
