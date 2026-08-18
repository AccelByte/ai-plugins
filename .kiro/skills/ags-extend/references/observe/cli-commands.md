---
last-verified: 2026-05-09
sources:
- https://github.com/AccelByte/extend-helper-cli
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-app-lifecycle/
see-also:
- '[signal-guide.md](signal-guide.md)'
- '[grafana-guide.md](grafana-guide.md)'
- '[cli-commands.md](../deploy/cli-commands.md)'
---

# Observability Commands and Tools

## CLI: Check App Status

The only CLI command relevant to observability is `get-app-info`, which returns app metadata including current status:

```bash
extend-helper-cli get-app-info \
  --namespace <my-game-namespace> \
  --app <my-extend-app>
```

Response includes `appStatus` (e.g. `undeployed`, `running`, `stopped`, `deployment failed`) and timestamps.

To query a single field (e.g. status only):

```bash
extend-helper-cli get-app-info \
  --namespace <my-game-namespace> \
  --app <my-extend-app> \
  --path /appStatus
```

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

The CLI does **not** have `logs`, `status`, or `list` subcommands. All log and metric observability is through **Grafana Cloud**, provided by AccelByte as part of the Extend package. For the full walkthrough — access by deployment tier, how Grafana is organized, LogQL filters, and a "find the last error" recipe — see `grafana-guide.md`. The essentials:

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

The CLI supports two authentication modes — interactive `extend-helper-cli login` (browser flow) and OAuth client credentials via env vars / `.env`. See the canonical treatment in `references/deploy/cli-commands.md#authentication`. Do not duplicate it here.
