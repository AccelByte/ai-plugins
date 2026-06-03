---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
see-also:
- '[unit-go.md](../references/test/unit-go.md)'
- '[unit-python.md](../references/test/unit-python.md)'
- '[unit-java.md](../references/test/unit-java.md)'
- '[unit-cs.md](../references/test/unit-cs.md)'
- '[integration.md](../references/test/integration.md)'
- '[contract.md](../references/test/contract.md)'
---

# AGS Extend Tester

Write or run tests for an Extend app. Three paths: unit tests (per-language patterns), integration tests (against a dev AGS namespace or an in-process fake), and contract tests (verifying generated proto code matches the contract). Picks the right path based on the user's intent and app language.

## Behavior Constraints

<grounding_rules>

- Read `references/test/unit-<language>.md` for the target app's language before writing or running unit tests.
- Read `references/test/integration.md` when the user says "integration", "end-to-end", "against real AGS", or "test with a running server."
- Read `references/test/contract.md` only when the user's concern is "does my generated code match the proto."
- Do not invent test frameworks or assertion libraries. Use what the template README or existing tests use (Go stdlib `testing`, Python `pytest`, JUnit 5, xUnit). If the project uses something else, use that.

</grounding_rules>

<tool_usage_rules>

- `Bash` for running the test command.
- `Read` for existing test files, the app's main source, and reference files.
- `Glob` to find test files (`*_test.go`, `test_*.py`, `*Test.java`, `*Tests.cs`).
- `Write` only when the user asks for a new test file. Never modify production source from this subskill.
- `Edit` only to add a test function to an existing test file at the user's direction.

</tool_usage_rules>

<dependency_checks>

Before running tests, verify:

1. The language runtime is present and matches the app's minimum (see `subskills/install-dep.md#runtime-minimums`).
2. Project deps are installed (`go.sum` present; `.venv` or `__pycache__`; `build/` or `target/`; `bin/` or `obj/`).
3. For integration tests targeting a dev namespace: `.env` has real values for `AB_BASE_URL`, `AB_NAMESPACE`, `AB_CLIENT_ID`, `AB_CLIENT_SECRET`. Placeholders fail.
4. For integration tests using local sidecars (mongo, redis): `docker-compose up` ran first or the needed containers are already up.

</dependency_checks>

<output_contract>

Output proceeds in blocks:

1. **Intent classification block** — unit / integration / contract, with the inferred language.
2. **Plan block** — what will run, from where.
3. **Run block** — streamed test output.
4. **Summary block** — pass/fail counts, notable failures with file:line, coverage if available.
5. **Next-step block** — fix a failure (point at the file), re-run, or continue to deploy.

</output_contract>

<completeness_contract>

Tests are "done" when:

- Every test the user asked for (existing or newly written) has run to completion.
- Failures are reported with enough detail to locate them (file, line, assertion).
- The summary names how many tests passed, failed, and were skipped.
- If new tests were written, they cover the handler's happy path plus one failure path (nil input, malformed field, or the language's equivalent). More coverage is fine but not required — completeness is the happy + one failure.

</completeness_contract>

## Workflow

### Step 1 — Classify intent

| User said | Route to |
|---|---|
| "test", "run tests", "unit test" | Unit tests |
| "write a test for X" | Unit tests; Step 4 writes the file |
| "integration", "end-to-end", "against AGS", "against the dev namespace" | Integration tests |
| "does my generated code work" | Contract tests |
| "coverage" | Unit tests with coverage reporting |

### Step 2 — Identify the app and language

If not specified:

```bash
# Are we already inside an app dir?
test -f Makefile && test -f Dockerfile && echo "in app: $(basename $(pwd))"
# Or are app dirs one level down?
ls */Makefile 2>/dev/null
```

Pick the app. If multiple `*/Makefile` siblings exist, ask which to operate on. Detect language from on-disk files: `go.mod` → Go, `requirements.txt` / `pyproject.toml` → Python, `*.csproj` → C#, `build.gradle` / `pom.xml` → Java.

### Step 3 — Read the right reference

- Unit → `references/test/unit-<language>.md`
- Integration → `references/test/integration.md` + language reference for runner commands
- Contract → `references/test/contract.md`

### Step 4 — Run or write

**Run existing tests** (language-specific commands; see the per-language reference for exact invocation):

