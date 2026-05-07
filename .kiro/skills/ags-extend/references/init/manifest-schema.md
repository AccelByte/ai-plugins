---
last-verified: 2026-05-07
status: design-proposal
sources:
- https://github.com/AccelByte/extend-helper-cli
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[templates.md](templates.md)'
- '[resource-defaults.md](resource-defaults.md)'
---

# extend-project.yaml Schema (DESIGN PROPOSAL — not yet implemented)

> **Status (2026-05-07):** No AccelByte tool currently reads or writes `extend-project.yaml`. `extend-helper-cli` operates on per-app inputs (Dockerfile + flags + env vars). Cloned templates (`extend-event-handler-go`, `extend-service-extension-go`, etc.) ship without any project-level manifest.
>
> This file documents a forward-looking schema for *eventual* tooling consolidation. **Do not generate `extend-project.yaml` from any subskill today.** Subskills that mention reading or writing it have stale guidance — fall back to per-app discovery (locate `Makefile` + `Dockerfile` in the working dir or one level up).
>
> Keep this file as a design reference for when the manifest-driven workflow ships.

The proposed `extend-project.yaml` manifest would live at the project root and describe the project and all its Extend apps so a single command could deploy, debug, or observe every app together.

## Full Schema with Annotations

```yaml
project:
  name: string         # Project name, kebab-case. Matches the project directory name.
  namespace: string    # AGS namespace this project targets (e.g. my-studio-prod)
  base_url: string     # AGS environment base URL (e.g. https://my-studio.accelbyte.io)

apps:
  - name: string       # App name, kebab-case. Matches its subdirectory name.
    type: string       # One of: override | event-handler | service-extension
    language: string   # One of: go | csharp | java | python
    path: string       # Relative path to the app directory (e.g. ./my-app)

    resources:
      cpu: integer     # millicores. See init-resource-defaults.md for starting values and hard limits.
      memory: integer  # MB. See init-resource-defaults.md for starting values and hard limits.
      replicas: integer # Starting replica count. Typically 1.

    infra:
      nosql_db: boolean  # true = this app needs Extend NoSQL Database. Closed alpha as of 2026-04.

    permissions:
      - string           # AGS permission strings required by this app. User fills in after scaffolding.
                         # Example: "ADMIN:NAMESPACE:{namespace}:USER:*:STATITEM [READ]"

    env:
      AB_CLIENT_ID: string      # OAuth client ID for this app. Fill in after creating the client in Admin Portal.
      AB_CLIENT_SECRET: string  # OAuth client secret. Keep out of version control.
      # Add additional app-specific environment variables here.

    secrets: {}  # Placeholder for secrets management. User fills in per deployment environment.
```

## Minimal Example — Single Override App

```yaml
project:
  name: vip-matchmaking
  namespace: my-studio-prod
  base_url: https://my-studio.accelbyte.io

apps:
  - name: matchmaking-override
    type: override
    language: go
    path: ./matchmaking-override
    resources:
      cpu: 250
      memory: 256
      replicas: 1
    infra:
      nosql_db: false
    permissions: []
    env:
      AB_CLIENT_ID: "<fill in>"
      AB_CLIENT_SECRET: "<fill in>"
    secrets: {}
```

## Multi-App Example

```yaml
project:
  name: vip-matchmaking
  namespace: my-studio-prod
  base_url: https://my-studio.accelbyte.io

apps:
  - name: matchmaking-override
    type: override
    language: go
    path: ./matchmaking-override
    resources:
      cpu: 250
      memory: 256
      replicas: 1
    infra:
      nosql_db: false
    permissions: []
    env:
      AB_CLIENT_ID: "<fill in>"
      AB_CLIENT_SECRET: "<fill in>"
    secrets: {}

  - name: match-event-handler
    type: event-handler
    language: go
    path: ./match-event-handler
    resources:
      cpu: 500
      memory: 512
      replicas: 1
    infra:
      nosql_db: false
    permissions: []
    env:
      AB_CLIENT_ID: "<fill in>"
      AB_CLIENT_SECRET: "<fill in>"
    secrets: {}
```

## Type Values

| Plan value | YAML value |
|---|---|
| Override | `override` |
| Event Handler | `event-handler` |
| Service Extension | `service-extension` |

## Language Values

| Language | YAML value |
|---|---|
| Go | `go` |
| C# | `csharp` |
| Java | `java` |
| Python | `python` |

## Placeholders for Unknown Values

Use `"TBD"` for namespace or base_url when the user doesn't have them yet. Use `"<fill in>"` for secrets and credentials. Never leave fields absent — always include every key.
