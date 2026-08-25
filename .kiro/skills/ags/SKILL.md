---
name: ags
description: "AccelByte Gaming Services (AGS) — managed game backend. Covers player auth (IAM), lobby, sessions, matchmaking, leaderboards, achievements, store, wallet, entitlements, analytics, social, and more. Default landing skill for any AccelByte question not pinned to ags-extend. Use whenever the user mentions AccelByte, AGS, IAM, OAuth clients, PCCU, namespaces, or any AGS module — even without saying 'AGS' explicitly."
---

# AGS

Single entry point for AccelByte Gaming Services — concept questions, namespace setup, SDK integration, Matchmaking, AMS, and the "where do I go next" decisions across the AccelByte product family. **This file is the single canonical AGS entry point and router.** It reads the user's invocation, picks exactly one workflow, capability router, or subskill, hands control to it, and otherwise stays out of the way.

Before running this skill, apply `accelbyte` when it is available.

Use the tool selection and fallback policy from `accelbyte` after routing to a subskill; do not redefine it here.

Never answer AGS concept questions, scaffold projects, run CLI commands, or describe Admin Portal flows from this file. All of that belongs inside a subskill, workflow, or capability router.

This is the single canonical AGS entry point. Do not decline deep Matchmaking or AMS work just because it is deep; route it inside this skill.

`/ags` owns AGS routing for core modules, Matchmaking, and AMS. Do not decline deep Matchmaking or AMS work just because it is deep. Route that work to the nested capability routers:

## Workspace Preflight

Before selecting a workflow, capability router, or subskill, run a shallow, read-only workspace fingerprint when a workspace is available. Use the workspace as the anchor for project-specific answers; use bundled references to interpret or fill gaps in that evidence.

1. Inspect the current directory and its ancestors for canonical project markers. If none are present, inspect only immediate child directories. Do not recursively inventory the repository.
2. Detect the project type from strong markers:
   - Unreal: `*.uproject`; then inspect `Config/DefaultEngine.ini`, project/plugin descriptors, and `Plugins/` only as needed.
   - Unity: `ProjectSettings/ProjectVersion.txt` with `Packages/manifest.json`; use `Packages/packages-lock.json` and `Library/PackageCache/com.accelbyte.unitysdk*` when available. `Assets/` alone is not sufficient evidence.
   - Godot: `project.godot`.
   - Roblox/Rojo: `*.project.json` or `default.project.json`, supported by `wally.toml` when present.
   - Web: `package.json` and its lockfile.
   - Custom engine or backend: a primary build/dependency manifest such as `CMakeLists.txt`, `go.mod`, `pyproject.toml`, or a language project file.
3. Record only the context relevant to routing and answering: project root, project type, engine version when available, AGS SDK family, declared SDK version, resolved SDK version, resolved local SDK source, AGS config locations, and caller type (`game client`, `game server`, `backend service`, `trusted tool`, `web app/admin UI`, or `unknown`). Infer caller type only from explicit user wording or project evidence.
4. For exact SDK class, method, signature, or code-example questions, inspect existing project usage and resolved local SDK source before bundled references or remote documentation. Prefer evidence in this order:
   `project code -> resolved local SDK source -> resolved package lock -> declared package manifest -> bundled AGS references -> official remote docs/source -> model memory`.
5. If declared and resolved SDK versions disagree, report the mismatch and use the resolved source that the project actually compiles when it is available.
6. Never print secrets found in SDK or OAuth configuration. Record only non-secret routing evidence unless the user's task explicitly requires a particular configuration value.

Skip only the parts that cannot apply: when no workspace is available, record that and route from the request; for product-only questions such as pricing or comparisons, stop after the cheap project-type check.

## Capability Routers

- Matchmaking-specific work → `capabilities/matchmaking/router.md`.
- AMS-specific work → `capabilities/ams/router.md`.

Two boundaries still leave this router:

- **Extend** (Override / Event Handler / Service Extension / App UI / custom gRPC handler deployment) → `/ags-extend`.
- **ADT** (build distribution, crash reporting, playtest tooling) → `/adt`. **A separate AccelByte product**, not under AGS. Originally BlackBox.

