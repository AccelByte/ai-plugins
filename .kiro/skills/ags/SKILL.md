---
name: ags
description: "AccelByte Gaming Services (AGS) — managed game backend. Covers player auth (IAM), lobby, sessions, matchmaking, leaderboards, achievements, store, wallet, entitlements, analytics, social, and more. Default landing skill for any AccelByte question not pinned to ags-extend. Use whenever the user mentions AccelByte, AGS, IAM, OAuth clients, PCCU, namespaces, or any AGS module — even without saying 'AGS' explicitly."
---

# AGS

Single entry point for AccelByte Gaming Services — concept questions, namespace setup, SDK integration, and the "where do I go next" decisions across the AccelByte product family. **This file is a router.** It reads the user's invocation, picks exactly one subskill, hands control to it, and otherwise stays out of the way.

Never answer AGS concept questions, scaffold projects, run CLI commands, or describe Admin Portal flows from this file. All of that belongs inside a subskill.

Four areas are deep enough to live in their own peer skills. Hand off rather than answering yourself:

- **Extend** (Override / Event Handler / Service Extension / App UI) → `/ags-extend`. Architecturally part of AGS; gets its own skill because the Extend lifecycle is deep enough to warrant one (scaffold, deploy, debug, observe).
- **AMS** beyond the basic concept (fleet configuration, server binary upload, watchdog tuning, regional rollout, dedicated-server lifecycle) → `/ags-ams`. Architecturally part of AGS; gets its own skill because AMS operations are deep enough to warrant one.
- **Matchmaking** beyond the basic concept (rule design, MMR, ticket lifecycle, ruleset tuning, region routing logic, debugging match formation) → `/ags-matchmaking`. Architecturally part of AGS; gets its own skill because matchmaking has enough surface area to warrant a dedicated lifecycle.
- **ADT** (build distribution, crash reporting, playtest tooling) → `/adt`. **A separate AccelByte product**, not under AGS. Originally BlackBox.

`/ags` knows all four exist and where they fit, and handles "what is X?" at a conceptual level — but the real workflows live in those peer skills.

A note on architecture: Extend, AMS, and Matchmaking are all *part of* AGS, not separate products. They get peer skills because of lifecycle depth, not because they're separate products. ADT is the only true separate product among the four.

## Subskills

| #  | Subskill | Phase | Purpose | Depends on |
|----|---|---|---|---|
| 1  | `subskills/ask.md` | any | Concept questions: what AGS is, modules, deployment models, pricing shape, EOS/PlayFab comparisons | — |
| 2  | `subskills/explore.md` | any | Read-only walkthrough of an existing namespace's shape (modules in use, IAM clients, environments) | — |
| 3  | `subskills/wizard.md` | scaffold | Interview → pick modules + SDK + target platforms → produce a starter integration plan | — |
| 4  | `subskills/connect-portal.md` | scaffold | Bootstrap a namespace + IAM client + `.env` for a new project | wizard (typically) |
| 5  | `subskills/install-sdk.md` | scaffold | Detect the target SDK and route to the right installer; still owns Godot, Roblox, Web SDK, and custom-engine REST fallback | wizard (typically) |
| 6  | `subskills/install-unreal-sdk.md` | scaffold | Install/scaffold the AGS Unreal plugin set: OnlineSubsystemAccelByte, AccelByteUe4Sdk, and AccelByteNetworkUtilities | wizard / install-sdk |
| 7  | `subskills/install-unity-sdk.md` | scaffold | Install/scaffold AGS Unity SDK packages through Unity Package Manager Git URLs | wizard / install-sdk |
| 8  | `subskills/install-cli.md` | scaffold | Install the AGS CLI for namespace + IAM management | — |
| 9  | `subskills/install-mcp.md` | scaffold | Customize the AGS API MCP server URL after the plugin is installed (Shared Cloud default / per-studio / Private Cloud). The MCP itself ships with the plugin. | — |
| 10 | `subskills/install-widget-blueprint-generator.md` | scaffold | Install the Unreal WidgetBlueprintGenerator editor plugin supplied by the Unreal SDK MCP server | install-mcp + install-unreal-sdk (typically) |
| 11 | `subskills/init.md` | scaffold | Orchestrates wizard + connect-portal + install-sdk + install-cli + optional install-mcp | — |
| 12 | `subskills/integrate.md` | build | Module-by-module SDK integration guide (auth, lobby, matchmaking, store, etc.) | install-sdk |
| 13 | `subskills/debug.md` | build | Run a game locally against AGS and trace integration failures | install-sdk |
| 14 | `subskills/observe.md` | operate | Pull logs, metrics, and event signals from a deployed namespace | connect-portal |
| 15 | `subskills/doctor.md` | operate | Read-only symptom → likely cause diagnosis; hands off to the subskill that owns the fix | — |
| 16 | `subskills/handoff.md` | any | Decide when AGS isn't the right tool — route to `ags-extend`, AMS, ADT, Access, or AccelByte support | — |

