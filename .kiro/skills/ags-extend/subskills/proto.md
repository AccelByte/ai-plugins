---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/accelbyte-api-proto
see-also:
- '[workflow.md](../references/proto/workflow.md)'
- '[conventions.md](../references/proto/conventions.md)'
- '[proto-changes.md](../references/upgrade/proto-changes.md)'
---

# AGS Extend Proto Regenerator

Regenerate proto-derived code in an existing Extend app after the developer adds a new `.proto` from `github.com/AccelByte/accelbyte-api-proto`, AGS publishes a contract change, or a template version bump ships updated protos. The canonical regen path is the template's `make proto` target — it dispatches to Docker (or to host tooling when running inside a devcontainer).

## Behavior Constraints

<grounding_rules>

- The template's `Makefile` is the source of truth. Read it before running anything. Every AccelByte Extend template uses the same dual-branch pattern: `make proto` runs `proto.sh` inside a Docker container when run on a host, or runs `proto.sh` directly when run inside a devcontainer.
- Do not invent regen commands. If the working directory has no `Makefile`, or its `proto` target doesn't match the dual-branch pattern, stop and direct the user to the template's `README.md` instead of guessing.
- Do not modify `.proto` files from this subskill. New protos come from `github.com/AccelByte/accelbyte-api-proto` (for AGS event payloads, override request/response types, AGS API messages) or from the developer's own design (Service Extension only). Adding or modifying a `.proto` is the developer's call; this subskill only regenerates code from existing protos.
- Read `references/proto/workflow.md` for the canonical Makefile pattern and toolchain details. Read `references/proto/conventions.md` only if the user asks about naming or versioning.

</grounding_rules>

<tool_usage_rules>

- `Bash` to run `make proto` and shell checks (Docker, devcontainer detection, git status).
- `Read` to inspect the `Makefile`, `proto.sh`, the template README, and reference files.
- `Glob` to locate `Makefile`, `proto.sh`, or `.proto` files when paths are not exact.
- Do not `Write` or `Edit` generated files (anything under `pkg/pb/` or equivalent). If regeneration fails, surface the error — never patch generated code by hand.
- **Never `apt install protobuf`, `brew install protobuf`, `go install protoc-gen-go`, or any host-side proto toolchain install.** The Docker branch of `make proto` provides the toolchain; the devcontainer branch assumes it's already provisioned. If neither path works, that's a user-environment problem to surface, not something this subskill resolves by mutating the host.

</tool_usage_rules>

<dependency_checks>

Before running regen:

1. **Template has the dual-branch `make proto` target.** Read the `Makefile` and verify it contains a `proto:` target that branches on `IS_INSIDE_DEVCONTAINER` (or equivalent — `REMOTE_CONTAINERS` env var). If the target shape is different, stop and direct the user to the template's README.

2. **Determine which branch will run.**
   - If `$REMOTE_CONTAINERS` is `true` (set by VS Code Remote Containers / devcontainer feature), the Makefile's *in-devcontainer* branch runs `./proto.sh` directly and expects `protoc` plus the language-specific plugins to be on `PATH` already.
   - Otherwise, the *host* branch runs `proto.sh` inside a Docker container built from the template's `proto-builder` Dockerfile target. This requires a working Docker daemon. Check `docker info` succeeds.

3. **`.proto` files exist where the script expects.** `proto.sh` defaults to `pkg/proto` as input (override via positional arg). Verify the directory has `.proto` files; an empty input means the regen will produce nothing useful.

4. **For Event Handlers targeting a non-default event:** the template ships exactly one example proto (currently `pkg/proto/accelbyte-asyncapi/iam/account/v1/account.proto`). If the user's handler targets a different event, the proto file must be copied from `github.com/AccelByte/accelbyte-api-proto` into `pkg/proto/` *before* running regen. If `pkg/proto/` only contains the default and the user's intent is something else, ask before regenerating.

</dependency_checks>

<action_safety>

