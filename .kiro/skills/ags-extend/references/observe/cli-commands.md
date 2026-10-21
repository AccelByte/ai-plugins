---
last-verified: 2026-10-09
sources:
- https://github.com/AccelByte/accelbyte-ags-cli
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-app-lifecycle/
see-also:
- '[signal-guide.md](signal-guide.md)'
- '[grafana-guide.md](grafana-guide.md)'
- '[cli-commands.md](../deploy/cli-commands.md)'
---

# Observability Commands and Tools

## CLI: Check App Status

`get-app-info` returns app metadata including current status:

```bash
ags extend get-app-info \
  --namespace <my-game-namespace> \
  --app <my-extend-app>
```

Response includes `appStatus` (e.g. `undeployed`, `running`, `stopped`, `deployment failed`) and timestamps.

To query a single field (e.g. status only):

```bash
ags extend get-app-info \
  --namespace <my-game-namespace> \
  --app <my-extend-app> \
  --format json | jq -r .appStatus
```

## CLI: Stream App Logs

`ags extend logs stream` prints an app's recent container log lines, or follows them live. The installed-binary check is `references/deploy/cli-commands.md#presence-and-freshness-check`.

```bash
ags extend logs stream \
  --namespace <my-game-namespace> \
  --app <my-extend-app> \
  --follow
```

Drop `--follow` to print recent lines and exit; add `--previous` to read the container instance that ran before the last restart (the crash text). Every flag, the output format, and the stream limit live in `references/deploy/cli-commands.md#stream-app-logs` — defer to it. Do not tell a reader to run or install `extend-helper-cli` to get logs.

The same live stream is in the Admin Portal: the app's **Logs** tab → **Live app logs** card.

## Admin Portal: Download Historical Logs

For a file of past logs, use the **Download historical logs** card on the app's **Logs** tab in the Admin Portal, under **Live app logs**. Pick **From** and **To** (up to 7 days), click **Export**, then download the file from **Recent exports** when it is **Ready**. Each file can be downloaded once and is kept for 24 hours after you click **Export**. This is Admin Portal only — there is no `ags extend logs` command for it. Statuses and messages: `references/deploy/cli-commands.md#logs-in-the-admin-portal`.

## App Lifecycle States

From the upstream lifecycle documentation, an app transitions through these states:

| Phase | Statuses |
|---|---|
| Creation | `provisioning in progress` → `undeployed` / `provisioning failed` / `provisioning timeout` |
| Deploy / Start | `starting` → `running` / `deployment failed` / `timeout` |
| Stop | `stopping` → `stopped` / `error` / `timeout` |
| Delete | `removing` → `removed` / `timeout` |

See `signal-guide.md` for interpreting log patterns once an app is running.

## Grafana Cloud (Logs and Metrics)

The CLI does **not** have `status` or `list` subcommands. LogQL log search (30 days of logs), metrics, and dashboards are through **Grafana Cloud**, provided by AccelByte as part of the Extend package. For the full walkthrough — access by deployment tier, how Grafana is organized, LogQL filters, and a "find the last error" recipe — see `grafana-guide.md`. The essentials:

### Access

Open Grafana Cloud from the Extend app's detail page in the Admin Portal → click "Open Grafana Cloud" → sign in with "Sign in with Admin Portal" (your Admin Portal credentials over SSO). Access scope differs by tier — Public Cloud is scoped to your AMS/Extend resources; Private Cloud is unrestricted. See `grafana-guide.md#access`.

### What's available

**Infrastructure metrics:** app instance count and status, CPU utilization (limit/request), memory consumption (limit/request), disk space, IOPS, network bandwidth.

**Service metrics:** gRPC total requests, requests per status code, request latency, error rates; HTTP total requests, 2xx/4xx/5xx counts, request latency; incoming Kafka events (Event Handler); app creation and deployment duration.

**Logs:** your app's stdout is forwarded to Grafana Cloud automatically — but **asynchronously**, so lines lag the app by seconds to a couple of minutes (longer right after a deploy). Use the Explore section in Grafana with the Loki logs data source (`log-<studio>`, or `grafanacloud-logs` in AccelByte's central Grafana), scoped by the `app_name` label. An empty view is usually too-soon or too-narrow a time range, not broken logging — widen and refresh first. See `grafana-guide.md`.

### Retention

- **Logs:** 30 days (default; may vary by plan or configuration)
- **Metrics:** 13 months (default; may vary by plan or configuration)

For longer retention, forward to an external sink.

## Authentication

The CLI supports two authentication modes — interactive `ags auth login` (browser flow) and OAuth client credentials via `ags auth login --grant client-credentials` plus env vars / `.env`. See the canonical treatment in `references/deploy/cli-commands.md#authentication`. Do not duplicate it here.
