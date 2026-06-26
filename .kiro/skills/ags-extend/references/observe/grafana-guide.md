---
last-verified: 2026-06-25
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/tool-utilities/grafana-cloud-observability/access-grafana-cloud/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/extend-override-observability/
see-also:
- '[signal-guide.md](signal-guide.md)'
- '[cli-commands.md](cli-commands.md)'
- '[common-errors.md](../deploy/common-errors.md)'
---

# Grafana Cloud for Extend Logs

Deployed Extend apps send their logs and metrics to **Grafana Cloud**, provided by AccelByte as part of the Extend package. `extend-helper-cli` has **no** `logs` command (see `cli-commands.md`) — Grafana Cloud is the only place to read a deployed app's logs. This guide covers getting in, finding your app's logs, and querying them, plus the one gotcha that makes logs look "missing" when they aren't.

## Read this first: logs are not instant

App stdout is forwarded to Grafana Cloud **asynchronously**. After a deploy, a restart, or a request, expect a lag — usually seconds, sometimes a minute or two, and longer right after a fresh deploy while the app is still starting — before lines show up in Grafana.

**An empty log view is almost never "logging is broken."** In order of likelihood it is:

1. **Too soon** — the lines haven't been ingested yet. Wait ~60–120s and refresh.
2. **Time range too narrow** — Explore defaults to a short window. Widen it (see below).
3. **Wrong filter** — the label or app-name filter doesn't match what's actually emitted.
4. **App isn't deployed / has no traffic** — confirm status with `get-app-info` (see `cli-commands.md`).
5. **Logging genuinely misconfigured in the app** — only conclude this after ruling out 1–4.

Always widen the time range and refresh before deciding a deployed app "isn't logging."

## Access

Open Grafana Cloud from the **Extend app's detail page** in the Admin Portal → click **"Open Grafana Cloud"**. Sign in with **"Sign in with Admin Portal"** — it uses your existing Admin Portal credentials over SSO; there is no separate Grafana username or password to create.

The instance lives at a URL of the form `https://<your-stack>.grafana.net`.

### Access differs by deployment tier

| | Shared Cloud | Private / Dedicated Cloud |
|---|---|---|
| Grafana access | Scoped to **your AMS / Extend resources only** | Unrestricted |
| Entry point | AMS menu, or the **individual Extend app detail page** → "Open Grafana Cloud" | Also from the Admin Portal sidebar (Foundations → Tools & Utilities → Grafana Cloud) |
| General AGS service metrics / Game Health dashboards | Not available | Available |
| Requires | The full AMS or Extend package (free-trial users unlock it once the tier is unlocked) | — |

Both tiers use the **same** managed Grafana Cloud instance — Shared Cloud just sees a scoped slice of it.

**If "Open Grafana Cloud" is missing or greyed out on Shared Cloud,** the Extend package isn't unlocked for that namespace — that's an entitlement/tier matter, not a bug. Contact AccelByte.

> On Shared Cloud, Grafana access is SSO-only and scoped to your own resources. Programmatic access (a service-account token or API key, e.g. for an MCP server or a script) may not be available on every deployment — confirm with your AccelByte contact before relying on it. The dependable way to read deployed logs today is the manual browser flow described here; `extend-helper-cli` has no logs command.

## How Grafana is organized (short version)

Two surfaces matter for troubleshooting:

- **Dashboards** — pre-built panels of *metrics*: instance count, CPU, memory, request rates, status-code counts, latency. Good for "is it healthy / under load?" Not where you read log lines.
- **Explore** — ad-hoc querying of a single **data source**. This is where you read *logs*. Open it from the compass / "Explore" icon in the left nav.

Data sources you'll use in Explore:

- **Logs:** a Loki data source. In your studio's Grafana — Shared or Private Cloud alike — it's named **`log-<studio>`** (and metrics is `metrics-<studio>`); only AccelByte's own internal Grafana shows it as `grafanacloud-logs`. The name is the only thing that varies, so if neither matches what you see, just pick the single Loki / logs source from the data-source dropdown.
- **Metrics:** a Prometheus-style data source for the same signals the dashboards chart.

