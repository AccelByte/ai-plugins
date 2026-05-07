---
last-verified: 2026-05-07
see-also:
- '[rollout.md](../production/rollout.md)'
- '[cli-commands.md](../deploy/cli-commands.md)'
---

# Feature Flags Pattern

How to gate new behavior in Extend apps. Primary value: canary rollout without canary infrastructure, and fast off-switches when something breaks.

## Why feature flags for Extend

AGS doesn't support per-replica canary deploys directly (see `references/production/rollout.md#canary-approximations-for-ags`). Feature flags fill that gap:

- Ship the new code path to all replicas.
- Gate it behind a flag read at call time.
- Flip the flag for a small slice (internal users, 1% of traffic, a specific realm).
- Flip off without a redeploy if it breaks.

Flags also enable:

- **Emergency kill-switches** — turn off a feature without code changes.
- **A/B testing** — serve two behaviors to compare outcomes.
- **Per-realm / per-namespace config** — enable for premium players only, or for tournament mode only.

## Where the flag value lives

Three common stores, each with tradeoffs:

| Store | Freshness | Complexity | When to use |
|---|---|---|---|
| Env var at startup | Stale until redeploy | Lowest | Long-lived config, rarely changed |
| Remote config service (LaunchDarkly, Unleash, OpenFeature backends) | Seconds | Higher | Dynamic flags, needs dashboard/audit |
| Database / shared cache | Custom | Medium | No third-party budget, tolerate DIY |

For "quick kill-switch" flags, dynamic sources are strongly preferred. Redeploying to flip a flag defeats the purpose.

## Simple: env var flag

Works for long-lived "feature on / off" toggles.

```go
var useNewMatchmaker = os.Getenv("USE_NEW_MATCHMAKER") == "true"

func handler(ctx context.Context, req *Req) (*Resp, error) {
    if useNewMatchmaker {
        return newHandler(ctx, req)
    }
    return oldHandler(ctx, req)
}
```

Where to set the value depends on which stage you're flipping:

**Local dev / debugging (`make run`, `docker-compose up`, `/ags-extend debug`)** — edit the app's local `.env` file. That's the source the local process reads at startup; restart the local process to pick up the change. This is the right path while the user is iterating on the new code path.

**Deployed app (running in AGS)** — local `.env` is irrelevant; it's not bundled into the image and isn't read by the deployed process. Use one of these (see `references/deploy/cli-commands.md`):

- `extend-helper-cli update-var --namespace {ns} --app {app} --key USE_NEW_MATCHMAKER --value true` (or `update-secret` for sensitive values), then restart the app to pick up the change.
- Admin Portal → app detail → environment variables / secrets, edit there, then restart.
- Direct CSM API call.

