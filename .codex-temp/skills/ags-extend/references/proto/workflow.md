---
last-verified: 2026-05-07
note: Canonical proto regen workflow. The template's Makefile is always king — every
  AccelByte Extend template wraps proto regen in `make proto`, which is consumed by
  `subskills/proto.md`. This file documents the dual-branch pattern every template
  uses and what each branch does.
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://github.com/AccelByte/extend-event-handler-go
- https://github.com/AccelByte/extend-service-extension-go
- https://github.com/AccelByte/accelbyte-api-proto
see-also:
- '[conventions.md](conventions.md)'
- '[contract.md](../test/contract.md)'
- '[proto-changes.md](../upgrade/proto-changes.md)'
---

# Proto Regeneration Workflow

Per-template regen pattern consumed by `subskills/proto.md`. Also used by `subskills/upgrade.md` when an SDK bump crosses a proto contract boundary.

## Pre-flight: is this the right tool?

Proto regen applies when:

- The developer just added a new `.proto` from `github.com/AccelByte/accelbyte-api-proto` (most common — the Event Handler template ships with one example proto, and any non-trivial handler needs a different one).
- The developer updated the AGS SDK (which may include contract changes).
- The developer pulled a new template version that ships updated `.proto` files.
- They're seeing compile errors that look like "undefined field / method renamed / missing type" in code under `pkg/pb/`.

Proto regen does NOT apply when:

- The developer wants to edit handler logic without changing the proto contract — that's a pure code change.
- They want to invent a new event or AGS API — AGS contracts are owned by AGS; you fetch them from `accelbyte-api-proto`, you don't author them locally. (Service Extensions are the one exception: you own the proto for your own RPCs. AGS-facing protos are still fetched.)

If `.proto` files haven't changed, regen is a no-op.

## Where `.proto` files come from

| Use case | Proto source |
|---|---|
| Event Handler subscribing to an AGS event | `github.com/AccelByte/accelbyte-api-proto` — copy the matching `.proto` into the template's `pkg/proto/` preserving its directory structure. |
| Override implementing an AGS extension point | `github.com/AccelByte/accelbyte-api-proto` — same workflow. |
| Service Extension exposing your own RPCs | You author the `.proto` under `pkg/proto/`. AGS-facing dependencies still come from `accelbyte-api-proto`. |

**Never invent a proto schema.** Inferring fields locally produces code that doesn't match the AGS contract. If `accelbyte-api-proto` doesn't have the file you need, AGS doesn't emit / accept that event yet — surface that to the user; don't paper over it.

## The canonical Makefile pattern

Every AccelByte Extend template (`extend-event-handler-{go,python,csharp,java}`, `extend-service-extension-{go,...}`, etc.) ships a `Makefile` with a `proto` target that branches on `IS_INSIDE_DEVCONTAINER` (driven by the `REMOTE_CONTAINERS` env var that VS Code Remote Containers sets). The Go event handler template's exact target:

```makefile
IS_INSIDE_DEVCONTAINER := $(REMOTE_CONTAINERS)
PROTOC_IMAGE := proto-builder

proto_image:
ifneq ($(IS_INSIDE_DEVCONTAINER),true)
	docker build --target proto-builder -t $(PROTOC_IMAGE) .
endif

proto: proto_image
ifneq ($(IS_INSIDE_DEVCONTAINER),true)
	docker run --tty --rm --user $$(id -u):$$(id -g) \
		--volume $$(pwd):/build \
		--workdir /build \
		--entrypoint /bin/bash \
		$(PROTOC_IMAGE) \
		proto.sh
else
	./proto.sh
endif
```

Two branches:

1. **Host branch** (`REMOTE_CONTAINERS` not `true`). The `proto_image` target builds the `proto-builder` stage of the template's `Dockerfile` into a local image. Then `proto:` runs `proto.sh` inside that image with the working directory bind-mounted at `/build`. The host needs only Docker; everything else (`protoc`, language plugins, etc.) lives in the image.

2. **In-devcontainer branch** (`REMOTE_CONTAINERS=true`, set by VS Code when running inside a devcontainer). `proto_image` is a no-op (the devcontainer image already contains the toolchain). `proto:` runs `./proto.sh` directly on the devcontainer's filesystem.

Subskills must detect which branch will run before invoking `make proto` and check the corresponding precondition (Docker daemon vs. on-PATH toolchain in the devcontainer).

## What `proto.sh` does

The script (also shipped by the template) is small and stable across templates. The Go template's version:

```bash
PROTO_DIR="${1:-pkg/proto}"
OUT_DIR="${2:-pkg/pb}"

rm -rf "${OUT_DIR:?}"/* && mkdir -p "${OUT_DIR:?}"

protoc \
  -I "${PROTO_DIR}" \
  --go_out="${OUT_DIR}" \
  --go_opt=paths=source_relative \
  --go-grpc_out="${OUT_DIR}" \
  --go-grpc_opt=paths=source_relative,require_unimplemented_servers=false \
  $(find "${PROTO_DIR}" -name "*.proto" -type f)
```

Key points:

