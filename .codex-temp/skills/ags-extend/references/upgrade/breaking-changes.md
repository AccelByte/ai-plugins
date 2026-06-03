---
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[proto-changes.md](proto-changes.md)'
- '[sdk-bumps.md](sdk-bumps.md)'
---

# Breaking Change Classification

Every compile or test failure after an SDK / proto bump falls into one of these classes. `subskills/upgrade.md` uses this taxonomy to surface breakage; developers fix by recognizing the class and applying the corresponding pattern.

## The five classes

### 1. Removed symbol

Something the code calls no longer exists.

**Compiler message (by language):**

- Go: `undefined: sdk.DeprecatedMethod`
- Python: `ImportError: cannot import name 'DeprecatedMethod'` / `AttributeError`
- Java: `cannot find symbol: method deprecatedMethod()`
- C#: `error CS0117: 'Client' does not contain a definition for 'DeprecatedMethod'`

**Fix pattern:** Find the replacement in the SDK release notes. Common moves:

- `OldMethod` → `NewMethod` (rename — see class 2)
- `OldMethod` → gone, use `OtherExistingMethod` instead
- `OldMethod` → split into multiple smaller methods

Don't wrap the old name in an alias "for later." The import is gone; the alias would just re-introduce a broken symbol when the next bump lands.

### 2. Renamed symbol

Same functionality, different name.

**Compiler message:** looks like class 1 (symbol not found) but the release notes say "renamed."

**Fix pattern:** mechanical find-and-replace.

```bash
# Go
grep -rn "OldName" --include="*.go" .
# Then global replace, compile, test.
```

Low risk if the rename is 1:1. Higher risk if the rename also changed semantics (verify by reading the new method's docs).

### 3. Signature change

Method kept its name but takes different parameters or returns a different shape.

Common patterns:

- **Primitive → wrapper struct.** `GetUser(ctx, userID string)` → `GetUser(ctx, &GetUserRequest{UserId: userID})`. SDK v2 migrations typically introduce wrappers for future field additions.
- **Direct field → getter.** `resp.Priority` → `resp.GetPriority()`. protoc-gen-go occasionally flips between these.
- **Added context parameter.** Older SDKs take `(userID)`, newer `(ctx, userID)`.
- **Response error split.** `value, err := Method(...)` → `resp, err := Method(...); value = resp.GetValue()`.

**Fix pattern:** update each call site to the new shape. Mechanical; the compiler will find all of them.

### 4. Type narrowing / widening

A field that was `string` is now `enum`; a field that was `int32` is now `int64`. The wire format is backward-compatible in many cases, but the generated bindings flip types.

**Compiler message:** `cannot use "active" (untyped string constant) as MatchStatus value` / `cannot convert int32 to int64`.

**Fix pattern:** convert at the call site. For enum transitions, use the enum's constants:

```go
// Before:
req.Status = "active"
// After:
req.Status = pb.MatchStatus_MATCH_STATUS_ACTIVE
```

### 5. Behavior change (no compile error)

The scariest class. Code compiles. Tests might catch it; they might not. Example patterns:

- **Default value changed.** Old SDK returned empty string when field unset; new SDK returns null / `nil`.
- **Error wrapping changed.** Old code `err == sdk.ErrNotFound`; new code must use `errors.Is(err, sdk.ErrNotFound)`.
- **Retry behavior changed.** Old SDK retried 3x by default; new SDK retries once. Code that relied on silent retries now fails more often.
- **Pagination changed.** Old SDK returned all results; new SDK returns paged results and you now need to iterate.

**Fix pattern:** read the release notes closely. Behavior changes are usually called out. If not, integration tests against a real AGS namespace are the safety net.

## Diagnosis workflow

When a bump breaks something, `subskills/upgrade.md` runs the build and lists failures. For each failure:

1. **Read the compiler error, literally.** Don't skim. The error usually names both the old and new symbol (if it can).
2. **Classify** — which of the five above?
3. **Apply the pattern.** Most fixes are mechanical once classified.
4. **Re-run the build.** New errors may surface after the first fix is applied.
5. **When the build is green, run tests.** Tests catch class 5 (behavior changes).

## What to fix now vs. later

Everything in classes 1–4 must be fixed before the bump can be committed. The code won't compile otherwise.

Class 5 is harder — you don't know it's broken until something behaves wrong. Two strategies:

- **Integration tests.** Run the full test suite (`/ags-extend test integration`) after bump. Real AGS calls exercise real wire-format contracts.
- **Canary deploy.** Deploy the bumped version to a single replica first, observe for anomalies, then roll out. AGS doesn't have a built-in canary — the closest approximation is a separate staging namespace with a subset of traffic.

## Common trap: accidentally crossing a major version

A `go get <pkg>@latest`, `pip install --upgrade <pkg>`, or equivalent can silently jump from v1 to v2 if the registry lists v2 as latest. The bump looks like a normal version bump but behaves like a major-version migration.

`subskills/upgrade.md` warns specifically when the target version crosses a major boundary — don't dismiss the warning. Every major-version bump should have planned time to handle breaking changes.

## Common trap: chained breakage

Fixing one error surfaces another:

- You fix a rename in `handler.go`, but that handler is called by `main.go`, which has its own call site using the old signature.
- You fix a type narrowing on a request field, but tests now fail because the fake data was seeded with the old type.

This is normal. Run the build repeatedly; the error list shrinks with each iteration. It's not broken, it's layered.

## When the release notes are missing / unhelpful

If AccelByte's release notes don't explain a breaking change (rare but possible):

1. Read the diff of the SDK between the two versions. GitHub's compare view works: `https://github.com/AccelByte/<sdk-repo>/compare/v<old>...v<new>`.
2. Focus on `BREAKING CHANGES`, `BREAKING`, or uppercase markers in commit messages.
3. If still unclear, contact AccelByte support. "Undocumented breaking change in vX.Y" is a support ticket, not a guess-and-hope.

## When to roll back instead of fixing

If the bump surfaces more breakage than you have time to fix:

```bash
git checkout -- <manifest-files>
# run the language-native restore to get the old version back
```

Roll back cleanly, open a ticket / tracking issue with the breakage list, and schedule the bump for when there's time. A half-migrated codebase is worse than an old version running correctly.
