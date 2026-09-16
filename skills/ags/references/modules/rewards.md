---
last-verified: 2026-09-15
sources:
- https://docs.accelbyte.io/gaming-services/modules/online/rewards/
- https://docs.accelbyte.io/gaming-services/modules/online/rewards/integrating-reward-with-the-supported-events/
- https://docs.accelbyte.io/gaming-services/knowledge-base/api-events/social-statistic/
- https://docs.accelbyte.io/gaming-services/modules/online/statistics/
see-also:
- '[statistics.md](statistics.md)'
- '[achievements.md](achievements.md)'
- '[iam.md](iam.md)'
- '[store-entitlements.md](store-entitlements.md)'
---

# Module — Rewards

Rewards is **event-driven and configured, not called**. There is no public
client-facing claim endpoint: a reward fires when an event published by another
module matches a condition you configured, and the grant goes through
Entitlement and Fulfillment. So wiring a reward means picking the right event
and writing the right condition — the code you write belongs to whichever
module raises the event.

This reference covers the supported events, the reward configuration fields,
the condition syntax, the payload a condition matches against, and measured
reward-code naming behavior. Verify anything not covered here against the
current Rewards surface instead of inferring it from the desired outcome.

## Supported events

Rewards listens to one **event topic** per reward configuration, and a
condition then matches a specific **event name** within it.

| Event topic | Event name | Grant when |
|---|---|---|
| Statistic | `statItemCreated` | a statistic value is first created for the player |
| Statistic | `statItemUpdated` | a statistic reaches a particular value |
| statisticCycle | `statItemCycleUpdated` | a cycle-scoped statistic reaches a value within a daily, weekly, monthly, or seasonal cycle |
| Achievement | `userAchievementUnlocked` | a particular achievement is unlocked |
| Achievement | `achievementRewardClaimed` | a player successfully claims a *global* achievement's reward — global in the Achievements module's sense, not a per-player unlock; see [achievements.md](achievements.md) |
| User Account | `userAccountCreated` | an account is created in the **publisher** namespace |
| User Account | `gameUserAccountCreated` | an account is created in the **game** namespace |
| User Account | `userAccountVerified` | an account is verified, using the game namespace |
| User Account | `userAccountLinked` | an account is linked to a third-party account, using the game namespace |
| User Account | `userAccountUpgraded` | a headless account is upgraded to a full account, using the game namespace |
| User Account | `thirdPartyAccountCreated` | an account is created from a third-party platform |

`statisticCycle` is how the available documentation labels that row's topic,
and it labels the matching condition section the same way — but the same page's
configuration walkthrough offers only three values in the Event Topic dropdown:
Statistic, Achievement, and User Account. The documentation contradicts itself
here, so treat the dropdown value for a cycle-scoped reward as unestablished and
read it off the Admin Portal, which is authoritative over both. What is not in
question is the event name, `statItemCycleUpdated`, and the condition form below.

`userAccountCreated` and `thirdPartyAccountCreated` both belong to the User
Account topic. The publisher-versus-game namespace split between
`userAccountCreated` and `gameUserAccountCreated` decides whether the reward
ever fires for the namespace your players actually sign in to — confirm which
namespace the account is created in before choosing between them.

## Reward configuration fields

Created in the Admin Portal under **Online > Rewards > Add Configuration**:

- **Reward Code** — unique identifier; see the naming constraint below.
- **Description** — free text.
- **Event Topic** — Statistic, Achievement, or User Account.
- **Max Awarded** — total times this reward can be earned across all players in
  the namespace.
- **Max Awarded Per User** — times a single player can earn it.

Two optional **Advanced Settings** fields locate the player and namespace
inside the event payload, both in JSON path format:

- **UserID Expression** — default `$.[0].userId`; format
  `$.eventPayloadObject.userId`.
- **Namespace Expression** — default `$.[0].namespace`; format
  `$.eventPayloadObject.namespace`.

Leave both blank unless the event payload puts those values somewhere other
than the defaults.

## Reward condition syntax

A reward condition is added per reward (**View** the reward, then **Add Reward
Condition**) and has three parts: the **Event Name** from the topic you chose,
a **Condition Name**, and the **Condition** itself, written as a JSON path
filter expression.

**Statistic** — grant when a statistic reaches a value:

```
$.[?(@.statCode == "input-your-stat-code" && @.latestValue == x)]
```

For example, granting when the player reaches 150 points in the `rewardpoints`
statistic:

```
$.[?(@.statCode == "rewardpoints" && @.latestValue == 150)]
```

**statisticCycle** — grant when a cycle-scoped statistic reaches a value. Use
this when progress should follow a cycle rather than the lifetime total, such
as a daily login reward or seasonal progression:

