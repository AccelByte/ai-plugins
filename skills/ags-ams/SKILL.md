---
name: ags-ams
description: "AccelByte Multiplayer Servers (AMS) — dedicated game-server fleet operations on AGS. Use for fleet configuration, warmed pool sizing, server binary upload, watchdog integration, regional rollout, build configurations, session claiming, and AMS-specific debugging and observability. Invoke whenever the user mentions AMS, fleet manager, dedicated servers, watchdog, server upload, claim keys, fleet scaling, AMS Simulator, warmed servers, DS lifecycle, or any dedicated-server operation — even without explicitly saying 'AMS'."
allowed-tools: Bash Read Write Edit Glob
model: sonnet
---

# AGS AMS

Single entry point for the AccelByte Multiplayer Servers (AMS) lifecycle. **This file is a router.** It reads the user's invocation, picks exactly one subskill, hands control to it, and otherwise stays out of the way.

Never answer AMS questions, run CLI commands, or configure fleets from this file. All of that belongs inside a subskill.

## Subskills

| #  | Subskill | Phase | Purpose | Depends on |
|----|---|---|---|---|
| 1  | `subskills/ask.md` | any | Conceptual questions: what AMS is, architecture, when to use it, how it fits AGS | — |
| 2  | `subskills/account.md` | scaffold | Activate AMS, create an AMS account, link/unlink namespaces | — |
| 3  | `subskills/sdk.md` | build | Integrate a dedicated server binary with the AMS watchdog (ready signal, heartbeat, drain handler) | — |
| 4  | `subskills/upload.md` | build | Upload a dedicated server build to AMS using the AMS CLI | account |
| 5  | `subskills/fleet.md` | build | Create and configure production/development fleets; choose instance types; set scaling parameters | upload |
| 6  | `subskills/session.md` | build | Configure session templates to claim dedicated servers from AMS | fleet |
| 7  | `subskills/debug.md` | build | Test a dedicated server locally using the AMS Simulator before upload | sdk |
| 8  | `subskills/init.md` | scaffold | Orchestrates account → sdk → upload → fleet → session end-to-end for a clean-slate AMS setup | — |
| 9  | `subskills/observe.md` | operate | Pull fleet metrics, server logs, and artifacts from a live AMS deployment | fleet |
| 10 | `subskills/doctor.md` | operate | Read-only symptom → likely cause diagnosis; hands off to the subskill that owns the fix | — |
| 11 | `subskills/rollout.md` | operate | Update to a new DS version; manage claim keys for blue/green, canary, and fallback fleet strategies | fleet |

Phases run roughly in order but loop (scaffold → build → operate → back to build). `ask`, `doctor` are phase-free: they answer questions or diagnose without mutating anything.

## Routing

<tool_usage_rules>

1. Resolve the invocation to **exactly one** subskill using the decision procedure below.
2. Read that subskill file start to finish before taking any action. Do not answer from memory of a subskill's contents — subskills change, and the file on disk is the source of truth.
3. Do not mix instructions across two subskills in one response. If a handoff is needed, finish the current subskill, then tell the user which one to invoke next.
4. If the user's message spans multiple phases ("upload a build and create a fleet"), route to the earliest phase and announce the next step; do not auto-chain into the next subskill.
5. Use only the tools listed in frontmatter. Subskills may further restrict; respect their restrictions.

</tool_usage_rules>

### Decision procedure

Apply these checks in order. Stop at the first match.

1. **Is the message off-topic?** (Generic server infrastructure, non-AMS AccelByte topics, unrelated cloud/DevOps advice.) → Decline with the off-topic response (below). Do not route.
2. **Is the message empty or only `/ags-ams`?** → Ask the disambiguation question (below). Do not route yet.
3. **Is there a direct subskill cue?** (Table below.) → Route to that subskill.
4. **Is the message conceptual** ("what", "how does", "which", "should I", "vs")? → Route to `ask`.
5. **Does the message span multiple phases?** → Route to the earliest phase; announce the later steps as follow-ups.
6. **No match** → Ask the disambiguation question.

### Cue table

First match wins. Cues are case-insensitive substring matches unless noted.