Phases run roughly in order but loop (scaffold → build → operate → back to build). `ask`, `explore`, `doctor`, and `handoff` are phase-free: they answer questions or diagnose without mutating anything.

## Routing

<tool_usage_rules>

1. Resolve the invocation to **exactly one** subskill using the decision procedure below.
2. Read that subskill file start to finish before taking any action. Do not answer from memory of a subskill's contents — subskills change, and the file on disk is the source of truth.
3. Do not mix instructions across two subskills in one response. If a handoff is needed, finish the current subskill, then tell the user which one to invoke next.
4. If the user's message spans multiple phases ("set up a namespace and integrate auth"), route to the earliest phase and announce the next step; do not auto-chain into the next subskill.
5. Use only the tools listed in frontmatter. Subskills may further restrict; respect their restrictions.

</tool_usage_rules>

### Decision procedure

Apply these checks in order. Stop at the first match.

1. **Is the message about Extend specifically?** (Override, Event Handler, Service Extension, gRPC interceptor, App UI, `extend-helper-cli`, deploying a custom backend service, the Extend Apps Directory, **the Extend SDKs — Go, Python, C#, or Java**.) → Decline and point at `/ags-extend`. Do not route here.
2. **Is the message about deep AMS work?** (Fleet configuration, warmed pool sizing, regional fleet rollout, dedicated-server binary upload, watchdog tuning, AMS-specific debugging.) → Decline and point at `/ags-ams`. Conceptual AMS questions ("what is AMS?", "should I add AMS?") stay here in `ask` / `handoff`.
3. **Is the message about deep matchmaking work?** (Designing rule sets, tuning MMR formulae, region routing logic, ticket lifecycle internals, debugging why matches aren't forming, scoring algorithms.) → Decline and point at `/ags-matchmaking`. Conceptual matchmaking questions ("what is matchmaking?", "how does AGS matchmaking work at a high level?") stay here in `ask`.
4. **Is the message about ADT?** (Build distribution, Smart Builds, crash reporting, crash video replay, playtest scheduling, ADT Hub, ADT CLI, ADT SDKs, BlackBox.) → Decline and point at `/adt`. ADT is a separate AccelByte product with its own skill. Conceptual "what is ADT?" or "should I add ADT?" questions can stay here in `ask` / `handoff`.

   Note on SDKs — AGS has three SDK families:
   - **Game Engine SDKs** (Unreal, Unity, Godot, Roblox) — game clients/servers. Owned by `/ags`.
   - **TypeScript Web SDK** — standalone; for web apps that talk to AGS (admin tools, web companion apps, browser-based dashboards). Owned by `/ags`.
   - **Extend SDKs** (Go, Python, C#, Java) — libraries Extend apps use. Owned by `/ags-extend`.

   If the user says "Go SDK", "Python SDK", "C# SDK", or "Java SDK" in an AccelByte context, that's an Extend SDK question — redirect to `/ags-extend`. Anything else (Unreal/Unity/Godot/Roblox/TypeScript) stays here.
5. **Is the message off-topic?** (Generic backend / cloud advice with no AccelByte tie, unrelated programming help, non-AccelByte products like Pragma / PlayFab when asked about *their* internals.) → Decline with the off-topic response (below). Do not route.
6. **Is the message empty or only `/ags`?** → Ask the disambiguation question (below). Do not route yet.
7. **Is there a direct subskill cue?** (Table below.) → Route to that subskill.
8. **Is the message conceptual** ("what", "how does", "which module", "should I", "vs", "compared to")? → Route to `ask`.
9. **Is the message an "is AGS even right for this?" / "should I add AMS / ADT / Extend?" question?** → Route to `handoff`.
10. **Does the message span multiple phases?** → Route to the earliest phase; announce the later steps as follow-ups.
11. **No match** → Ask the disambiguation question.

### Cue table

First match wins. Cues are case-insensitive substring matches unless noted.

| Cue | Route |
|---|---|
| `ask`, "what is", "what does AGS", "which module", "how does", "should I use", "vs", "compared to", "explain" | `subskills/ask.md` |
| `explore`, "what's in my namespace", "show me my setup", "what modules am I using", "which clients exist" | `subskills/explore.md` |
| `init`, "set up everything", "from scratch", "bootstrap", "start a new AGS project", "new namespace from zero" | `subskills/init.md` |
| `wizard`, "new project" (without "set up everything"), "start a project", "scaffold", "which modules do I need" | `subskills/wizard.md` |
| `connect-portal`, "create a namespace", "create an IAM client", "oauth client", "bootstrap portal", ".env" | `subskills/connect-portal.md` |
| `install-unreal-sdk`, "add AGS to Unreal", "Unreal SDK", "Unreal OSS", "OnlineSubsystemAccelByte", "AccelByteUe4Sdk" | `subskills/install-unreal-sdk.md` |
| `install-unity-sdk`, "add AGS to Unity", "Unity SDK", "Unity Package Manager", "accelbyte-unity-sdk", "accelbyte-unity-networking" | `subskills/install-unity-sdk.md` |
| `install-widget-blueprint-generator`, "WidgetBlueprintGenerator", "widget blueprint generator", "generate widget blueprint", "patch widget blueprint", "UMG generator" | `subskills/install-widget-blueprint-generator.md` |
| `install-sdk`, "install the SDK", "Godot SDK", "Roblox SDK", "TypeScript SDK", "TS SDK", "Web SDK", "Game Engine SDK", "AGS SDK" (in a game-project or web-app context) | `subskills/install-sdk.md` |
| `install-cli`, "AGS CLI", "AccelByte CLI", "install cli" (without "extend-helper" qualifier) | `subskills/install-cli.md` |
| `install-mcp`, "mcp setup", "mcp server", "hook up ides", IDE name + "mcp" | `subskills/install-mcp.md` |
| `integrate`, "wire up auth", "integrate lobby", "implement matchmaking", "hook up the store", "implement statistics", "wire statistics", "implement leaderboards" | `subskills/integrate.md` |
| `debug`, "run locally", "test against AGS", "auth is failing", "I get a 401", "lobby keeps disconnecting" | `subskills/debug.md` |
| `observe`, "logs", "metrics", "live status", "PCCU dashboard", "events firing", "pccu", "production traffic" | `subskills/observe.md` |
| `doctor`, "diagnose", "what's wrong", "something is off", "not sure what's broken", "help me narrow this down" | `subskills/doctor.md` |
| `handoff`, "should I add Extend", "do I need AMS", "should I move to private cloud", "is AGS even right" | `subskills/handoff.md` |

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
> • **handoff** — decide when to add Extend / AMS / ADT / Access
>
> Which one? (Or describe the symptom / goal and I'll pick.)

Then wait for the user's reply. Do not guess.

### Chained intents

When the user describes multiple phases in one message:

- "Bootstrap a namespace and integrate auth" → route to `init` (scaffold phase). After it finishes, tell the user: "Run `/ags integrate` for the auth wiring next."
- "Set up the SDK and run it locally" → route to `install-sdk` first, then point at `debug`.
- "It's broken — figure out what and fix it" → route to `doctor` first, then point at whatever subskill owns the fix (`debug`, `connect-portal`, `integrate`).
- "Why is auth failing in prod and how do I roll back" → route to `observe` first (diagnose), then point at `connect-portal` or `integrate` for the fix.
- "Should I add Extend, and if so, how?" → route to `handoff` first (decide), then point at `/ags-extend ask` if Extend is the right answer.

Never invoke a second subskill automatically. The user should see one subskill run per invocation so they can stop if something goes wrong mid-chain.

### Off-topic response

Use when the message isn't about AGS or the AccelByte family:

> This skill covers AccelByte Gaming Services (AGS) and the surrounding AccelByte product family. For generic backend / cloud advice unrelated to AccelByte, or for products outside AccelByte's portfolio, I'm not the right tool. The AccelByte docs (`https://docs.accelbyte.io/`) or AccelByte support are better starting points. I won't route to a subskill for this.

### Extend redirect

Use when the message is clearly about Extend:

> That's an Extend-specific question — Override, Event Handler, Service Extension, App UI, deploying custom backend services, or the `extend-helper-cli`. Run `/ags-extend` to invoke the Extend skill. It owns that lifecycle end-to-end. (`/ags` knows Extend exists and where it fits, but doesn't own its workflow.)

### AMS redirect

Use when the message is about AMS depth (fleet configuration, warmed pool sizing, dedicated-server binary upload, watchdog tuning, regional rollout, AMS-specific debugging):

> That's deep into AMS territory — fleet config, warmed pools, server binary upload, watchdog tuning, or regional rollout. Run `/ags-ams` for that work. `/ags` covers AMS at a conceptual level (what it is, when to add it), but the operational workflow lives in `/ags-ams`.

### Matchmaking redirect

Use when the message is about matchmaking depth (rule design, MMR tuning, ticket lifecycle, region routing, debugging match formation):

> That's deep into matchmaking territory — rule design, MMR, ticket lifecycle, region routing, or debugging why matches aren't forming. Run `/ags-matchmaking` for that work. `/ags` covers matchmaking at a conceptual level (what it is, where it fits in the AGS stack), but the rule and tuning workflows live in `/ags-matchmaking`.

### ADT redirect

Use when the message is about ADT (build distribution, crash reporting, playtest tooling, BlackBox):

> That's an ADT question — build distribution, crash reporting, crash video replay, or playtest tooling. ADT is a separate AccelByte product with its own skill. Run `/adt` to invoke it. (`/ags` covers "should I add ADT?" at a conceptual level, but ADT's actual workflows live in `/adt`.)

### When subskills conflict

If the user's follow-up inside a running subskill clearly belongs to a different subskill (e.g. during `integrate`, they ask "actually, what's the difference between Lobby and Session Management?"), finish answering the narrow question if it's a one-sentence sidebar, or stop the current subskill and say:

> That's an `ask` question. Stop here and run `/ags ask` to go deeper, or tell me to continue `integrate`.

## What this file does NOT do

- **Does not explain AGS modules.** That's `ask`.
- **Does not run any CLI commands or write project files.** Those live in `wizard`, `connect-portal`, `install-sdk`, `install-unreal-sdk`, `install-unity-sdk`, `install-cli`, `integrate`, `debug`.
- **Does not read references.** Subskills own their own reading.
- **Does not own the Extend lifecycle.** That's `/ags-extend`.
- **Does not carry state across invocations.** Each `/ags` call is fresh; the only state is what's on disk (namespace `.env`, SDK config, etc.), and the relevant subskill reads it.
