---
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[workflow.md](../proto/workflow.md)'
- '[contract.md](../test/contract.md)'
- '[breaking-changes.md](breaking-changes.md)'
---

# Proto Contract Changes

When an AGS SDK bump, a template update, or an AccelByte contract release brings new `.proto` content, the regen produces a code diff. This reference catalogs what kinds of diffs you'll see and how to tell "safe" from "breaking."

## The regen produces a diff. Classify it.

After running `/ags-extend proto`, `git diff --stat` against the generated code directory shows changed files. Every change falls into one of five buckets:

### 1. Additive — new message / field / method

New symbols appear; nothing existing is removed or renamed.

```diff
+ message NewOptionalField { ... }
+ rpc NewMethod(...) returns (...)
```

**Impact:** none on existing handlers. New methods/fields can be ignored until you use them.

**Action:** commit the regen and move on.

### 2. Additive field inside an existing message

An existing message gains a new field:

```diff
  message GetPlayerResponse {
    string id = 1;
    string name = 2;
+   int64  level = 3;
  }
```

**Impact:** backwards-compatible at the wire level (proto3 fields are optional). Handlers compile unchanged. Clients that don't know about `level` ignore it.

**Action:** commit. Consider whether to start using the new field.

### 3. Renamed — method, field, or type

```diff
- rpc GetPriority(GetPriorityRequest) returns (Priority)
+ rpc EvaluatePriority(EvaluatePriorityRequest) returns (PriorityResult)
```

**Impact:** breaking. Handlers must update call sites / implementation.

**Action:** `subskills/upgrade.md` surfaces this with file:line. Update the handler to the new names.

### 4. Signature change — same method, different params

```diff
- rpc GetUser(string user_id) returns (User)
+ rpc GetUser(GetUserRequest) returns (User)
```

(Not strictly a proto shape — more common in generated bindings where a v2 SDK wraps primitive args in a request struct.)

**Impact:** breaking at source level. Callers pass the new shape.

**Action:** update every call site. Mechanical but tedious.

### 5. Removed — method or field disappears

```diff
- rpc DeprecatedMethod(...) returns (...)
- message OldType { ... }
```

**Impact:** severe. Any caller of the removed symbol fails to compile. Runtime behavior of deployed callers is undefined (depends on whether AGS still honors the wire format).

**Action:** find and update every call site before this can ship. `subskills/upgrade.md` surfaces removals with file:line.

## How to spot the bucket from the diff

Run from the app dir after regen:

```bash
# Everything removed from generated code:
git diff pkg/pb/ | grep -E "^-.*func|^-.*type|^-.*interface|^-.*message|^-.*rpc" | head

# Everything added:
git diff pkg/pb/ | grep -E "^\+.*func|^\+.*type|^\+.*interface|^\+.*message|^\+.*rpc" | head

# Signature changes (matching old/new pair around the same symbol):
git diff pkg/pb/ | grep -E "^[-+].*func" | head
```

Pure additions (only `+` lines, no `-`) → bucket 1 or 2. Safe.

Mixed `+`/`-` on the same symbol name → bucket 3 or 4. Breaking.

Only `-` lines on a symbol → bucket 5. Breaking, possibly severe.

## Coordinating with upstream

AGS-side proto changes happen on AccelByte's release schedule. Two coordination points:

- **Read the AGS release notes / changelog** before bumping. They list contract changes explicitly.
- **Deploy order.** If an Override handler starts implementing a v2 method that AGS hasn't rolled out yet, AGS calls still use v1 — the v2 code is dead. Coordinate with AccelByte support for timing when a contract change is ambiguous.

For Service Extensions (where *you* own the contract), the coordination is inverted: deploy the service with the new contract before any client calls the new method.

## Version skew during rollout

When AGS rolls new replicas of your Extend app:

- Old replicas run v1 code, new replicas run v2 code.
- Callers may hit either.
- If v1 and v2 return different shapes, callers get inconsistent responses during the window.

Mitigations:

- Make v2 changes additive when possible (bucket 1 or 2). No skew problem.
- For unavoidable renames / removes, deprecate first: keep the v1 symbol alongside v2 for a deploy window, drop v1 after all callers moved.
- Canary: deploy to a single replica, verify, then roll out. AGS doesn't have a first-class canary primitive for Extend — if your team needs this, run a parallel app with a fraction of traffic routed to it.

## When the diff looks wrong

If the regen produces a diff you didn't expect — wholesale reformatting, touching files unrelated to the proto change — the usual cause is a plugin version mismatch. See `references/proto/workflow.md#common-failure-modes`. Don't commit a noisy diff; fix the toolchain first.

## After a successful regen

1. Commit the generated code separately from handler changes. Reviewers can read the regen commit (mechanical) without wading through it to find your logic changes.
2. Update any docs referencing the old contract.
3. Run `/ags-extend test contract` in CI to catch future drift automatically.
