---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[cli-commands.md](cli-commands.md)'
- '[slo.md](../production/slo.md)'
---

# Log Signal Guide

How to interpret app statuses and log patterns from deployed Extend apps.

## App Status Values

| Status | Meaning | Typical Cause |
|---|---|---|
| `Running` | App is healthy and serving traffic | Normal |
| `Deploying` | A new version is being rolled out | Recent deploy in progress |
| `Degraded` | App is running but unhealthy — errors or failed health checks | App crashes, bad config, or unhandled panics |
| `Stopped` | App is not running | Manual stop, failed deploy, or resource limit hit |
| `Failed` | Deploy attempt failed | Build error, image push failure, or AGS-side error |

## Healthy Log Signals

These lines indicate the app started successfully and is ready to serve:

| Pattern | App Type | Meaning |
|---|---|---|
| `gRPC server listening on :8080` | Override, Event Handler | Server is up |
| `HTTP gateway listening on :8081` | Service Extension | REST gateway is up |
| `serving requests` | Any | App is handling traffic |
| `connected to AGS` | Any | Successfully authenticated with AGS |

## Warning Signals

| Pattern | Likely Meaning |
|---|---|
| `retry attempt` | A downstream call to AGS failed and is being retried |
| `context deadline exceeded` | A request timed out — could be AGS latency or the app's processing time |
| `connection refused` | App can't reach AGS or a dependency — check `AB_BASE_URL` and network |
| `token refresh failed` | OAuth token expired and refresh failed — check `AB_CLIENT_ID` / `AB_CLIENT_SECRET` |

## Error Signals

| Pattern | Likely Cause | Suggested Fix |
|---|---|---|
| `panic:` / `runtime error` | Unhandled nil pointer or out-of-bounds in the app code | Check the stack trace in the log; fix the nil check in the handler |
| `SIGSEGV` | Segfault — usually a language runtime issue | Redeploy; if recurring, check for memory issues in the code |
| `OOMKilled` | App exceeded its memory limit | Raise the memory limit in the AGS Admin Portal (app detail → resource configuration), then redeploy with `extend-helper-cli deploy-app` (see `references/deploy/cli-commands.md`) |
| `permission denied` (calling AGS API) | OAuth client lacks a required AGS permission | Add the missing permission to the OAuth client in the Admin Portal (IAM → Clients → {client} → Permissions), then redeploy |
| `invalid argument` / `unknown field` | Payload schema mismatch — app received unexpected input | Check if AGS updated the proto contract; regen protos if needed |
| `failed to connect to AGS` | `AB_BASE_URL` is wrong or unreachable, or the CLI didn't see it | Verify `AB_BASE_URL` is set for the deployed app in the AGS Admin Portal (app detail → environment variables). For the CLI itself, ask the user for `AB_BASE_URL` if it's not already in their env or the `.env` in the CLI's working directory — note that the CLI reads `.env` from its OWN cwd, not the Extend app's local `.env`. |

## Reading a Panic Stack Trace

When you see `panic:` in logs, the relevant lines are:

```
panic: runtime error: ...     ← error type
goroutine N [running]:
main.yourFunction(...)         ← your code — this is the entry point to fix
    /app/main.go:42            ← file and line number
```

Ignore `runtime/` and `google.golang.org/grpc/` lines — focus on your own package paths.

## Degraded but No Errors in Logs

If the app is `Degraded` but logs look clean:

1. Fetch more lines: `--tail 200`
2. Check if the health check endpoint is failing — the app may be alive but not responding on the expected port
3. Check the app's status and recent state with `extend-helper-cli get-app-info --namespace {ns} --app {app}` — `OOMKilled` may not always appear in app logs (see `references/observe/cli-commands.md`)
4. If still unclear, redeploy with `/ags-extend deploy` and monitor the fresh startup
