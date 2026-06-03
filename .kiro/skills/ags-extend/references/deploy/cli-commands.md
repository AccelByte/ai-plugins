---
last-verified: 2026-05-07
authoritative: true
note: This file is the SINGLE SOURCE OF TRUTH for extend-helper-cli command syntax
  inside this skill. Every other file in this bundle that mentions a CLI command,
  flag, or env var must defer to this file (cite-or-defer rule). Do not restate CLI
  flags from memory anywhere else — link here. The unedited binary `--help` output
  lives at `references/cli/help-output.md` (regen with `references/cli/scripts/capture-cli-help.sh`);
  this file is the skill-friendly restatement of that artifact.
sources:
- https://github.com/AccelByte/extend-helper-cli
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-helper-cli/
see-also:
- '[help-output.md](../cli/help-output.md)'
- '[common-errors.md](common-errors.md)'
- '[rollout.md](../production/rollout.md)'
---

# extend-helper-cli — Commands (authoritative reference)

This file is the only place inside this skill that quotes CLI command names, flag names, and environment variables. If you are about to write `extend-helper-cli <something>` somewhere else, stop — link here instead. The `<grounding_rules>` of every CLI-touching subskill enforces this.

The CLI is a binary-only release (no source on GitHub). The verbatim `--help` output for every subcommand is bundled at `references/cli/help-output.md` and is the ground truth this file restates. Re-capture with `references/cli/scripts/capture-cli-help.sh` whenever a new release ships, then update this file to match.

## Authentication

The CLI supports two authentication modes.

### Mode 1: interactive login (preferred when the user is at a terminal)

```bash
extend-helper-cli login
```

Opens the AccelByte Admin Portal in a browser using OAuth 2.0 + PKCE. The user signs in with their normal Admin Portal credentials. The CLI stores the resulting session locally so subsequent commands are authenticated without `AB_CLIENT_ID` / `AB_CLIENT_SECRET`.

`AB_BASE_URL` must be set first (env var or `.env`) so the CLI knows which environment to authenticate against. Ask the user for it; do not hardcode.

`login` accepts one optional flag:

- `--base-url {url}` — overrides `AB_BASE_URL` for this single invocation.

`extend-helper-cli logout` revokes the local session. `extend-helper-cli status` reports the current login state.

### Mode 2: OAuth client credentials (preferred for CI/CD and unattended scripts)

Set three environment variables — either exported, or in a `.env` file in the directory where the CLI is run:

```
AB_BASE_URL='https://your-env.accelbyte.io'
AB_CLIENT_ID='xxxxxxxxxx'
AB_CLIENT_SECRET='xxxxxxxxxx'
```

The CLI itself reads `.env` from the cwd. **This is independent of the Extend app's own `.env`** (which holds runtime secrets for `make run` / local `/ags-extend debug` and is *not* read by the CLI when deploying).

The OAuth client must have these Extend permissions. For AGS Private Cloud:

- `ADMIN:NAMESPACE:{namespace}:EXTEND:APP [CREATE, READ, UPDATE, DELETE]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:DEPLOYMENT [CREATE]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:REPOCREDENTIALS [READ]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:SECRET [CREATE, READ, UPDATE]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:VARIABLE [CREATE, READ, UPDATE]`
- `ADMIN:NAMESPACE:{namespace}:EXTEND:TUNNEL [READ]`

For AGS Shared Cloud, the equivalent grouped permissions are: App Management (CRUD), Deployment Management (Create), Extend app image repository access (Read), Configuration Secret Management (Read, Create, Update), Configuration Variable Management (Read, Create, Update), TCP Tunneling (Read).

### `--base-url` exists only on `login`

`AB_BASE_URL` is set via env or `.env` for every other command. Only `login` accepts `--base-url` as a one-shot override (handy for switching between environments without re-exporting). Anywhere else in the docs that shows `--base-url` on `image-upload` / `deploy-app` / `update-var` / etc. is wrong.

## Presence check (is the CLI installed?)

The CLI does **not** have a `--version` flag. Don't run `extend-helper-cli --version` for presence detection — it exits 1 ("flag provided but not defined: -version"). Use one of:

```bash
command -v extend-helper-cli   # exits 0 if on PATH, 1 if not
extend-helper-cli --help       # exits 0; prints command list
```

`extend-helper-cli status` is for *login* status, not presence. It does not report a CLI version either.

## Verbosity (global)

Most subcommands accept:

- `--verbosity {0..6}` (or `-v`) — `0` panic, `1` fatal, `2` error, `3` warn, `4` info (default), `5` debug, `6` trace.

> **Exception:** `tunnel` does not accept `--verbosity`.

## Create an Extend App

```bash
extend-helper-cli create-app \
  --namespace {namespace} \
  --app {app-name} \
  --scenario {event-handler|function-override|service-extension} \
  --confirm
```

Scenario values are exactly as listed: `event-handler`, `function-override`, `service-extension` (note: `function-override`, not `override`).

Optional flags:

