---
last-verified: 2026-05-07
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-task-scheduler/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-nosql-database/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-sql-database/
see-also:
- '[overview.md](overview.md)'
- '[faq.md](faq.md)'
---

# AGS Extend Glossary

Terms in one place so subskills can point at this file instead of redefining. All definitions are consistent with `overview.md` and `faq.md`; when in doubt those files are authoritative.

Terms are grouped by topic and listed in the order a developer usually encounters them.

---

## Core concepts

**AGS** — AccelByte Gaming Services. The platform Extend runs on top of.

**Extend** — AGS's extensibility layer. Lets you run custom backend code inside AGS infrastructure, integrated with AGS auth and events. Three core patterns: Override, Event Handler, Service Extension. Plus a UI pattern: Extend App UI.

**Extend app** — one deployable unit. An app maps to one pattern. A project can contain many apps.

**Extend project** — a directory containing one or more Extend app directories. Each app directory is its own clone of an AccelByte template (Dockerfile, Makefile, `.env`, source code). Multi-app projects are just multiple of those directories side by side in one repo. There is no project-level manifest file.

**Pattern** — one of the three core Extend shapes (Override, Event Handler, Service Extension) or the UI pattern (Extend App UI). The core pattern determines how your code is invoked; Extend App UI provides a custom Admin Portal interface for your apps.

**Namespace** — AGS's tenancy boundary. Your app is deployed to a specific namespace (commonly one per environment: dev, staging, prod). IAM clients, event subscriptions, and override registrations are all per-namespace.

**Admin Portal** — AccelByte's web UI for managing namespaces, IAM clients, Extend app config, override registration, event subscriptions, and environment variables. Many "production-only" steps happen here, not in code.

---

## The three patterns

**Override** — synchronous gRPC handler that replaces a specific decision inside an AGS service. AGS calls you, waits, uses your response. Latency you add is latency the caller sees.

**Event Handler** — asynchronous gRPC handler invoked when AGS emits an event. Delivered via Kafka Connect. AGS doesn't wait for you; failures don't block the AGS flow that fired the event.

**Service Extension** — standalone microservice hosted on AccelByte infrastructure. gRPC + gRPC Gateway (REST). You own the API contract. Uses the AGS SDK to call into other AGS services.

**Extend App UI** — custom web interface for an Extend app, embedded directly into the AGS Admin Portal as a menu item. Used for admin-facing workflows (content management, configuration dashboards). Not player-facing.

**Override point** — a named slot inside an AGS service where an Override can plug in (e.g. a priority-scoring step inside matchmaking). Override points are defined by AGS; you can only override where a slot exists.

**Event type** — a named AGS event an Event Handler can subscribe to (e.g. `Achievement.Unlocked`, `Match.Completed`). Event types are defined by AGS; you can only subscribe to what AGS actually emits.

---

## Code and contracts

**Proto / protobuf** — the `.proto` IDL file that defines gRPC message types and service methods. Comes from AGS (for Override + Event Handler) or from the template (for Service Extension).

**Generated code** (a.k.a. "pb files") — language-specific source produced from `.proto` by the proto toolchain. Never hand-edit — regenerate via `/ags-extend proto` (see `references/proto/workflow.md`).

**gRPC** — the RPC framework Extend apps expose. HTTP/2 + protobuf. Service Extensions also expose REST via gRPC Gateway.

**gRPC Gateway** — translates REST requests into gRPC calls. Auto-generated from proto annotations. Only Service Extensions expose REST; Override and Event Handler are gRPC-only.

**AGS SDK** — language-specific client library for calling AGS services from inside your Extend app (e.g. `accelbyte-go-sdk`). Authenticates automatically inside deployed apps.

**Extend SDK** — the server-side library an Extend app uses to wire itself into AGS (auth interceptors, event delivery, metrics). Separate package from the AGS SDK.

---

## Project layout

**`extend-project.yaml`** *(design proposal — not implemented)* — a hypothetical top-level manifest that would list every Extend app in a project and its config. No such file is consumed by `extend-helper-cli` or any AccelByte tooling today; project structure is per-app (one directory per app, each with its own Dockerfile and `.env`). See `references/init/manifest-schema.md` for the forward-looking design.

