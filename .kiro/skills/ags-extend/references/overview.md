---
last-verified: 2026-05-07
source: https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[glossary.md](glossary.md)'
- '[faq.md](faq.md)'
- '[first-app.md](tutorials/first-app.md)'
---

# AGS Extend

Extend is AccelByte's extensibility layer. It runs your custom backend code inside AGS's infrastructure, wired into AGS auth and events, so you can modify AGS behavior or add new services without operating your own cloud.

There are three core patterns plus a UI pattern. Everything else — deployment, observability, limits — is the same across the core patterns. The pattern choice determines how your code is invoked.

---

## Pattern: Extend Override

**What it does.** Replaces a specific decision inside an AGS service with your logic. AGS calls your gRPC method synchronously, waits for your response, then continues using what you returned.

**Architecture.** gRPC server. You implement a handful of methods defined by the AGS service's override proto. AGS routes its internal calls to you instead of its default implementation.

**Call shape.** Synchronous. AGS is blocked until you respond. Add latency carefully — whatever time your handler takes is time the AGS call takes.

**Concrete example — VIP matchmaking priority.**
A studio wants VIP players' matchmaking requests weighted higher in the queue. They clone `extend-override-go`, implement the `GetPriority` override: read `user_id` from the request, look up VIP tier in their own database, return a numeric priority boost. Every time AGS's matchmaking service evaluates a request, it calls their override, gets a priority, and uses it in the existing queue. No game client change — the client still calls `JoinMatchmaking` like before.

**Good fit when:**

- You need to change *how* an existing AGS service decides something.
- The change must be live before AGS returns to the caller.
- You don't need a new API surface — the game client already talks to AGS for this.

**Bad fit when:**

- The change is "also do X on the side" (use Event Handler instead — Override adds latency).
- AGS doesn't have an override point for that decision (check the Admin Portal; if there's no slot, Override isn't an option).
- You want to build a brand-new feature AGS doesn't cover (use Service Extension).

---

## Pattern: Extend Event Handler

**What it does.** Runs your code when AGS emits an event (match completed, entitlement granted, player banned, etc.). Delivered asynchronously via Kafka Connect — AGS fires the event and moves on without waiting.

**Architecture.** gRPC server receiving events on an `onMessage` method. AccelByte subscribes your handler to specific event types via manifest/Portal config.

**Call shape.** Asynchronous. AGS doesn't wait. Your handler can take seconds or minutes; AGS doesn't care. Failures don't block the AGS flow that fired the event.

**Concrete example — Discord notification on achievement.**
When a player earns a legendary achievement, the studio wants to post a message in their community Discord. They clone `extend-event-handler-go`, subscribe to the `Achievement.Unlocked` event, and in `onMessage` they check whether the achievement is `legendary_tier` and POST to a Discord webhook. AGS doesn't know or care what the handler does — the player's unlock flow returns instantly; the Discord message arrives whenever the handler processes the event.

**Good fit when:**

- You want to react to something AGS already broadcasts.
- The reaction doesn't need to happen before AGS returns to its caller.
- You might be integrating with an external system (webhooks, analytics, CRM).

**Bad fit when:**

- AGS needs the reaction to complete before continuing (use Override).
- The behavior has nothing to do with an AGS event (use Service Extension — a scheduled job or a new API).
- The event you want to react to isn't actually emitted by AGS (verify in the Admin Portal's event catalog; if it's not there, Event Handler can't help).

---

## Pattern: Extend Service Extension

**What it does.** Hosts an entirely new microservice on AccelByte infrastructure. Exposes REST endpoints (via gRPC Gateway) and/or raw gRPC. Has SDK access to call into other AGS services.

**Architecture.** gRPC server + gRPC Gateway. OpenAPI specs auto-generated. Deployed as a standalone app on AGS infra; game clients and other services call it directly via REST.

**Call shape.** Whatever you want. Synchronous REST, server-streaming gRPC, scheduled background work (via Task Scheduler add-on), pub/sub publishing (via Async Messaging add-on) — you own the endpoints and the call shape.

**Concrete example — custom guild crafting system.**
AGS doesn't have a guild-crafting feature. The studio clones `extend-service-extension-go`, defines REST endpoints (`POST /guild/{id}/craft`, `GET /guild/{id}/inventory`), backs them with a MongoDB collection (applied via the `nosql-go` patch in `references/patches/`), and uses the AGS SDK inside handlers to check guild membership against AGS's Guild service. Game clients call their service directly; AGS doesn't know crafting exists but the feature integrates with the rest of AGS by using the SDK.

**Good fit when:**

- AGS doesn't have the feature at all — you're adding new surface area.
- You want to own the API contract (endpoints, shapes, versioning).
- You need scheduled background work, database access, or external data integrations that don't fit Override / Event Handler.

**Bad fit when:**