```
$.[?(@.statCode == "input-your-stat-code" && @.cycleId == "input-your-cycle-id" && @.latestValue == x)]
```

For example, granting when `dailyloginclaim` reaches 1 inside the
`daily-login-cycle` cycle:

```
$.[?(@.statCode == "dailyloginclaim" && @.cycleId == "daily-login-cycle" && @.latestValue == 1)]
```

**Achievement** — grant on achievement progress or unlock:

```
$.[?(@.status == 2 && @.achievementCode == "input-your-achievement-code")]
```

`status` is `1` while the achievement is in progress and `2` when the player
has earned it.

This is the only Achievement condition the available documentation works
through, and it is written for `userAchievementUnlocked`. Whether
`achievementRewardClaimed` carries the same `status` and `achievementCode`
fields is **not established here** — it is a different event about a different
act. Confirm its payload before writing a condition against it, because a
condition naming fields the event does not publish never matches and reports
nothing.

**User Account and third-party login** — grant after account creation:

```
$.[?(@.userId != null && @.emailAddress != null)]
```

For third-party logins, drop the `emailAddress` clause and match on `userId`
alone.

Take the `statCode` from the Statistics page and the `achievementCode` from the
Achievements page in the Admin Portal; a condition that names a code which does
not exist simply never matches, and nothing reports that as an error.

## Reward items

Each condition carries its **Reward Items**: the **Item** to grant, a **Qty**,
and a **Duration** that applies only when the item is a subscription. The item
must already be configured in the store before it can be selected — see
[store-entitlements.md](store-entitlements.md).

## Event payload shape

A condition is evaluated against the published event, so the fields available
to it are the payload's fields.

`statItemCreated`, `statItemUpdated`, and `statItemDeleted` share one payload
shape:

| Field | Type |
|---|---|
| `namespace` | string |
| `statCode` | string |
| `userId` | string |
| `latestValue` | number |
| `inc` | number |
| `additionalData` | object (free-form) |
| `ignoreAdditionalDataOnValueRejected` | boolean |
| `defaultValue` | number |
| `requestValue` | number |
| `updateStrategy` | string |

`statItemCycleUpdated` carries a **different** payload — not a superset of the
one above. It has no `inc`, `additionalData`, `defaultValue`, `requestValue`,
or `ignoreAdditionalDataOnValueRejected`, and it adds the two cycle fields:

| Field | Type |
|---|---|
| `namespace` | string |
| `cycleId` | string |
| `statCode` | string |
| `userId` | string |
| `updateStrategy` | string |
| `cycleVersion` | integer |
| `latestValue` | number |
| `updateValue` | number |

A cycle condition can therefore match `statCode`, `cycleId`, and `latestValue`,
as the syntax above shows, but a condition carried over from a non-cycle reward
that also matches `inc` or `requestValue` will never fire, because the cycle
event does not publish those fields.

Each event also carries an envelope around its payload, with `id`, `version`,
`name`, `namespace`, `parentNamespace`, `timestamp`, `clientId`, `userId`, and
`sessionId`. The envelope's `userId` is documented as the operator id, so match
the player against the payload's own `userId` — which is what the default
`UserID Expression` does.

This is why the Statistic conditions above match on `statCode` and
`latestValue`: those are payload fields. Before writing a condition against a
field not listed here, confirm the event actually publishes it.

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

A first-login reward has three supported shapes, and the difference between
them is which event actually fires for the player in question:

1. **Account creation** — the User Account topic, with `userAccountCreated` for
   the publisher namespace or `gameUserAccountCreated` for the game namespace.
   This fires once per account, which is what "first ever login" usually means.
   Confirm which namespace the account is created in before choosing.
2. **A login statistic** — update a statistic from the trusted login-completion
   flow and match `statItemUpdated` on it. Use this when the grant should
   follow a value your own code controls rather than account creation, and
   remember that the statistic's **Set By** configuration decides whether a
   game client may write it at all; see [statistics.md](statistics.md).
3. **A login statistic on a cycle** — the same thing through
   `statItemCycleUpdated`, for a *daily* first login rather than a one-time
   one.

Treat Code Redemption and Extend as alternatives when their tradeoffs fit. Do
not invent a direct login-event trigger: the account events above are the
closest supported thing, and the list of supported events is the list.

## Verification

For a live creation workflow, discover the current Rewards request schema and
dry-run or submit the exact candidate through the selected AGS environment.
Preserve the response status and body when a name is rejected; HTTP 422 alone
does not identify which field failed.

A condition that never matches produces no error and no grant, so verify by
driving the real event — update the statistic, unlock the achievement, create
the account — and then check the player's entitlements, rather than by
inspecting the configuration alone.
