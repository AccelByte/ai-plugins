---
last-verified: 2026-04-19
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[sdk-bumps.md](../references/upgrade/sdk-bumps.md)'
- '[proto-changes.md](../references/upgrade/proto-changes.md)'
- '[breaking-changes.md](../references/upgrade/breaking-changes.md)'
---

# AGS Extend Upgrader

Guide the developer through a version bump: SDK package, proto contract, or both. Detect what's changing, regenerate, help the user reconcile breaking changes, and verify the app still builds and passes tests before the bump gets committed.

## Behavior Constraints

<grounding_rules>

- Read `references/upgrade/sdk-bumps.md` for the package name and install/bump command per language.
- Read `references/upgrade/proto-changes.md` when the bump touches proto contracts (AGS SDK bumps often include proto regen).
- Read `references/upgrade/breaking-changes.md` when compile or tests fail after the bump.
- Do not invent SDK package names or versions. If the reference is stamped `TODO: verify`, say so and point at the SDK's release page before running install commands with a specific version.

</grounding_rules>

<tool_usage_rules>

- `Bash` to run the language package manager (`go get`, `pip install`, `./gradlew`, `dotnet add package`).
- `Bash` to run `go build ./...` / `python -m compileall` / `./gradlew build` / `dotnet build` after the bump to detect breakage.
- `Read` for `go.mod`, `requirements.txt`, `build.gradle`, `.csproj`, and reference files.
- `Edit` only when pinning a specific version in a manifest file, with explicit confirmation.
- Do not modify handler code to absorb a breaking change from this subskill. Surface the break, point at the site, and let the developer fix it.
- Delegate proto regen to `/ags-extend proto` (tell the developer to run it) — don't duplicate that workflow here.

</tool_usage_rules>

<dependency_checks>

Before the bump:

1. Working tree is clean (`git status --short` empty or close to it). Uncommitted changes make the bump diff unreviewable.
2. The app currently builds and its tests currently pass. Don't bump on a red baseline — the upgrade will be impossible to diagnose.
3. The language runtime is present and at or above the app's minimum.

</dependency_checks>

<action_safety>

Bumps modify dependency manifests, which is tracked in git. But:

- Confirm the target version before running the bump. If the developer says "latest", pull the version first and show it; don't blind-install.
- If the current version is already latest, stop — nothing to do.
- If the bump crosses a major version boundary, double-warn: breaking changes are likely.
- Never run `git push` after a bump. Surface the changed files and let the developer review/commit/push.

</action_safety>

<completeness_contract>

The upgrade is complete when:

- The package manifest (`go.mod` / `requirements.txt` / `build.gradle` / `.csproj`) reflects the new version.
- Generated code (if proto touched) is regenerated via `/ags-extend proto`.
- `go build ./...` (or equivalent) passes.
- Existing tests still pass, or every failure is named with file:line and a likely-cause hint.
- The summary block names all changed files and any required handler changes the developer still has to make.

Do not mark the upgrade complete while there are compile errors or red tests.

</completeness_contract>

## Workflow

### Step 1 — Identify the scope

| User said | Route |
|---|---|
| "Upgrade the SDK" | SDK bump (may or may not involve proto) |
| "New proto / AGS changed the contract" | Proto-first; SDK likely needs a bump too |
| "Latest everything" | SDK + proto; full regen + build |
| "I'm seeing a breaking change" | Skip to Step 4 (breakage recovery) |

### Step 2 — Baseline

```bash
git status --short
go build ./...  # or equivalent
go test ./...   # or equivalent
```

Red here → stop, fix the baseline first.

### Step 3 — Bump

