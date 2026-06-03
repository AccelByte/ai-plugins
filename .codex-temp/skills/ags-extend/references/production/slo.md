---
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[resources.md](resources.md)'
- '[rollout.md](rollout.md)'
---

# SLOs for Extend Apps

Service Level Objectives for the three Extend patterns. Intended as a starting point — tune to your player experience, not these numbers. "Good enough" varies by game and genre.

## SLI first, SLO second

An SLI (indicator) is what you measure. An SLO (objective) is the target for that measurement. An SLA (agreement) is a business commitment — typically AGS's responsibility, not yours.

Common SLIs for Extend:

- **Availability** — fraction of handler calls that succeeded (no 5xx, no panic, no timeout).
- **Latency** — distribution of handler durations (P50, P95, P99).
- **Freshness** (Event Handler) — end-to-end delay from event emit to handler completion.
- **Correctness** — fraction of calls with correct output. Harder to measure automatically; often comes via customer-reported bugs.

Pick 2–4 SLIs per app. Don't try to measure everything; track what matters to the player.

## Override SLO starting points

Override is on the critical path. Every call blocks an AGS call.

| SLI | Starting SLO |
|---|---|
| Availability | 99.9% of calls succeed |
| Latency P50 | < 10 ms (no external calls) / < 50 ms (in-process cache) / < 200 ms (external) |
| Latency P99 | < 3x P50 under normal load |
| Error rate | < 0.1% |

Justification:

- At 99.9% avail, you can have ~43 minutes of degradation per month. For a matchmaking override, that's enough to be noticeable but not catastrophic. Games with tighter requirements (competitive, money-handling) should aim for 99.95% or 99.99%.
- P50 targets track `references/production/resources.md#latency-specifically-for-override`.
- P99 over 3x P50 under normal load usually indicates an avoidable bottleneck (GC pauses, occasional DB slowness).

## Service Extension SLO starting points

Service Extensions serve HTTP/gRPC, often client-facing through AGS routing.

| SLI | Starting SLO |
|---|---|
| Availability | 99.9% of requests succeed |
| Latency P50 | < 100 ms |
| Latency P95 | < 500 ms |
| Latency P99 | < 1 s |
| Error rate | < 0.1% (4xx excluded from "error" — that's client fault) |

Justification:

- Player-facing clients are more forgiving of latency than AGS-internal callers. Sub-second P99 keeps UX smooth.
- Separate 4xx and 5xx: 4xx is "the caller sent something wrong" (don't count against you unless a spike indicates a client bug *you* introduced). 5xx is "you broke."

## Event Handler SLO starting points

Event Handler is async. Availability still matters, but latency is measured differently — *freshness*, not per-call latency, is the key SLI.

| SLI | Starting SLO |
|---|---|
| Availability | 99.9% of events processed successfully |
| Freshness P95 | < 30 s end-to-end |
| Freshness P99 | < 2 min end-to-end |
| Dead-letter rate | < 0.01% (events that fail all retries) |

Justification:

- Players rarely notice 30 s delays on async work (analytics, leaderboard updates). Minutes are perceptible.
- Freshness includes Kafka Connect queuing — not just handler time. Lag on the topic is part of the SLI.
- Dead-letters represent events abandoned after retry exhaustion. A growing dead-letter count is the most important Event Handler signal.

## Error budget

An SLO implies an error budget: 100% minus the SLO. For 99.9% availability: 0.1% of calls *are allowed* to fail.

Why this matters: if you've had a quiet month, you have budget to take risk — ship a bigger change, skip the canary, deploy on Friday afternoon. If you've had a rough month (budget burned), slow down — no risky deploys, investigate the recurring failures first.

Error budget is a decision framework, not a measurement. It couples "how reliable we are" to "how fast we can move."

## Burn rate alerts

Alert on *fast* or *slow* burn of the error budget:

- **Fast burn:** 2% of monthly budget consumed in 1 hour. Page someone.
- **Slow burn:** 10% of monthly budget consumed in 6 hours. Slack alert.

A per-minute error-rate threshold alert ("alert if error rate > 1% for 5 minutes") is a proxy for fast-burn but has more false positives. Burn-rate alerts are more forgiving of brief anomalies and more sensitive to sustained degradation.

## What *not* to SLO on

- **Individual handler internals.** SLO on user-observable outcomes, not internal state.
- **Metrics that don't correlate with player experience.** "Database CPU < 80%" is an operational target, not an SLO.
- **Nice-to-have numbers.** SLO only on what you're willing to halt deploys for.

Fewer, meaningful SLOs > many, ignored ones.

## Measuring

Practically, Extend apps emit metrics through the AGS metrics pipeline (see `overview.md#infrastructure` — 13-month retention). Latency histograms, error counts, and throughput counters can be emitted from handlers.

For Event Handler freshness, the handler needs to know the event emit timestamp. AGS events typically carry this; check the event shape. Compute freshness as `handler_complete_time - event_emit_time` and emit as a histogram.

Dashboards typically live in AccelByte's monitoring (Grafana-style). Verify what's available in your setup before designing SLIs.

## Reviewing SLOs

Re-examine SLOs quarterly:

- **Were any missed?** If so, why — is the target wrong or is the app unreliable?
- **Were all hit trivially?** Consider tightening — unused error budget is waste.
- **Did anything happen that the SLO didn't catch?** Player complaints not reflected in metrics suggest a missing SLI.

SLOs are a living contract with players, not a write-and-forget document.

## SLOs for launch day

Launch day is not a normal day. Typical rules:

- **Availability:** aim for normal SLO. Failing on launch day is a player-facing disaster.
- **Latency:** relaxed P99 (2x normal) is acceptable; everything is loaded.
- **Error budget:** consider a separate launch-day budget, because spiky days consume normal monthly budgets fast.

Plan for launch day separately from steady-state operation.

## Tying SLOs to rollout decisions

SLO status feeds the rollout process in `references/production/rollout.md`:

- **In-budget, plenty of headroom** → deploy freely, experiment, take risks.
- **Near budget exhaustion** → tighten rollout. Canary everything. Delay non-urgent changes.
- **Budget blown** → freeze deploys except to fix the reliability issue.

SLOs aren't punitive; they're a shared signal that says "we should slow down" or "we can speed up."

## What this reference doesn't cover

- AccelByte / AGS's own SLOs on the platform — ask AccelByte support for the current numbers.
- Custom monitoring infrastructure — AGS provides metrics, but advanced setups (PagerDuty integration, custom dashboards, on-call rotation tools) are outside Extend.
- Incident response process — see your org's runbook. General guidance in `references/production/rollout.md#post-deploy-verification` for deploy-related incidents.
