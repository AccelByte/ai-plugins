---
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[retries.md](retries.md)'
---

# Idempotency Pattern

How to handle duplicate calls safely. Critical for Event Handlers (at-least-once delivery) and anywhere retries can fire twice.

## Why idempotency matters for Extend

- **Event Handlers** receive events from Kafka Connect. Delivery is at-least-once; a replica crash between "process" and "commit offset" re-delivers the event on restart.
- **Override / Service Extension retries.** Callers retry on timeout. If your handler succeeded but the response was lost, the retry is a duplicate.
- **Deploy-time replica rotation.** In-flight work may re-run on a fresh replica.

If your handler writes to a DB, calls an external API, or sends a message, a duplicate call means duplicate effects unless you defend against it.

## Idempotency ≠ safety

An idempotent operation can be applied multiple times with the same result as applying it once. Some operations are naturally idempotent:

- `SET key = "value"` (DB upsert with same value) — idempotent.
- `ADD 5 to counter` — NOT idempotent (adds twice).
- `INCREMENT counter IF idempotency_key NOT SEEN` — idempotent.

Design the operation, or guard it.

## The idempotency key

Every "duplicatable" operation gets a unique key. Common sources:

- **Event ID** (for Event Handlers) — typically in the event metadata. Unique per emit.
- **Request ID** from the caller (Override, Service Extension) — require callers to include one.
- **Synthesized key** — compose from operation + input (`"rewardgrant:"+userID+":"+claimID`). Works if the inputs naturally identify the operation.

Prefer upstream-provided IDs. Synthesized keys can collide if the inputs aren't uniquely identifying.

## The basic pattern

```
1. Extract idempotency key from request/event.
2. Check dedup store: has this key been processed?
   - Yes: return cached result (or skip).
   - No: continue.
3. Perform the operation.
4. Record key + result in dedup store.
5. Return.
```

The dedup store is typically a DB table or a Redis key with a TTL.

## Go example — Event Handler with DB dedup

```go
func handleRewardGranted(ctx context.Context, event *RewardEvent) error {
    // Step 1: key
    key := event.EventID

    // Step 2: dedup check
    var already bool
    err := db.QueryRow(ctx,
        "SELECT EXISTS (SELECT 1 FROM processed_events WHERE event_id = $1)",
        key,
    ).Scan(&already)
    if err != nil {
        return err
    }
    if already {
        return nil  // already processed; skip
    }

    // Step 3: do the work
    if err := grantReward(ctx, event.UserID, event.RewardID); err != nil {
        return err
    }

    // Step 4: mark processed (atomic with step 3 via transaction)
    _, err = db.Exec(ctx,
        "INSERT INTO processed_events (event_id, processed_at) VALUES ($1, NOW())",
        key,
    )
    return err
}
```

**Important:** step 3 and step 4 should be atomic. Either both happen (DB transaction) or step 3 is itself idempotent so a replay of step 4 alone is safe.

## Transactional outbox — when the side effect is in the same DB

If the side effect is a DB write in the same database:

```sql
BEGIN;
  INSERT INTO processed_events (event_id) VALUES ($1)
    ON CONFLICT (event_id) DO NOTHING RETURNING event_id;
  -- if RETURNING returns nothing, this is a duplicate; rollback and skip.
  -- else perform the side-effect writes in the same transaction.
  INSERT INTO rewards (user_id, reward_id) VALUES ($2, $3);
COMMIT;
```

The unique constraint on `processed_events.event_id` is the idempotency guarantee. If the transaction commits, both the marker and the side effect are persisted together.

## External side effects — two-phase approach

When the side effect is an external API call (payment provider, email send):

```
1. Check dedup (as before).
2. Call external API with its own idempotency key (most payment APIs accept one).
3. Record success in dedup store.
```

If step 2 succeeds and step 3 fails, the next retry re-calls step 2 — safe because the external API deduplicates on its own key. If step 2 fails, don't record; next retry tries again.

Use the same key for the dedup store and the external API's idempotency header. Simplifies reasoning.

## TTL on the dedup store

If using Redis/KV:

```
SETNX dedup:event:{eventID} "processed" EX 604800   # 7 days
```

Set TTL longer than any possible retry window:

- Event Handler: several days (events rarely reappear after the retention window).
- Override retry: typically seconds to minutes.

If using DB: no TTL needed, but periodic cleanup keeps the table manageable.

## What if the dedup check itself fails

If you can't reach the dedup store, decide:

- **Fail the handler.** Return error, get retried later. Safe. Costs throughput.
- **Proceed without dedup.** Risky — a duplicate may slip through.
- **Use local per-replica dedup as a fallback.** Catches duplicates delivered to the same replica. Misses cross-replica duplicates.

Default: fail closed. Unless you have a specific reason to trade correctness for availability, don't.

## Language-specific notes

### Python

```python
from hashlib import sha256

def compute_key(event) -> str:
    return event.event_id or sha256(
        f"{event.user_id}:{event.action}:{event.timestamp}".encode()
    ).hexdigest()
```

### Java

Use `@Idempotent` annotations from frameworks (Spring, Micronaut) if available; otherwise hand-roll in the handler.

### C#

Similar — check `IdempotencyKey` on the request; implement as middleware if using ASP.NET.

## Common mistakes

- **Using the wrong key.** `userID` as the key means only one event per user ever processes. Use `eventID` or a truly unique composite.
- **Checking dedup but not recording it.** Writes never get deduplicated; the check is pointless.
- **Non-atomic side effect and dedup marker.** If the marker writes first and the side effect fails, the retry skips it entirely. If the side effect writes first and the marker fails, the retry duplicates. Always atomic.
- **No TTL on ephemeral dedup stores.** Redis fills up forever.
- **Assuming "duplicates are rare, so who cares."** At 1M events/day, even 0.01% duplicates is 100/day. Players notice.

## Design-for-idempotency wherever possible

Operations that are naturally idempotent don't need dedup infra:

- **Setters vs. deltas.** `SetUserScore(uid, 500)` is idempotent; `IncrementUserScore(uid, 500)` is not.
- **Upserts.** `INSERT ... ON CONFLICT DO UPDATE SET ...` is idempotent for equal inputs.
- **Conditional updates.** `UPDATE ... WHERE version = expected` — if applied twice, the second has wrong version and no-ops.

When designing a handler, ask: "if this ran twice with the same input, would the result differ from running once?" If yes, add dedup.