- `--description {text}` — human-readable description shown in the Admin Portal.
- `--cpu {millicores}` — initial CPU allocation. Range 60–1415, default 1000. (1 CPU = 1000m.)
- `--memory {MB}` — initial memory allocation. Range 100–2382, default 350.
- `--wait` plus `--wait-interval {seconds:10}` and `--wait-limit {seconds:600}` to block until the app is ready for image upload.
- `--confirm` skips the interactive y/n prompt.

The server returns the app's full resource configuration in the response (`CPU.cpuLimit`, `CPU.requestCPU`, `memory.memoryLimit`, `memory.requestMemory`, `replica.minReplica`, `replica.maxReplica`, `replica.replicaLimit`).

**`--cpu` and `--memory` are inputs only on `create-app`** — they're not accepted by `deploy-app`, `start-app`, or `stop-app`. To change CPU or memory on an *existing* app, use the AGS Admin Portal (app detail → resource configuration) or call CSM API directly. The CLI does not have an "update resources" subcommand today.

## Replicas

The CLI does not accept `--min-replicas` or `--max-replicas` on any subcommand. Replica configuration (min, max, hard ceiling) is read-only via `get-app-info` (`replica.minReplica` / `replica.maxReplica` / `replica.replicaLimit`) and editable only in the Admin Portal or via CSM API.

## Docker Login

```bash
extend-helper-cli dockerlogin \
  --namespace {namespace} \
  --app {app-name} \
  --login
```

Optional:

- `--login` (or `-l`) — immediately runs `docker login` with the returned credentials.
- `--print` (or `-p`) — print the password and exit (useful for piping).

Credentials are scoped to one namespace + app. Re-run for different apps.

## Build and Push (image-upload)

```bash
extend-helper-cli image-upload \
  --namespace {namespace} \
  --app {app-name} \
  --image-tag {tag} \
  --work-dir {app-path}
```

Optional flags:

- `--login` (or `-l`) — auto-runs `dockerlogin` first.
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
extend-helper-cli deploy-app \
  --namespace {namespace} \
  --app {app-name} \
  --image-tag {tag}
```

Optional: `--wait` plus `--wait-interval {seconds:10}` and `--wait-limit {seconds:600}` to block until deploy finishes.

`deploy-app` does not accept `--cpu`, `--memory`, `--min-replicas`, or `--max-replicas`. The deploy uses whatever resource configuration the app currently has (set via `create-app` flags initially, or via the Admin Portal afterward).

## Get App Info

```bash
extend-helper-cli get-app-info \
  --namespace {namespace} \
  --app {app-name}
```

Returns JSON with `appStatus`, `appRepoUrl`, `scenario`, `deploymentImageTag`, `CPU.*`, `memory.*`, `replica.*`, etc.

Use `--path /appStatus` to extract a single field (JSON pointer; default `/`).

This is the canonical "what's running?" command — there is no `extend-helper-cli list` and no `extend-helper-cli status {app}`. To enumerate multiple apps, you need the Admin Portal (or your repo layout — one Makefile+Dockerfile dir per app).

## Start / Stop

```bash
extend-helper-cli start-app --namespace {namespace} --app {app-name}
extend-helper-cli stop-app  --namespace {namespace} --app {app-name}
```

Both support `--wait` / `--wait-interval` / `--wait-limit`. Useful pair when changing resource configuration in the Admin Portal — the change applies on the next start.

## Environment Variables and Secrets (deployed-app config)

These commands set runtime config on a *deployed* app. The deployed app's process sees the variables and secrets configured here.

```bash
extend-helper-cli update-var \
  --namespace {namespace} --app {app-name} \
  --key KEY --value VALUE

extend-helper-cli update-secret \
  --namespace {namespace} --app {app-name} \
  --key KEY --value VALUE
```

Optional flags (both commands):

- `--force` — create the variable/secret if it doesn't exist yet (otherwise the command errors when it's missing).
- `--description {text}` — human-readable description shown in the Admin Portal.
- `--sensitive {true|false}` — `update-secret` defaults to `true`, `update-var` defaults to `false`. Sensitive values are masked in the Admin Portal.

The Admin Portal exposes the same surface (app detail → environment variables / secrets), and CSM API can be called directly. Pick by workflow:

- One-off flip → Admin Portal is fastest.
- Scripted / repeatable → CLI.
- CI pipeline owning all config → CSM API or CLI from CI.

### Local `.env` vs deployed-app config

These are different stages, both legitimate:

- **Local dev / debugging.** The Extend app's `.env` (or `.env.template`) feeds `make run`, `docker-compose up`, and `/ags-extend debug`. Edit it freely; restart the local process to pick up the change.
- **Deployed app.** Local `.env` is not bundled into the image (it's git-ignored by every template's `.gitignore`) and the deployed process never reads it. Use `update-var` / `update-secret` / Admin Portal / CSM API to change deployed runtime config.

The trap to avoid: editing the deployed app's value by editing local `.env` and redeploying. The image build doesn't carry `.env`, so the deployed process keeps whatever `update-var` / Admin Portal last set.

## NoSQL Database Tunnel

```bash
extend-helper-cli tunnel \
  --namespace {namespace} \
  --resource-name {resource-name} \
  --local-port {local-port}
