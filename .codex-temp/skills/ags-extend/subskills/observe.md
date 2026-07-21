---
last-verified: 2026-07-20
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
- https://github.com/AccelByte/extend-helper-cli
see-also:
- '[deploy-cli-commands.md](../references/deploy/cli-commands.md)'
- '[observe-cli-commands.md](../references/observe/cli-commands.md)'
- '[signal-guide.md](../references/observe/signal-guide.md)'
- '[grafana-guide.md](../references/observe/grafana-guide.md)'
---

# AGS Extend Observer

Pull live signals for deployed Extend apps. Observability is split across two surfaces: the CLI's `get-app-info` command returns app status/metadata, and Grafana Cloud holds logs and metrics. The CLI does **not** have a `logs`, `list`, or per-app `status` subcommand. This subskill fetches what the CLI can give and points at Grafana Cloud for the rest. Read-only — never restarts, redeploys, or changes app state.

## Behavior Constraints

<grounding_rules>

- Read `references/deploy/cli-commands.md` and `references/observe/cli-commands.md` before quoting any CLI command, flag, or env var. Do not restate flags from memory — link instead.
- Read `references/observe/signal-guide.md` for status meanings, log-pattern classification, and common fixes. Do not invent diagnostic advice.
- The CLI cannot tail logs and cannot list apps. The only observability command is `extend-helper-cli get-app-info` (returns `appStatus`, image tag, etc.). Logs and metrics live in Grafana Cloud (Admin Portal → app detail → Open Grafana Cloud).
- Read `references/observe/grafana-guide.md` before coaching the user on opening Grafana, finding logs, or writing a log query. Logs are forwarded to Grafana **asynchronously** — an empty log view right after a deploy or a request is almost always ingestion lag (or too-narrow a time range / wrong filter), not broken logging. Never tell a user their logging is broken until they've widened the time range, confirmed lines still aren't arriving, and ruled out no-traffic.
- Distinguish carefully between `Deploying`, `Degraded`, `Stopped`, and `Failed` — they imply different next actions. The signal guide has the mapping.

</grounding_rules>

<tool_usage_rules>

- Use `Bash` only for `extend-helper-cli get-app-info` and per-app discovery (`test -f Makefile`, `ls */Makefile`).
- Use `Read` for `.env` files and reference files.
- Use `Glob` to enumerate Extend app dirs (`*/Makefile` siblings) when invoked from a parent directory.
- **Never** modify any file. This subskill is strictly observe-only.
- **Never** run `extend-helper-cli deploy-app`, `start-app`, `stop-app`, or any state-changing command from here. If the user asks for those, finish observing and direct them to `/ags-extend deploy`.
- Logs come from Grafana Cloud, not the CLI. Direct the user there; do not pretend a CLI log command exists.

</tool_usage_rules>

<dependency_checks>

Before running any observe commands:

1. `command -v extend-helper-cli` returns a path. Run the `/ags-extend install-cli` freshness check and report the installed path/version, latest version, and status. Missing or broken/unparseable -> stop. Outdated or legacy/pre-version -> offer an upgrade to the latest official release. If the user declines, continue only when the documented observe command is present in `--help`. See `references/deploy/cli-commands.md#presence-and-freshness-check`.
2. The CLI is authenticated. Either: `AB_BASE_URL`, `AB_CLIENT_ID`, `AB_CLIENT_SECRET` are set in the user's environment or in a `.env` file in the CLI's cwd; OR the user has run `extend-helper-cli login` (browser flow). If neither, ask the user for `AB_BASE_URL` and direct them to `references/deploy/cli-commands.md#authentication`.
3. Namespace and app name are known — either from the app's local `.env` (if the user is in/near an app dir) or supplied inline by the user.

No Docker dependency — this subskill talks to the AGS control plane through the CLI only.

</dependency_checks>

<output_contract>

Two possible output shapes:

**App is healthy (status running):**

```
{app-name}  [running]  {scenario}  image-tag {tag}

  No CLI-side issues. For logs / metrics, open Grafana Cloud
  (Admin Portal → app detail → Open Grafana Cloud).
```

**App is unhealthy (any non-running status, or user pasted log lines):**

