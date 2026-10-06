---
last-verified: 2026-09-25
authoritative: true
note: This file is the SINGLE SOURCE OF TRUTH for `ags extend` command syntax inside
  this skill. Every other file in this bundle that mentions a CLI command, flag, or
  env var must defer to this file (cite-or-defer rule). Do not restate CLI flags from
  memory anywhere else — link here. The unedited binary `--help` output lives at `references/cli/help-output.md`
  (regen with `references/cli/scripts/capture-cli-help.sh`); this file is the skill-friendly
  restatement of that artifact. Targets `ags` 0.5.1.
sources:
- https://github.com/AccelByte/accelbyte-ags-cli
- https://github.com/AccelByte/accelbyte-ags-cli/blob/v0.5.1/CHANGELOG.md
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[help-output.md](../cli/help-output.md)'
- '[common-errors.md](common-errors.md)'
- '[rollout.md](../production/rollout.md)'
---

# ags extend — Commands (authoritative reference)

This file is the only place inside this skill that quotes CLI command names, flag names, and environment variables. If you are about to write `ags extend <something>` somewhere else, stop — link here instead. The `<grounding_rules>` of every CLI-touching subskill enforces this.

**Checking whether a "Minimum version: `ags` 0.5.1" note applies to an installed binary:** run `ags --version` (see [Presence and freshness check](#presence-and-freshness-check)) and compare the leading semver against 0.5.1. If the version can't be read, probe the feature directly: run the lifecycle command (`create-app`, `deploy-app`, `start-app`, `stop-app`, or `delete-app`) with `--wait` added. If it errors with an unrecognized-flag message, the installed release predates this feature; if `--wait` is accepted, the release has it.

The CLI is distributed as binary releases. The verbatim command help is bundled at `references/cli/help-output.md`; re-capture it with `references/cli/scripts/capture-cli-help.sh` whenever a new release ships.

## Authentication

`ags extend` shares authentication with the rest of the AGS CLI.

### Mode 1: interactive login (preferred when the user is at a terminal)

```bash
ags auth login
```

Opens a browser using OAuth 2.0 + PKCE against a pre-registered **public** IAM client — unlike the retired `extend-helper-cli login`, which auto-registered its own client, this client must already exist with the redirect URI configured (see `/ags install-cli`, Step 7). The CLI stores the resulting session locally so subsequent commands are authenticated without `AGS_CLIENT_ID` / `AGS_CLIENT_SECRET`.

`AGS_BASE_URL` must be set first (via the `--base-url` flag on `ags auth login`, or the `AGS_BASE_URL` environment variable — the CLI has no `.env` file support) so the CLI knows which environment to authenticate against. Ask the user for it; do not hardcode.

`ags auth status` reports the current login state. `ags auth logout` revokes the local session.

### Mode 2: OAuth client credentials (preferred for CI/CD and unattended scripts)

```bash
ags auth login --grant client-credentials
```

`ags auth login` accepts `--base-url`, `--client-id`, and `--client-secret` (or `--client-secret-stdin`) directly as flags. In CI, prefer setting them as environment variables instead — either exported, or via the CI host's own secret store (the CLI itself has no `.env` file support; it never reads a `.env` file):

```
AGS_BASE_URL='https://your-env.accelbyte.io'
AGS_CLIENT_ID='xxxxxxxxxx'
AGS_CLIENT_SECRET='xxxxxxxxxx'
```

Resolution order: `--base-url` → `AGS_BASE_URL` → the CLI's own config → an interactive prompt (same pattern for `--client-id`/`AGS_CLIENT_ID`; `--client-secret`/`AGS_CLIENT_SECRET` falls back to the OS keychain instead of config before prompting).

This requires a **confidential** IAM client, distinct from the public client used for interactive login. The client must have these Extend permissions. For AGS Private Cloud:

- `ADMIN:NAMESPACE:{namespace}:EXTEND:APP [CREATE, READ, UPDATE, DELETE]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:DEPLOYMENT [CREATE]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:REPOCREDENTIALS [READ]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:SECRET [CREATE, READ, UPDATE]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:VARIABLE [CREATE, READ, UPDATE]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:TUNNEL [READ]`

(Unchanged from `extend-helper-cli` — these IAM permission resources are unchanged by the app lifecycle commands' move to the CSM v5 contract. See [CSM API version](#csm-api-version) below for which commands moved.) For AGS Public Cloud, the equivalent grouped permissions are: App Management (CRUD), Deployment Management (Create), Extend app image repository access (Read), Configuration Secret Management (Read, Create, Update), Configuration Variable Management (Read, Create, Update), TCP Tunneling (Read).

## Presence and freshness check

`ags --version` and `ags -V` are top-level version flags:

```bash
ags --version
ags -V
```

Output on 0.5.1: `ags 0.5.1 (workflow protocol 1.0.0)` — the semver first, then the workflow-protocol version in parentheses. Parse the leading semver for freshness comparisons; the parenthetical is a separate, independently-versioned protocol number, not part of the CLI's own release version.

**`-v` is not the version flag** — `-v` (lowercase) is short for `--verbose` (shows resolution trace and request/response details); the version short flag is `-V` (capital). Do not carry over the old `extend-helper-cli`-era assumption that bare `-v` prints the version.

`--version`/`-V` exit 0 without requiring authentication, configuration, network access, or Docker. Use `command -v` (the POSIX shell builtin, unrelated to the CLI's own `-v`/`--verbose` flag) to find the executable, and `--version`/`-V` to determine its installed version. Verify that every downloaded candidate reports the selected release tag before installing it.

A legacy `extend-helper-cli` binary (or any binary predating version support) fails `--version` in this exact form. Distinguish a legacy/pre-version install from a broken binary by falling back to:

```bash
command -v ags   # exits 0 if on PATH, 1 if not
ags --help       # successful fallback means legacy/pre-version
```

Fetch the latest release metadata from `https://api.github.com/repos/AccelByte/accelbyte-ags-cli/releases/latest`, remove a leading `v` from `tag_name`, and compare it semantically with the installed version. `ags auth status` remains the *login* status command; it does not report the CLI version.

## Verbosity (global)

**Most subcommands do NOT accept the old `--verbosity {0..6}` flag on this release.** `create-app`, `deploy-app`, `start-app`, `stop-app`, `delete-app`, `tunnel`, `clone-template`, `update-var`, and `update-secret` show no such flag at all in their `--help` output — do not add it to an example for any of them.

Only `docker-login` and `app-ui upload` show a `--verbosity {level}` flag, and on both it is **accepted for backward compatibility, ignored** — it does nothing on this release.

There *is* a real global verbosity control, but it isn't `--verbosity`: `-v` / `--verbose` (top-level `ags` flag, shown in `ags --help`) turns on resolution-trace and request/response detail logging for any command. **`-v` does not mean version** — that's `-V` (capital) or `--version`; see Presence and freshness check above.

## Create an Extend App

```bash
ags extend create-app \
  --namespace {namespace} \
  --app {app-name} \
  --json '{"scenario":"{event-handler|function-override|service-extension}"}'
```

`--wait`/`--wait-interval`/`--wait-limit` on this command need `ags` 0.5.1 or later (see below).

Scenario values are exactly as listed: `event-handler`, `function-override`, `service-extension` (note: `function-override`, not `override`).

Optional `--json` fields (see `references/cli/help-output.md` for the full `CreateAppV5Request` schema) — these replace the separate `--description`/`--cpu`/`--memory` flags the retired `extend-helper-cli` had:

- `"description"` — human-readable description shown in the Admin Portal.
- `"cpu": {"requestCPU": {millicores}}` — initial CPU allocation. Range 60–1415, default 1000. (1 CPU = 1000m.)
- `"memory": {"requestMemory": {MB}}` — initial memory allocation. Range 100–2382, default 350.

`--api-version {v2|v5}` selects the CSM API contract; default is `v5`. See [CSM API version](#csm-api-version) for every command that carries it.

`--wait` plus `--wait-interval {seconds:10}` and `--wait-limit {seconds:600}` block until the app is ready for image upload. Minimum version: `ags` 0.5.1.

**There is no `--confirm` flag on this release's `create-app`** — unlike the retired `extend-helper-cli`, which prompted for interactive y/n confirmation unless `--confirm` was passed, `ags extend create-app` has no confirmation step to skip. Verify against `ags extend create-app --help` before telling a reader to pass `--confirm` — passing an unknown flag errors.

The server returns the app's full resource configuration in the response (`CPU.cpuLimit`, `CPU.requestCPU`, `memory.memoryLimit`, `memory.requestMemory`, `replica.minReplica`, `replica.maxReplica`, `replica.replicaLimit`).

### CSM API version

The commands that forward to CSM — `create-app`, `get-app-info`, `list-images`, `deploy-app`, `start-app`, `stop-app`, and `delete-app` — all default to the CSM **v5** contract and accept `--api-version {v2|v5}` (default `v5`) to pin one. `deploy-app`'s `--json` body is `CreateDeploymentV5Request`, whose only field is still the required `"imageTag"`.

`update-secret` and `update-var` carry no CSM version at all and take no `--api-version` flag. `docker-login`, `image-upload`, `tunnel`, and `clone-template` take none either.

**`--cpu` and `--memory` are inputs only on `create-app`** — via its `--json` payload, not as flags on any command. They're not accepted in any form by `deploy-app`, `start-app`, or `stop-app`. To change CPU or memory on an *existing* app, use the AGS Admin Portal (app detail → resource configuration) or call CSM API directly. The CLI does not have an "update resources" subcommand today.

## Replicas

The CLI does not accept `--min-replicas` or `--max-replicas` as flags on any subcommand. But replica config is **not** purely read-only via the CLI: `create-app`'s `--json` payload accepts a `"replica": {"minReplica": {n}, "maxReplica": {n}}` field at creation time (see Create an Extend App above) — so a reader can set initial replica bounds through the CLI, just not with a `--min-replicas`/`--max-replicas` flag.

For an *existing* app, replica configuration (min, max, hard ceiling) is read-only via `get-app-info` (`replica.minReplica` / `replica.maxReplica` / `replica.replicaLimit`) and editable only in the Admin Portal or via CSM API — `deploy-app`/`start-app`/`stop-app`/`delete-app` have no replica-related field or flag at all.

## Docker Login

```bash
ags extend docker-login \
  --namespace {namespace} \
  --app {app-name}
```

Runs `docker login` with the fetched credentials by default.

Optional:

- `--print` (or `-p`) — print the credentials to stdout instead of running `docker login` (useful for piping).
- `--print-format {json|token}` — output format for `--print`. Default `json`.
- `--login` (or `-l`) — accepted for backward compatibility with the retired `extend-helper-cli --login` flag, but **ignored** on this release: `docker-login` already logs in by default unless `--print` is passed. Verify against `ags extend docker-login --help` before quoting different behavior.

Credentials are scoped to one namespace + app. Re-run for different apps.

## Build and Push (image-upload)

```bash
ags extend image-upload \
  --namespace {namespace} \
  --app {app-name} \
  --image-tag {tag} \
  --work-dir {app-path}
```

Optional flags:

- `--login` (or `-l`) — auto-runs `docker-login` first.
- `--work-dir {path}` (or `-w`) — defaults to the calling shell's cwd.
- `--dockerfile {filename}` (or `-f`) — defaults to `Dockerfile`.
- `--platform {os/arch}` (or `-p`) — defaults to `linux/amd64`. Pass multiple `--platform` for multi-arch builds.
- `--retry-limit {n}` — max retry count, default 0.
- `--retry-interval {seconds}` — base delay, default 1.0.
- `--retry-rate {factor}` — exponential backoff rate, default 2.0.
- `--dry-run` — go through the motions without uploading.

Run from the app directory (Makefile + Dockerfile present), or pass `--work-dir`.

## Deploy

```bash
ags extend deploy-app \
  --namespace {namespace} \
  --app {app-name} \
  --json '{"imageTag":"{tag}"}'
```

Optional: `--wait` plus `--wait-interval {seconds:10}` and `--wait-limit {seconds:600}` to block until deploy finishes. Minimum version: `ags` 0.5.1.

Exit codes under `--wait`, per the [0.5.1 CHANGELOG](https://github.com/AccelByte/accelbyte-ags-cli/blob/v0.5.1/CHANGELOG.md):

- `6` — the wait reached `--wait-limit`. The deploy may still finish; re-check with `get-app-info` before acting.
- `3` — the app reached a failed state (`deployment-failed`, `deployment-timeout`, or `deployment-down` when the app came up and then crashed), printed as `deployment failed: <state>`. Do not retry blindly. `3` is also the code for any other API error, a permission denial included, so a `3` on its own does not prove the rollout failed — read the message.

A CI script can tell "wait longer" (`6`) from "stop" (`3`) without parsing the message.

The "Exit codes" list in `ags --help` stops at `5` and does not mention `6` (see [help-output.md](../cli/help-output.md)). That is a gap in the help text, not a different behaviour: 0.5.1 does exit `6` on a `--wait` timeout.

`deploy-app` does not accept `--cpu`, `--memory`, `--min-replicas`, or `--max-replicas`. The deploy uses whatever resource configuration the app currently has (set via `create-app`'s `--json` payload initially, or via the Admin Portal afterward).

## Get App Info

```bash
ags extend get-app-info \
  --namespace {namespace} \
  --app {app-name}
```

Returns JSON with `appStatus`, `appRepoUrl`, `scenario`, `deploymentImageTag`, `CPU.*`, `memory.*`, `replica.*`, etc.

To extract a single field, pipe `--format json` through `jq`. For `get-app-info` that output is the app's JSON itself, with no envelope, so the field sits at the top level:

```bash
ags extend get-app-info \
  --namespace {namespace} \
  --app {app-name} \
  --format json | jq -r .appStatus
```

Without `jq`, read `appStatus` from the full JSON. There is no `--path` or other field-selection flag: `--path /appStatus` fails with `Unexpected argument '--path' found`.

This is the canonical "what's running?" command — there is no `ags extend list` and no `ags extend status {app}`. To enumerate multiple apps, you need the Admin Portal (or your repo layout — one Makefile+Dockerfile dir per app).

## Stream App Logs

**Not available in `ags extend` today.** The AGS CLI has no equivalent of `extend-helper-cli logs stream --previous` (not yet built). Do not tell a reader to install `extend-helper-cli` to get this — instead:

- Use Grafana Cloud for historical search, LogQL, metrics, and dashboards (see `references/observe/cli-commands.md` and `references/observe/grafana-guide.md`).
- If the reader already has `extend-helper-cli` installed from before this migration, `extend-helper-cli logs stream --previous` still works against their existing install and is not disallowed — but this skill does not instruct a fresh install of it for this purpose.

## Start / Stop

```bash
ags extend start-app --namespace {namespace} --app {app-name}
ags extend stop-app  --namespace {namespace} --app {app-name}
```

Both support `--wait` / `--wait-interval` / `--wait-limit`. Minimum version: `ags` 0.5.1. Useful pair when changing resource configuration in the Admin Portal — the change applies on the next start.

## Environment Variables and Secrets (deployed-app config)

These commands set runtime config on a *deployed* app. The deployed app's process sees the variables and secrets configured here.

```bash
ags extend update-var \
  --namespace {namespace} --app {app-name} \
  --key KEY --value VALUE

ags extend update-secret \
  --namespace {namespace} --app {app-name} \
  --key KEY --value VALUE
```

Prefer `--value-stdin` (reads the value from stdin) over `--value` to avoid exposing the value in shell history — this matters most for `update-secret`.

Optional flags (both commands):

- `--force` — create the variable/secret if it doesn't exist yet (otherwise the command errors when it's missing).
- `--description {text}` — human-readable description shown in the Admin Portal. Preserved from the existing record on update if not supplied.
- `--sensitive {true|false}` — `update-secret` defaults to `true`, `update-var` defaults to `false` on create; preserved from the existing record on update if not supplied. Sensitive values are masked in the Admin Portal.

The Admin Portal exposes the same surface (app detail → environment variables / secrets), and CSM API can be called directly. Pick by workflow:

- One-off flip → Admin Portal is fastest.
- Scripted / repeatable → CLI.
- CI pipeline owning all config → CSM API or CLI from CI.

### Local `.env` vs deployed-app config

These are different stages, both legitimate:

- **Local dev / debugging.** The Extend app's `.env` (or `.env.template`) feeds `make run`, `docker-compose up`, and `/ags-extend debug`. Edit it freely; restart the local process to pick up the change.
- **Deployed app.** Local `.env` is not bundled into the image (it's git-ignored by every template's `.gitignore`) and the deployed process never reads it. Use `update-var` / `update-secret` / Admin Portal / CSM API to change deployed runtime config.

The trap to avoid: editing the deployed app's value by editing local `.env` and redeploying. The image build doesn't carry `.env`, so the deployed process keeps whatever `update-var` / Admin Portal last set.

## Database Tunnel

```bash
ags extend tunnel \
  --namespace {namespace} \
  --resource-name {resource-name} \
  --local-port {local-port}
```

Short flags: `-n` for `--namespace` only — `--resource-name` and `--local-port` have no short forms on this release. Verify against `ags extend tunnel --help` before quoting `-r`/`-p` short flags; the retired `extend-helper-cli` had them, but the current grounding artifact does not.

Optional: `--pod-name {pod}` — target a specific pod instead of letting the CLI pick one.

`--resource-name` supports both SQL and NoSQL database resource names. Find the resource name in the matching SQL or NoSQL Database area in the Admin Portal, then connect your database client to `localhost:{local-port}`.

The tunnel provides connectivity to the named database resource only. It does not discover database resources or create, update, delete, or otherwise manage database clusters.

## Delete an Extend App

```bash
ags extend delete-app \
  --namespace {namespace} \
  --app {app-name} \
  --forced true
```

Minimum version for `--wait`: `ags` 0.5.1.

**This release's `delete-app` has no `--confirm` flag and no `--force` flag** — it has a single `--forced {true|false}` flag (default `false`) that proceeds with deletion regardless of the app's current status when set to `true`. This differs from the retired `extend-helper-cli`, which had `--confirm` (skip the y/n prompt) and `--force` (delete despite running status) as two separate flags. Verify against `ags extend delete-app --help` before quoting either retired flag name.

Optional: `--wait` / `--wait-interval` / `--wait-limit`.

## Security Assessment (pen-testing engagements)

`ags extend security-assessment` requests a pen-testing engagement for an Extend app, tracks it, and downloads its report. It has four subcommands:

```bash
ags extend security-assessment list-endpoints --namespace {namespace} --app-name {app-name}
ags extend security-assessment request        --namespace {namespace} --app {app-name} --all-endpoints
ags extend security-assessment list           --namespace {namespace}
ags extend security-assessment result         --namespace {namespace} --app {app-name}
```

- **`list-endpoints`** — discovers a Service Extension app's testable endpoints and the permission each one requires (from the app's OpenAPI spec's `x-required-permission`, falling back to gRPC server reflection). Takes `--app-name`, **not** `--app` — the only `security-assessment` subcommand that does. An app that doesn't exist returns `404`; an app that isn't running, or has no reachable OpenAPI spec, still returns `200` with discovery skipped. Canonical command: `ags csm security-assessment get-app-endpoints`. Requires `READ` on `ADMIN:NAMESPACE:{namespace}:EXTEND:APP`.
- **`request`** — submits the engagement. Choose endpoints non-interactively with `--all-endpoints` or `--operation-ids {id1,id2,...}`; without either it walks an interactive checklist. `--permission {operationId}={RESOURCE} [ACTION]` (repeatable) supplies a permission where none was discovered. It warns before submitting if any selected endpoint can modify or delete data; the global `--yes` skips that confirmation and `--dry-run` previews without requesting. `--wait` blocks until the engagement is `COMPLETED` or `FAILED`, polling every 10s up to `--wait-limit {seconds}` (default 1800); Ctrl-C stops only the local wait, not the engagement.
- **`list`** — lists the namespace's engagements, live from the assessment service, so status always reflects its current state. Canonical command: `ags csm security-assessment list`. Requires `READ` on `ADMIN:NAMESPACE:{namespace}:EXTEND:SECURITYASSESSMENT`.
- **`result`** — downloads a completed engagement's report. `--report-format {pdf|md}` (default `pdf`), `--report-output {path}` (or `-o`; default `{app}-{engagementId}-report.{ext}`), and `--engagement-id {id}` to skip the interactive picker.

The `--help` output names no required permission for `request` or `result`, so don't state one.

## Login / Logout / Status

Already covered under Authentication above:

```bash
ags auth login                              # interactive OAuth 2.0 + PKCE browser flow
ags auth login --grant client-credentials    # CI / unattended
ags auth status                              # current login state
```

## Clone Template

```bash
ags extend clone-template \
  --template {name} \
  --destination {dir}
```

Without `--template`, the command prompts interactively through scenario, template, and language selection; pass `--template` for CI/scripted use.

Useful flags (per `references/cli/help-output.md` — this release's `clone-template` has a smaller flag surface than the retired `extend-helper-cli`'s):

- `--template {name}` — select a template by name (non-interactive).
- `--destination {dir}` (or `-d`) — destination directory.
- `--depth {n}` — shallow clone depth. Default `1` (shallow); pass `0` for a full clone.

**Removed, not present on this release:** `--repo-url`/`-r` (raw-URL clone — cloning from a raw URL was removed; starters catalog only), `--scenario`, `--language`, `--starters`, `--branch`/`-b`, `--auth-method`, `--token`, `--username`/`--password`, `--ssh-path`/`--ssh-pass`, `--confirm`, `--dry-run`. If a reader needs any of these, verify against `ags extend clone-template --help` first — this file's grounding artifact (`references/cli/help-output.md`) shows none of them on the current release, and that artifact was captured against the real binary, not hand-authored.

`subskills/wizard.md` currently uses raw `git clone` because it pairs the clone with the integration patches; `clone-template` is documented here for completeness and may take over from the wizard later.

## What the CLI does NOT have

These are the most common invented commands and flags. If you're tempted to write any of them, you're hallucinating — defer to this section.

- `ags extend list` — no list command. Use `get-app-info` per app, or the Admin Portal to enumerate. (`list-images` is a real subcommand, but it lists container images for one app, not apps themselves.)
- `ags extend logs` with no subcommand, or any `logs` subcommand at all — log streaming is not available in `ags extend` today (see "Stream App Logs" above). Invented siblings like `logs get` / `logs tail` do not exist either.
- `ags extend deploy` (without the `-app` suffix) — the command is `deploy-app`.
- `--base-url {url}` on any `ags extend` command — the environment is chosen once at login time via `ags auth login`, not a per-command flag on `image-upload`/`deploy-app`/etc. (`--base-url` **is** a real flag, but only on `ags auth login` itself — see Authentication above — where it resolves before the `AGS_BASE_URL` environment variable.)
- `--cpu` / `--memory` as flags on any command — they don't exist as flags at all on this release. `create-app`'s `--json` payload carries `cpu.requestCPU` / `memory.requestMemory` (see Create an Extend App above); post-create resource changes go through the Admin Portal or CSM API.
- `--min-replicas` / `--max-replicas` on any command — no such flags exist. `create-app`'s `--json` payload can set initial bounds via `replica.minReplica`/`replica.maxReplica` (see Replicas above); for an *existing* app, replica config is read-only via `get-app-info` and editable only in Admin Portal / CSM API.
- `--permissions` on any command — OAuth client permissions are configured on the IAM client itself in the Admin Portal.
- `--client-id` / `--client-secret` on any `ags extend` command (`image-upload`, `deploy-app`, `create-app`, etc.) — these subcommands take no such flags; the session is resolved once via `ags auth login`. (`--client-id` and `--client-secret` **are** real flags, but only on `ags auth login --grant client-credentials` itself — see Authentication above — where they resolve before the `AGS_CLIENT_ID` / `AGS_CLIENT_SECRET` environment variables.)
- `ags extend status {app-name}` — there is no per-app `status` under `ags extend`; login/session status is `ags auth status`. For app status: `get-app-info --format json | jq -r .appStatus`.
- `--path {json-pointer}` on `get-app-info` (or any command) — carried over from `extend-helper-cli`; `ags` has no field-selection flag. Pipe `--format json` through `jq` instead (see Get App Info above).
- `ags extend create-app --scenario {value}` / `ags extend deploy-app --image-tag {tag}` — these flags were retired; both commands take `--json` payloads now (see Create/Deploy above).
- `--confirm` on `create-app` or `delete-app` — no such flag exists on this release; `delete-app` uses `--forced true` instead (see Delete an Extend App above), and `create-app` has no confirmation step to skip.
- `-v` meaning "print version" — `-v` is short for `--verbose` (trace/debug logging); the version flag is `-V` (capital) or `--version` (see Presence and freshness check above).
- `--output json` meaning "format output as JSON" — `--output <path>` writes the response body to a file; the JSON-automation flag is `--format json` (see Machine-readable output below).

If you need a flag that isn't documented here, run `ags extend {subcommand} --help` against the binary and re-verify, then update this file before quoting the new flag elsewhere.

## Machine-readable output (`--format json`)

**The flag is `--format json`, not `--output json`.** `--output <path>` is a different, real, global `ags` flag that writes the response body to a file at `<path>` (`-` for stdout) — passing `--output json` would try to write the response to a file literally named `json`, not select JSON formatting. Do not confuse the two; verify against `ags --help` if unsure.

These commands accept `--format json` and emit a single JSON envelope on stdout (logs go to stderr): `create-app`, `deploy-app`, `start-app`, `stop-app`, `delete-app`, `update-var`, `update-secret`, `clone-template` (all under `ags extend`), plus `ags auth login`, `ags auth logout`, `ags auth status`.

Envelope shape — assumed unchanged from `extend-helper-cli`'s envelope shape pending verification against a real `ags extend` release; re-verify when the targeted release ships:

```json
{
  "command": "create-app",
  "result": "success",
  "serverResponse": {
    "csm": { "httpStatus": 200, "response": { ... } }
  }
}
```

`get-app-info` is the exception, and its shape is measured rather than assumed: `get-app-info --format json` prints the app's JSON itself, pretty-printed, with no envelope — `appStatus`, `deploymentImageTag` and the other fields sit at the top level.

On failure, `result` contains the error message and the process exits with code 1. `serverResponse` is omitted for commands with no server calls (`status`, `clone-template`).

`--format json` is **not** supported on `docker-login`, `image-upload`, or `tunnel` (their output is inherently streaming). Passing the flag on those commands prints a warning to stderr and the command runs normally. Log streaming itself is unavailable in `ags extend` at all (see "Stream App Logs" above), so there is no `logs stream --format json` case to consider here.

Use `--format json` in any non-interactive context (CI/CD pipelines, scripted automation).

## Full Deploy Sequence (Single App)

```bash
cd {app-path}

# Auth: either (a) interactive once per session
ags auth login                           # opens browser

# OR (b) export env vars (the CLI has no .env file support)
# AGS_BASE_URL, AGS_CLIENT_ID, AGS_CLIENT_SECRET
ags auth login --grant client-credentials

ags extend image-upload \
  --namespace {namespace} --app {app-name} --image-tag v1.0.0 --login

ags extend deploy-app \
  --namespace {namespace} --app {app-name} \
  --json '{"imageTag":"v1.0.0"}' --wait
```

Minimum version for `--wait`: `ags` 0.5.1.

Auth must be set first — see Authentication above for the two modes.
