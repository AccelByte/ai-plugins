---
last-verified: 2026-09-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/
see-also:
- '[statistics.md](statistics.md)'
- '[achievements.md](achievements.md)'
- '[store-entitlements.md](store-entitlements.md)'
---

# Module — Rewards

This reference covers measured reward-code naming behavior and the grounded
Statistics-to-Rewards integration path. Verify other trigger types against the
current Rewards surface instead of inferring them from the desired outcome.

## Reward identifier constraint

Use lowercase kebab-case for a reward's `rewardCode`: lowercase ASCII words
separated by hyphens, for example `daily-login-bonus`.

This is a measured platform constraint, not a regex published in the available
public AGS documentation. A reproduction against a live AGS environment
recorded these results:

- Created successfully: `test-reward-4`, `test-reward-code-abc`, and
  `first-login-reward`.
- Returned HTTP 422: uppercase-only, snake_case, camelCase, PascalCase, and
  uppercase-with-hyphens examples.

Accordingly, do not accept or recommend `Daily_Login_Bonus`; use
`daily-login-bonus`. Do not broaden the observation into claims about exact
minimum length, maximum length, Unicode handling, leading or trailing hyphens,
or repeated hyphens without a current API schema or live validation.

## First-login reward pattern

When a first-login reward is requested, consider the documented
Statistics-to-Rewards path before custom implementation: update a player
statistic from the trusted login-completion flow, then configure Rewards to
listen for the statistic update event and grant when its condition is met.
Treat Code Redemption and Extend as alternatives when their tradeoffs fit; do
not invent a direct login-event trigger unless the current environment exposes
and verifies one.

## Verification

For a live creation workflow, discover the current Rewards request schema and
dry-run or submit the exact candidate through the selected AGS environment.
Preserve the response status and body when a name is rejected; HTTP 422 alone
does not identify which field failed.
