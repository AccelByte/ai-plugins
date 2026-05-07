---
last-verified: 2026-05-07
sources:
- https://github.com/AccelByte/extend-helper-cli
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/observability/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-app-lifecycle/
see-also:
- '[signal-guide.md](signal-guide.md)'
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

Response includes `appStatus` (e.g. `app-undeployed`, `running`, `stopped`, `deployment failed`) and timestamps.

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

The CLI does **not** have `logs`, `status`, or `list` subcommands. All log and metric observability is through **Grafana Cloud**, provided by AccelByte as part of the Extend package.

### Access

Open Grafana Cloud from the Extend app's detail page in the Admin Portal → click "Open Grafana Cloud" → sign in with Admin Portal credentials.

### What's available

**Infrastructure metrics:** app instance count and status, CPU utilization (limit/request), memory consumption (limit/request), disk space, IOPS, network bandwidth.

**Service metrics:** gRPC total requests, requests per status code, request latency, error rates; HTTP total requests, 2xx/4xx/5xx counts, request latency; incoming Kafka events (Event Handler); app creation and deployment duration.

**Logs:** your app's stdout is forwarded to Grafana Cloud automatically. Use the Explore section in Grafana with the `log-<studio>` data source and `namespace: extend-accelbyte-custom-service` label filter.

### Retention

- **Logs:** 30 days
- **Metrics:** 13 months

For longer retention, forward to an external sink.

## Authentication

The CLI supports two authentication modes — interactive `extend-helper-cli login` (browser flow) and OAuth client credentials via env vars / `.env`. See the canonical treatment in `references/deploy/cli-commands.md#authentication`. Do not duplicate it here.