- The feature is really "modify an existing AGS decision" (use Override — Service Extension won't intercept AGS calls).
- The feature is really "react to an AGS event" and no new API is needed (use Event Handler — Service Extension is heavier).
- You're running it *outside* AGS anyway (just build a normal backend — Extend's value is tight AGS integration, which you don't need).

---

## Pattern: Extend App UI

**What it does.** Builds custom web interfaces for your Extend apps and embeds them directly into the AGS Admin Portal. Instead of managing your Extend apps through Swagger docs or Postman, you can create purpose-built UIs that appear as menu items in the Admin Portal.

**Architecture.** Web frontend app hosted on AccelByte infrastructure. Renders inside the Admin Portal as a custom menu item.

**Good fit when:**

- You want operators or non-developer teammates to interact with your Extend app through a visual interface inside the Admin Portal.
- Your Service Extension has admin-facing workflows (content management, configuration, dashboards) that benefit from a dedicated UI.

**Bad fit when:**

- The feature is player-facing (players don't use the Admin Portal — use Service Extension REST endpoints and your game client).
- A few API calls are sufficient and no one needs a dedicated admin interface.

---

## Combining Patterns

Patterns compose. Common combos:

- **Override + Event Handler** — Override for real-time decision logic (e.g. matchmaking priority); Event Handler for post-hoc processing (e.g. granting rewards when the match ends).
- **Service Extension + Event Handler** — Service Extension owns a new API (e.g. leaderboard); Event Handler subscribes to events that keep the new API's data fresh (e.g. match-complete events updating scores).
- **Service Extension + Service Extension** — two Service Extensions in one project, one fronted by REST for clients and one internal that the first calls via gRPC.

Each combo is still N separate Extend apps. Each app is its own directory cloned from an AccelByte template; a multi-app project is just multiple of those directories side by side in one repo. There is no project-level manifest tying them together — each app's config (Dockerfile, `.env`, deploy flags) is local to its directory.

---

## How Each Pattern Connects to AGS

**Override** — Registered against a specific AGS service + override point in the Admin Portal. When the service reaches that point internally, it routes the call to your gRPC endpoint instead of running its default.

**Event Handler** — Subscribed to specific event types. AccelByte delivers matching events via Kafka Connect. No polling, no webhook setup, no retry loop to build — AccelByte's delivery layer handles it.

**Service Extension** — Standalone. It calls AGS APIs using the AGS SDK; credentials and token management are automatic. Game clients or other services call it directly via REST (or gRPC for internal callers).

In all three: service discovery, routing, and authentication between AGS and your code are managed by AccelByte. You write the logic; AccelByte runs the plumbing.

---

## Infrastructure

Extend apps run inside AccelByte's cloud, same network as AGS.

- Each namespace gets its own VM.
- Multiple Extend apps can deploy within the same namespace.
- You package as Docker; AccelByte handles compute, networking, scaling, uptime.
- Observability via Grafana Cloud (health, logs, metrics). Access via Admin Portal → app detail → Open Grafana Cloud.
- Dev Containers supported for containerized dev environments.

**Hard limits to know before you design:**

| Limit | Value | Why it matters |
|---|---|---|
| Images per app | 50 (Shared Cloud), 100 (Private Cloud) | Old images get pruned; don't rely on rolling back to an ancient one. |
| Log retention | 30 days | Anything older lives in whatever external sink you forward to. |
| Metrics retention | 13 months | Fine for SLO tracking; not enough for long-term trending — export. |
| Max HTTP request size | 4.5 MB | Large payloads need chunking or a signed URL upload pattern. |
| Override memory max | 2382 MB | See `references/init/resource-defaults.md` for the full table. |
| Override CPU max | 1415 m | Same. |
| Max replicas (any type) | 60 | Design for stateless horizontal scale up to this. |

---

## Supported Languages

Go, C#, Java, Python. AccelByte publishes open-source starter templates on GitHub per pattern × language; see `references/init/templates.md` for repo URLs.

Sample apps (full reference implementations beyond starter templates): https://accelbyte.github.io/extend-apps-directory/

---

## Pattern Selection — Decision Aid

| Your goal | Pattern |
|---|---|
| "Change how AGS decides X inside a call" | Override |
| "React when AGS event X fires" | Event Handler |
| "Build a feature AGS doesn't have" | Service Extension |
| "React to events AND expose new endpoints" | Service Extension + Event Handler |
| "Modify a decision AND schedule follow-up work" | Override + Event Handler, or Override + Service Extension |

**One-line tests (for pattern selection questions in `subskills/ask.md`):**

- "Does AGS need to wait for my logic before continuing?" — yes → Override; no → Event Handler or Service Extension.
- "Is AGS already firing an event I want to react to?" — yes → Event Handler; no → Service Extension.
- "Am I adding endpoints that clients or other services will call?" — yes → Service Extension.