One peer skill also leaves this router, and it is not a product boundary: reviewing an AccelByte integration that already exists — scanning a repo for incomplete integrations, deprecated APIs, unsafe token handling or missing error paths, checking what an engine SDK upgrade would break, or checking whether one named AMS fleet or Extend app is sized right → `/teammate`. Handing over a document to keep — a technical design, a milestone plan, meeting notes, a postmortem — goes there too, and is the one thing it does that is not a review. `/ags` owns building and explaining AGS; `/teammate` owns reviewing what is already built and hands back a report.

## Required Maps

Use the maps when a request needs product, dependency, service-name, or migration context:

- `maps/capability-map.md`
- `maps/dependency-map.md`
- `maps/service-map.md`
- `maps/migration-map.md`

## Cross-Service Workflows

Use exactly one workflow when the request describes a cross-service player-facing outcome:

All AGS game integration requests default to player-facing game-flow planning. This includes single-module game requests such as `integrate login`, `wire auth`, `integrate device id login`, `integrate lobby`, `implement matchmaking`, `join session`, and `connect dedicated server`.

Smoke-only, backend-only, debug-only, doctor-only, SDK setup, and namespace setup are explicit exceptions.
Explicit nested capability invocations such as `/ags matchmaking ...`, `/ags ams ...`, backend-only ruleset/pool/region/backfill work, and backend-only fleet/upload/claim-key work route to the capability routers instead of the game-flow gate.

Matchmaking, Session, AMS, Statistics, and engine-specific references are supporting context for the approved Game Flow Plan. Do not route player-facing implementation requests directly to capability routers or module references before `workflows/online-game-flow.md` establishes the player-facing plan.

- `workflows/online-game-flow.md`

## Subskills

| #  | Subskill | Phase | Purpose | Depends on |
|----|---|---|---|---|
| 1  | `subskills/ask.md` | any | Concept questions: what AGS is, modules, deployment models, pricing shape, EOS/PlayFab comparisons | — |
| 2  | `subskills/explore.md` | any | Read-only walkthrough of an existing namespace's shape (modules in use, IAM clients, environments) | — |
| 3  | `subskills/wizard.md` | scaffold | Interview → pick modules + SDK + target platforms → produce a starter integration plan | — |
| 4  | `subskills/connect-portal.md` | scaffold | Bootstrap a namespace + IAM client + `.env` for a new project | wizard (typically) |
| 5  | `subskills/install-sdk.md` | scaffold | Detect the target SDK and install/scaffold Unreal, Unity, Godot, Roblox, Web SDK, or custom-engine REST fallback | wizard (typically) |
| 6  | `subskills/install-cli.md` | scaffold | Install the AGS CLI for namespace + IAM management | — |
| 7  | `subskills/install-mcp.md` | scaffold | Customize the AGS API MCP server URL after the plugin is installed (Public Cloud default / per-studio / Private Cloud). The MCP itself ships with the plugin. | — |
| 8  | `subskills/generate-ui.md` | build | Detect the game engine and route AGS UI generation to the engine-specific UI workflow; Unreal and Unity are supported | install-sdk |
| 9  | `subskills/init.md` | scaffold | Orchestrates wizard + connect-portal + install-sdk + install-cli + optional install-mcp | — |
| 10 | `subskills/integrate.md` | build | Module-by-module SDK integration guide (auth, lobby, matchmaking, store, etc.) | install-sdk |
| 11 | `subskills/debug.md` | build | Run a game locally against AGS and trace integration failures | install-sdk |
| 12 | `subskills/observe.md` | operate | Pull logs, metrics, and event signals from a deployed namespace | connect-portal |
| 13 | `subskills/doctor.md` | operate | Read-only symptom → likely cause diagnosis; hands off to the subskill that owns the fix | — |
| 14 | `subskills/handoff.md` | any | Decide when AGS isn't the right tool, when to add Extend or ADT, when to use the internal `/ags ams ...` capability, whether Access packaging fits, or whether AccelByte support is needed | — |
| 15 | `subskills/manage-permissions.md` | operate | Add, update, or delete IAM/OAuth client permissions on an existing client via the AGS CLI or AGS API MCP, under a confirmation gate | connect-portal (typically) |
| 16 | `subskills/run-workflow.md` | operate | Execute a registered AGS CLI workflow (e.g. `competitive-multiplayer`) via `ags workflow run`, always with `--ui fullscreen` | install-cli (typically) |
| 17 | `subskills/manage-resource.md` | operate | Create, update, or delete a single AGS backend resource (not a registered workflow, IAM permission, or onboarding step) via the generated AGS CLI service commands | install-cli (typically) |

