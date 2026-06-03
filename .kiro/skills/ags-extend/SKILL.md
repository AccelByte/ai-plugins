---
name: ags-extend
description: "AccelByte Extend — custom server-side game logic on AGS. Use for choosing an Extend pattern (Override, Event Handler, Service Extension), scaffolding a service, deploying to AGS, running locally, testing, and debugging."
---

# AGS Extend

Single entry point for the full Extend lifecycle. **This file is a router.** It reads the user's invocation, picks exactly one subskill, hands control to it, and otherwise stays out of the way.

Before running this skill, apply `accelbyte` when it is available.

Never answer Extend questions, scaffold templates, run CLI commands, or apply patches from this file. All of that belongs inside a subskill.

## Subskills

| #  | Subskill | Phase | Purpose | Depends on |
|----|---|---|---|---|
| 1  | `subskills/ask.md` | any | Conceptual questions: what Extend is, pattern selection, comparisons | — |
| 2  | `subskills/design.md` | design | Multi-app project shaping: which patterns + how they fit together (read-only) | — |
| 3  | `subskills/wizard.md` | scaffold | Interview → clone template → apply integration patches | design (optional) |
| 4  | `subskills/install-dep.md` | scaffold | Detect runtimes; install per-app project deps | wizard (typically) |
| 5  | `subskills/install-cli.md` | scaffold | Install `extend-helper-cli` (required before deploy) | — |
| 6  | `subskills/install-mcp.md` | scaffold | Wire Extend MCP servers into the user's AI IDE (optional) | — |
| 7  | `subskills/init.md` | scaffold | Orchestrates wizard + install-dep + install-cli + optional install-mcp | — |
| 8  | `subskills/proto.md` | scaffold/build | Regenerate proto-derived code after contract or SDK changes | wizard |
| 9  | `subskills/debug.md` | build | Run and test a local Extend app | wizard, install-dep |
| 10 | `subskills/test.md` | build | Write or run unit / integration / contract tests | wizard, install-dep |
| 11 | `subskills/deploy.md` | ship | Build-push + deploy one or more apps to AGS | wizard, install-cli |
| 12 | `subskills/ci.md` | ship | Wire `image-upload` + `deploy` into GitHub Actions or GitLab CI | deploy |
| 13 | `subskills/observe.md` | operate | Pull logs, health, and runtime signals for a deployed app | deploy |
| 14 | `subskills/doctor.md` | operate | Read-only diagnosis: symptoms → likely causes → next-step pointer | — |
| 15 | `subskills/upgrade.md` | operate | Guided SDK or proto contract version bump with breakage surfacing | deploy (recommended) |

Phases run roughly in order but loop (design → scaffold → build → ship → operate → back to design/build). `ask` and `doctor` are phase-free: `ask` answers concept questions at any time; `doctor` diagnoses without mutating anything and hands off to the subskill that owns the fix.

## Routing

<tool_usage_rules>

1. Resolve the invocation to **exactly one** subskill using the decision procedure below.
2. Read that subskill file start to finish before taking any action. Do not answer from memory of a subskill's contents — subskills change, and the file on disk is the source of truth.
3. Do not mix instructions across two subskills in one response. If a handoff is needed, finish the current subskill, then tell the user which one to invoke next.
4. If the user's message spans multiple phases ("scaffold and deploy"), route to the earliest phase and announce the next step; do not auto-chain into the next subskill.
5. Use only the tools listed in frontmatter. Subskills may further restrict; respect their restrictions.

</tool_usage_rules>

### Decision procedure

Apply these checks in order. Stop at the first match.

1. **Is the message off-topic?** (General AGS admin, non-Extend AccelByte SDKs, unrelated programming help.) → Decline with the off-topic response (below). Do not route.
2. **Is the message empty or only `/ags-extend`?** → Ask the disambiguation question (below). Do not route yet.
3. **Is there a direct subskill cue?** (Table below.) → Route to that subskill.
4. **Is the message conceptual** ("what", "how does", "which", "should I", "vs")? → Route to `ask`.
5. **Does the message span multiple phases?** → Route to the earliest phase; announce the later steps as follow-ups.
6. **No match** → Ask the disambiguation question.

### Cue table

First match wins. Cues are case-insensitive substring matches unless noted.

| Cue | Route |
|---|---|
| `ask`, "what is", "which pattern", "how does", "should I use", "vs", "compared to" | `subskills/ask.md` |
| `design`, "multi-app", "how should I structure", "which patterns do I need", "project shape", "how do the pieces fit" | `subskills/design.md` |
| `init`, "set up everything", "from scratch", "bootstrap", "start a new project" | `subskills/init.md` |
| `wizard`, "new project" (without "set up everything"), "scaffold", "generate", "build me a" | `subskills/wizard.md` |
| `install-dep`, "install dependencies", "go mod tidy", "pip install", "restore packages" | `subskills/install-dep.md` |
| `install-cli`, "extend-helper-cli", "install cli" | `subskills/install-cli.md` |
| `install-mcp`, "mcp setup", "mcp server", "hook up ides", IDE name + "mcp" | `subskills/install-mcp.md` |
| `proto`, "regen proto", "regenerate proto", "buf generate", "make proto", "proto contract changed" | `subskills/proto.md` |
| `debug`, "run locally", "test locally", "local server", "localhost" | `subskills/debug.md` |
| `test`, "unit test", "integration test", "run tests", "write a test", "coverage" | `subskills/test.md` |
| `deploy`, "push", "ship", "release", "image-upload" | `subskills/deploy.md` |
| `ci`, "github actions", "gitlab ci", "pipeline", "workflow file", "automate deploy" | `subskills/ci.md` |
| `observe`, "logs", "live status", "health check", "monitor", "degraded", "why is it crashing" | `subskills/observe.md` |
| `doctor`, "diagnose", "what's wrong", "something is off", "not sure what's broken", "help me narrow this down" | `subskills/doctor.md` |
| `upgrade`, "bump sdk", "new sdk version", "upgrade sdk", "migrate to v2", "dependency upgrade" | `subskills/upgrade.md` |

