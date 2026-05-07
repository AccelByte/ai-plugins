---
last-verified: 2026-04-21
see-also:
- '[slo.md](../production/slo.md)'
---

# Caching Pattern

How to cache upstream lookups inside Extend handlers, especially for Override where every millisecond matters.

## When to cache

Cache a lookup if:

- The answer changes rarely (seconds to minutes, not milliseconds).
- You make the same lookup many times (same user, same config).
- The upstream call costs real time or money.

Don't cache if:

- The answer must be strictly fresh (account balance in a financial flow).
- The key space is unbounded and access is uniform — every call is a cold miss.

For AGS Override, good caching candidates: VIP status, user tier, config lookups. Bad candidates: anything that changes per request.

## Two tiers: per-replica + shared

**L1 (per-replica, in-process):** fast (nanoseconds). Bounded by heap size. Lost on replica restart.

**L2 (shared, e.g., Redis):** slower (milliseconds). Survives restart. Coherent across replicas.

Typical flow:

1. Check L1 → hit, return.
2. Check L2 → hit, populate L1, return.
3. Call upstream → populate both, return.

For most Extend workloads L1 alone is fine. Add L2 only when you measure L1 miss rate too high.

## TTL — how long is "a little stale"?

TTL (time-to-live) is the tradeoff between freshness and load:

- 5 seconds — nearly live. Upstream still sees most calls. Caching here saves only under-bursts.
- 60 seconds — the sweet spot for many configs. Staleness measured in minutes is fine for tier lookups.
- 5 minutes — only for very slow-changing data (game-mode settings, seasonal config).
- Forever — dangerous; no eviction on update.

Start short and lengthen if miss rate is high. Most caches get set to "too long" on day 1 and everyone regrets it during an incident.

## Go — in-process LRU

```go
import "github.com/hashicorp/golang-lru/v2/expirable"

// At init:
userTierCache := expirable.NewLRU[string, Tier](
    10_000,        // max entries
    nil,           // no eviction callback
    time.Minute,   // TTL
)

// In handler:
if tier, ok := userTierCache.Get(userID); ok {
    return tier, nil
}
tier, err := fetchUserTier(ctx, userID)
if err != nil {
    return Tier{}, err
}
userTierCache.Add(userID, tier)
return tier, nil
```

## Python — cachetools

```python
from cachetools import TTLCache
from threading import Lock

# Thread-safe LRU with TTL.
_user_tier_cache = TTLCache(maxsize=10_000, ttl=60)
_lock = Lock()

def get_user_tier(user_id: str) -> Tier:
    with _lock:
        if user_id in _user_tier_cache:
            return _user_tier_cache[user_id]
    # Fetch outside the lock; multiple concurrent misses will double-fetch.
    tier = fetch_user_tier(user_id)
    with _lock:
        _user_tier_cache[user_id] = tier
    return tier
```

For async, use `async-lru` or similar.

## Java — Caffeine

```java
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;

private final Cache<String, Tier> userTierCache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(Duration.ofMinutes(1))
    .build();

public Tier getUserTier(String userId) {
    return userTierCache.get(userId, id -> fetchUserTier(id));
}
```

The `get` with loader pattern deduplicates concurrent misses — only one thread fetches, others wait.

## C# — MemoryCache

```csharp
using Microsoft.Extensions.Caching.Memory;

private readonly IMemoryCache _cache;

public Tier GetUserTier(string userId) {
    return _cache.GetOrCreate(userId, entry => {
        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
        entry.Size = 1;
        return FetchUserTier(userId);
    });
}

// Register in DI:
services.AddMemoryCache(options => options.SizeLimit = 10_000);
```

## Thundering-herd protection

When a hot key expires, many concurrent requests race to refresh it. All call upstream simultaneously.

**Single-flight:** only one fetch per key at a time; others wait for its result. Go has `golang.org/x/sync/singleflight`. Caffeine's `get(key, loader)` and .NET's MemoryCache with `GetOrCreate` do this implicitly.

**Probabilistic early refresh:** start refreshing before TTL expires with increasing probability. Avoids the synchronized expiration stampede.

For high-RPS handlers with hot keys, use one of these. Without it, TTL expiration shows up as periodic latency spikes.

## Negative caching

Cache "not found" results too, but with a shorter TTL. Otherwise every call for a nonexistent key hits upstream.

```go
userTierCache.Add(userID, Tier{NotFound: true})  // still cached
```

Short TTL (5–10 seconds) means new users get served correctly quickly after creation.

## Shared cache (Redis)

For coherence across replicas and larger key spaces:

```go
// Check L2:
val, err := redis.Get(ctx, "tier:"+userID).Result()
if err == nil {
    return parseTier(val), nil
}
// L2 miss, fetch upstream
tier, _ := fetchUserTier(ctx, userID)
redis.SetEX(ctx, "tier:"+userID, serializeTier(tier), 60*time.Second)
return tier, nil
```

Add L1 in front for hot keys.

## Cache invalidation

"There are only two hard things in computer science: cache invalidation..." Extend apps typically can't proactively invalidate; the upstream doesn't notify them.

Options:

- **TTL-only.** Stale data goes away when TTL expires. Accept the staleness window.
- **Event-driven.** If AGS emits an event when the cached value changes, subscribe (via an Event Handler that pushes into the shared cache). Adds complexity.
- **Version fetch.** Fetch a cheap "version" from upstream; if it changed, invalidate. Adds latency.

TTL-only is the right default. Event-driven invalidation is for high-value, slow-changing data where staleness is costly.

## Metrics to emit

- `cache_hits_total{cache="user-tier", tier="l1|l2"}`
- `cache_misses_total{cache="user-tier"}`
- `cache_size{cache="user-tier"}` — gauge
- `cache_eviction_total{cache="user-tier", reason="ttl|size"}`

Hit rate = hits / (hits + misses). Below 50% and the cache is barely helping; above 95% and you might extend TTL.

## Common mistakes

- **Caching errors.** Don't cache upstream errors — you'll serve "error" for the TTL window. Fail open: retry on next call.
- **Unbounded cache.** Memory leak. Always set `maxSize`.
- **Caching mutable objects by reference.** Mutating a cached object mutates it for all callers. Clone on read or store immutable values.
- **Cache warmup on startup.** Bulk-loading the cache on startup delays readiness probe. Warm lazily.
- **No metrics.** You won't know the cache is broken if you don't measure hit rate.