- The output directory is wiped before regen. Hand-edits to `pkg/pb/` will be lost.
- Inputs come from a recursive walk of `pkg/proto/` — adding a new `.proto` anywhere under that tree picks it up automatically.
- The exact `protoc` flags are template-specific (Python templates use `python -m grpc_tools.protoc`; Java uses Gradle's `generateProto`; C# uses `dotnet build`). Read the actual `proto.sh` (or build file) to know what's running for the language at hand.

## Toolchain reference (what lives inside `proto-builder`)

This section documents what the Docker image provides. Two of the three execution paths (Docker host, devcontainer) consume this image and require no host install. The third path (host install) exists as a last-resort fallback for environments where neither Docker nor a devcontainer is feasible — see `subskills/proto.md` Step 2 for when to offer it. Subskills must NEVER auto-install proto tooling on the host without explicit user opt-in, and even with opt-in, must surface the version-drift risks and read the template's `Dockerfile` for the pinned versions before recommending install commands.

For reference, the Go event handler template's `proto-builder` stage (Ubuntu 22.04 base) installs:

- `protoc` at a pinned version (`PROTOC_VERSION` ARG, currently 21.9)
- `protoc-gen-go` and `protoc-gen-go-grpc` at versions pinned in the Dockerfile
- For Service Extensions exposing REST: `protoc-gen-grpc-gateway` and `protoc-gen-openapiv2`

Python, Java, and C# templates use equivalent stages with their language-specific tooling. The exact versions are in the template's `Dockerfile`; `subskills/proto.md` does not need to know them — `make proto` consumes them.

## Verification after regen

After `make proto`:

1. **Compile** — `go build ./...` / `python -m compileall .` / `./gradlew build` / `dotnet build`. A clean build confirms generated code is consistent with handler call sites.
2. **Diff** — `git diff --stat` shows which generated files changed. A regen producing no diff means nothing changed upstream or the regen ran in the wrong directory.
3. **Breakage search** — `git diff pkg/pb/ | grep -E "^-.*func|^-.*type|^-.*interface"` surfaces removed symbols (the usual breakage pattern). Any hits = handlers likely need updates.

## Common failure modes

| Symptom | Usual cause | Fix |
|---|---|---|
| `make proto` fails: Docker not running | Host branch needs Docker. | Start Docker Desktop or systemd Docker; or open the project in its `.devcontainer`. |
| `make proto` builds the image then `proto.sh` fails with "no such file or directory" | `pkg/proto/` is empty or `.proto` files have a syntax error. | Confirm `.proto` was added under `pkg/proto/` preserving the directory layout from `accelbyte-api-proto`. |
| In-devcontainer branch: `protoc: command not found` | Devcontainer image is incomplete or stale. | Rebuild the devcontainer (VS Code: "Dev Containers: Rebuild Container"). Do not install onto the host. |
| Generated diff is huge and touches every file | Plugin version mismatch is reformatting everything. | Don't paper over by hand-editing — rebuild `proto-builder` (`docker build --no-cache --target proto-builder -t proto-builder .`) so versions match the Dockerfile. |
| `buf` references in some templates | Some older templates used `buf generate`. The current Extend templates use `protoc` directly via `proto.sh`. | If the template you're in uses `buf`, it's older — `buf generate` works the same way. Defer to the Makefile target. |
| Java template: `./gradlew generateProto` fails with "Protobuf plugin not configured" | `build.gradle` is stale or the Gradle wrapper is broken. | Compare against a fresh template clone and reset `build.gradle` if drift is the cause. |

## Host install — last-resort fallback

Hosts that already have an old `protoc` look "ready" — running `protoc` directly will produce *something*, just not necessarily what the template expects. Three failure modes you trade off against when going down the host-install path:

1. **Version drift.** The `proto-builder` Dockerfile pins specific versions. Host `protoc` is whatever the OS package manager last installed — usually older, sometimes newer in incompatible ways.
2. **Plugin drift.** `protoc-gen-go` major versions are not interchangeable; the wrong one regenerates files that look superficially right but silently break wire compatibility.
3. **Reproducibility.** A pipeline that depends on host state isn't reproducible. CI runs `make proto` in Docker for the same reason — the host shouldn't be special.

The Docker host path or the devcontainer path avoids all three. Use them when feasible.

When neither is feasible (no Docker available on the host, no devcontainer-capable IDE, restrictive corporate environment), the host-install path is acceptable with the following discipline:

1. **Read the template's `Dockerfile`** to find the exact `PROTOC_VERSION` and plugin versions pinned in the `proto-builder` stage. Don't guess.
2. **Install those exact versions** on the host. For Go templates, that typically means `protoc` + `protoc-gen-go` + `protoc-gen-go-grpc` (and `protoc-gen-grpc-gateway` + `protoc-gen-openapiv2` for Service Extensions exposing REST).
3. **Run `./proto.sh` directly** from the app dir. Do NOT run `make proto` — its host branch will try to build the Docker image first and fail.
4. **Accept that locally-generated files may differ from CI's output.** CI still runs `make proto` in Docker. If you commit locally-generated `pkg/pb/` and CI regenerates from scratch, the diff will surface — usually in PR review.

`subskills/proto.md` Step 2 walks the user through this choice. The subskill must never auto-install onto the host; it surfaces the install commands and lets the user run them.

## What this file does NOT cover

- How to *write* `.proto` files for Service Extensions. See `conventions.md` for style norms.
- How to integrate proto regen into CI. That's `subskills/ci.md` — typically CI runs the template's `make proto` target (which uses Docker on the runner).
- How to resolve breaking changes introduced by regen. That's `subskills/upgrade.md` + `references/upgrade/breaking-changes.md`.