Read the language section of `references/upgrade/sdk-bumps.md`. The canonical commands (trust the reference; this subskill doesn't invent):

- **Go:** `go get <module-path>@<version>` then `go mod tidy`
- **Python:** edit `requirements.txt` (or `pyproject.toml`), then `pip install -r requirements.txt --upgrade`
- **Java:** update `build.gradle` dependency version, then `./gradlew build --refresh-dependencies`
- **C#:** `dotnet add package <name> --version <version>`, then `dotnet restore`

If the SDK version is not verified in the reference (stamped `TODO: verify`), pull the current latest from the SDK's release page *before* running the install, and echo the version to the user for confirmation.

### Step 4 — Regenerate proto

If the bump changed proto contracts:

```
Next: regenerate proto. Run /ags-extend proto — come back when done.
```

Do not run the proto regen from this subskill; it's `proto`'s responsibility.

### Step 5 — Build and test

```bash
go build ./...  # or equivalent
go test ./...
```

- **All green** → Step 6.
- **Build errors** → read `references/upgrade/breaking-changes.md`. Each compile error maps to one of the breakage classes: removed symbol, signature change, type narrowing, field renamed, package moved. Classify each and surface to the developer. Do not auto-fix.
- **Tests fail** → same classification, but tests usually point at behavioral changes (new required field, default changed, error wrapping). Surface and let the developer decide.

### Step 6 — Summarize

```
Upgrade summary — matchmaking-override

  SDK:    github.com/AccelByte/accelbyte-go-sdk  v1.44.0 → v1.47.0
  Proto:  regenerated (via /ags-extend proto)
  Build:  ✓ passes
  Tests:  ✓ 12 passed, 0 failed

Files changed:
  go.mod               (version bump)
  go.sum               (checksums)
  pkg/pb/*.go          (regenerated)

No handler changes required.

Next: commit the bump (`git commit -m "chore: bump AGS SDK to v1.47.0"`) and push.
```

Or with breakage:

```
Upgrade summary — matchmaking-override

  SDK:    v1.44.0 → v2.0.0
  Build:  ✗ 3 errors

Breakage (all signature changes):
  1. pkg/handler/priority.go:45
     Old: client.GetUser(ctx, userID)
     New: client.GetUser(ctx, &GetUserRequest{UserId: userID})
     Cause: request wrapper added in v2.
  2. pkg/handler/priority.go:78
     Old: resp.Priority
     New: resp.GetPriority()
     Cause: direct field access replaced with getter.
  3. pkg/handler/fallback.go:22
     Old: error type assertion on client.ErrNotFound
     New: errors.Is(err, client.ErrNotFound)
     Cause: sentinel error changed to error-wrapping pattern.

Upgrade NOT complete. Fix the 3 sites (or roll back with `git checkout -- go.mod go.sum`).
```

## Error Handling

| Situation | Response |
|---|---|
| SDK release page is unreachable | Fall back to the reference's latest-known version if one is listed. Otherwise stop — don't guess. |
| Bump succeeds but `go mod tidy` fails | Usually a transitive dependency conflict. Surface the conflict; let the developer pin or rework. Don't try to resolve from here. |
| Proto regen required but `/ags-extend proto` not yet run | Direct the user to run it and come back. Don't build before regen completes. |
| Major version bump (v1 → v2) | Extra-warn before running. Major version bumps always have breaking changes — point at the release notes link in `references/upgrade/sdk-bumps.md`. |
| Tests fail after bump in a way that looks like a behavior change | Point at the test failure with file:line. Don't modify production code. If the change is a default behavior shift, suggest checking the SDK changelog. |
| User wants to pin an older version | Fine. Pin, rebuild, note that they're skipping the bump for later. |
| Existing apps in a multi-app project use different SDK versions | Ask which app(s) to bump. Bumping all is an option; bumping one at a time is often safer. |
| `extend-helper-cli` itself needs a bump | Out of scope for this subskill — point at `/ags-extend install-cli` and its reference. |

## Examples

### Clean bump

```
User: /ags-extend upgrade

Skill: Found matchmaking-override (override, go).
       Current SDK: github.com/AccelByte/accelbyte-go-sdk v1.44.0

       Baseline: ✓ clean tree, ✓ builds, ✓ 12 tests pass.

       [reads references/upgrade/sdk-bumps.md]

       Bumping to latest (v1.47.0 per the release page).
       Command: go get github.com/AccelByte/accelbyte-go-sdk@v1.47.0 && go mod tidy

       Run? (yes/no)

User: yes

Skill: [runs]
       go: upgraded github.com/AccelByte/accelbyte-go-sdk v1.44.0 => v1.47.0
       [build + test]

       Upgrade complete.
       Files changed: go.mod, go.sum.
       No handler changes required.
       Commit: git commit -m "chore: bump AGS SDK to v1.47.0"
```

### Major version — breakage

```
User: /ags-extend upgrade to v2

Skill: [baseline green]
       v1 → v2 is a major version bump. Breaking changes are expected.

       [runs go get; go mod tidy; go build ./...]

       Build failed — 3 errors. All signature changes:
         pkg/handler/priority.go:45 — client.GetUser now takes a wrapper struct
         pkg/handler/priority.go:78 — resp.Priority → resp.GetPriority()
         pkg/handler/fallback.go:22 — ErrNotFound check needs errors.Is

       These are known v2 patterns (see release notes: <link from reference>).

       Fix those three sites, then /ags-extend upgrade to re-verify, or `git checkout -- go.mod go.sum` to roll back.
```

### Proto-only bump

```
User: /ags-extend upgrade
  AGS pushed new proto contracts for matchmaking.

Skill: Proto contract change. SDK version unchanged.
       First: /ags-extend proto (regenerate)
       Then come back and I'll check the build + tests.

       [user runs /ags-extend proto separately]

User: done

Skill: [runs go build ./...; go test ./...]
       ✓ builds, ✓ 12 tests pass. No handler changes needed.
```
