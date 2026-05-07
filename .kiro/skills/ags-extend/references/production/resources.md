---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/extend-service-extension-go
see-also:
- '[resource-defaults.md](../init/resource-defaults.md)'
- '[scaling.md](scaling.md)'
- '[slo.md](slo.md)'
---

# Production Resource Tuning

`references/init/resource-defaults.md` has *starting* values to use when first deploying. This reference covers what to do once the app is live and you have actual load data.

## Tune, don't guess

Resource settings (CPU, memory, replica min/max) are per-app configuration in the AGS Admin Portal (app detail → resource configuration). `extend-helper-cli create-app` accepts `--cpu` and `--memory` as initial values at creation time; once the app exists, resource changes must be made in the Admin Portal or via the CSM API (the CLI has no "update resources" subcommand) — see `references/deploy/cli-commands.md`. To apply new resource settings, edit them in the Admin Portal or CSM API, then redeploy with `extend-helper-cli deploy-app` to pick up the new configuration.

Reference values for a Service Extension with DB access (use `references/init/resource-defaults.md` for the full per-pattern table):

| Setting | Starting value |
|---|---|
| CPU | 500m |
| Memory | 512 MB |
| Min replicas | 1 |
| Max replicas | 10 |

There is no local manifest; resource values live on the app's config in the Portal (or in whatever script wraps the CSM API).

Don't raise these numbers preemptively. Every millicore and MB you reserve is reserved whether or not the app uses it. Over-provisioning costs; under-provisioning manifests as OOMKills or throttling.

## Signals that say "bump memory"

- **`OOMKilled` in logs.** The replica ran out of memory; the kernel killed it. Bump memory up (double, then tune down once stable).
- **Steady memory growth across hours/days.** Almost certainly a memory leak — profile before bumping. More memory delays the crash; doesn't fix it.
- **Degraded status during load spikes, no obvious log errors.** Memory pressure can cause slow GC pauses (Java/C#) or swapping (all languages) that look like "degraded" rather than "crashed."

## Signals that say "bump CPU"

- **High latency on sync handlers (Override).** Handler takes longer under load than under quiet conditions.
- **CPU throttling metrics nonzero.** If AGS's metrics show your app hitting its CPU limit, you're throttled — the app is running slower than it would with more CPU.
- **Queue backup on Event Handlers.** Events arriving faster than you process them. Either bump CPU or bump replicas (usually replicas — Event Handlers parallelize well).

## Signals that say "bump replicas"

- **RPS exceeds single-replica throughput.** Horizontal scale works better than vertical for most stateless handlers.
- **P99 latency spikes under load** while P50 stays flat. Indicates queuing at a replica — more replicas spread the queue.
- **Event Handler lag.** Events queued in Kafka Connect. More replicas = more parallel consumers.

## Signals that say "reduce resources"

Rarely mentioned but important. Running well-above-needed resources:

- Wastes money.
- Makes problems look bigger than they are (more headroom masks inefficiency).

If the app is running smoothly at 10% CPU and 30% memory for weeks, you can tune down. Halve one dimension, observe for a week, tune again.

## The hard ceilings (recap)

From `init/resource-defaults.md#hard-limits`:

| Type | CPU max (m) | Memory max (MB) | Replicas max |
|---|---|---|---|
| Override | 1415 | 2382 | 60 |
| Service Extension | 1415 | 2382 | 60 |
| Event Handler | 1215 | 1358 | 60 |

If you're brushing these ceilings, vertical scale has run out:

- **Override** hitting 1415m is a hint that the handler is doing too much synchronously. Move work to Event Handler or Service Extension.
- **Event Handler** hitting 1215m usually means the handler is too slow per event — optimize the handler or horizontally scale (more replicas, each doing less).
- **Replicas at 60** under sustained load is a design problem. The pattern may be wrong, or the handler fundamentally needs to scale differently (caching, batching, async offloading).

## Latency, specifically for Override

Override latency = AGS call latency. Every millisecond you add to the override handler adds to the matchmaking call (or whichever AGS surface invokes it).

Targets by percentile:

- **P50 < 10ms** for override handlers that don't make external calls.
- **P50 < 50ms** for handlers that hit an in-process cache.
- **P50 < 200ms** for handlers that must hit a database or external API. Consider moving this logic out of Override.

P99 should stay within 3x of P50 under typical load. A P99:P50 ratio over 10x suggests GC pauses, thread contention, or occasional network flukes on a critical external dep.

## Right-sizing process

When a fresh app goes to production:

1. **Deploy at the scaffold defaults.** Start with `references/init/resource-defaults.md` values.
2. **Observe a week of real traffic.** Pay attention to peak hour, not average.
3. **Tune one dimension at a time.** If the app is memory-constrained, bump memory; don't also bump CPU — you won't know which change helped.
4. **Re-observe a week.** Confirm stability.
5. **Repeat if needed.**

This is boring. It's the right pace. "Adjust, observe, adjust" avoids chasing your tail.

## When the app is at capacity and you can't add more

Hit the 60-replica ceiling or the per-replica max? Options in order of effort:

1. **Optimize the hot path.** Profile. Common wins: eliminate redundant allocations, batch work that's currently per-request, cache lookups.
2. **Move work off the critical path.** Override doing a database lookup per call? Cache it. Handler doing an external API call? Fire-and-forget to a Service Extension instead.
3. **Split the app.** Two Override handlers in one app that have different resource profiles → two apps with independent scaling.
4. **Rethink the pattern.** Some problems don't fit Override. An Override that needs 20 different external data sources probably belongs in a Service Extension that front-runs AGS.

## What resource changes do NOT fix

- **Correctness bugs.** More memory doesn't fix a handler that returns the wrong result.
- **Intermittent external failures.** More CPU doesn't help when AGS's dependency flakes.
- **Credential / permission errors.** Bumping resources doesn't authorize you.
- **Proto contract mismatches.** See `upgrade/breaking-changes.md`.

Resource tuning treats symptoms of load. Other bugs live elsewhere.