| Cue | Route |
|---|---|
| `ask`, "what is", "how does AMS", "which instance", "should I use", "vs", "compared to", "explain AMS" | `subskills/ask.md` |
| `init`, "set up everything", "from scratch", "bootstrap AMS", "start AMS", "new AMS project" | `subskills/init.md` |
| `account`, "create AMS account", "activate AMS", "link namespace", "unlink namespace", "AMS trial" | `subskills/account.md` |
| `sdk`, "integrate dedicated server", "watchdog", "ready message", "drain signal", "SendServerReady", "SendReadyMessage", "bServerUseAMS", "heartbeat", "AMS SDK integration" | `subskills/sdk.md` |
| `upload`, "upload build", "upload server", "AMS CLI upload", "ams upload", "server image", "image name" | `subskills/upload.md` |
| `fleet`, "create fleet", "fleet manager", "fleet config", "instance type", "fleet size", "buffer", "warmed", "max servers", "min servers", "production fleet", "development fleet", "build config" | `subskills/fleet.md` |
| `session`, "session template", "claim key", "DS - AMS", "configure session", "claim dedicated server" | `subskills/session.md` |
| `debug`, "local test", "AMS simulator", "amssim", "register local server", "test locally", "local DS" | `subskills/debug.md` |
| `observe`, "logs", "artifacts", "metrics", "live logs", "server logs", "Grafana", "fleet overview", "claim failure", "running servers" | `subskills/observe.md` |
| `doctor`, "diagnose", "what's wrong", "something is off", "not sure what's broken", "help me narrow this down", "servers not starting", "claim failing", "DS crashing" | `subskills/doctor.md` |
| `rollout`, "new DS version", "update version", "blue/green", "canary fleet", "fallback fleet", "deploy new build", "migrate fleet", "version upgrade" | `subskills/rollout.md` |

### Disambiguation prompt

Use verbatim when no cue matches and the user hasn't typed anything specific:

> I can help across the full AccelByte Multiplayer Servers (AMS) lifecycle:
> • **ask** — what AMS is, how it works, which instance types, when to use it
> • **init** — end-to-end AMS setup from scratch
> • **account** — activate AMS, create an account, link namespaces
> • **sdk** — integrate your dedicated server with the AMS watchdog
> • **upload** — upload a server build with the AMS CLI
> • **fleet** — create and configure fleets (scaling, instance types, buffers)
> • **session** — configure session templates to claim servers from AMS
> • **debug** — test locally with the AMS Simulator
> • **observe** — fleet metrics, server logs, and artifacts
> • **doctor** — read-only diagnosis when something's off
> • **rollout** — update to a new DS version; manage blue/green and canary strategies
>
> Which one? (Or describe the symptom / goal and I'll pick.)

Then wait for the user's reply. Do not guess.

### Chained intents

When the user describes multiple phases in one message:

- "Set up AMS and create my first fleet" → route to `init` (scaffold). After it finishes, tell the user: "Run `/ags-ams fleet` to dive deeper into fleet tuning."
- "Upload my build and create a fleet" → route to `upload` first, then point at `fleet`.
- "My servers aren't being claimed — diagnose and fix" → route to `doctor` first (read-only narrow-down), then point at whatever subskill owns the fix (`fleet`, `session`, `rollout`).
- "Update to a new DS version and configure canary" → route to `rollout`.
- "What is AMS and how do I get started?" → route to `ask` first, then point at `init`.

Never invoke a second subskill automatically. The user should see one subskill run per invocation so they can stop if something goes wrong mid-chain.

### Off-topic response

Use when the message isn't about AMS:

> This skill covers AccelByte Multiplayer Servers (AMS) — dedicated game-server fleet operations within AGS. For general AGS questions (auth, lobby, matchmaking, entitlements), run `/ags`. For Extend (custom backend services), run `/ags-extend`. For ADT (build distribution, crash reporting), run `/adt`. I won't route to a subskill for unrelated topics.

### When subskills conflict

If the user's follow-up inside a running subskill clearly belongs to a different subskill (e.g. during `fleet`, they ask "actually what's the difference between warmed and buffer servers?"), finish answering the narrow question if it's a one-sentence sidebar, or stop the current subskill and say:

> That's an `ask` question. Stop here and run `/ags-ams ask` to go deeper, or tell me to continue `fleet`.

## What this file does NOT do

- **Does not explain AMS concepts.** That's `ask`.
- **Does not run CLI commands or write config.** Those live in `account`, `upload`, `fleet`, `session`, `debug`, `rollout`.
- **Does not read references.** Subskills own their own reading.
- **Does not carry state across invocations.** Each `/ags-ams` call is fresh; the only state is what's on disk (fleet config, `.env`, uploaded images in the Admin Portal), and the relevant subskill reads it.
