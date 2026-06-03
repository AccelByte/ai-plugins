---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
- https://github.com/AccelByte/extend-helper-cli
see-also:
- '[contract.md](contract.md)'
- '[github-actions.md](../ci/github-actions.md)'
- '[gitlab.md](../ci/gitlab.md)'
---

# Integration Tests

Integration tests exercise the full handler path against real (or realistic) external dependencies. For Extend apps, "real" usually means a dev namespace in AGS. "Realistic" usually means docker-compose sidecars (mongo, redis) for local storage.

Distinct from unit tests (see `unit-<language>.md`): integration tests are allowed to be slow, require setup, and can fail for reasons unrelated to the code under test (network flake, stale credentials, missing subscription).

## Two flavors

**Live AGS integration.** Tests call a real AGS namespace. Exercises the AGS SDK wiring, permissions, event subscriptions, override registration. Requires real credentials + a dev namespace you can safely write to.

**Local-stack integration.** Tests bring up docker-compose sidecars and exercise the app end-to-end without touching AGS. Exercises handler logic against real infrastructure (mongo, redis, kafka) without flaky AGS dependencies.

Most Extend projects benefit from both. Local-stack is faster and runs in CI; live AGS is slower and usually gated to manual or scheduled runs.

## Directory convention

- Unit tests live next to source (`pkg/handler/`, `src/handler/`, etc.).
- Integration tests live under `tests/integration/` (Go: `internal/integration/`; Python: `tests/integration/`; Java: `src/integrationTest/java/`; C#: separate test project `tests/MyApp.IntegrationTests/`).

Language-specific runner guidance is in the per-language unit-test reference; the directory + gating convention is the same.

## Gating — don't run by default

Integration tests should NOT run with a bare `go test` / `pytest` / `./gradlew test` / `dotnet test`. They need setup that isn't always available. Gate them:

- **Go:** build tag — `//go:build integration` at the top of the file. Run with `go test -tags=integration ./tests/integration/...`.
- **Python:** `pytest` marker — `@pytest.mark.integration`. Configure `pytest.ini` with `addopts = -m "not integration"` to skip by default; run with `pytest -m integration`.
- **Java:** separate Gradle source set (`integrationTest`). Run with `./gradlew integrationTest`.
- **C#:** `[Trait("Category", "Integration")]`. Run with `dotnet test --filter "Category=Integration"`.

## Prerequisites (live AGS flavor)

Before running, verify:

1. `.env` has real values for:
   - `AB_BASE_URL`
   - `AB_NAMESPACE` (a dev namespace — never prod for tests)
   - `AB_CLIENT_ID`
   - `AB_CLIENT_SECRET`
2. The IAM client has the permissions the tests exercise. Missing permissions surface as `401 unauthorized` or `403 forbidden`.
3. For Override tests that go through the full AGS call path, the override is registered in the dev namespace's Admin Portal. Otherwise AGS won't route to your handler.
4. For Event Handler tests that rely on actual event delivery, the event subscription is configured in the dev namespace.

This subskill's dependency_checks flag missing values; the developer fixes them before retrying.

## Prerequisites (local-stack flavor)

1. Docker running locally.
2. `docker-compose up -d` has been run to bring up sidecars (mongo, redis, kafka-mock — whatever `docker-compose.yml` declares).
3. The app can connect to the sidecars via the connection strings in `.env`. Usually defaults work (`mongodb://localhost:27017`); confirm in the template README.

## Cleanup

Integration tests should clean up after themselves. Two patterns:

- **Namespace-scoped data.** Every write uses a test-specific key (`test-user-<uuid>`, `test-session-<ts>`) and a teardown step deletes by that key.
- **Transactional / rollback.** If the storage supports it (SQL), wrap each test in a transaction and rollback on completion. Mongo doesn't support this natively; prefer the key-scoping pattern.

Leaky integration tests pollute the dev namespace over time — by the time the data is noticeable, tracking down which test produced which residue is painful. Build cleanup in from test #1.

## CI integration

Integration tests in CI typically:

- Run only on `main` or on tag-based releases (not every PR — they're slow).
- Require `AB_CLIENT_ID` / `AB_CLIENT_SECRET` as CI secrets.
- Run against a dedicated CI-only dev namespace so test residue doesn't conflict with human developers' work.

The `subskills/ci.md` template defaults integration tests to `workflow_dispatch` only. Upgrade to on-push for `main` when the team is ready for it.

## Example — Go live-AGS integration test

```go
//go:build integration
// +build integration

package integration

import (
    "context"
    "os"
    "testing"

    "github.com/AccelByte/accelbyte-go-sdk/..."
)

func TestIntegration_GetPlayer(t *testing.T) {
    if os.Getenv("AB_CLIENT_ID") == "" {
        t.Skip("AB_CLIENT_ID not set; skipping live-AGS test")
    }
    // configure SDK from env, call AGS, assert...
}
```

The `t.Skip` guard means the test self-skips when credentials aren't present — no failure in a developer's local test run. CI that wants to run the integration suite sets the env vars.

## Example — Python local-stack integration test

```python
import pytest
import pymongo

@pytest.mark.integration
def test_leaderboard_submit_score_persists():
    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client["leaderboard_test"]
    collection = db["scores"]

    # arrange: clear prior state
    collection.delete_many({"user_id": "test-user"})

    # act: call the handler
    handler = LeaderboardHandler(storage=MongoStorage(collection))
    handler.submit_score(user_id="test-user", score=500)

    # assert: data landed
    doc = collection.find_one({"user_id": "test-user"})
    assert doc is not None
    assert doc["score"] == 500

    # cleanup
    collection.delete_many({"user_id": "test-user"})
```

## Common failure modes

| Symptom | Usual cause |
|---|---|
| `401 unauthorized` | `.env` credentials stale or rotated. Check against the Admin Portal. |
| `403 forbidden` | IAM client missing permission for the resource the test touches. |
| `connection refused` | Wrong `AB_BASE_URL` or the dev namespace is unreachable from the test host. For local-stack: docker-compose isn't up. |
| Event-handler test never sees the event | Subscription missing in the dev namespace, or the event type name drifted. Check the Admin Portal's events page. |
| Test data pollution accumulating | Cleanup isn't running (test crashed before teardown). Use the language's cleanup hook (`t.Cleanup` in Go, `yield` fixtures in Python, `@AfterEach` in JUnit, `IAsyncLifetime` in xUnit). |

## When not to write an integration test

- The logic is a pure transformation (input → output) with no I/O. That's a unit test.
- The integration is a single SDK call you're not customizing. Trust the SDK's own tests; don't duplicate them.
- You're testing AGS's behavior, not yours. If the test's real subject is "does AGS match-complete fire when X happens," that's AGS's responsibility, not yours.

Write integration tests when the risk is a wiring-level failure (auth config, connection string, event-subscription setup) that unit tests can't catch.