Phases run roughly in order but loop (scaffold → build → operate → back to build). `ask`, `explore`, `doctor`, and `handoff` are phase-free: they answer questions or diagnose without mutating anything.

## Routing

<tool_usage_rules>

1. Run the Workspace Preflight above before routing. This bounded fingerprint is the only project inspection allowed before selecting a subskill.
2. Resolve the invocation to **exactly one** subskill using the decision procedure below, carrying the workspace context into that route.
3. Read that subskill file start to finish before taking any further action. Do not answer from memory of a subskill's contents — subskills change, and the file on disk is the source of truth.
4. Do not mix instructions across two subskills in one response. If a handoff is needed, finish the current subskill, then tell the user which one to invoke next.
5. If the user's message spans multiple phases ("set up a namespace and integrate auth"), route to the earliest phase and announce the later step; do not auto-chain into the next subskill.
6. Before starting any routed work that will rely on a live AGS namespace through the AGS API MCP server or AGS CLI, run the cheapest read-only auth freshness check for that tool:
   - MCP path: call a lightweight read-only MCP tool first, such as capability discovery or a harmless search/describe/read operation. If it reports expired auth, unauthenticated, login required, consent required, or re-auth needed, stop and ask the user to re-authenticate/reload the MCP server before doing more work.
   - CLI path: run `ags auth status` before other AGS CLI commands. If the session is expired, unauthenticated, or pointed at the wrong profile/portal, stop and ask the user to run `ags auth login` or select the correct profile before continuing.
   - Skip this for conceptual/local-only answers that do not need live AGS data, and say live verification was not required when relevant.
7. Use only the tools listed in frontmatter. Subskills may further restrict; respect their restrictions.

</tool_usage_rules>

### Authorization preflight gate

For any IAM client, OAuth client, permission, permission group, `groupId`, resource/action, role, scope, `401`, `403`, `insufficient_permission`, or forbidden-call question, the selected workflow or subskill must read `references/security/iam-authorization-preflight.md` before answering. This is a cross-cutting rule, not a separate subskill.

Environment detection controls the answer format. Public Cloud answers must use the module / group / `groupId` / action shape. Private Cloud / BYOC answers use the discovered resource/action string as the final permission. If the environment cannot be identified from project config, AGS CLI profile/config, or the permission catalog behavior, report it as unknown and name the missing evidence instead of choosing a Public Cloud group.

### Decision procedure

Apply these checks in order. Stop at the first match.