Proto regen *overwrites* generated files (everything under `pkg/pb/` is `rm -rf`'d at the start of `proto.sh`). This is intended — generated files should never be hand-edited. But:

- Confirm the working directory is the app root before running.
- If `git status` shows uncommitted changes anywhere under `pkg/pb/`, ask the developer to commit or stash first so the regen diff is clean and reviewable.
- If the working directory has uncommitted `.proto` additions (the user just dropped a new event proto in), confirm before regen so the user knows their `.proto` change will be reflected in `pkg/pb/`.

</action_safety>

<output_contract>

Output proceeds in blocks, each printed once:

1. **Detection block** — working directory, Makefile presence, branch that will run (Docker or in-devcontainer).
2. **Prerequisites block** — Docker daemon status (or in-devcontainer toolchain check), `.proto` files found.
3. **Plan block** — exact command (`make proto`), expected output location, files expected to be regenerated.
4. **Run block** — stdout/stderr from `make proto`.
5. **Review block** — what changed (file count + bucket summary). Name anything that looks like a breaking change (removed types, renamed methods).
6. **Next-step block** — link to `/ags-extend test` to re-run tests, or `/ags-extend upgrade` if this was part of a larger bump.

</output_contract>

## Workflow

### Step 1 — Locate the app and its Makefile

If invoked from the app root, the working directory is the target. Otherwise, ask which app — never guess across multiple apps.

```bash
test -f Makefile && test -f Dockerfile && echo "looks like an Extend app root"
```

If the user named an app, `cd` into that directory first. If neither file is present and no app argument was given, stop and ask.

Read the `Makefile`. Confirm there is a `proto:` target and that it follows the dual-branch pattern documented in `references/proto/workflow.md`. If it doesn't, stop — the user is on a non-standard or older template; direct them to the template's `README.md`.

### Step 2 — Detect which Makefile branch will run

```bash
echo "REMOTE_CONTAINERS=${REMOTE_CONTAINERS:-not-set}"
```

- **`REMOTE_CONTAINERS=true`** — running inside a VS Code Remote Containers / devcontainer session. The Makefile's in-devcontainer branch will run `./proto.sh` directly. Verify host has the proto toolchain:
  ```bash
  command -v protoc && command -v protoc-gen-go && command -v protoc-gen-go-grpc
  ```
  If any are missing, the devcontainer wasn't built correctly — direct the user to rebuild the devcontainer (it's the devcontainer's `Dockerfile` that installs these). Do not install them onto the host.

- **Otherwise (host run)** — the Makefile's host branch will run `proto.sh` inside a Docker container built from the `proto-builder` stage of the template's `Dockerfile`. Verify Docker is running:
  ```bash
  docker info > /dev/null 2>&1 && echo "docker ok" || echo "docker NOT running"
  ```

  If Docker is missing or its daemon isn't running, *also* check for a host toolchain in case the user has it installed independently:

  ```bash
  command -v protoc && command -v protoc-gen-go && command -v protoc-gen-go-grpc
  ```

  Then stop and present the three options to the user — do not pick one for them:

  ```
  This template's `make proto` needs one of three environments. Pick one:

    1. Docker on the host (what `make proto` uses by default).
       Install: https://docs.docker.com/get-docker/
       Start the daemon, then re-run `/ags-extend proto`.
       Pro: matches the template-pinned toolchain exactly. Reproducible.

    2. The project's devcontainer (toolchain pre-installed).
       In VS Code: Command Palette → "Dev Containers: Reopen in Container".
       Re-run `/ags-extend proto` from the devcontainer terminal.
       Pro: zero host-side install. Recommended if Docker for the host isn't an option.

    3. Host-side install of the proto toolchain (last resort).
       Use ONLY if 1 and 2 aren't viable. Read the template's
       `Dockerfile` for the `proto-builder` stage to find the
       pinned PROTOC_VERSION and plugin versions, then install
       those exact versions on the host. After installing, run
       `./proto.sh` directly from the app dir (bypassing `make proto`).
       Pro: no Docker needed. Con: version drift risk; CI still
       runs `make proto` in Docker, so if your host versions diverge,
       what works locally may break in CI.
  ```

  If the user picks option 3, read the template's `Dockerfile` to surface the exact pinned versions before they install. Do NOT auto-install — surface the install commands and let them run them. Example for the Go template (versions are illustrative; always read the actual Dockerfile):

  ```bash
  # The proto-builder Dockerfile pins:
  #   PROTOC_VERSION=21.9
  #   protoc-gen-go and protoc-gen-go-grpc at versions in the Dockerfile

  # macOS:
  #   brew install protobuf@21
  #   go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.31.0
  #   go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.3.0

  # After install, run from the app dir:
  #   ./proto.sh
  ```

  If the host already has `protoc` etc. but at different versions than the Dockerfile pins, warn the user explicitly: "Your host has protoc X.Y; the template pins protoc Z.W. Generated files may differ from CI. Recommended: use option 1 or 2 instead."

### Step 3 — Check `.proto` inputs and git state

```bash
ls pkg/proto 2>/dev/null && find pkg/proto -name "*.proto" | head
git status --short
```

If `pkg/proto/` is empty or missing, ask the user what proto they expect to regenerate from — most commonly they need to copy a `.proto` from `github.com/AccelByte/accelbyte-api-proto` into `pkg/proto/` first.

If generated files have uncommitted changes, prompt the user to commit or stash before regen so the diff is reviewable.

### Step 4 — Confirm and run

```
Plan:
  Working dir:  ./{app-name}
  Command:      make proto
  Branch:       {Docker host run | in-devcontainer direct}
  Expected:     overwrites files under pkg/pb/

Run it? (yes/no)
```

On yes, run and stream output. On the host branch the first run is slow because Docker has to build the `proto-builder` image; subsequent runs reuse the cached image.

### Step 5 — Review the diff

```bash
git diff --stat
```

Classify each changed file:

- **New file** — a new proto added under `pkg/proto/` produced new generated code under `pkg/pb/`.
- **Modified file** — proto changed (added field, renamed method, version bump).
- **Removed file** — `proto.sh` `rm -rf`'s `pkg/pb/` before regen, so any generated file with no matching proto disappears. If the user did not intend to drop that proto, surface it as a likely accidental deletion.

For modified files, do a quick look for breaking patterns:

```bash
git diff pkg/pb/ | grep -E "^-.*func|^-.*type|^-.*interface" | head -20
```

Removed `func`/`type`/`interface` lines usually indicate a breaking change — surface them.

### Step 6 — Next steps

```
Regen complete.

Summary:
  ✓ 3 files modified
  ✓ 1 new file (pkg/pb/.../new_event.pb.go)
  ⚠ Removed: pkg/pb/.../old_event.pb.go — its source proto is no longer in pkg/proto/.
           If this is intentional, also remove handler code that referenced it.

Next:
  • Update call sites if breakage was surfaced — `go build ./...` to find them
  • Run tests → /ags-extend test
  • If this was part of an SDK or contract bump → /ags-extend upgrade
```

## Error Handling

| Situation | Response |
|---|---|
| No `Makefile` in the working directory | Stop. Either the user is in the wrong directory or the template is non-standard. Ask for the app path. |
| `Makefile` has no `proto:` target | Stop. Direct to the template's `README.md`. Do not invent a regen command. |
| Docker not installed (host branch) | Stop. Direct to https://docs.docker.com/get-docker/, or suggest opening the project's devcontainer if `.devcontainer/` exists. Do not auto-install. |
| Docker daemon not running | Tell the user to start Docker Desktop (or `sudo systemctl start docker` on Linux). Do not start it for them. |
| `make proto` fails building the `proto-builder` image | Surface the full Docker build output. Common causes: network blocked from pulling base images, corporate proxy needs configuration. Suggest the user retry once connectivity is confirmed. |
| `make proto` runs but `proto.sh` fails inside the container | Surface stderr. Common causes: syntax error in a `.proto` file the user just added, missing import path, mismatched plugin versions in the `proto-builder` Dockerfile. |
| In-devcontainer branch runs but `protoc` not found | The devcontainer image is incomplete or out of date. Suggest rebuilding the devcontainer (Command Palette → "Dev Containers: Rebuild Container"). Do not install protoc onto the host. |
| Regen succeeds but `go build ./...` fails | Expected when a proto contract change just landed. Direct to `/ags-extend upgrade` for guided handling. |
| User wants to undo regen | `git checkout -- pkg/pb/`. Describe it; let them run it. |
| `pkg/proto/` is empty | Ask what they expected to regenerate from. The most common answer is "I need to copy `<event>.proto` from `github.com/AccelByte/accelbyte-api-proto` first." |

## Examples

### Straight path — host with Docker

```
User: /ags-extend proto

Skill: Working dir: ./match-event-handler
       Makefile present, proto target uses standard dual-branch pattern.
       REMOTE_CONTAINERS not set → will run via Docker.

       Prerequisites:
         ✓ Docker daemon running
         ✓ pkg/proto/ has 2 .proto files
         ✓ working tree clean

       Plan:
         Command:    make proto
         Branch:     Docker host run (builds proto-builder image first time)
         Expected:   regenerates files under pkg/pb/

       Run it? (yes/no)

User: yes

Skill: [runs make proto]
       [+] Building proto-builder image... (cached)
       [+] Running proto.sh in proto-builder container...
       [no output on success]

       Regen complete.
       Summary: 4 files modified under pkg/pb/, no removals.
       No breaking changes detected in the diff.

       Next: /ags-extend test
```

### Inside a devcontainer

```
Skill: REMOTE_CONTAINERS=true → in-devcontainer branch.
       Verifying toolchain on PATH:
         ✓ protoc 21.9
         ✓ protoc-gen-go
         ✓ protoc-gen-go-grpc

       Plan:
         Command:    make proto
         Branch:     in-devcontainer (runs ./proto.sh directly)
         Expected:   regenerates files under pkg/pb/

       Run it? (yes/no)
```

### Docker not running

```
Skill: Working dir: ./match-event-handler
       REMOTE_CONTAINERS not set → would run via Docker.

       Prerequisites:
         ✗ Docker daemon NOT running

       Stopping. The host branch of `make proto` builds the proto toolchain
       in a Docker container. Either:
         • Start Docker Desktop (or `sudo systemctl start docker` on Linux)
           and re-run `/ags-extend proto`, OR
         • Open this project in its `.devcontainer` (which has the toolchain
           pre-installed) — VS Code: "Dev Containers: Reopen in Container".

       I will not install protoc onto your host — that's not how this template
       is meant to be built.
```

### New event added but proto missing

```
User: /ags-extend proto — I just wrote a handler for Match.Completed

Skill: pkg/proto/ contains only:
         pkg/proto/accelbyte-asyncapi/iam/account/v1/account.proto

       The Match.Completed proto isn't in this template — it ships only the
       IAM account example. Before regen will help you, copy the proto from
       github.com/AccelByte/accelbyte-api-proto:

         1. Find Match.Completed in accelbyte-api-proto
            (likely under accelbyte-asyncapi/match/v1/ or similar)
         2. Copy that .proto preserving its directory structure into
            ./match-event-handler/pkg/proto/
         3. Re-run /ags-extend proto

       I won't write the proto schema myself — the canonical contract lives
       in accelbyte-api-proto, and inferring fields here would drift from it.
```

### Breaking change detected

```
Skill: Regen complete.

       Summary:
         ✓ 3 files modified
         ⚠ Removed method: pkg/pb/player_service_grpc.pb.go — `GetPlayerOld`
            is gone (proto dropped the RPC).
         ⚠ Signature change: SetScore now takes (ctx, *SetScoreRequest)
            — second arg changed from int64 to struct.

       `go build ./...` will fail until handler call sites are updated.

       Next: /ags-extend upgrade for guided handling, or fix manually
       and /ags-extend test.
```
