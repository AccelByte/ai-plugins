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

| App Type | Default Local Port |
|---|---|
| Override | 8080 (gRPC) |
| Event Handler | 8080 (gRPC) |
| Service Extension | 8080 (gRPC) + 8081 (HTTP gateway) |

## Override

### Go

Prerequisites: go 1.24+, docker (for integration tests only)

Startup command (from the app directory):
```bash
go run main.go
```

Ready signal in logs:
```
gRPC server listening on :8080
```

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

Ready signal:
```
gRPC server listening on [::]:8080
```

### Java

Prerequisites: JDK 17+

Startup command:
```bash
./gradlew run
```

Ready signal:
```
Started Application in
```

### C#

Prerequisites: .NET 8 SDK

Startup command:
```bash
dotnet run
```

Ready signal:
```
Now listening on:
```

## Event Handler

Same commands as Override per language — the template structure is identical. Uses the same default port (8080).

## Service Extension

Service Extension runs two servers: a gRPC server and an HTTP gateway (REST proxy).

### Go

Startup command:
```bash
go run main.go
```

Ready signals:
```
gRPC server listening on :8080
HTTP gateway listening on :8081
```

Use port 8081 for REST calls, port 8080 for direct gRPC.

### Python / Java / C#

Same pattern as Go — see the Override section per language. Service Extension templates typically export both ports.

## Environment Variables

The app reads from `.env` in its directory. Minimum required at runtime:

| Variable | Description |
|---|---|
| `AB_BASE_URL` | AGS base URL (e.g. `https://your-env.accelbyte.io`) — needed to call AGS APIs |
| `AB_NAMESPACE` | AGS namespace (e.g. `my-studio-dev`) |
| `AB_CLIENT_ID` | OAuth client ID — needed to call AGS APIs |
| `AB_CLIENT_SECRET` | OAuth client secret |

The app will start without these, but calls to AGS will fail.