**`.env` / `.env.template`** — per-app environment file. `.env.template` is committed with placeholder values; `.env` is gitignored and holds real secrets (`AB_CLIENT_ID`, `AB_CLIENT_SECRET`, `AB_BASE_URL`, `AB_NAMESPACE`). Real secrets in production are injected through the Admin Portal, not the image.

**Permissions** — the OAuth permissions an app's IAM client needs to call the AGS APIs the app uses. Configured per-app on the OAuth client in the Admin Portal, or passed at deploy time via `extend-helper-cli` flags.

**Template** — a starter repo per pattern × language (e.g. `extend-override-go`). See `references/init/templates.md` for the full list.

**Patch** — a structured prompt in `references/patches/` that the wizard applies on top of a template to add optional integrations (e.g. NoSQL).

---

## CLI and deployment

**`extend-helper-cli`** — the official CLI for building, pushing, and deploying Extend apps. Binary release from GitHub (no package manager). Required before `deploy-app`. Install via `/ags-extend install-cli`. Authenticates via `AB_CLIENT_ID`, `AB_CLIENT_SECRET`, and `AB_BASE_URL` environment variables — there is no `login` subcommand.

**`image-upload`** — `extend-helper-cli` subcommand that builds the Docker image for an app and pushes it to AccelByte's image registry.


**`create-app`** — `extend-helper-cli` subcommand that creates a new Extend app in AGS.

**`get-app-info`** — `extend-helper-cli` subcommand that retrieves app metadata (status, repo URL, scenario).

**`deploy-app`** — `extend-helper-cli` subcommand that tells AGS to roll the pushed image to running replicas.

**`start-app` / `stop-app`** — `extend-helper-cli` subcommands to start or stop a deployed app without redeploying.

**`tunnel`** — `extend-helper-cli` subcommand that creates a secure tunnel to access NoSQL databases (DocumentDB) through a local port.

**Image registry** — AccelByte-hosted registry that `image-upload` targets. You don't manage it; the CLI does.

**Replica** — one running instance of an Extend app. AGS scales horizontally up to the replica ceiling (60 per app). Design stateless.

**Rollout / rolling update** — AGS brings up new replicas and drains old ones to keep the app continuously serving during deploy. No zero-downtime guarantee for Override during rollout (see `faq.md#does-a-new-deploy-mean-zero-downtime`).

**Rollback** — there is no one-command rollback. Redeploy a previously-pushed image tag, or checkout the previous commit and re-run `image-upload` + `deploy-app` (see `references/deploy/cli-commands.md`). Old images are retained up to the per-app image limit.

---

## Runtime states and observability

**App status** — high-level lifecycle label shown by `extend-helper-cli get-app-info --path /appStatus` (see `references/observe/cli-commands.md`) and in the Admin Portal:

- `Provisioning in progress` → `Undeployed` — app created, no image deployed yet.
- `Starting` → `Running` — replicas are up and health checks pass.
- `Degraded` — at least one replica is unhealthy; some traffic still served.
- `Stopping` → `Stopped` — no replicas serving.
- `Removing` → `Removed` — app deleted.

See `references/observe/signal-guide.md` for how to interpret each.

**Health check** — liveness/readiness probe AGS uses to decide whether to promote a replica. Failing health checks are the most common reason a deploy gets stuck.

**Grafana** — AccelByte-provided observability UI (Grafana Cloud). Logs, metrics, dashboards. Access via Admin Portal → app detail → Open Grafana Cloud. There is no CLI command for logs — Grafana is the primary interface.

**Signal** — any datapoint that tells you what the app is doing: log line, status field, metric, event delivery count. The "signal-guide" is about interpreting these.

---

## Infrastructure limits

**Image limit** — 50 images/app on Shared Cloud, 100 on Private Cloud. Old images get pruned.

**Log retention** — 30 days. Forward externally if you need more.

**Metrics retention** — 13 months. Export for multi-year trending.

**Max HTTP request size** — 4.5 MB. Use signed URLs for larger uploads.

**Resource limits** — per-app CPU and memory ceilings. Override and Service Extension go up to 1415m / 2382 MB; Event Handler caps lower (1215m / 1358 MB). Full table in `references/init/resource-defaults.md`.

**Replica ceiling** — 60 per app, any pattern.

---

## Identity and auth

**IAM client** — OAuth2 confidential client in the Admin Portal. Extend apps authenticate to AGS using client credentials (client ID + secret). Typically one client per app per namespace.

