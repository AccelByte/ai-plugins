---
last-verified: 2026-04-21
see-also:
- '[idempotency.md](idempotency.md)'
- '[scaling.md](../production/scaling.md)'
---

# Rate Limiting Pattern

How to protect downstream dependencies (your DB, external APIs, AGS calls) from bursty Extend app traffic.

## Why rate-limit inside the app

AGS doesn't rate-limit per-handler calls in a way you control. At 60 replicas each receiving traffic, your handler can fan out 60x the incoming RPS to downstream services. Most downstream services don't handle that.

Rate limiting is about protecting *downstream*, not protecting the handler itself. If the handler can handle 1000 RPS but the DB can only handle 100, you want to shed load *before* it hits the DB, not have the DB fall over.

## Two scopes: per-replica vs. shared

**Per-replica** — each replica enforces its own limit. Simpler; no shared infra. But N replicas × per-replica limit = global limit. If limit is 100 and you scale to 10 replicas, global is 1000.

**Shared** — all replicas share a limit through Redis / another store. More accurate global limit. Slower (adds a cache call per request).

Per-replica is the right default. Shared becomes necessary when the downstream has a firm global cap (e.g., a partner API billed per call).

## Per-replica limiter (token bucket)

### Go

```go
import "golang.org/x/time/rate"

// One limiter per downstream, constructed at app init.
var dbLimiter = rate.NewLimiter(100, 20)  // 100 req/s, burst 20

func handler(ctx context.Context, req *Req) (*Resp, error) {
    if err := dbLimiter.Wait(ctx); err != nil {
        return nil, fmt.Errorf("rate limit: %w", err)
    }
    return callDB(ctx, req)
}
```

`Wait` blocks until a token is available or the context expires. `Allow()` returns immediately with a bool if you prefer fail-fast.

### Python

```python
from asyncio import Semaphore
# For async handlers. For rate-per-second, use aiolimiter or similar.

import time

class TokenBucket:
    def __init__(self, rate_per_sec, burst):
        self.rate = rate_per_sec
        self.tokens = burst
        self.last = time.monotonic()

    def try_acquire(self):
        now = time.monotonic()
        self.tokens = min(self.tokens + (now - self.last) * self.rate, self.rate)
        self.last = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
```

Production: use `aiolimiter` (async) or `limits` library rather than hand-rolling.

### Java

```java
// Guava's RateLimiter
import com.google.common.util.concurrent.RateLimiter;

private final RateLimiter dbLimiter = RateLimiter.create(100.0);  // 100 permits/sec

public Response handle(Request req) {
    dbLimiter.acquire();  // blocks
    return callDb(req);
}
```

### C#

```csharp
// System.Threading.RateLimiting (built in since .NET 7)
using System.Threading.RateLimiting;

private readonly RateLimiter _dbLimiter = new TokenBucketRateLimiter(
    new TokenBucketRateLimiterOptions {
        TokenLimit = 20,
        TokensPerPeriod = 100,
        ReplenishmentPeriod = TimeSpan.FromSeconds(1),
        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
        QueueLimit = 10
    }
);

public async Task<Response> Handle(Request req) {
    using var lease = await _dbLimiter.AcquireAsync(1);
    if (!lease.IsAcquired) throw new Exception("rate limit");
    return await CallDb(req);
}
```

## Shared limiter (Redis)

For global limits across replicas:

```go
// Pseudocode — use a proven library like redis_rate / go-redis/redis_rate
result := redisRate.Allow(ctx, "db-limiter", rate.PerSecond(100))
if !result.Allowed {
    return nil, errRateLimited
}
```

Each Redis round-trip adds ~1 ms. For high-throughput handlers, this is non-trivial — consider a hybrid: per-replica at high rates (fast), with Redis-backed fallback for cross-replica fairness.

## Per-key rate limits

"Rate-limit per user" is a different problem: global limits don't help a single spammy user. Add a user-keyed limiter:

- Per replica: `map[userID]*rate.Limiter` with LRU eviction. Fast, but per-replica.
- Shared: Redis with keys like `rate:user:{uid}`. Global but adds latency.

Evict entries for idle users; don't grow the map unbounded.

## What to do when the limit hits

- **Override:** return an error. AGS treats it as a handler failure; callers see degraded AGS response. Alternative: synthesize a "default" response if your semantics allow (e.g., no-op the override and let AGS default apply).
- **Event Handler:** sleep and retry within the handler, or let the event re-consume (requires at-least-once semantics — see `references/cookbook/idempotency.md`).
- **Service Extension:** return HTTP 429 with `Retry-After` header. Clients should back off.

## Metrics to emit

- `rate_limit_allowed_total{limiter="db"}` — counter
- `rate_limit_rejected_total{limiter="db"}` — counter
- `rate_limit_wait_seconds{limiter="db"}` — histogram (if using `Wait` semantics)

If `rejected_total` climbs, either the downstream is too small or the handler is too hot — investigate before bumping the limit.

## Common mistakes

- **Global limiter in a stateful variable across the app lifetime.** Fine. Just don't accidentally create a new limiter per request.
- **Rate limit too high.** "Protecting" at 1000 req/s when the downstream caps at 100 is not protection.
- **No timeout on `Wait`.** A blocked Wait can hold a request forever. Use `WaitN(ctx, 1)` with a context deadline.
- **Rate limiting on the wrong axis.** Per-request rate limiting is blunt. If your issue is bytes/sec or concurrent connections, limit on that axis instead.
