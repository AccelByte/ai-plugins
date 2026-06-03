---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-app-cpu-memory-replicas/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
see-also:
- '[manifest-schema.md](manifest-schema.md)'
- '[resources.md](../production/resources.md)'
---

# Resource Defaults

CPU, memory, and replica starting points for AGS Extend apps. `extend-helper-cli create-app` accepts `--cpu` (60–1415m) and `--memory` (100–2382 MB) to set initial values at creation time — see `references/deploy/cli-commands.md`. Once the app exists, resource changes are made in the AGS Admin Portal (app detail → resource configuration) or via the CSM API. `deploy-app`, `start-app`, and `stop-app` do NOT accept resource flags. There is no project-level manifest — these values configure the app directly.

## Starting Recommendations

| Type | CPU (millicores) | Memory (MB) | Replicas |
|---|---|---|---|
| Override | 250 | 256 | 1 |
| Event Handler | 500 | 512 | 1 |
| Service Extension | 500 | 512 | 1 |

**Reasoning:**
- Override is synchronous — AGS waits for your response. Keep it lean to minimize added latency.
- Event Handler and Service Extension have higher reserved overhead per replica from the gRPC and asynchronous delivery stack.

## Hard Limits (from AGS docs)

| Type | CPU min–max (m) | Memory min–max (MB) | Max replicas |
|---|---|---|---|
| Override | 1–1415 | 1–2382 | 60 |
| Service Extension | 1–1415 | 1–2382 | 60 |
| Event Handler | 1–1215 | 1–1358 | 60 |

Do not configure values outside these bounds in the Admin Portal.

## Scaling Guidance

Use these when the user's app description suggests higher complexity — bump the starting recommendation accordingly:

| Signal | Adjustment |
|---|---|
| Multiple override functions or heavy business logic | 500m CPU / 512 MB |
| External API calls (third-party services) | +128 MB memory |
| High event volume (Event Handler) | Start at 2 replicas |
| Service Extension with many REST endpoints | 750m CPU |
| Service Extension with database access | +256 MB memory |
