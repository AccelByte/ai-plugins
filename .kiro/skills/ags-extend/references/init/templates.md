---
last-verified: 2026-04-21
sources:
- https://github.com/AccelByte
- https://github.com/AccelByte/extend-service-extension-go
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[manifest-schema.md](manifest-schema.md)'
- '[resource-defaults.md](resource-defaults.md)'
---

# GitHub Templates

Official AccelByte open-source template repositories for each Extend pattern and language combination.

## Template URLs

| Type | Language | GitHub Repository |
|---|---|---|
| Override | Go | `AccelByte/extend-override-go` |
| Override | Python | `AccelByte/extend-override-python` |
| Override | Java | `AccelByte/extend-override-java` |
| Override | C# | `AccelByte/extend-override-csharp` |
| Event Handler | Go | `AccelByte/extend-event-handler-go` |
| Event Handler | Python | `AccelByte/extend-event-handler-python` |
| Event Handler | Java | `AccelByte/extend-event-handler-java` |
| Event Handler | C# | `AccelByte/extend-event-handler-csharp` |
| Service Extension | Go | `AccelByte/extend-service-extension-go` |
| Service Extension | Python | `AccelByte/extend-service-extension-python` |
| Service Extension | Java | `AccelByte/extend-service-extension-java` |
| Service Extension | C# | `AccelByte/extend-service-extension-csharp` |

Clone URL format: `https://github.com/{repository}`

## What Each Template Includes

- gRPC proto files (Override, Event Handler) or REST/gRPC Gateway boilerplate (Service Extension)
- `.env.template` with the environment variable keys required by the app
- `Dockerfile` for building the container image
- `Makefile` with build, test, and proto generation targets
- `docker-compose.yaml` for running the app locally with sidecars
- `.devcontainer/` config for VS Code / containerized development
- `.vscode/` settings for local development
- Proto generation script (e.g. `proto.sh` for Go)
- Built-in observability instrumentation (metrics, traces, logs)
- Demo/test files (e.g. Postman collections, Swagger UI)
- Basic README with getting-started, testing, and deployment steps

## Sample Apps Directory

Beyond starter templates, AccelByte maintains a directory of complete Extend sample apps:
https://accelbyte.github.io/extend-apps-directory/

Useful for reference implementations before or after scaffolding.
