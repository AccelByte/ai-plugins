---
last-verified: 2026-04-21
source: AccelByte Extend template READMEs
note: Commands are per the template repo README. Verify against the app's own README
  — templates may update startup steps.
sources:
- https://github.com/AccelByte/extend-service-extension-go
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[test-guide.md](test-guide.md)'
- '[templates.md](../init/templates.md)'
---

# Local Run Commands

How to start each Extend app type locally by language.

## Default Ports

| App Type | Default Local Ports |
|---|---|
| Override | 6565 (gRPC), 8080 (Prometheus `/metrics`) |
| Event Handler | 6565 (gRPC), 8080 (Prometheus `/metrics`) |
| Service Extension | 6565 (gRPC), 8000 (HTTP/REST gateway + Swagger), 8080 (Prometheus `/metrics`) |

These three ports are an Extend platform convention and are the same across all four languages (confirmed in every template's `Dockerfile` `EXPOSE` lines):

- **6565** — the gRPC server ("Plugin Arch gRPC Server Port"). This is where you point `grpcurl`.
- **8000** — the gRPC-Gateway HTTP server (REST proxy + Swagger UI), **Service Extension only**. This is where you `curl` REST endpoints and open `/apidocs/`. The REST paths sit under the app's base path (set by the `BASE_PATH` env var, e.g. `/guild`).
- **8080** — the Prometheus `/metrics` endpoint, present on every pattern. **It is not the app's gRPC or REST port** — a common source of "why doesn't my request work on :8080?" confusion.

**Ready signal:** watch the startup stream for the app binding those ports. Exact log wording varies by language and template version, so trust the port binding over a specific string. In the Go templates the relevant lines are `serving prometheus metrics` (`:8080`), `starting gRPC-Gateway HTTP server` (`:8000`, Service Extension), and `app server started`. There is no `gRPC server listening on :8080` line — if you're waiting for that, you'll wait forever.

## Override

### Go

Prerequisites: go 1.24+, docker (for integration tests only)

Startup command (from the app directory):
```bash
go run main.go
```

Ready: the gRPC server binds `:6565` and the metrics server comes up on `:8080`. Test gRPC with `grpcurl -plaintext localhost:6565 list`.

### Python

Prerequisites: python 3.10+, pip

Setup (first time):
```bash
pip install -r requirements.txt
```

Startup command:
```bash
python main.py
```

Ready: the gRPC server binds `[::]:6565`; metrics on `:8080`.

### Java

Prerequisites: JDK 17+

Startup command:
```bash
./gradlew run
```

Ready: the gRPC server binds `:6565`; metrics on `:8080`. (Spring Boot also logs a `Started … in` line.)

### C#

Prerequisites: .NET 8 SDK

Startup command:
```bash
dotnet run
```

Ready: the gRPC server binds `:6565`; metrics on `:8080`.

## Event Handler

Same commands as Override per language — the template structure is identical. Same ports: gRPC on `:6565`, metrics on `:8080`. No HTTP gateway (Event Handlers receive events over gRPC; they don't expose REST).

## Service Extension

Service Extension runs a gRPC server (`:6565`) plus an HTTP gateway (REST proxy + Swagger UI) on `:8000`, and the metrics server on `:8080`.

### Go

Startup command:
```bash
go run main.go
```

Ready: look for `starting gRPC-Gateway HTTP server` (`:8000`), `serving prometheus metrics` (`:8080`), and `app server started`. The gRPC server binds `:6565`.

Use port `8000` for REST calls (under the base path, e.g. `http://localhost:8000/guild/...`) and Swagger UI (`/apidocs/`); port `6565` for direct gRPC.

### Python / Java / C#

Same ports as Go — gRPC `:6565`, REST/Swagger gateway `:8000`, metrics `:8080` (confirmed in each template's `Dockerfile`). Startup commands per language follow the Override section. The exact ready-signal log line varies by language; rely on the port bindings.

## Environment Variables

The app reads from `.env` in its directory. Minimum required at runtime:

| Variable | Description |
|---|---|
| `AB_BASE_URL` | AGS base URL (e.g. `https://your-env.accelbyte.io`) — needed to call AGS APIs |
| `AB_NAMESPACE` | AGS namespace (e.g. `my-studio-dev`) |
| `AB_CLIENT_ID` | OAuth client ID — needed to call AGS APIs |
| `AB_CLIENT_SECRET` | OAuth client secret |

The app will start without these, but calls to AGS will fail.