### Disambiguation prompt

Use verbatim when no cue matches and the user hasn't typed anything specific:

> I can help with Extend across the full lifecycle:
> • **ask** — what is it, which pattern, how it works
> • **design** — shape a multi-app project before scaffolding
> • **init** — scaffold a new project from scratch
> • **debug** — run it locally
> • **test** — unit / integration / contract tests
> • **deploy** — ship to AGS
> • **ci** — wire deploys into GitHub Actions / GitLab CI
> • **observe** — logs and health for a deployed app
> • **doctor** — read-only diagnosis when something's off
> • **upgrade** — guided SDK or proto version bump
>
> Which one? (Or describe the symptom / goal and I'll pick.)

Then wait for the user's reply. Do not guess.

### Chained intents

When the user describes multiple phases in one message:

- "Scaffold a matchmaking override and deploy it" → route to `init` (scaffold phase). After the subskill finishes, tell the user: "Run `/ags-extend deploy` when you're ready to ship."
- "Fix the bug and redeploy" → route to `debug` first (investigate + fix locally), then point at `deploy`.
- "Why is it failing and how do I restart it" → route to `observe` first (diagnose), then point at `deploy`.
- "Design a tournaments product and generate the apps" → route to `design` first (shape the system), then point at `init`.
- "It's broken — diagnose and fix" → route to `doctor` first (read-only narrow-down), then point at whatever subskill owns the fix (`debug`, `deploy`, `upgrade`).
- "Bump the SDK and redeploy" → route to `upgrade` first, then point at `deploy` once the bump is green.

Never invoke a second subskill automatically. The user should see one subskill run per invocation so they can stop if something goes wrong mid-chain.

### Off-topic response

Use when the message isn't about Extend:

> This skill covers AccelByte Extend specifically (Overrides, Event Handlers, Service Extensions). For general AGS admin, non-Extend SDK work, or other AccelByte products, check the AccelByte docs or Admin Portal. I won't route to a subskill for this.

### When subskills conflict

If the user's follow-up inside a running subskill clearly belongs to a different subskill (e.g. during `deploy`, they ask "actually how do the three patterns differ?"), finish answering the narrow question if it's a 1-sentence sidebar, or stop the current subskill and say:

> That's an `ask` question. Stop here and run `/ags-extend ask` to go deeper, or tell me to continue `deploy`.

## Hard rule: cite-or-defer for `extend-helper-cli`

`extend-helper-cli` command names, flags, and environment variables hallucinate easily. To prevent this, the skill enforces one rule that supersedes every subskill's local guidance:

**`references/deploy/cli-commands.md` is the single authoritative source for CLI syntax.** Every subskill that mentions a CLI command, flag, or env var must defer to that file — by linking to it ("see `references/deploy/cli-commands.md`") or by reading it before quoting any CLI invocation. Restating CLI flags from memory anywhere else in this skill is a defect, even if the restatement happens to be correct.

Subskills that touch the CLI (deploy, debug, observe, ci, install-cli, doctor, upgrade) must include this in their `<grounding_rules>`:

> Before writing any `extend-helper-cli <subcommand>` invocation in a response or example, Read `references/deploy/cli-commands.md`. Do not restate flags from memory. If `cli-commands.md` doesn't document the flag you want to use, the flag does not exist — use a documented alternative, surface the gap to the user, or stop and ask.

The "What the CLI does NOT have" section of `cli-commands.md` explicitly catalogues invented flags so they can be recognized as red flags during authoring or runtime.

## Project layout: per-app, no project-wide manifest

There is no project-wide manifest file. Each Extend app is a standalone directory cloned from an AccelByte template (Go, C#, Python, Java — see `references/init/templates.md`) and carries its own:

- `Makefile` — wraps Docker-based build + proto regen
- `Dockerfile` — multi-stage build (proto-builder → builder → runtime)
- `.env.template` (or `.env` — a copy for local use) — per-app credentials and config
- `.devcontainer/` — optional VS Code devcontainer with the toolchain pre-installed
- `IMPLEMENTATION_PLAN.md` (after `/ags-extend wizard`) — the agreed plan

**Multi-app projects** are just multiple of those directories side by side, typically inside one git repo. Subskills discover the active app by locating a `Makefile` + `Dockerfile` in the working directory or one level up — never by reading a project-level config file (skill-internal discovery heuristic, not an AGS contract).

`references/init/manifest-schema.md` documents a forward-looking proposal for a project-wide `extend-project.yaml`. **No subskill should generate it today**, and references in this skill bundle have been updated to reflect per-app discovery.

## What this file does NOT do

- **Does not explain Extend concepts.** That's `ask`.
- **Does not run any CLI commands.** Those live in `deploy`, `debug`, `observe`, `install-cli`.
- **Does not read references.** Subskills own their own reading.
- **Does not carry state across invocations.** Each `/ags-extend` call is fresh; the only state is what's on disk (the app's `Makefile`, `Dockerfile`, `.env`, `IMPLEMENTATION_PLAN.md`, etc.), and the relevant subskill reads it.
