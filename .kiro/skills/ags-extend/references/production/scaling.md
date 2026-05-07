---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[resources.md](resources.md)'
- '[rate-limiting.md](../cookbook/rate-limiting.md)'
---

# Scaling Extend Apps

How to reason about scale for Extend apps. Complements `resources.md` (single-replica sizing) by focusing on the horizontal axis.

## Stateless by default

Every Extend pattern scales horizontally. That requires handlers to be stateless — any replica can handle any call.

"Stateless" means:

- No per-request data in memory that persists across calls.
- Any caching is bounded and safe to lose (LRU with TTLs, not "the truth").
- Authoritative state lives in a database, AGS itself, or shared cache (Redis, DocumentDB).

Patterns to avoid:

- **In-memory session tracking.** "The player is in match X" stored in a `map[userID]matchID` on the replica. Replica dies / player lands on a different replica → lost. Put in Redis or AGS's session service.
- **Counter accumulated locally, flushed periodically.** `replica-local count += 1; flush every minute`. Double-counts during rollouts, undercounts on crash. Use atomic increments on shared storage.
- **Per-replica file writes.** The filesystem is ephemeral.

## The 60-replica ceiling

Hard limit: 60 replicas per app, any pattern (from `overview.md#infrastructure`).

At 60 replicas running at a cumulative P50 of 10ms, a single Override can sustain roughly 6000 concurrent calls (60 × 1/0.01). In practice AGS also has ingress queues, so sustained RPS may be lower. Plan headroom.

If you're designing for >60 replicas' worth of load, rethink:

- **Can the work be batched?** If each handler call processes one item, batching 10 items per call cuts replica demand 10x.
- **Can the work be cached?** Most Override calls for "VIP tier for user X" return the same answer for minutes at a time. In-memory TTL cache with shared-cache fallback, sized per replica, reduces upstream load.
- **Can the work be async?** If AGS doesn't strictly need the answer on the critical path, Event Handler instead of Override.
- **Can you split the app?** Two Overrides doing different things in one app → two apps scaling independently. AGS deploys each.

## Load shapes to design for

**Steady-state.** Average RPS roughly constant. Size for peak + headroom.

**Diurnal.** Peaks at player-friendly hours, troughs at night. Autoscale if replicas can warm up in seconds (Event Handler, Service Extension); fixed at peak size if cold start is slow (Override on the critical path).

**Event-driven spike.** Event Handlers see bursts when AGS emits many events at once (game ends, season rollover). Replicas consuming from Kafka parallelize; throughput scales near-linearly up to the replica ceiling.

**Launch day.** Entire player base hits at once. Size for 5–10x typical peak. Accept that you'll over-provision during the calm days after launch and tune down.

## Autoscaling

AGS scales Extend replicas between a min and max configured per-app in the AGS Admin Portal (app detail → resource configuration). The `extend-helper-cli` does not accept `--min-replicas` or `--max-replicas` on any subcommand — see `references/deploy/cli-commands.md` for the full replica-related notes. Adjust `Min Replicas` and `Max Replicas` in the Portal (or via the CSM API) and redeploy to pick up the new bounds.

Setting `min == max` disables autoscale (fixed size). The actual autoscale triggers (what thresholds AGS uses to scale up/down) are AGS infra; not configurable per-app as of this reference.

For workloads that need more scaling control than AGS exposes:

- Use Event Handler / Service Extension instead of Override where possible — more latitude on latency means more tolerance of cold starts.
- Keep handlers fast so a single replica does more work per unit of CPU; reduces pressure on replica count.

## Warm capacity vs. burst capacity

For Override, cold-start matters because AGS is blocked. If you need burst capacity:

- Raise the min-replica floor in the Admin Portal (app detail → resource configuration) above steady-state demand. Warm replicas serve immediately.
- Keep handler code small. A 10 MB binary starts faster than a 100 MB one.
- Minimize init-time work (no "load 1 GB of model into memory at startup").

Service Extension and Event Handler tolerate cold starts better — a caller expecting an async reply can wait seconds.

## Event Handler-specific scaling

Event Handlers consume from Kafka Connect. Throughput is bounded by:

- Number of replicas × per-replica processing rate.
- Kafka partition count (parallelism ceiling is per-partition).
- Backpressure if your handler is slower than event arrival.

Signs you need more replicas:

- **Event lag metric climbing.** Events are arriving faster than you process them.
- **Handler CPU at ceiling** while lag climbs. Per-replica work is CPU-bound; parallelize.

Signs you need a faster handler (not more replicas):

- **Handler CPU at ceiling on a single event.** One event takes too long. Profile and optimize.

## Service Extension-specific scaling

REST/gRPC endpoints scale like any HTTP service:

- **Connection pooling to downstream (AGS, your DB).** Each replica opens a pool. At 60 replicas × 10 connections = 600 connections to your DB — verify your DB handles it.
- **Shared state (cache, DB)** becomes the bottleneck at high replica count. Sharding or read replicas on the DB side often matter more than more handler replicas.
- **Stateful features (WebSocket, server-streaming)** complicate horizontal scaling. A client stuck to one replica means losing that replica drops the connection. Design for reconnect.

## Multi-region considerations

Extend apps deploy within a namespace's region. If your players are global:

- AGS offers multi-namespace setups; an Extend app in each region serves local traffic.
- Your app is typically the replica of itself — multiple deploys of the same code, one per region, each with its own data store or a globally-replicated one.
- Design storage access for region locality. Cross-region DB calls add latency that makes Override infeasible.

This is a topic larger than the Extend layer itself; the actual multi-region architecture is an AccelByte / AGS decision, not an Extend configuration.

## When scaling has gone wrong

Signs you've scaled "out" when you should have scaled "up" (or vice versa):

- **At N replicas, P50 latency doesn't drop below a floor.** That floor is the per-call work; more replicas don't help. Optimize the handler.
- **At N replicas, P99 latency gets worse.** Contention on a shared resource (DB, cache, external API rate limit) is worse with more callers. More replicas = more contention.
- **Tail latency goes up with more replicas.** Could be infrastructure noise — more replicas = more chances to land on a slow host. Not usually fixable; accept a higher P99 or use fewer, larger replicas.

Scaling is one of those things where "add more" is often not the answer. Measure first.
