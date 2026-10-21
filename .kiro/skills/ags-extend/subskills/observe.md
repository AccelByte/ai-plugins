---
last-verified: 2026-10-19
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
- https://github.com/AccelByte/accelbyte-ags-cli
- https://github.com/grafana/mcp-grafana
see-also:
- '[deploy-cli-commands.md](../references/deploy/cli-commands.md)'
- '[observe-cli-commands.md](../references/observe/cli-commands.md)'
- '[signal-guide.md](../references/observe/signal-guide.md)'
- '[grafana-guide.md](../references/observe/grafana-guide.md)'
- '[grafana-mcp.md](../../ags/references/observe/grafana-mcp.md)'
---

# AGS Extend Observer

Pull live signals for deployed Extend apps. Observability is split across these surfaces: the CLI's `get-app-info` (app status/metadata); live logs from `ags extend logs stream` or the Admin Portal's **Live app logs** card (recent and live container lines, including the previous container's crash text); the Admin Portal's **Download historical logs** card (a file of past logs, up to 7 days per export); and Grafana Cloud (LogQL log search, metrics, and dashboards). The CLI still does **not** have a `list` or per-app `status` subcommand. Read-only — never restarts, redeploys, or changes app state.

## Behavior Constraints

<grounding_rules>

- Read `references/deploy/cli-commands.md` and `references/observe/cli-commands.md` before quoting any CLI command, flag, or env var. Do not restate flags from memory — link instead.
- Read `references/observe/signal-guide.md` for status meanings, log-pattern classification, and common fixes. Do not invent diagnostic advice.
- The CLI observability commands are `ags extend get-app-info` and `ags extend logs stream`. There is no `list` and no per-app `status` subcommand. Before `logs stream`, follow [Presence and freshness check](../references/deploy/cli-commands.md#presence-and-freshness-check).
- Read `references/observe/grafana-guide.md` before coaching the user on opening Grafana, finding logs, or writing a log query. Logs are forwarded to Grafana **asynchronously** — an empty log view right after a deploy or a request is almost always ingestion lag (or too-narrow a time range / wrong filter), not broken logging. Never tell a user their logging is broken until they've widened the time range, confirmed lines still aren't arriving, and ruled out no-traffic.
- Grafana can be read two ways: the browser flow, or a Grafana MCP server backed by a brokered service-account token. The token path is **Private Cloud only** — never offer it to a Public Cloud user, where the broker rejects the tenant by design, and don't assume BYOC behaves like Private Cloud. That path is owned by `/ags`: read `../../ags/references/observe/grafana-mcp.md` before describing the broker call or the MCP config, and don't restate either from memory.
- Distinguish carefully between `Deploying`, `Degraded`, `Stopped`, and `Failed` — they imply different next actions. The signal guide has the mapping.

</grounding_rules>

<tool_usage_rules>

- Use `Bash` for `ags extend get-app-info`, `ags extend logs stream`, and per-app discovery (`test -f Makefile`, `ls */Makefile`).
- Run `ags extend logs stream` yourself only without `--follow`, so the command ends on its own. Bound it with `--tail-lines` and summarize the result — never paste a raw log dump. A `--follow` stream never ends on its own; hand that command to the user to run in their own terminal.
- LogQL search, metrics, and dashboards live in Grafana Cloud (browser, or the Grafana MCP server when configured). A file of past logs comes from the Admin Portal's **Download historical logs** card, not the CLI.
- Use `Read` for `.env` files and reference files.
- Use `Glob` to enumerate Extend app dirs (`*/Makefile` siblings) when invoked from a parent directory.
- **Never** modify any file. This subskill is strictly observe-only.
- **Never** run `ags extend deploy-app`, `start-app`, `stop-app`, or any state-changing command from here. If the user asks for those, finish observing and direct them to `/ags-extend deploy`.
- When a Grafana MCP server is already configured, use its read-only query tools directly instead of asking the user to copy log lines out of the browser. Never use its write tools (creating dashboards, annotations, datasources) from this subskill.
- Do not broker a token and do not edit MCP config here. Both belong to `/ags install-mcp` — route the user there and continue observing with what is already available.

</tool_usage_rules>

<dependency_checks>

Preconditions depend on the signal. App status, metadata, and recent container log lines come from the CLI; searchable log history and metrics come from Grafana; a file of past logs comes from the Admin Portal. Check only what the requested signal needs — don't block a Grafana-only question on a missing CLI, or a status question on a missing Grafana server.

For CLI signals (app status, image tag, scenario):

1. `command -v ags` returns a path. Run the `/ags-extend install-cli` freshness check and report the installed path/version, latest version, and status. Missing or broken/unparseable -> stop. Outdated or legacy/pre-version -> offer an upgrade to the latest official release. If the user declines, continue only when the documented observe command is present in `--help`. See `references/deploy/cli-commands.md#presence-and-freshness-check`.
2. The CLI is authenticated. Either: `AGS_BASE_URL`, `AGS_CLIENT_ID`, `AGS_CLIENT_SECRET` are set in the user's environment (the CLI has no `.env` file support — its resolution order is flag → environment variable → its own config → interactive prompt); OR the user has run `ags auth login` (browser flow) or `ags auth login --grant client-credentials`. If neither, ask the user for `AGS_BASE_URL` and direct them to `references/deploy/cli-commands.md#authentication`.
3. Namespace and app name are known — either from the app's local `.env` (if the user is in/near an app dir) or supplied inline by the user.

For CLI log lines, apply the same `logs` check (`references/deploy/cli-commands.md#presence-and-freshness-check`). Until the binary lists `logs`, use the Admin Portal's **Live app logs** card for the live stream. Grafana is for search and metrics: a configured Grafana MCP server (Private Cloud) or the user's browser.

No Docker dependency in either path.

</dependency_checks>

<output_contract>

Two possible output shapes:

**App is healthy (status running):**

```
{app-name}  [running]  {scenario}  image-tag {tag}

  No CLI-side issues.
  Live logs: ags extend logs stream --follow (see references/deploy/cli-commands.md)
  Past-log file: Admin Portal → app → Logs tab → Download historical logs
  Search/metrics: Grafana Cloud (Admin Portal → app detail → Open Grafana Cloud)
```

**App is unhealthy (any non-running status, or log lines from the CLI log stream / Grafana MCP / Grafana):**

```
{app-name}  [{appStatus}]  {scenario}  image-tag {tag}

  appStatus from get-app-info: {appStatus}

  (If log lines are available — from `ags extend logs stream`,
   Grafana MCP, or pasted by the user. Say which source they came from.)
  Issues identified:
    {timestamp}  {error line}
    {timestamp}  {error line}

  Likely cause: {from signal-guide.md}
  Suggested next step: {concrete action}
```

The CLI cannot enumerate apps, so there is no multi-app list shape. If the user wants to know what's deployed in a namespace, send them to the Admin Portal.

</output_contract>

<user_updates_spec>

If the user asks to "follow", "tail", or "stream" logs:

1. If the installed `ags` has `logs stream` (`references/deploy/cli-commands.md#stream-app-logs`), give them the `ags extend logs stream --follow` command from that reference to run in their own terminal — it streams until Ctrl-C, so don't run it from here. Lines arrive directly from the container, with no Grafana ingestion lag. The Admin Portal's **Live app logs** card (app → **Logs** tab) is the same stream in the browser.
2. If the check in `references/deploy/cli-commands.md#presence-and-freshness-check` finds no `logs` command, say so plainly. Send them to the Admin Portal's **Live app logs** card first (app → **Logs** tab) — it is the same stream, needs no install or update, and has no Grafana ingestion lag. Then tell them to update the AGS CLI to the latest release if they want it in the terminal. Use Grafana Explore (Admin Portal → app detail → Open Grafana Cloud → Explore with the Loki logs data source, scoped by the `app_name` label) only for search, metrics, or history.
3. For a file of past logs, use the Admin Portal's **Download historical logs** card (app → **Logs** tab; up to 7 days per export, each file downloadable once within 24 hours after you click **Export**). For searchable history or metrics, use Grafana. If a Grafana MCP server is already configured (Private Cloud), offer to query it directly (Step 3a) instead of sending them to the browser.
4. Note: Grafana ingestion is asynchronous, so a freshly-deployed app's Grafana log view can start empty — have them wait 60–120s and widen the time range before concluding nothing is flowing. See `references/observe/grafana-guide.md`.

</user_updates_spec>

<empty_result_recovery>

Several "empty" cases to handle explicitly, not silently:

- **`get-app-info` returns "app not found"** → the app named in the invocation isn't registered in the namespace. Say: "`{name}` is not deployed to `{namespace}` (or the name doesn't match). Verify in the Admin Portal, or run `/ags-extend deploy` to push it."
- **App dir exists locally but `get-app-info` returns 404** → it was never deployed or was removed. Say: "`{name}` exists in your repo but isn't deployed to `{namespace}`. Run `/ags-extend deploy` to push it."
- **Grafana Cloud shows no logs for a Running app** → rule out Grafana causes in order: (1) **ingestion lag** — wait ~60–120s and refresh; (2) **time range too narrow**; (3) **filter doesn't match**; (4) **no traffic**; (5) only then suspect the app's logger config. Cross-check with a bounded `ags extend logs stream` read (no `--follow`): lines there but not in Grafana point at ingestion lag, not the app.
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

> No `Makefile`+`Dockerfile` here or as a sibling one level down, and no .env to read. Give me the namespace and the app name you want to inspect, plus `AGS_BASE_URL` if it isn't already set in your environment for the CLI's own session (the CLI has no `.env` file support).

The CLI does not have a list command. Either the user names an app, the local app directory's basename is the app name, or you ask. Don't pretend to enumerate.

### Step 2 — Fetch app info

Read `references/observe/cli-commands.md` and `references/deploy/cli-commands.md` for exact syntax. The CLI authenticates via `ags auth login` (interactive) or `ags auth login --grant client-credentials` (unattended), which itself resolves `--base-url`/`--client-id`/`--client-secret` flags, then `AGS_BASE_URL`/`AGS_CLIENT_ID`/`AGS_CLIENT_SECRET` environment variables, then its own config, then an interactive prompt — the CLI has no `.env` file support. Then:

```bash
ags extend get-app-info --namespace {namespace} --app {app-name}
```

The response includes `appStatus`, `appName`, `scenario`, `appRepoUrl`, `deploymentImageTag`, timestamps, etc. Read `references/observe/signal-guide.md#app-status-values` to map the status.

If only the status is needed, pipe the JSON output through `jq`:

```bash
ags extend get-app-info --namespace {namespace} --app {app-name} --format json | jq -r .appStatus
```

Use the status to guide what comes next:

| Status | Next in Step 3 |
|---|---|
| `running` | Healthy. If user wants logs, use `logs stream` for recent/live lines, the Admin Portal for a past-log file, and Grafana for search (Step 3). |
| `app-undeployed` / `stopped` | App isn't serving. Suggest `/ags-extend deploy`. There are no pods to stream (`app-stopped` → `HTTP 404`; `app-undeployed` → `HTTP 400` with `app is not streamable`; see the exit-3 table). For earlier logs, use **Download historical logs** or Grafana (Step 3). |
| `deployment failed` | Redeploy attempt is needed. Direct to `/ags-extend deploy`. If a pod is still restarting, a `logs stream --previous` read may show why. If the stream exits `3`, read the status in `references/deploy/cli-commands.md#stream-app-logs`: `HTTP 404` is no running pods, `HTTP 400` with `app is not streamable` is a status that cannot be streamed. Either way, use **Download historical logs** or Grafana Cloud. |
| `starting` / `stopping` / `removing` | Transitional. Wait and re-run `get-app-info`. |
| `provisioning failed` / `provisioning timeout` | Infra-side. Surface the status and direct to AccelByte support if it persists. |

If `get-app-info` returns "app not found": see `empty_result_recovery`.

### Step 3 — Logs

**Recent and live app logs — the CLI.** `ags extend logs stream` reads the app's container output directly (`references/deploy/cli-commands.md#stream-app-logs` and `references/observe/cli-commands.md`). Confirm `logs` is listed first (`references/deploy/cli-commands.md#presence-and-freshness-check`).

- For a one-off look, run it without `--follow`, bounded with `--tail-lines`, and summarize the lines against the signal guide.
- After a crash or restart, add `--previous` to read the container instance that died. A pod that hasn't restarted prints no log lines, and the command still exits 0. On `ags` 0.5.2, `--format json` still emits `pod_done` with `reason` `error` for that pod. That event is the empty previous container, not a failed command (`references/deploy/cli-commands.md#stream-app-logs`).
- For a live tail, hand the user the `--follow` command to run themselves.
- Exit `3` means the server rejected the stream. Read the `HTTP <status>` in the message and use the table in `references/deploy/cli-commands.md#stream-app-logs`. Do not treat `HTTP 404` and `HTTP 400` with `app is not streamable` as the same status.
- An app with no running pods can't be streamed, by the CLI or the **Live app logs** card, and `--previous` doesn't change that. Which status that is, and where earlier logs come from, is the same table.

The Admin Portal's **Live app logs** card (app → **Logs** tab) is the same stream. Never tell the user to run or install `extend-helper-cli` to get logs.

**A file of past logs — the Admin Portal.** The app's **Logs** tab has a **Download historical logs** card under **Live app logs**: pick **From** and **To** (up to 7 days), click **Export**, and download the file from **Recent exports** once it is **Ready**. Each file can be downloaded only once and is kept for 24 hours after you click **Export**. There is no CLI command for it. Statuses, the default quotas (3 preparing exports per namespace, 10 per user per UTC day), and which permission starts an export versus which one lists and downloads the file: `references/deploy/cli-commands.md#logs-in-the-admin-portal`.

**Search and metrics — Grafana Cloud.** Grafana holds searchable log history (30 days), all metrics, and dashboards. There are two ways in:

- **A Grafana MCP server is already connected** → query it yourself (Step 3a). The user never has to leave the conversation.
- **Otherwise** → walk them through the browser flow (Step 3b). Offer the MCP setup only when they're on Private Cloud *and* reading logs repeatedly; for a single look it's slower than just opening Explore. Setup itself is `/ags install-mcp`.

#### Step 3a — Query Grafana directly

Run the same LogQL the browser flow would, scoped by `app_name`, against the Loki datasource:

```
{app_name="{app-name}"} |~ "(?i)error|panic|fatal|traceback|exception"
```

Ingestion lag still applies — an empty result means the same five things it means in a browser, in the same order (see `empty_result_recovery`). Widen the time range before reporting nothing.

If the tools return 401 or have vanished since earlier in the session, the brokered token expired (~4h, no refresh). Say so plainly and point at `../../ags/references/observe/grafana-mcp.md` — do not diagnose it as an app problem.

Summarize findings using the diagnosis shape below. Never paste a raw log dump.

#### Step 3b — Browser flow

Direct the user to Grafana Cloud:

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

For the full walkthrough — access by deployment tier (Public vs Private Cloud), programmatic access via the Grafana MCP server, how Grafana is organized, LogQL filters, and a "find the last error in the last 30 minutes" recipe — read `references/observe/grafana-guide.md` and walk the user through the relevant steps inline. Don't tell them to open the reference file; relay the steps.

If log lines are available (from `ags extend logs stream`, the Grafana MCP server, or pasted from Grafana), scan them against `references/observe/signal-guide.md`:

- **Healthy signals** — record the most recent one and its timestamp.
- **Warning signals** — list with timestamps.
- **Error signals** — list with timestamps, classify against the signal guide's fix table.

Summarize:

```
Diagnosis for {app-name}:
  Status (CLI):        {appStatus from get-app-info}
  Last healthy signal: "{pattern}" at {timestamp}
  Warnings:            {count}
    • {timestamp}  {pattern}
  Errors:              {count}
    • {timestamp}  {pattern}
  Likely cause:        {from signal-guide.md, or "unclear — pull more via logs stream or Grafana"}
  Suggested next step: {concrete action tied to the cause}
```

If errors exist but don't match any pattern in the signal guide, say so — don't make up a cause.

### Step 4 — Next action guidance

Based on the diagnosis:

| Finding | Suggestion |
|---|---|
| Healthy | "Looks good. For a live tail: `ags extend logs stream --follow`. For a past-log file: Admin Portal → Logs → Download historical logs. For search and metrics: Grafana Explore." |
| Errors with known fix (from signal-guide.md) | State the fix. If it requires redeploy, direct to `/ags-extend deploy`. |
| Errors with no known pattern | "No matching pattern in signal-guide.md. Pull more via Grafana, or share the log with AccelByte support." |
| `stopped` / `app-undeployed` | "App is not running. Run `/ags-extend deploy` to start it." |
| `deployment failed` | "Deploy itself failed. Re-run `/ags-extend deploy` — the Dockerfile, image, or namespace permissions may need fixing." |
| `starting` / `stopping` | "Still transitioning. Wait 30–60s and re-run `/ags-extend observe`." |

## Error Handling

| Situation | Response |
|---|---|
| `ags` missing | Direct to `/ags-extend install-cli`. Stop. |
| No app dir found and user didn't provide namespace/app | Ask for both. Don't guess. |
| `get-app-info` returns `401 unauthorized` | Session expired or env vars unset. Direct user to `references/deploy/cli-commands.md#authentication` — either re-export `AGS_BASE_URL`/`AGS_CLIENT_ID`/`AGS_CLIENT_SECRET` or run `ags auth login`. |
| `get-app-info` returns `403 forbidden` | OAuth client lacks permissions for Extend in this namespace. User needs Admin Portal to grant the needed Extend permissions. |
| `get-app-info` returns `namespace not found` | Wrong namespace or typo. Verify against the Admin Portal. |
| App named in invocation isn't deployed | See `empty_result_recovery`. |
| `get-app-info` runs but JSON is incomplete | CLI version mismatch. Suggest `/ags-extend install-cli` to upgrade. Show the raw output. |
| User wants logs (any status) | `ags extend logs stream` for recent, live, or previous-container lines; the Admin Portal's **Download historical logs** card for a file of past logs (up to 7 days); Grafana (MCP or browser) for LogQL search and metrics. |
| `ags extend logs stream` is rejected as an unknown subcommand | The installed `ags` has no `logs` subcommand. Say so, send them to the Admin Portal's **Live app logs** card first (same stream, no lag, nothing to install), and tell them to update the AGS CLI to the latest release (`/ags-extend install-cli`) for the terminal. Grafana only for search and metrics. Don't suggest `extend-helper-cli`. |
| `ags extend logs stream` exits `3` | Read the `HTTP <status>` and follow `references/deploy/cli-commands.md#stream-app-logs`. `404` is a missing app or no running pods (`app-stopped`). `400` with `app is not streamable` is creating, undeployed, removing, removed, or remove timeout. Don't call every exit `3` a stream limit, and don't swap those two statuses. |
| "You don't have permission to view these logs" (Portal) or `HTTP 403` from `logs stream` | Needs Extend app **read**. Listing **Recent exports** and downloading a file need **read** too. "You don't have permission to export logs" needs Extend app **create** to start the export. Don't swap them. |
| Grafana MCP tools return 401 mid-session | The brokered token expired (~4h, no refresh). Say so, and point at `../../ags/references/observe/grafana-mcp.md`. Don't diagnose it as an app fault. |
| User on Public Cloud asks to query Grafana programmatically | Not available on that tier — the broker rejects it by design, and there is no workaround. Use the browser flow in Step 3b. |
| Token broker call returns `406 Not Acceptable` | Missing `Content-Type: application/json` and a `{}` body — but brokering isn't done here. Route to `/ags install-mcp`. |
| User asks to set up the Grafana MCP server | Owned by `/ags` — hand off to `/ags install-mcp`. Don't broker a token or edit MCP config from this subskill. |
| App status is `running` but user reports the feature broken | Likely a handler bug or downstream failure that the health check doesn't catch. Read recent lines with `logs stream` (or Grafana), then `/ags-extend doctor` for symptom-driven diagnosis. |
| App stuck `starting` or `deployment failed` for >5 min | Show the `get-app-info` JSON output. Read startup errors with `logs stream` (add `--previous` if the container restarted), or Grafana. |
| Logs suggest OOMKilled | Surface it prominently. Suggested fix: raise the memory limit in the AGS Admin Portal (app detail → resource configuration), then redeploy via `/ags-extend deploy` (see `references/init/resource-defaults.md` for hard limits). |
| `connection refused` when CLI tries to reach AGS | The CLI can't reach `AGS_BASE_URL`. Check VPN / DNS / proxy, then verify `AGS_BASE_URL` is set correctly. |
| Stack trace in logs is from a non-user package (grpc internals only) | Tell the user to look earlier in the log — the root cause is usually 10–30 lines before the stack dump. |

## Examples

### Single app, healthy

```
User: /ags-extend observe

Skill: In ./matchmaking-override (Makefile + Dockerfile + go.mod). Reading .env…
       Namespace: my-studio-dev. App name: matchmaking-override.

       [reads references/deploy/cli-commands.md and references/observe/cli-commands.md]
       [runs ags extend get-app-info --namespace my-studio-dev --app matchmaking-override]

       appStatus: running
       deploymentImageTag: v1.4.2
       scenario: service-extension

       Diagnosis for matchmaking-override:
         Status (CLI):        running
         Suggested next step: Live tail — ags extend logs stream
                              --namespace my-studio-dev
                              --app matchmaking-override --follow
                              Search / metrics — Grafana Cloud Explore
                              (Admin Portal → app detail → "Open Grafana Cloud").
```

### User asks to stream logs

```
User: /ags-extend observe — stream logs for matchmaking-override

Skill: [checks that `ags extend --help` lists `logs`]

       Run this in your own terminal — it streams until you press Ctrl-C:

         ags extend logs stream --namespace my-studio-dev \
           --app matchmaking-override --follow

       Or use the Live app logs card on the app's Logs tab in the Admin Portal.
       Lines come straight from the container, so there's no Grafana lag.
       For a file of older logs, use Download historical logs on the same tab
       (up to 7 days per export). For LogQL search or metrics, use Grafana
       Cloud (Admin Portal → app detail → "Open Grafana Cloud").

       [If `ags extend --help` doesn't list `logs`, say so and send them to
       the Live app logs card first — same stream, no lag, nothing to
       install — then tell them to update the AGS CLI for the terminal. Use
       Grafana Explore (or the Grafana MCP server on Private Cloud) only for
       search, metrics, or history.]
```

### User pasted Grafana log lines suggesting a panic

```
User: /ags-extend observe match-event-handler. I see these in Grafana:
       10:32:00  retry attempt 1 (token refresh failed)
       10:32:01  panic: runtime error: invalid memory address or nil pointer dereference
       10:32:01  main.handleMatchComplete(…) /app/main.go:64 +0x45

Skill: [runs ags extend get-app-info --namespace my-studio-dev
        --app match-event-handler --format json | jq -r .appStatus]
       running   (process is restarting after panic)

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

       guild-service is stopped, so it has no pods to stream from —
       `ags extend logs stream` and the Live app logs card can't read it.
       For the logs from before it stopped:
         - Download historical logs on the app's Logs tab in the Admin
           Portal (up to 7 days per export), or
         - search Grafana Cloud (30 days; see references/observe/grafana-guide.md).
       If logs
       show OOMKilled, raise the memory limit in the Admin Portal (app detail →
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
         2. Read startup output with a bounded `ags extend logs stream`
            (add --previous if the container restarted), or Grafana Cloud.
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
