---
last-verified: 2026-04-21
see-also:
- '[integration.md](integration.md)'
---

# Unit Tests — Go

Conventions for unit-testing handler logic in Go Extend apps. Uses the Go standard library's `testing` package — no third-party test framework needed. Works for Override, Event Handler, and Service Extension.

## File layout

- Test files live alongside the source they test: `pkg/handler/priority.go` ↔ `pkg/handler/priority_test.go`.
- Test files end in `_test.go`. Only files matching this pattern are compiled by `go test`.
- Use the same package name (`package handler`) to access unexported symbols. Use `package handler_test` when you want to force an external-API test — rare; default to internal.

## Test function shape

```go
func TestPriority_VIPTier(t *testing.T) {
    // arrange
    req := &pb.GetPriorityRequest{UserId: "user-123"}
    tierLookup := fakeTierLookup{"user-123": "vip-gold"}
    h := NewHandler(tierLookup)

    // act
    resp, err := h.GetPriority(context.Background(), req)

    // assert
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if resp.Priority != 100 {
        t.Errorf("priority: got %d, want 100", resp.Priority)
    }
}
```

Naming convention: `Test<Type>_<Scenario>`. Keeps failing tests scannable (`TestPriority_VIPTier` is obviously about VIP tiers).

Use `t.Fatalf` for setup failures (can't continue — abort the test). Use `t.Errorf` for assertion failures (record and continue so a single run surfaces all failures at once).

## Table-driven tests

Prefer table-driven for multiple scenarios of the same shape:

```go
func TestPriority_Tiers(t *testing.T) {
    cases := []struct {
        name     string
        tier     string
        wantPrio int32
    }{
        {"default", "none", 50},
        {"gold",    "vip-gold",     100},
        {"platinum", "vip-platinum", 200},
    }
    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            req := &pb.GetPriorityRequest{UserId: "u"}
            h := NewHandler(fakeTierLookup{"u": tc.tier})
            resp, err := h.GetPriority(context.Background(), req)
            if err != nil {
                t.Fatalf("unexpected error: %v", err)
            }
            if resp.Priority != tc.wantPrio {
                t.Errorf("%s: got %d, want %d", tc.name, resp.Priority, tc.wantPrio)
            }
        })
    }
}
```

`t.Run` creates subtests — failures show up as `TestPriority_Tiers/gold`, easy to re-run individually (`go test -run TestPriority_Tiers/gold`).

## Fakes over mocks

Prefer hand-written fakes over mock frameworks (`gomock`, `testify/mock`). Fakes are simpler to read and less likely to over-constrain behavior:

```go
type fakeTierLookup map[string]string

func (f fakeTierLookup) Lookup(ctx context.Context, userID string) (string, error) {
    tier, ok := f[userID]
    if !ok {
        return "", ErrNotFound
    }
    return tier, nil
}
```

Mocking frameworks are fine if the project already uses them consistently. Don't introduce one for a single test.

## What to test

For each handler:

- **Happy path.** Typical input → expected output.
- **One failure path.** Nil input, empty string, or the language's equivalent "caller got it wrong" case. Handler should return `INVALID_ARGUMENT` (or the pattern's error convention), not panic.

Anything beyond is nice-to-have. The happy + one failure covers the completeness contract in `subskills/test.md`.

## Running

From the app directory:

```bash
go test ./...           # all tests
go test ./... -v        # verbose (shows each test name as it runs)
go test -run TestPriority ./...   # filter by name pattern
go test -cover ./...    # with coverage summary
go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out   # HTML coverage report
```

`./...` means "recursively from here." Omit to test just the current package.

## Skipping integration tests

Integration tests live in `tests/integration/` with a build tag:

```go
//go:build integration
// +build integration
```

Standard `go test ./...` skips tagged tests. To include them: `go test -tags=integration ./tests/integration/...`. See `references/test/integration.md`.

## Common failure modes

| Symptom | Usual cause |
|---|---|
| `no test files` | Test file doesn't end in `_test.go`, or the test function isn't `func TestXxx(t *testing.T)`. |
| Test runs but never executes assertions | Missing `t.Run` when you expected subtests, or the test function returned before reaching assertions. |
| `import cycle not allowed` when importing production code | Test file uses `package handler_test` but also imports the production package. Use internal package (`package handler`) or restructure. |
| Flaky test (passes locally, fails in CI) | Usually ordering-dependent state (package-level vars, time-based assumptions, unordered map iteration). Fix: reset state per-test with `t.Cleanup`; use fixed times via an injected clock. |

## When handlers call AGS

Unit tests shouldn't actually call AGS. Inject the AGS client as an interface and provide a fake in tests. If the template's handler takes a concrete SDK struct directly (hard to fake), refactor to take an interface that the SDK struct satisfies.

For full end-to-end coverage against a real dev namespace, use integration tests (`references/test/integration.md`) — not unit tests.
