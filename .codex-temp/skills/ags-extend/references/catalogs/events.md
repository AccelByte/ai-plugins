---
last-verified: 2026-05-09
authoritative-source: https://github.com/AccelByte/accelbyte-api-proto
note: AGS emits events that Extend Event Handlers can subscribe to. The canonical
  source is the accelbyte-api-proto repo; the Admin Portal shows the live subset available
  in a specific namespace. This file is a STARTER TABLE, not exhaustive.
sources:
- https://github.com/AccelByte/accelbyte-api-proto
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[overridables.md](overridables.md)'
- '[idempotency.md](../cookbook/idempotency.md)'
---

# AGS Event Types (Starter Catalog)

AGS emits events when notable things happen inside its services (a match completes, an entitlement is granted, a player logs in). An Extend Event Handler is a gRPC server that subscribes to one or more event types and receives events asynchronously via Kafka Connect.

## Where the authoritative list lives

There are two sources, used together:

1. **`github.com/AccelByte/accelbyte-api-proto` (primary)** — the canonical proto definitions for all AGS events. Exact event name strings, payload field names, and types live here. This is the ground truth for what AGS can emit.

2. **Admin Portal (secondary — namespace-scoped)** — shows the live subset of events your specific namespace currently has available for subscription. Navigate:

```
Admin Portal → <target namespace> → Extend → Event Handler
```

Use the proto repo to get exact names and payload shapes. Use the Admin Portal to confirm the event is available in your target namespace before wiring up an Event Handler. AGS adds event types over time; old namespaces may emit fewer events than newer ones.

## Hard constraint — applies to all subskills

**Never invent a proto message schema.** Do not infer field names, field numbers, or types for any AGS event payload. If the proto isn't confirmed in `github.com/AccelByte/accelbyte-api-proto`, do not write it — flag it as an open prerequisite and tell the user where to fetch it.

**The Event Handler template ships with exactly one example proto** (`pkg/proto/accelbyte-asyncapi/iam/account/v1/account.proto` at the time of last verification — Go template path; other language templates use equivalent paths). Real handlers almost always target a different event. The standing workflow is:

1. Identify the event by exact name in `accelbyte-api-proto`.
2. Copy the matching `.proto` file (preserving its directory structure) into the template's `pkg/proto/` tree.
3. Run `make proto` (or `/ags-extend proto`) to regenerate code under `pkg/pb/` (Go workflow; other languages have equivalent generation commands).
4. Implement the handler against the generated types.

Skipping step 1 — guessing at the schema — produces code that doesn't compile against real AGS payloads. Skipping step 2 and trying to add `.proto` content by hand produces drift from the canonical contract. Don't do either.

## How to use this file

This is a **starter** table — enough to orient a developer before they check the primary sources. It is not exhaustive and it is not guaranteed current. Exact event names, payload shapes, and availability can shift between AGS releases.

**Before scaffolding an Event Handler:** look up the exact event name in `accelbyte-api-proto`, then confirm it is available in your target namespace via the Admin Portal. The Event Handler wizard asks what event types the handler subscribes to — that answer comes from those two sources, not this file.

## Starter table

| AGS area | Common event types | When it fires |
|---|---|---|
| Matchmaking | Match started / completed / cancelled | A matchmaking session transitions state |
| Session / Lobby | Session created / joined / left / closed | Session lifecycle transitions |
| IAM / Identity | User registered / logged in / banned / unbanned | Account lifecycle |
| Entitlements | Entitlement granted / revoked | A player's entitlement state changes |
| Inventory | Item added / removed / consumed | Inventory mutations |
| Achievements | Achievement unlocked | A player earns an achievement |
| Rewards | Reward granted | A reward is distributed to a player |
| Leaderboard | Score submitted / reset | Leaderboard state changes |
| Store / Commerce | Order fulfilled / refunded | Commerce transactions |

Each row is "generally emitted by AGS" — the exact event name (`Match.Completed` vs. `match_completed` vs. `MatchCompletedV2`) and payload schema must be confirmed in the portal.

## Subscription is per-namespace

Event delivery only happens in a namespace where the subscription is registered. Two things to watch for:

1. **Subscribing in dev ≠ subscribing in prod.** You must configure the subscription in each target namespace. See `faq.md#events-fire-locally-but-not-in-production-event-handler`.
2. **Subscription drift.** If an event handler has been updated to consume a new event type, the production subscription needs to be updated too; code alone won't do it.

## Idempotency is your responsibility

Kafka Connect can deliver the same event more than once under retry or rebalancing conditions. Event Handlers must be idempotent — processing the same event twice must produce the same effect. See `references/cookbook/idempotency.md` for common patterns (dedup keys, upserts).

## What doesn't go here

- **Synchronous decision points.** If AGS needs to wait for your logic before continuing, that's an Override, not an Event Handler — see `catalogs/overridables.md`.
- **Events from your own services.** AGS only emits events for AGS state changes. Events originating in your Service Extensions do not flow through the AGS Event Handler pipeline (they use a separate messaging channel).
- **Custom events not emitted by AGS.** If AGS doesn't emit the event you want to react to, Event Handler can't help. Options: Service Extension that polls the data you care about, or ask AccelByte support whether an event is planned.

## What to point `ask` at

When a developer asks "can I react to X?":

1. Answer conceptually from `overview.md` ("Event Handler is for reacting to AGS events asynchronously").
2. If X is in the starter table above, say "AGS commonly emits this — look up the exact event name and payload in `github.com/AccelByte/accelbyte-api-proto`, then confirm it is available in your namespace via the Admin Portal."
3. If X is not in the table, say "not listed in the starter catalog; check `github.com/AccelByte/accelbyte-api-proto` for the canonical event list. If the proto repo doesn't define it and the Admin Portal doesn't list it, AGS doesn't emit it and Event Handler can't help — consider Service Extension with a polled data source, or contact AccelByte support about event roadmap."

Do not invent event types. If it's not in the proto repo, it isn't emitted.