**The trap to avoid:** editing the deployed-app's value by editing local `.env` and redeploying. The image build doesn't carry `.env` (git-ignored, not COPY'd), so the deployed process keeps whatever value `update-var` / Admin Portal last set. Use the deployed-config path for deployed apps; use local `.env` for local dev.

## Dynamic: remote flag service

For runtime-adjustable flags. Example with a hypothetical OpenFeature-style client:

```go
// At init:
flagClient := openfeature.NewClient("extend-matchmaker")

// In handler:
useNew, _ := flagClient.BooleanValue(ctx, "use-new-matchmaker", false,
    openfeature.EvaluationContext{
        Attributes: map[string]interface{}{
            "userID": req.UserID,
            "realm":  req.Realm,
        },
    })
if useNew {
    return newHandler(ctx, req)
}
return oldHandler(ctx, req)
```

Evaluation happens at call time; rollout percentage, user attributes, and rule expressions live in the flag service.

## Percentage rollout by user ID

Without a flag service, you can percentage-gate using a hash:

```go
import "hash/fnv"

func inRollout(userID string, percent int) bool {
    h := fnv.New32a()
    h.Write([]byte(userID))
    return int(h.Sum32()%100) < percent
}

// In handler:
if inRollout(req.UserID, rolloutPercent) {
    return newHandler(ctx, req)
}
return oldHandler(ctx, req)
```

`rolloutPercent` comes from env var, config fetch, or a flag service. Same user sees consistent behavior regardless of which replica serves them.

**Important:** hash should be stable across replica restarts. FNV, xxhash, or SHA work. Go's `maphash` does NOT — it's randomized per-process.

## Per-realm / per-namespace gating

For player-segmentation without per-user attributes:

```go
allowedRealms := map[string]bool{
    "realm-premium": true,
    "realm-staging": true,
}

if allowedRealms[req.Realm] {
    return newHandler(ctx, req)
}
return oldHandler(ctx, req)
```

Populate `allowedRealms` from env var (comma-separated), flag service, or config.

## Flag lifecycle

Every flag has a lifecycle:

1. **Gated rollout** — new code gated behind flag, off by default.
2. **Progressive enablement** — 1% → 10% → 50% → 100%.
3. **Validation** — metrics stable, no regressions.
4. **Cleanup** — remove the flag and the old code path.

**Clean up.** Dead flags accumulate into technical debt. The new code path becomes the only path; the flag is no-op but still evaluated. Eventually someone turns the wrong flag off.

A useful rule: every flag has a `created_at` and an expected `cleanup_by` date. Beyond `cleanup_by`, it goes on a debt list.

## Emergency kill-switch pattern

Distinct from progressive rollout. Kill-switches protect against *new* problems in *existing* features.

```go
// Gate every call to a fragile external dep:
if killSwitch.Get("disable-external-leaderboard-sync") {
    return cachedLeaderboard, nil
}
return fetchExternalLeaderboard(ctx, req)
```

Kill-switches should:

- Default to "feature on" (so forgetting the flag config doesn't break the feature).
- Fail open if the flag service itself is down (don't make the kill-switch a single point of failure).
- Be documented in runbooks so on-call knows which flag to flip.

## Flag evaluation performance

A flag check must be fast. If it adds 10 ms per call, you've made Override slower to enable canary.

- **Evaluate from memory.** Local cache of flag values, refreshed periodically from the source. `openfeature` and most flag SDKs do this.
- **Don't call flag service per-request from a hot path.** Even 1 ms per request at 1000 RPS = 1 CPU-second per second of flag overhead.

Check the SDK's caching behavior; most SDKs cache flags for seconds and refresh in the background.

## Fail-safe defaults

What happens if the flag service is unreachable?

- **Default value:** each `BooleanValue(ctx, "key", DEFAULT)` call takes a default. Pick the safe option:
  - For a new feature: default `false` (don't serve untested code if flag source down).
  - For a kill-switch: default `false` (don't accidentally disable a working feature).

The SDK returns the default on error. Log the miss so you know it's happening.

## Per-language notes

### Python

```python
# Unleash, LaunchDarkly, OpenFeature Python SDK
use_new = flag_client.is_enabled("use-new-matchmaker", user={"id": user_id})
```

### Java

```java
// OpenFeature-Java or vendor SDK
boolean useNew = flagClient.getBooleanValue("use-new-matchmaker", false,
    new EvaluationContext.Builder().targetingKey(userId).build());
```

### C#

```csharp
// OpenFeature-CSharp
bool useNew = await client.GetBooleanValueAsync("use-new-matchmaker", false,
    new EvaluationContext.Builder().Set("userId", userId).Build());
```

## Testing with flags

Two code paths means doubled test surface. Strategies:

- **Test both paths.** Unit tests parametrize on the flag state.
- **Integration tests on the flag-on path** (new code), spot-check flag-off (old code still works).
- **Feature-flagged tests pre-cleanup.** Before removing the flag, run the full suite with flag forced on and forced off.

Don't let "we'll test both" become "we only tested one."

## Metrics to emit

- `flag_evaluation_total{flag="use-new-matchmaker", value="true|false"}` — counter.
- `flag_evaluation_error_total{flag="use-new-matchmaker"}` — counter.

Per-path metrics:

```go
// Tag any metric with the flag value:
metrics.Count("handler_calls_total", 1,
    "flag:new-matchmaker", fmt.Sprintf("%t", useNew))
metrics.Histogram("handler_duration", elapsed,
    "flag:new-matchmaker", fmt.Sprintf("%t", useNew))
```

Lets you compare latency, error rate, etc. between flag-on and flag-off cohorts.

## Common mistakes

- **Flag in the hot path without caching.** Every call hits the flag service.
- **Default to feature-on before rollout.** Flag turns *on* — intent was to turn off. Always double-check the polarity.
- **Flag drift.** Same flag with different semantics in two code paths.
- **Never cleaning up.** 50 dead flags in code, no one remembers which matter.
- **Using flags for config.** A flag ("use-new-matchmaker") is binary. Config ("matchmaking-timeout-seconds") is a value. Mixing them makes both harder to reason about.
- **Relying on flags for auth / billing.** Flags default to `false` on errors. Don't gate paid features with a single boolean unless "false" is the correct fail-safe state.