1. **Is the message about Extend implementation or deployment specifically?** (Override, Event Handler, Service Extension, gRPC interceptor, App UI, `extend-helper-cli`, deploying a custom backend service, the Extend Apps Directory, custom match functions, custom Matchmaking gRPC handlers, **the Extend SDKs — Go, Python, C#, or Java**.) → Point at `/ags-extend`. Do not route here. "Should I add Extend?" decisions route to `subskills/handoff.md` below.
2. **Is the message about ADT operations specifically?** (Build distribution, Smart Builds, crash reporting, crash video replay, playtest scheduling, ADT Hub, ADT CLI, ADT SDKs, BlackBox.) → Point at `/adt`. ADT is a separate AccelByte product with its own skill. "Should I add ADT?" decisions route to `subskills/handoff.md` below.
3. **Is the message off-topic?** (Generic backend / cloud advice with no AccelByte tie, unrelated programming help, non-AccelByte products like Pragma / PlayFab when asked about *their* internals.) → Use the off-topic response below. Do not route.
4. **Is the message empty or only `/ags`?** → Ask the disambiguation question (below). Do not route yet.
5. **Is the message explicitly scoped to nested Matchmaking capability work?** (Capability-router prefix `/ags matchmaking ...` or `matchmaking ...`; backend-only ruleset design, pool creation, pool tuning, MMR formulae, ticket lifecycle, region routing, backfill, X-Ray, debugging why matches are not forming, scoring algorithms.) → Read `capabilities/matchmaking/router.md`. If the user asks to implement player-facing matchmaking in a game without a capability-router prefix or backend-only scope, continue to the game-integration check.
6. **Is the message explicitly scoped to nested AMS capability work?** (Capability-router prefix `/ags ams ...` or `ams ...`; backend-only fleet configuration, warmed pool sizing, regional fleet rollout, dedicated-server binary upload, watchdog tuning, AMS Simulator, claim keys, AMS-specific debugging.) → Read `capabilities/ams/router.md`. If the user asks to connect a game to a dedicated server through a player-facing flow without a capability-router prefix or backend-only scope, continue to the game-integration check.
7. **Is the message explicitly about running or executing a registered AGS CLI workflow** ("run workflow", "execute workflow", "ags workflow", "ags workflow run", a named workflow id like "competitive-multiplayer", or "configure/set up <feature> workflow" where the intent is CLI-driven backend scaffolding rather than full player-facing game integration)? → Route to `subskills/run-workflow.md`. This is distinct from the game-integration check below: `run-workflow` only executes the CLI's `ags workflow run` scaffolding, while game integration plans and wires actual game code. If the phrasing is ambiguous between the two ("configure matchmaking workflow on AGS" could mean either), ask the user which one they want before routing.
8. **Is the message about creating, updating, or deleting a single AGS backend resource via the CLI, where the intent is admin/ops backend configuration rather than player-facing game-code wiring?** Shaped like "create/update/delete a `<resource>`" (e.g. "create a statistic configuration", "create a leaderboard config", "delete a store item", "update a platform item") where `<resource>` is an AGS backend object exposed by a generated `ags <service> <resource> <method>` CLI command, and the request is not: a registered multi-step workflow (step 7), an IAM/OAuth client permission (the permission-shaped check below), or namespace/IAM-client/login-method onboarding (cue table → `connect-portal.md`). → Route to `subskills/manage-resource.md`. This is a **shape-based check** — "create/update/delete a single backend resource" — not a name-by-name enumeration of every resource type; do not hardcode this skill's cue table with every AGS resource noun (stats, leaderboards, items, ...). The distinguishing signal against the game-integration check directly below: this step is for standalone backend resource configuration with no player-facing code wiring implied ("create a stat config" is just data, not a feature); the next step is for requests that describe wiring that resource into actual game behavior ("implement statistics", "wire stats into the game", "hook up the leaderboard widget" — these imply game-code integration work, route there instead even though they also touch a backend resource). If a request plausibly wants both ("create a stat config and wire it into my game"), route to this step first for the backend piece and tell the user `/ags integrate` (or `workflows/online-game-flow.md`, if it's part of a larger game-integration ask) is the follow-up for the wiring — do not silently chain.
9. **Is the message about AGS game integration or a cross-service player-facing outcome?** Pick exactly one workflow:
   All AGS game integration requests default to player-facing game-flow planning. Route `integrate login`, `wire auth`, `integrate device id login`, `integrate lobby`, `implement matchmaking`, `join session`, and `connect dedicated server` to `workflows/online-game-flow.md`. If the user explicitly requests smoke-only/module-only verification or a non-game integration, route to `subskills/integrate.md` instead.

   - Skill-based matchmaking, MMR-driven queues, or rank/stat inputs in a game implementation -> `workflows/online-game-flow.md` first; after the Game Flow Plan is approved, use `references/modules/statistics.md` plus `capabilities/matchmaking/router.md` as supporting context.
   - Matchmaking that must allocate or claim dedicated servers through AMS in a game implementation -> `workflows/online-game-flow.md` first; after the Game Flow Plan is approved, coordinate `capabilities/matchmaking/router.md`, `capabilities/ams/router.md`, and `references/modules/session.md`.
   - P2P quick match, listen-server match flow, TURN/STUN/WebRTC connectivity, or no dedicated server allocation in a game implementation -> `workflows/online-game-flow.md` first; after the Game Flow Plan is approved, coordinate `capabilities/matchmaking/router.md`, `references/modules/session.md`, and `references/modules/turn-stun-p2p.md`.
   - Login -> matchmaking -> session/DS travel, Play Online, online play end-to-end, or "make the game join a dedicated server through the UI" → `workflows/online-game-flow.md`.
