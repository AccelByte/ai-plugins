---
last-verified: 2026-04-21
sources:
- https://github.com/AccelByte/extend-service-extension-go
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[local-run.md](local-run.md)'
- '[integration.md](../test/integration.md)'
---

# Local Testing Guide

How to invoke a locally-running Extend app and verify it's working correctly.

## Override

An Override app intercepts gRPC calls from AGS. To test locally, you need to either:

**Option A: Use the AGS Test Environment**

Configure your AGS namespace to route override calls to your local machine. This requires:
1. A tunnel tool like `ngrok` to expose localhost to the internet (the gRPC server is on `:6565`):
   ```bash
   ngrok tcp 6565
   ```
2. Register the forwarding address in the Admin Portal under your Override app settings.

AGS will then route real calls through your local server. Watch the logs.

**Option B: Send gRPC calls directly with grpcurl**

Install `grpcurl`:
```bash
brew install grpcurl
```

List available RPC methods:
```bash
grpcurl -plaintext localhost:6565 list
```

Call a method:
```bash
grpcurl -plaintext -d '{"input": "value"}' localhost:6565 {ServiceName}/{MethodName}
```

Use the proto files in the app directory to find the service and method names.

## Event Handler

An Event Handler subscribes to AGS events. Local testing options:

**Option A: Publish test events from AGS**

Trigger the relevant action in AGS (e.g. a match completing, a player leveling up). With your local event handler running and exposed via ngrok, AGS will route the event payload to your server.

**Option B: Send a mock event payload directly**

Construct a mock event payload matching the expected event schema and POST it to your local server. Check the app's README for the expected envelope format.

**Verify handler logic ran:**

Watch the log output for:
- Acknowledgment log lines (e.g. `event received`, `processing...`)
- Any business logic output your handler emits
- No `panic` or unhandled error lines

## Service Extension

A Service Extension exposes custom REST or gRPC endpoints. It's the most straightforward to test locally.

**REST (via docker compose):**

When running with `docker compose up`, the gRPC Gateway is typically exposed on port 8000. The Go template includes a Swagger UI:

```bash
# Check the app's Swagger UI (Go template example)
# http://localhost:8000/{base_path}/apidocs/

# Call a custom endpoint
curl -X POST http://localhost:8000/{base_path}/{your-endpoint} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -d '{"key": "value"}'
```

> **Note:** The standard Extend ports are `6565` (gRPC), `8000` (HTTP/REST gateway + Swagger, Service Extension only), and `8080` (Prometheus `/metrics`) — the same whether or not you run under Docker. Confirm against the `docker-compose.yaml` / `Dockerfile` in your app directory if in doubt. So `{grpc_port}` below is `6565`.

**gRPC (direct):**

```bash
grpcurl -plaintext localhost:{grpc_port} list
grpcurl -plaintext -d '{}' localhost:{grpc_port} {ServiceName}/{MethodName}
```

Check the app's proto files or Swagger spec (if generated) for available endpoints.

## Common Startup Failures

| Symptom | Likely Cause | Fix |
|---|---|---|
| `bind: address already in use` | Port 6565 (gRPC), 8000 (gateway), or 8080 (metrics) is occupied | `lsof -i :6565` (or `:8000` / `:8080`) to find the process, then kill it |
| `no such file or directory: main.go` | Running from wrong directory | `cd` into the app directory |
| `connection refused` (when calling gRPC) | Server not yet ready | Wait a moment and retry; check logs for the ready signal |
| `proto: not found` | Proto files not generated | Run `make proto` or the proto generation step in the app README |
| Crashes immediately with env error | Missing required `.env` variable | Check which variable is reported missing, set it in `.env` |