For "why is my app misbehaving," you want **Explore → the Loki logs data source.**

## Finding your app's logs in Explore

1. Open **Explore** (compass icon, left nav).
2. Select the Loki logs data source at the top (`log-<studio>` or `grafanacloud-logs`).
3. Scope to your app with the **`app_name`** label — this is the cleanest filter:
   ```
   {app_name="<Your-App-Name>"}
   ```
   `app_name` is your app's registered name, in its original casing (e.g. `My-Extend-App`). Other labels available on Extend log streams: `namespace` (auto-generated per deployment, shaped like `ext-<game-namespace>-<id>` — don't hardcode it, let `app_name` do the work), `game_namespace` (your AGS namespace), `container` (`service`), `cluster` / `environment_name`, and `service_name` (a generated `ext-<hash>` id). `pod_name` lives in the log entry's attributes, not as a stream label. Use Grafana's **label browser** to see the exact values in your environment.
4. Set the **time range** (top-right picker) to **Last 30 minutes** — or wider if you just deployed, because of ingestion lag.
5. Run the query. Newest lines are at the top.

Each log line arrives wrapped in a JSON envelope: `{"body":"<the actual log line>","attributes":{"pod_name":"…"}}`. To read just the message, append `| json | line_format "{{.body}}"` to the query.

## Querying with LogQL (the minimum you need)

LogQL is "a label selector, then optional line filters."

- **Label selector** (required) — picks the stream:
  ```
  {app_name="<Your-App-Name>"}
  ```
- **Exclude** — drop noise (e.g. the `/metrics` scrape, which is frequent):
  ```
  {app_name="<Your-App-Name>"} != "/metrics"
  ```
- **Regex match** — case-insensitive match across error-ish lines:
  ```
  {app_name="<Your-App-Name>"} |~ "(?i)error|panic|fatal|traceback|exception"
  ```

The log format inside each line depends on the app's language: a Go app using `slog` emits JSON (`"level":"ERROR"`); a Python app emits logfmt-style text (`level=error`) and stack traces. The case-insensitive regex above catches all of them; reach for `| json` parsing only once you know the shape.

### Recipe: "show me the last error in the last 30 minutes"

1. Time range → **Last 30 minutes** (widen if you deployed within the last couple of minutes).
2. Query:
   ```
   {app_name="<Your-App-Name>"} |~ "(?i)error|panic|fatal|traceback|exception"
   ```
3. Make sure the result list is sorted newest-first (Descending) and read the **top** line — that's the most recent match. Match its pattern against `signal-guide.md` to interpret it.

If that returns nothing, broaden before concluding the app is clean: drop the error filter (just `{app_name="<Your-App-Name>"}`) to confirm *any* lines are arriving — that rules out ingestion lag and a wrong `app_name` — then widen the time range.

## Live tail

Explore supports **Live** tailing (toggle at the top of the Explore view) — a continuous stream, useful while you reproduce an issue against the deployed app. Note the same ingestion lag applies, so a freshly-triggered request shows up a beat after you make it.

## Common confusions

| Symptom | Usually means |
|---|---|
| Empty view right after deploy | Ingestion lag + app still starting — wait and refresh, widen the time range |
| "No logs" but app is `running` | Time range too narrow, or a wrong `app_name` value — use the label browser to confirm the exact value |
| Only `/metrics` access lines show | That's the health/metrics scrape (`GET /metrics`), normal background traffic — exclude it with `!= "/metrics"` and trigger a real request |
| Metrics show but no log lines | You're on the metrics data source — switch Explore to the Loki logs source |
| A saved query with `namespace="extend-accelbyte-custom-service"` returns nothing | That namespace value was wrong — the real namespace is auto-generated per deployment (`ext-<game-namespace>-<id>`). Scope by `app_name="<your-app>"` instead. |
| Can't open Grafana at all (Shared Cloud) | Extend/AMS package not unlocked for the namespace — tier/entitlement, contact AccelByte |