```
{app-name}  [{appStatus}]  {scenario}  image-tag {tag}

  appStatus from get-app-info: {appStatus}

  (If user pasted log lines from Grafana:)
  Issues identified:
    {timestamp}  {error line}
    {timestamp}  {error line}

  Likely cause: {from signal-guide.md}
  Suggested next step: {concrete action}
```

The CLI cannot enumerate apps, so there is no multi-app list shape. If the user wants to know what's deployed in a namespace, send them to the Admin Portal.

</output_contract>

<user_updates_spec>

There is no live log stream from the CLI. If the user asks to "follow" or "tail" logs, point them at Grafana Cloud Explore (Admin Portal → app detail → Open Grafana Cloud → Explore with the Loki logs data source, scoped by the `app_name` label). Grafana itself supports live-tail. Note: ingestion is asynchronous, so a freshly-deployed app's stream can start empty — have them wait 60–120s and widen the time range before concluding nothing is flowing. See `references/observe/grafana-guide.md`.

</user_updates_spec>

<empty_result_recovery>

Several "empty" cases to handle explicitly, not silently:

- **`get-app-info` returns "app not found"** → the app named in the invocation isn't registered in the namespace. Say: "`{name}` is not deployed to `{namespace}` (or the name doesn't match). Verify in the Admin Portal, or run `/ags-extend deploy` to push it."
- **App dir exists locally but `get-app-info` returns 404** → it was never deployed or was removed. Say: "`{name}` exists in your repo but isn't deployed to `{namespace}`. Run `/ags-extend deploy` to push it."
- **Grafana Cloud shows no logs for a Running app** → rule out the cheap causes first, in order: (1) **ingestion lag** — logs arrive seconds-to-minutes late, so wait ~60–120s and refresh; (2) **time range too narrow** — widen the Explore time picker; (3) **filter doesn't match** — check available labels in Grafana's label browser; (4) **no traffic** — trigger a call to the app; (5) only then suspect the app's logger config. See `references/observe/grafana-guide.md`. Do not tell the user their logging is broken before (1)–(4) are ruled out.
- **`get-app-info` returns zero or unexpected fields** → show the raw output and check freshness. Offer an upgrade when outdated or legacy/pre-version. Retry after an approved, verified upgrade before declaring the field or capability unsupported. Treat authentication and authorization failures separately.

</empty_result_recovery>

## Workflow

### Step 1 — Identify the target

```bash
# Are we inside an Extend app dir?
test -f Makefile && test -f Dockerfile && echo "in app: $(basename $(pwd))"
# Or are app dirs siblings one level down?
ls */Makefile 2>/dev/null
```