**Client credentials grant** — OAuth2 flow where the app exchanges client ID + secret for a short-lived access token. Token refresh is handled by the SDK.

**`AB_CLIENT_ID` / `AB_CLIENT_SECRET`** — the IAM client credentials. Local `.env` + production injected via Admin Portal.

**`AB_BASE_URL`** — the AGS environment's API root (e.g. `https://your-env.accelbyte.io`).

**`AB_NAMESPACE`** — the namespace the app runs in / talks to.

**Identity injection** — AGS automatically adds the caller's identity to every Extend call. Your handler can read it; you don't validate JWTs manually.

---

## Event delivery

**Kafka Connect** — AccelByte's delivery layer for events to Event Handlers. You don't operate it; you subscribe to event types and AccelByte pushes.

**Event subscription** — per-namespace config (in the Admin Portal) mapping event types to your Event Handler app. Not automatic across environments — configure in each namespace you want to receive events in.

**Idempotency** — the property that re-delivering the same event produces the same result. Event Handlers must be idempotent: Kafka Connect can deliver an event more than once. See `references/cookbook/idempotency.md`.

---

## Development environment

**Dev Container / `.devcontainer`** — VS Code / containerized dev environment config shipped in most templates. Optional.

**Sidecar** — a local-only supporting container (mongo, redis) brought up via `docker-compose.yml` for local dev. Production uses managed equivalents (DocumentDB, ElastiCache) with different connection strings and TLS requirements.

**MCP (Model Context Protocol)** — protocol used by AI IDEs to load external context. The two Extend MCP servers (`ags-api`, `ags-extend-sdk`) are optional; install via `/ags-extend install-mcp`.

**ngrok** — tunnel tool occasionally used to expose a local Override to AGS for testing. Free-tier URLs rotate; re-register the URL in the Admin Portal when they do, or pay for a reserved subdomain.

---

## Architecture terms

**Version skew** — the window during a rolling deploy where replicas running the old and new versions coexist. Design Override contracts to tolerate skew (additive field changes, backward-compatible defaults).

**Stateless** — handler does not store per-request data in memory across calls. Required for horizontal scale (any replica can handle any call).

**Critical path** — synchronous work that blocks the caller. Override is on the critical path of the AGS call that invokes it. Event Handler and Service Extension background tasks are not.

**Async Messaging add-on** (alpha) — AccelByte add-on for custom pub/sub messaging between Extend apps. Publishers (Service Extension) send messages via a gRPC sidecar on port 7474; consumers (Event Handler) receive via `OnMessage`. Proto definitions from `accelbyte-api-proto`. See `references/patches/am-go.md` and `references/patches/am-pub-go.md`.

**Task Scheduler add-on** (alpha) — AccelByte add-on that gives Service Extensions cron-based scheduled background jobs. Implements `OnJobTriggered` (bidirectional streaming) or `RunScheduledTask` (unary). Schedules configured via Admin Portal → App Details → Task Scheduler tab. See `references/patches/ts-go.md`.

**NoSQL Database add-on** (closed alpha) — AccelByte-managed Amazon DocumentDB (MongoDB-compatible) for Extend apps. Env vars: `DOCDB_HOST`, `DOCDB_DATABASE_NAME`, `DOCDB_USERNAME`, `DOCDB_PASSWORD`, `DOCDB_CA_CERT_FILE_PATH`. TLS required in production; `SetRetryWrites(false)` mandatory. Local dev uses plain MongoDB via docker-compose. Access via `extend-helper-cli tunnel`. See `references/patches/nosql-go.md`.

**SQL Database add-on** (preview) — AccelByte-managed Amazon Aurora PostgreSQL-compatible database for Extend apps. Env vars: `SQLDB_HOST`, `SQLDB_DATABASE_NAME`, `SQLDB_USERNAME`, `SQLDB_PASSWORD`, `SQLDB_CA_CERT_FILE_PATH`. TLS required in production. Local dev uses plain PostgreSQL via docker-compose. Access via `extend-helper-cli tunnel`. See `references/patches/sql-go.md`.

---

## Quick mental model

Read these one after the other for a first pass:

1. `overview.md` — what Extend is and the three patterns.
2. This glossary — terms as they appear.
3. `faq.md` — the judgment calls (when to use Extend vs. own backend, limits that bite, prod-vs-local gotchas).
4. `subskills/ask.md` — the skill that routes conceptual questions; pulls from all three.
