---
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/extend-service-extension-go
see-also:
- '[integration.md](integration.md)'
- '[workflow.md](../proto/workflow.md)'
- '[proto-changes.md](../upgrade/proto-changes.md)'
---

# Contract Tests

Contract tests answer one question: **does the generated code in the repo match the `.proto` source?** When generated code drifts out of sync with proto (usually because someone edited proto but forgot to regen, or regenerated with a different plugin version), handlers compile against stale types while the wire format changes. Contract tests catch this in CI before it reaches production.

Narrower than integration tests. Faster than unit tests. Idempotent — you can run them repeatedly with no side effects.

## The check

Conceptually simple:

1. Regenerate proto code into a scratch directory.
2. Diff the scratch directory against what's checked in.
3. Empty diff → generated code is in sync.
4. Non-empty diff → drift exists; either run `/ags-extend proto` to catch up or resolve the mismatch manually.

## Where this test lives

Typically as a shell script or Makefile target run in CI:

```bash
# Makefile target
check-proto:
	@tmpdir=$$(mktemp -d); \
	 cp -r pkg/pb $$tmpdir/pb-before; \
	 $(MAKE) proto; \
	 if diff -r pkg/pb $$tmpdir/pb-before > /dev/null; then \
	   echo "proto in sync"; \
	 else \
	   echo "proto drift detected:"; \
	   diff -r pkg/pb $$tmpdir/pb-before; \
	   mv $$tmpdir/pb-before/* pkg/pb/; \
	   exit 1; \
	 fi
```

Or as a dedicated test file that invokes the regen command and compares:

### Go example

```go
//go:build contract
// +build contract

package contract

import (
    "os/exec"
    "testing"
)

func TestProtoInSync(t *testing.T) {
    // snapshot current generated files
    if out, err := exec.Command("git", "stash", "push", "--include-untracked", "pkg/pb/").CombinedOutput(); err != nil {
        t.Fatalf("stash failed: %s: %v", out, err)
    }
    t.Cleanup(func() { exec.Command("git", "stash", "pop").Run() })

    // regenerate
    if out, err := exec.Command("make", "proto").CombinedOutput(); err != nil {
        t.Fatalf("regen failed: %s: %v", out, err)
    }

    // diff against stash
    out, err := exec.Command("git", "diff", "--quiet", "pkg/pb/").CombinedOutput()
    if err != nil {
        diff, _ := exec.Command("git", "diff", "pkg/pb/").CombinedOutput()
        t.Fatalf("proto drift detected:\n%s", diff)
    }
    _ = out
}
```

The git stash dance is one way to preserve the baseline. A tempdir approach (regen into tempdir, compare trees) avoids touching the working tree — safer if other things might be running concurrently.

### Python / other languages

Same idea, different runner. Run the regen command, `git diff --exit-code` over the generated directory, fail the test on non-empty diff.

## Integrating with CI

Contract tests belong in CI's pre-merge check. Typical flow:

```
checkout → install toolchain → run contract test → if fail, block merge
```

The test's output on failure should surface *exactly* which files drifted and what changed — the developer needs to know whether to run `/ags-extend proto` (if the drift is harmless regen output) or resolve a real contract conflict (if a proto was edited and needs a coordinated update).

## When contract tests are noise

- **Plugin version drift.** Running `protoc` with a different plugin version produces a different diff — not a real contract drift. Pin plugin versions in the Makefile or `buf.gen.yaml` so regen is byte-stable.
- **OS-specific line endings.** Generated files with CRLF vs. LF cause false positives. Use `.gitattributes` to normalize.
- **Timestamps or absolute paths in generated output.** Some plugins embed these. Check the regen config; most modern plugins don't.

If contract tests keep flagging noise, the fix is to make regen deterministic, not to delete the test.

## When to run contract tests

- **Pre-merge in CI.** Mandatory. Catches the common "forgot to regen" mistake.
- **Locally before commit.** Optional but cheap — run the `make check-proto` target as a pre-commit hook.
- **After every `/ags-extend upgrade`.** The upgrade subskill delegates proto regen to `/ags-extend proto`, but a contract test in the upgrade path confirms the regen actually happened.

## Relationship to other test types

- **Unit tests** — exercise handler logic against fakes. Don't care about the generated code's byte shape.
- **Contract tests** — care about the byte shape of generated code. Don't exercise any handler logic.
- **Integration tests** — exercise the full wire path. Transitively catches proto drift because mismatched generated code fails to deserialize real messages, but reports it as "integration failure" rather than "contract drift."

Contract tests are the specific tool for the specific problem. Keep them small, keep them fast, keep them deterministic.