```

Short flags: `-n` / `-r` / `-p`.

Find `{resource-name}` in Admin Portal → Extend app detail → NoSQL Database tab → Database URL. Then connect your database client to `localhost:{local-port}`.

## Delete an Extend App

```bash
extend-helper-cli delete-app \
  --namespace {namespace} \
  --app {app-name} \
  --confirm
```

Optional: `--force` (proceed even if the app is currently running), `--wait` / `--wait-interval` / `--wait-limit`.

## Login / Logout / Status

Already covered under Authentication above:

```bash
extend-helper-cli login    # OAuth 2.0 + PKCE browser flow against AB_BASE_URL
extend-helper-cli logout   # revoke local session
extend-helper-cli status   # current login state (NOT a CLI version check)
```

`login` accepts `--base-url {url}` to override `AB_BASE_URL` for that single invocation.

## Clone Template

```bash
extend-helper-cli clone-template \
  --repo-url {url} \
  --destination {dir}
```

Useful flags:

- `--repo-url {url}` (or `-r`) — HTTPS or SSH repo URL.
- `--scenario {name}` and `--template {name}` — pick from a starters catalog instead of a raw URL.
- `--language {C#|Go|Java|Python}` — filter starters by language.
- `--starters {path}` — path to a starters YAML file.
- `--branch {ref}` (or `-b`), `--depth {n}` — clone control. Depth defaults to `1` (shallow); pass `0` for a full clone.
- `--auth-method {none|token|basic|ssh}` — defaults to `none`. Pair with `--token`, `--username`/`--password`, or `--ssh-path`/`--ssh-pass` as needed.
- `--confirm`, `--dry-run`.

`subskills/wizard.md` currently uses raw `git clone` because it pairs the clone with the integration patches; `clone-template` is documented here for completeness and may take over from the wizard later.

## What the CLI does NOT have

These are the most common invented commands and flags. If you're tempted to write any of them, you're hallucinating — defer to this section.

- `extend-helper-cli list` — no list command. Use `get-app-info` per app, or the Admin Portal to enumerate.
- `extend-helper-cli logs` — no log subcommand. Logs are in Grafana Cloud (see `references/observe/cli-commands.md`).
- `extend-helper-cli deploy` (without the `-app` suffix) — the command is `deploy-app`.
- `extend-helper-cli --version` — no version flag (exits 1). Use `command -v extend-helper-cli` for presence checks.
- `--base-url {url}` on any command except `login` — `AB_BASE_URL` is set via env or `.env`; only `login` accepts an inline override.
- `--cpu` / `--memory` on `deploy-app`, `start-app`, `stop-app`, or `update-var` — they exist only on `create-app` (initial allocation). Post-create resource changes go through Admin Portal or CSM API.
- `--min-replicas` / `--max-replicas` on any command — replica config is read-only via `get-app-info`; editable only in Admin Portal / CSM API.
- `--permissions` on any command — OAuth client permissions are configured on the IAM client itself in the Admin Portal.
- `--client-id` / `--client-secret` flags — credentials are env-only (`AB_CLIENT_ID` / `AB_CLIENT_SECRET`) or the `login` browser flow.
- `extend-helper-cli status {app-name}` — `status` reports *login* state, not per-app status. For app status: `get-app-info --path /appStatus`.

If you need a flag that isn't documented here, run `extend-helper-cli {subcommand} --help` against the binary and re-verify, then update this file before quoting the new flag elsewhere.

## Machine-readable output (`--output json`)

These commands accept `--output json` and emit a single JSON envelope on stdout (logs go to stderr): `create-app`, `deploy-app`, `start-app`, `stop-app`, `delete-app`, `get-app-info`, `update-var`, `update-secret`, `clone-template`, `login`, `logout`, `status`.

Envelope shape:

```json
{
  "command": "create-app",
  "result": "success",
  "serverResponse": {
    "csm": { "httpStatus": 200, "response": { ... } }
  }
}
```

On failure, `result` contains the error message and the process exits with code 1. `serverResponse` is omitted for commands with no server calls (`status`, `clone-template`).

`--output json` is **not** supported on `dockerlogin`, `image-upload`, or `tunnel` (their output is inherently streaming). Passing the flag on those commands prints a warning to stderr and the command runs normally.

When `--output json` is set and the command would normally show an interactive confirmation prompt (`create-app` / `delete-app` without `--confirm`), the prompt is skipped automatically.

Use `--output json` in any non-interactive context (CI/CD pipelines, scripted automation).

## Full Deploy Sequence (Single App)

```bash
cd {app-path}

# Auth: either (a) interactive once per session
extend-helper-cli login                 # opens browser

# OR (b) export env vars / put them in .env in this directory
# AB_BASE_URL, AB_CLIENT_ID, AB_CLIENT_SECRET

extend-helper-cli image-upload \
  --namespace {namespace} --app {app-name} --image-tag v1.0.0 --login

extend-helper-cli deploy-app \
  --namespace {namespace} --app {app-name} --image-tag v1.0.0 --wait
```

Auth must be set first — see Authentication above for the two modes.