If we are inside (or one level up from) an Extend app, read its `.env` to pick up `AB_NAMESPACE` (and `AB_BASE_URL` for the user's reference). For multi-app projects, ask which app's environment to use if `.env` values differ — usually they match across apps in the same project.

If no app dir is found and the user did not supply namespace + app name inline:

> No `Makefile`+`Dockerfile` here or as a sibling one level down, and no .env to read. Give me the namespace and the app name you want to inspect, plus `AB_BASE_URL` if it isn't already in your env or in a `.env` in this directory.

The CLI does not have a list command. Either the user names an app, the local app directory's basename is the app name, or you ask. Don't pretend to enumerate.

### Step 2 — Fetch app info

Read `references/observe/cli-commands.md` and `references/deploy/cli-commands.md` for exact syntax. The CLI authenticates via env vars or `.env` in its cwd, or via `extend-helper-cli login` (browser flow) — never via flags. Then:

```bash
extend-helper-cli get-app-info --namespace {namespace} --app {app-name}
```

The response includes `appStatus`, `appName`, `scenario`, `appRepoUrl`, `deploymentImageTag`, timestamps, etc. Read `references/observe/signal-guide.md#app-status-values` to map the status.

If only the status is needed, narrow with a JSON pointer:

```bash
extend-helper-cli get-app-info --namespace {namespace} --app {app-name} --path /appStatus
```

Use the status to guide what comes next:

| Status | Next in Step 3 |
|---|---|
| `running` | Healthy. If user wants logs, hand off to Grafana Cloud. |
| `app-undeployed` / `stopped` | App isn't serving. Suggest `/ags-extend deploy`. |
| `deployment failed` | Redeploy attempt is needed. Direct to `/ags-extend deploy`. Logs in Grafana Cloud may show why. |
| `starting` / `stopping` / `removing` | Transitional. Wait and re-run `get-app-info`. |
| `provisioning failed` / `provisioning timeout` | Infra-side. Surface the status and direct to AccelByte support if it persists. |

If `get-app-info` returns "app not found": see `empty_result_recovery`.

### Step 3 — Logs and metrics (Grafana Cloud)

The CLI cannot tail logs. Direct the user to Grafana Cloud:

```
Logs and metrics for {app-name} live in Grafana Cloud:
  1. Open the Admin Portal → Extend → app detail → "Open Grafana Cloud".
  2. Sign in with "Sign in with Admin Portal" (your Admin Portal credentials).
  3. Explore section → the Loki logs data source (log-<studio>, or grafanacloud-logs).
  4. Filter by the app_name label (your app's registered name).
  5. Set the time range to Last 30 minutes (widen it if you just deployed).

Heads-up: logs are ingested asynchronously — they show up seconds to a
couple of minutes after the app emits them, longer right after a deploy.
If the view is empty, widen the time range and refresh before assuming
anything is broken.

Retention: logs 30 days, metrics 13 months. See references/observe/cli-commands.md.
```

For the full walkthrough — access by deployment tier (Shared vs Private Cloud), how Grafana is organized, LogQL filters, and a "find the last error in the last 30 minutes" recipe — read `references/observe/grafana-guide.md` and walk the user through the relevant steps inline. Don't tell them to open the reference file; relay the steps.

If the user pastes log lines from Grafana into the chat, scan them against `references/observe/signal-guide.md`:

- **Healthy signals** — record the most recent one and its timestamp.
- **Warning signals** — list with timestamps.
- **Error signals** — list with timestamps, classify against the signal guide's fix table.

Summarize:

```
Diagnosis for {app-name}:
  Status (CLI):        {appStatus from get-app-info}
  Last healthy signal: "{pattern}" at {timestamp}      (from pasted Grafana log)
  Warnings:            {count}
    • {timestamp}  {pattern}
  Errors:              {count}
    • {timestamp}  {pattern}
  Likely cause:        {from signal-guide.md, or "unclear — pull more from Grafana"}
  Suggested next step: {concrete action tied to the cause}
```

If errors exist but don't match any pattern in the signal guide, say so — don't make up a cause.

### Step 4 — Next action guidance

Based on the diagnosis:

| Finding | Suggestion |
|---|---|
| Healthy | "Looks good. Open Grafana Cloud Explore for live tailing if you want continuous visibility." |
| Errors with known fix (from signal-guide.md) | State the fix. If it requires redeploy, direct to `/ags-extend deploy`. |
| Errors with no known pattern | "No matching pattern in signal-guide.md. Pull more from Grafana, or share the log with AccelByte support." |
| `stopped` / `app-undeployed` | "App is not running. Run `/ags-extend deploy` to start it." |
| `deployment failed` | "Deploy itself failed. Re-run `/ags-extend deploy` — the Dockerfile, image, or namespace permissions may need fixing." |
| `starting` / `stopping` | "Still transitioning. Wait 30–60s and re-run `/ags-extend observe`." |

## Error Handling

| Situation | Response |
|---|---|
| `extend-helper-cli` missing | Direct to `/ags-extend install-cli`. Stop. |
| No app dir found and user didn't provide namespace/app | Ask for both. Don't guess. |
| `get-app-info` returns `401 unauthorized` | Session expired or env vars unset. Direct user to `references/deploy/cli-commands.md#authentication` — either re-export `AB_BASE_URL`/`AB_CLIENT_ID`/`AB_CLIENT_SECRET` or run `extend-helper-cli login`. |
| `get-app-info` returns `403 forbidden` | OAuth client lacks read permissions for Extend in this namespace. User needs Admin Portal to grant read permissions for Extend apps (the exact permission string may vary — check Admin Portal → IAM → Clients → [client] → Permissions if unsure). |
| `get-app-info` returns `namespace not found` | Wrong namespace or typo. Verify against the Admin Portal. |
| App named in invocation isn't deployed | See `empty_result_recovery`. |
| `get-app-info` runs but JSON is incomplete | CLI version mismatch. Suggest `/ags-extend install-cli` to upgrade. Show the raw output. |
| User wants logs (any status) | Direct to Grafana Cloud as in Step 3. Do not pretend a CLI log command exists. |
| App status is `running` but user reports the feature broken | Likely a handler bug or downstream failure that the health check doesn't catch. Direct to Grafana Cloud logs, then `/ags-extend doctor` for symptom-driven diagnosis. |
| App stuck `starting` or `deployment failed` for >5 min | Show the `get-app-info` JSON output. Direct user to Grafana Cloud for logs from the failed deploy. |
| Logs the user pasted suggest OOMKilled | Surface it prominently. Suggested fix: raise the memory limit in the AGS Admin Portal (app detail → resource configuration), then redeploy via `/ags-extend deploy` (see `references/init/resource-defaults.md` for hard limits). |
| `connection refused` when CLI tries to reach AGS | The CLI can't reach `AB_BASE_URL`. Check VPN / DNS / proxy, then verify `AB_BASE_URL` is set correctly. |
| Stack trace in logs is from a non-user package (grpc internals only) | Tell the user to look earlier in the log — the root cause is usually 10–30 lines before the stack dump. |

## Examples

### Single app, healthy

```
User: /ags-extend observe

Skill: In ./matchmaking-override (Makefile + Dockerfile + go.mod). Reading .env…
       Namespace: my-studio-dev. App name: matchmaking-override.

       [reads references/deploy/cli-commands.md and references/observe/cli-commands.md]
       [runs extend-helper-cli get-app-info --namespace my-studio-dev --app matchmaking-override]

       appStatus: running
       deploymentImageTag: v1.4.2
       scenario: service-extension

       Diagnosis for matchmaking-override:
         Status (CLI):        running
         Last healthy signal: (CLI cannot tail logs)
         Likely cause:        —
         Suggested next step: For continuous visibility, open Grafana Cloud
                              Explore (Admin Portal → app detail →
                              "Open Grafana Cloud") and live-tail filtered
                              by app_name="matchmaking-override".
```

### User pasted Grafana log lines suggesting a panic

```
User: /ags-extend observe match-event-handler. I see these in Grafana:
       10:32:00  retry attempt 1 (token refresh failed)
       10:32:01  panic: runtime error: invalid memory address or nil pointer dereference
       10:32:01  main.handleMatchComplete(…) /app/main.go:64 +0x45

Skill: [runs extend-helper-cli get-app-info --namespace my-studio-dev
        --app match-event-handler --path /appStatus]
       appStatus: running   (process is restarting after panic)

       Diagnosis for match-event-handler:
         Status (CLI):        running
         Warnings:            1
           • 10:32:00  retry attempt 1 (token refresh failed)
         Errors:              1
           • 10:32:01  panic: nil pointer at main.go:64
         Likely cause:        Unhandled nil pointer at main.go:64
         Suggested next step: Add a nil check at main.go:64 (event payload
                              might be missing a field). Fix locally, run
                              /ags-extend debug, then /ags-extend deploy.
```

### Stopped

```
Skill: [runs get-app-info]
       appStatus: stopped

       guild-service is stopped. Logs in Grafana Cloud may show why
       (Admin Portal → app detail → Open Grafana Cloud). If logs show
       OOMKilled, raise the memory limit in the Admin Portal (app detail →
       resource configuration; see references/init/resource-defaults.md
       for hard limits) then /ags-extend deploy.
```

### Stuck starting

```
Skill: [runs get-app-info]
       appStatus: starting    (deploy began 6 minutes ago)

       Still transitioning. Fresh deploys usually reach `running` within
       1–2 minutes. Options:
         1. Wait another minute and re-run /ags-extend observe.
         2. Check Grafana Cloud logs for startup errors.
         3. If stuck, re-run /ags-extend deploy to force a fresh rollout.
```

### App not deployed

```
User: /ags-extend observe leaderboard-ext

Skill: [runs get-app-info]
       Error: app not found in namespace my-studio-dev.

       leaderboard-ext is not deployed to my-studio-dev. If it exists in
       your repo, run /ags-extend deploy to push it.
```
