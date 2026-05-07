---
last-verified: 2026-04-21
see-also:
- '[idempotency.md](idempotency.md)'
---

# Retry Pattern

How to retry upstream calls (AGS, external APIs) safely. Closely tied to `references/cookbook/idempotency.md` — retries without idempotency compound failures.

## When to retry

Retry **transient** failures:

- Network errors (connection reset, timeout).
- HTTP 5xx from upstream.
- gRPC `UNAVAILABLE`, `DEADLINE_EXCEEDED`, `RESOURCE_EXHAUSTED`.

Don't retry **permanent** failures:

- HTTP 4xx (bad request, not found, unauthorized).
- gRPC `INVALID_ARGUMENT`, `NOT_FOUND`, `PERMISSION_DENIED`.
- Application errors indicating your input is wrong.

Retrying a 4xx just burns capacity. Retrying a 5xx gives the upstream a chance to recover.

## Exponential backoff

Linear retries (retry at 1s, 2s, 3s) pile on when the upstream is struggling. Exponential (1s, 2s, 4s, 8s) gives it room to recover.

**With jitter.** Multiple callers retrying synchronously at the same backoff cause a synchronized "retry storm." Jitter (randomness added to the wait) spreads them out.

Typical config:

- Initial delay: 100 ms.
- Max delay: 10 seconds.
- Factor: 2.
- Jitter: ±50%.
- Max attempts: 3–5.
- Max total time: 30 seconds.

## Go — using `github.com/cenkalti/backoff`

```go
import "github.com/cenkalti/backoff/v4"

operation := func() error {
    resp, err := client.CallUpstream(ctx, req)
    if err != nil {
        if isPermanent(err) {
            return backoff.Permanent(err)  // stop retrying
        }
        return err  // transient, retry
    }
    // success path
    return nil
}

backoffCfg := backoff.NewExponentialBackOff()
backoffCfg.MaxElapsedTime = 30 * time.Second

err := backoff.Retry(operation, backoffCfg)
```

`backoff.Permanent` wraps an error to signal "don't retry." The library unwraps it and stops.

## Python — `tenacity`

```python
from tenacity import (
    retry, stop_after_attempt, wait_exponential_jitter,
    retry_if_exception_type,
)

@retry(
    retry=retry_if_exception_type((TransientError, TimeoutError)),
    wait=wait_exponential_jitter(initial=0.1, max=10),
    stop=stop_after_attempt(5),
)
def call_upstream(req):
    return client.call(req)
```

## Java — Resilience4j

```java
import io.github.resilience4j.retry.*;
import java.time.Duration;

RetryConfig config = RetryConfig.custom()
    .maxAttempts(5)
    .waitDuration(Duration.ofMillis(100))
    .intervalFunction(IntervalFunction.ofExponentialRandomBackoff(100, 2.0))
    .retryExceptions(TimeoutException.class, IOException.class)
    .ignoreExceptions(IllegalArgumentException.class)
    .build();

Retry retry = Retry.of("upstream", config);
Response result = retry.executeSupplier(() -> client.call(req));
```

## C# — Polly

```csharp
using Polly;

var policy = Policy
    .Handle<HttpRequestException>()
    .Or<TaskCanceledException>()
    .WaitAndRetryAsync(
        retryCount: 5,
        sleepDurationProvider: attempt =>
            TimeSpan.FromMilliseconds(Math.Min(
                100 * Math.Pow(2, attempt) + Random.Shared.Next(0, 100),
                10_000)));

var response = await policy.ExecuteAsync(() => client.CallAsync(req));
```

## Circuit breakers

Unbounded retries against a failing upstream DDoS it (and yourself). A circuit breaker halts all traffic to the upstream once failure rate crosses a threshold.

- **Closed:** normal operation.
- **Open:** all calls fail immediately without hitting upstream. Usually 30–60s.
- **Half-open:** after the open timeout, a few calls probe the upstream. If they succeed, close. If they fail, re-open.

Libraries: Resilience4j (Java), Polly (C#), `sony/gobreaker` (Go), `pybreaker` (Python).

Wrap your retry inside a circuit breaker — retries happen inside the breaker; if the breaker opens, retries don't fire either.

## Context deadlines / timeouts

Retries only help if the handler has time for them. If Override has a 100 ms SLA and your retry sleeps 1s, the caller already gave up.

- **Override:** budget is tight. 1 retry, maybe. `ctx.Deadline()` caps total handler time — your retry loop must respect it.
- **Event Handler:** budget is generous. Multi-minute retries fine.
- **Service Extension:** depends on caller SLA; respect the incoming request's context.

Always propagate context. Go: pass `ctx` through. Python: use `asyncio.timeout` or deadlines. Java: `Timeout` annotations or explicit deadlines. C#: `CancellationToken`.

## Retries + idempotency (hard requirement)

Retrying a non-idempotent operation = doubled side effects. Some combinations:

- **Retrying a GET:** safe (no side effect).
- **Retrying a PUT with a body:** safe if the PUT is idempotent.
- **Retrying a POST without an idempotency key:** UNSAFE.
- **Retrying a payment / email / notification send:** UNSAFE without provider-side dedup.

See `references/cookbook/idempotency.md`. Never retry blindly across a side-effect boundary.

## Server-side retry vs. client-side retry

If your handler calls another service, you can:

- **Retry inside your handler.** Caller sees one response (eventual success or final failure).
- **Let the caller retry.** Your handler returns the error quickly; caller handles retry logic.

For Override, the caller is AGS and you usually can't influence its retry behavior. For Service Extension, clients retry per your API contract.

Prefer pushing retry to the caller when possible — you own less failure state, and the caller may have better context (e.g., give up faster if the user closed the app).

## Retry budget

Across a whole system, retries amplify load during failure. If every caller retries 3x on failure, a failing dep sees 3x its normal traffic — the opposite of what it needs.

Mitigations:

- **Circuit breaker** — primary defense.
- **Shared retry budget** — cap retries per second across the app; when exhausted, fail without retry.
- **Caller-side budget** — retry only once if you know other callers will also retry.

## Common mistakes

- **Infinite retry.** Handler hangs forever on an upstream outage. Cap attempts and elapsed time.
- **Retrying 4xx.** Wastes capacity; upstream still won't accept it. Classify errors.
- **No jitter.** Synchronized retry storms.
- **Retries inside a synchronous RPC with no deadline.** Holds the caller indefinitely.
- **Retry at multiple layers.** Handler retries 3x, framework retries 3x → 9 total calls. Pick one layer.
- **Retries masking bugs.** A transient retry that always succeeds hides an underlying flaky dep. Alert on high retry rates.

## Metrics to emit

- `retry_attempts_total{upstream="ags"}` — counter.
- `retry_exhausted_total{upstream="ags"}` — counter (retries that hit max and still failed).
- `circuit_breaker_state{upstream="ags"}` — gauge (0 = closed, 1 = open, 2 = half-open).
- `retry_wait_seconds{upstream="ags"}` — histogram.

If `retry_attempts / total_requests` goes above a few percent, investigate — the upstream is likely degraded.