- Go: `go test ./...` (add `-v` for verbose, `-cover` for coverage)
- Python: `pytest` (from the app's test directory)
- Java: `./gradlew test`
- C#: `dotnet test`

**Write a new test** if the user asked. Follow the file/function naming from the per-language reference (e.g., `*_test.go` in Go, `test_*.py` in Python). Include one happy-path + one failure-path case.

**Integration tests** typically live in a separate directory (`tests/integration/`, `test/e2e/`) with different build tags, markers, or test group config. The per-language reference names the convention; respect whatever the project uses.

### Step 5 — Summarize

```
Test summary: matchmaking-override (go)

  ✓ 12 passed
  ✗ 2 failed
    - pkg/handler/priority_test.go:45 — TestPriority_VIPTier expected 100, got 50
    - pkg/handler/priority_test.go:78 — TestPriority_Fallback expected nil error, got "nil tier lookup"
  - 1 skipped (TestIntegration_AgainstLiveAGS — requires AB_CLIENT_ID)

Coverage: 68% (pkg/handler), 91% (pkg/storage)

Next:
  • Fix pkg/handler/priority.go around the tier mapping → re-run
  • Or skip test fixes and /ags-extend deploy (not recommended with 2 red tests)
```

## Error Handling

| Situation | Response |
|---|---|
| No test files exist yet | Offer to write one for a named handler. Pull the signature from the handler source. Use the per-language template from `references/test/unit-<language>.md`. |
| Tests fail to compile (Go/Java/C#) or collect (Python) | Surface the compiler error; this is usually a missing import, stale generated code (run `/ags-extend proto`), or a type mismatch. |
| Integration tests hit `401 unauthorized` | `.env` credentials are stale or the OAuth client lacks the needed AGS permissions. Point at `references/faq.md#credentials-and-permissions`. |
| Integration tests hit `connection refused` | `AB_BASE_URL` wrong, or the dev namespace's endpoint is unreachable from the test host. |
| Tests fail only in CI | Usually env differences: secrets missing, docker-compose not up, timezone or locale difference. This subskill flags it; `/ags-extend ci` handles CI-specific wiring. |
| Coverage tool not installed | Print the install hint from the per-language reference; don't fabricate an alternative tool. |
| User asks to "fix the failing test" | Do not modify production code from this subskill. Point at the file + line and let the user decide. If the fix is in the test itself, Edit the test file with their explicit permission. |

## Examples

### Straight path — Go unit tests

```
User: /ags-extend test

Skill: In ./matchmaking-override (Makefile + Dockerfile + go.mod).
       Intent: unit tests.
       [reads references/test/unit-go.md]

       Plan:
         Working dir: ./matchmaking-override
         Command:     go test ./... -v

Skill: [runs]
       === RUN   TestPriority_Default
       --- PASS: TestPriority_Default (0.00s)
       === RUN   TestPriority_VIPTier
       --- FAIL: TestPriority_VIPTier (0.00s)
           priority_test.go:45: expected 100, got 50
       PASS: 11 / FAIL: 1 / SKIP: 0

       Test summary:
         ✓ 11 passed
         ✗ 1 failed — priority_test.go:45 (VIP tier mapping off by half)

       Next: inspect pkg/handler/priority.go around the VIP multiplier.
```

### Write a new test — Python

```
User: /ags-extend test
  Write a test for the on_event handler's happy path

Skill: In ./match-event-handler (Makefile + Dockerfile + requirements.txt).
       [reads references/test/unit-python.md]

       I'll add a test to tests/test_on_event.py (create if missing).
       Happy-path case: valid MatchCompleted payload → handler returns without raising.
       Failure-path case: payload missing required field → ValueError.

       [shows the code to be written; confirms with user]
       [Writes the file]
       [Runs pytest → 2 passed]
```

### Integration

```
User: /ags-extend test integration

Skill: In ./leaderboard-service (Makefile + Dockerfile + go.mod).
       [reads references/test/integration.md]

       Integration tests under tests/integration/ target a live dev namespace.
       Checking prerequisites…
         ✓ AB_BASE_URL set
         ✓ AB_NAMESPACE set
         ✓ AB_CLIENT_ID present
         ✓ AB_CLIENT_SECRET present
         ✓ docker-compose up (mongo is reachable)

       Plan:
         Command: go test -tags=integration ./tests/integration/... -v

Skill: [runs, streams output, summarizes as in Step 5]
```

### Contract test

```
User: /ags-extend test
  Make sure my generated code actually matches the proto.

Skill: Routing to contract tests.
       [reads references/test/contract.md]

       The contract check is: regenerate proto into a scratch dir, diff against what's checked in.
       If the diff is empty, generated code is in sync. If not, /ags-extend proto will regenerate.

       [runs the check; reports clean or dirty]
```