10. **Is the message a decision about adding or leaving AGS capability scope?** ("should I add Extend", "should I add ADT", "should I add AMS", "should I use Access", "should I move to Private Cloud", "is AGS right for this", "is AGS even right", "do I need AMS", "do I need Extend".) → Route to `subskills/handoff.md`. This check runs before generic conceptual `ask`.
11. **Is there a direct subskill cue?** (Table below.) → Route to that subskill.
12. **Is the message permission-shaped?** ("what permission", "which permission", "client permission", "OAuth permission", "IAM permission", "permission group", `groupId`, "resource/action", "scope", `401`, `403`, `insufficient_permission`, "forbidden".) Split by intent, and apply the Authorization preflight gate above before answering or mutating:
    - **Change request** — add, grant, give, remove, revoke, delete, edit, update, change, configure, set, or assign a permission / scope / permission group on an *existing* IAM or OAuth client → Route to `subskills/manage-permissions.md`.
    - **Question or diagnosis** — "what/which permission", a `401`/`403`/forbidden failure, or any other read-only permission question → Route to `subskills/ask.md`.
13. **Is the message conceptual** ("what", "how does", "which module", "should I use" after the handoff decisions above, "vs", "compared to")? → Route to `subskills/ask.md`.
14. **Does the message span multiple phases?** → Route to the earliest phase; announce the later steps as follow-ups.
15. **No match** → Ask the disambiguation question.

   Note on SDKs — AGS has three SDK families:
   - **Game Engine SDKs** (Unreal, Unity, Godot, Roblox) — game clients/servers. Owned by `/ags`.
   - **TypeScript Web SDK** — standalone; for web apps that talk to AGS (admin tools, web companion apps, browser-based dashboards). Owned by `/ags`.
   - **Extend SDKs** (Go, Python, C#, Java) — libraries Extend apps use. Owned by `/ags-extend`.

   If the user says "Go SDK", "Python SDK", "C# SDK", or "Java SDK" in an AccelByte context, that's an Extend SDK question — redirect to `/ags-extend`. Anything else (Unreal/Unity/Godot/Roblox/TypeScript) stays here.

### Cue table

First match wins. Cues are case-insensitive substring matches unless noted.

| Cue | Route |
|---|---|
| "check my integration", "health check", "review my AccelByte integration", "scan my repo", "any deprecated APIs", "am I using deprecated", "what breaks if we upgrade", "upgrade check", "is this fleet sized right", "is this app over-provisioned", "remember this design", "ingest our plan", "add these notes to memory" | `/teammate` — leaves this skill, see the redirect below |
| `handoff`, "should I add Extend", "should I add ADT", "should I add AMS", "should I use Access", "should I move to private cloud", "do I need AMS", "is AGS even right", "is AGS right for this" | `subskills/handoff.md` |
| `manage-permissions`, "add permission", "grant permission", "remove permission", "revoke permission", "delete permission", "edit permission", "update permission", "change permission", "configure permission", "set permission", "assign permission", "grant scope", "add scope", "edit client permissions", "update client permissions", "manage permissions" | `subskills/manage-permissions.md` with `references/security/iam-authorization-preflight.md` |
| "what permission", "which permission", "client permission", "OAuth permission", "IAM permission", "permission group", `groupId`, "resource/action", "scope", `401`, `403`, `insufficient_permission`, "forbidden" | `subskills/ask.md` with `references/security/iam-authorization-preflight.md` |
| `ask`, "what is", "what does AGS", "which module", "how does", "should I use" without an add / leave-scope decision, "vs", "compared to", "explain" | `subskills/ask.md` |
| `explore`, "what's in my namespace", "show me my setup", "what modules am I using", "which clients exist" | `subskills/explore.md` |
| `init`, "set up everything", "from scratch", "bootstrap", "start a new AGS project", "new namespace from zero" | `subskills/init.md` |
| `wizard`, "new project" (without "set up everything"), "start a project", "scaffold", "which modules do I need" | `subskills/wizard.md` |
| `connect-portal`, "create a namespace", "create an IAM client", "oauth client", "bootstrap portal", ".env" | `subskills/connect-portal.md` |
| `generate-ui`, "generate AGS UI", "generate widget blueprint", "create widget blueprint", "create tab view", "create leaderboard widget", "create leaderboard list", "create friends screen", "create friends list widget", "create achievements widget", "patch widget blueprint", "UMG generator", "build UMG widget", "build game UI" | `subskills/generate-ui.md` |
| `install-sdk`, "install the SDK", "add AGS to Unreal", "Unreal SDK", "Unreal OSS", "OnlineSubsystemAccelByte", "AccelByteUe4Sdk", "add AGS to Unity", "Unity SDK", "Unity Package Manager", "accelbyte-unity-sdk", "accelbyte-unity-networking", "Godot SDK", "Roblox SDK", "TypeScript SDK", "TS SDK", "Web SDK", "Game Engine SDK", "AGS SDK" (in a game-project or web-app context) | `subskills/install-sdk.md` |
| `install-cli`, "AGS CLI", "AccelByte CLI", "install cli" (without "extend-helper" qualifier) | `subskills/install-cli.md` |
| `install-mcp`, "mcp setup", "mcp server", "hook up ides", IDE name + "mcp" | `subskills/install-mcp.md` |
| `integrate`, "wire up auth", "integrate lobby", "implement matchmaking", "hook up the store", "implement statistics", "wire statistics", "implement leaderboards" | `workflows/online-game-flow.md` (see step 9) |
| `run-workflow`, "run workflow", "execute workflow", "ags workflow run", "ags workflow", "competitive multiplayer workflow", "competitive-multiplayer" | `subskills/run-workflow.md` (see step 7) |
| `manage-resource`, "create a statistic configuration", "create a leaderboard config", "delete a store item", "update a platform item", "create stats config", "create leaderboard configuration" | `subskills/manage-resource.md` (see step 8) |
| `debug`, "run locally", "test against AGS", "auth is failing", "I get a 401", "lobby keeps disconnecting" | `subskills/debug.md` |
| `observe`, "logs", "metrics", "live status", "PCCU dashboard", "events firing", "pccu", "production traffic" | `subskills/observe.md` |
| `doctor`, "diagnose", "what's wrong", "something is off", "not sure what's broken", "help me narrow this down" | `subskills/doctor.md` |

### Disambiguation prompt

Use verbatim when no cue matches and the user hasn't typed anything specific:

> I can help across the AccelByte Gaming Services lifecycle:
> • **ask** — what AGS is, which modules, how it compares
> • **explore** — read-only walkthrough of a namespace
> • **init** — set up a namespace + SDK + CLI from scratch
> • **wizard** — pick the modules and SDK for a new project
> • **integrate** — wire up auth, lobby, matchmaking, store, etc.
> • **debug** — run a game locally against AGS and trace failures
> • **observe** — logs, metrics, and events from a live namespace
> • **doctor** — read-only diagnosis when something's off
> • **handoff** — decide when to add Extend or ADT, use `/ags ams ...`, use Access packaging, or change deployment model
>
> Which one? (Or describe the symptom / goal and I'll pick.)

Then wait for the user's reply. Do not guess.

### Chained intents

When the user describes multiple phases in one message:

- "Bootstrap a namespace and integrate auth" → route to `init` (scaffold phase). After it finishes, tell the user: "Run `/ags integrate` for the auth wiring next."
- "Set up the SDK and run it locally" → route to `install-sdk` first, then point at `debug`.
- "It's broken — figure out what and fix it" → route to `doctor` first, then point at whatever subskill owns the fix (`debug`, `connect-portal`, `integrate`).
- "Why is auth failing in prod and how do I roll back" → route to `observe` first (diagnose), then point at `connect-portal` or `integrate` for the fix.
- "Should I add AMS, and if so, how?" → route to `handoff` first (decide), then point at `/ags ams ...` if AMS is the right answer.
- "Should I add Extend, and if so, how?" → route to `handoff` first (decide), then point at `/ags-extend ask` if Extend is the right answer.

Never invoke a second subskill automatically. The user should see one subskill run per invocation so they can stop if something goes wrong mid-chain.

### Off-topic response

Use when the message isn't about AGS or the AccelByte family:

> This skill covers AccelByte Gaming Services (AGS) and the surrounding AccelByte product family. For generic backend / cloud advice unrelated to AccelByte, or for products outside AccelByte's portfolio, I'm not the right tool. The AccelByte docs (`https://docs.accelbyte.io/`) or AccelByte support are better starting points. I won't route to a subskill for this.

### Extend redirect

Use when the message is clearly about Extend:

> That's an Extend-specific question — Override, Event Handler, Service Extension, App UI, deploying custom backend services, or the `extend-helper-cli`. Run `/ags-extend` to invoke the Extend skill. It owns that lifecycle end-to-end. (`/ags` knows Extend exists and where it fits, but doesn't own its workflow.)

### ADT redirect

Use when the message is about ADT (build distribution, crash reporting, playtest tooling, BlackBox):

> That's an ADT question — build distribution, crash reporting, crash video replay, or playtest tooling. ADT is a separate AccelByte product with its own skill. Run `/adt` to invoke it. (`/ags` routes "should I add ADT?" decisions through `subskills/handoff.md`, but ADT's actual workflows live in `/adt`.)

### Teammate redirect

Use when the message asks for a review of an integration that already exists rather than help building one:

> That's a job for the AccelByte teammate — it scans an AccelByte-integrated repo and reports back on incomplete integrations, deprecated APIs, unsafe token handling and missing error paths, tells you what an engine SDK upgrade would break, and checks whether a named AMS fleet or Extend app is sized right. It will also keep a design, a plan or a postmortem you hand it in your studio's own memory, so a later run can read what the team decided. Run `/teammate` to invoke it. (`/ags` still owns building and explaining AGS, so come back here for "how do I add X".)

### When subskills conflict

If the user's follow-up inside a running subskill clearly belongs to a different subskill (e.g. during `integrate`, they ask "actually, what's the difference between Lobby and Session Management?"), finish answering the narrow question if it's a one-sentence sidebar, or stop the current subskill and say:

> That's an `ask` question. Stop here and run `/ags ask` to go deeper, or tell me to continue `integrate`.

## What this file does NOT do

- **Does not explain AGS modules.** That's `ask`.
- **Does not run any CLI commands or write project files.** Those live in `wizard`, `connect-portal`, `install-sdk`, `install-cli`, `integrate`, `debug`, `run-workflow`.
- **Does not read references directly.** Subskills, workflows, capability routers, and maps own their own reading.
- **Does not own the Extend lifecycle.** That's `/ags-extend`.
- **Does not review an integration that already exists.** A repo scan, an SDK-upgrade break check, or a fleet/app sizing check is `/teammate`. `subskills/doctor.md` diagnoses a symptom you already have; `/teammate` goes looking for the ones you don't.
- **Does not let module wiring define product completion.** `workflows/online-game-flow.md` owns the Game Flow Plan, and `subskills/integrate.md` is the module-wiring helper for game projects.
- **Does not carry state across invocations.** Each `/ags` call is fresh; the only state is what's on disk (namespace `.env`, SDK config, etc.), and the relevant subskill reads it.
