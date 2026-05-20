# accelbyte-ai-plugins

![version](https://img.shields.io/badge/version-0.2.0-blue)

Public AI coding agents, skills, and MCP servers for AccelByte.

## How it works

Once installed, skills activate automatically when your AI assistant recognizes a relevant AccelByte question — no special commands needed. You can also invoke any skill directly using its slash command.

For connecting your assistant to a live AccelByte environment, each skill can configure MCP servers on a per-project basis — your assistant will walk you through it when you're ready.


## Skills

### ags

AccelByte Gaming Services (AGS) is the managed backend that handles player accounts, sessions, matchmaking, leaderboards, achievements, the item store, wallet, and more — so you can focus on building your game.

#### What it covers

The full AGS platform: player authentication (IAM), real-time lobby and presence, sessions and matchmaking, leaderboards, achievements, item store, wallet, entitlements, and namespace management.

#### Examples

```
/ags How do I configure OAuth for my Unity game?
```
```
/ags My players can't log in — where do I start?
```
```
/ags How do leaderboards and statistics relate to each other?
```

#### What you can do

- **Set up a new project** — `/ags init` walks you through namespace setup, SDK install, and IAM client config from scratch.
- **Integrate a feature** — `/ags integrate` guides you module by module: auth, lobby, matchmaking, store, achievements, and more.
- **Install the SDK** — `/ags install-sdk` detects your engine (Unreal, Unity, Godot, web) and runs the right installer.
- **Debug a live issue** — `/ags debug` traces auth errors, lobby disconnects, matchmaking timeouts, and store failures.
- **Diagnose without touching anything** — `/ags doctor` walks from symptom to root cause, then hands off to the right fix.
- **Explore your namespace** — `/ags explore` gives you a read-only overview of what's configured in your AGS environment.
- **Plan your next feature** — `/ags wizard` helps you decide what to build next and produces an implementation plan.

#### Intended workflow

1. **New to AGS?** `/ags ask` explains what AGS is and which modules cover your needs.
2. **Starting a project** — `/ags init` does the full setup: picks modules, bootstraps your namespace and IAM client, installs the SDK and CLI. Or step through it manually: `/ags wizard` → `/ags connect-portal` → `/ags install-sdk` → `/ags install-cli`.
3. **Taking stock of an existing namespace** — `/ags explore` gives you a read-only overview of what's already configured before you touch anything.
4. **Wiring AGS into your game** — `/ags integrate` walks you module by module: auth, lobby, matchmaking, store, achievements, and more.
5. **Something broken?** `/ags doctor` narrows the symptom to a cause, then `/ags debug` traces the failure in your running game.
6. **Checking live state** — `/ags observe` pulls logs and signals from a deployed namespace. Pair it with the AGS API MCP server for real-time data.

### ags-ams

AccelByte Multiplayer Servers (AMS) lets you run dedicated game servers close to your players — AMS handles fleet provisioning, regional scaling, server health, and crash recovery. You upload the binary; AccelByte runs the fleet.

#### What it covers

Integrating your dedicated server with the AMS watchdog, uploading builds, configuring fleets and session templates, testing locally with the AMS Simulator, monitoring with Grafana, and rolling out new DS versions with zero downtime.

#### Examples

```
/ags-ams What instance type should I use for a physics-heavy dedicated server?
```
```
/ags-ams sdk — integrate my Unreal DS with the AMS watchdog
```
```
/ags-ams My sessions keep failing to claim a server — help me debug it
```

#### What you can do

- **Understand AMS** — `/ags-ams ask` explains how AMS works, how it fits AGS Matchmaking, and how to size a fleet for your player load.
- **Set up AMS** — `/ags-ams init` guides you from a blank namespace to an active fleet end-to-end.
- **Integrate your DS** — `/ags-ams sdk` walks through the watchdog ready signal, heartbeat, and drain handler for Unreal, Unity, or raw WebSocket.
- **Upload a build** — `/ags-ams upload` runs the AMS CLI upload with the right flags and IAM setup.
- **Configure fleets** — `/ags-ams fleet` helps you choose instance types, set scaling parameters, and assign claim keys.
- **Connect matchmaking** — `/ags-ams session` configures session templates to claim DS from AMS.
- **Test locally** — `/ags-ams debug` runs the AMS Simulator so you can verify watchdog integration without uploading.
- **Monitor production** — `/ags-ams observe` pulls fleet metrics, server logs, and crash artifacts.
- **Diagnose problems** — `/ags-ams doctor` maps symptoms (claim failures, crashes, missing logs) to likely causes.
- **Roll out new versions** — `/ags-ams rollout` guides DS version migration, blue/green, canary, and fallback fleet strategies.

#### Intended workflow

1. **Not sure where to start?** `/ags-ams ask` explains AMS and when to use it.
2. **Starting fresh** — `/ags-ams init` does the full setup: account, SDK integration, upload, fleet, and session config.
3. **Iterating** — `/ags-ams sdk` after engine changes, `/ags-ams debug` to test locally, `/ags-ams upload` to push a new build.
4. **Managing fleets** — `/ags-ams fleet` to tune scaling and `/ags-ams session` to adjust claim routing.
5. **In production** — `/ags-ams observe` for metrics and logs, `/ags-ams doctor` when something's wrong, `/ags-ams rollout` for new DS versions.

### ags-extend

AGS Extend lets you run custom server-side game logic — matchmaking filters, leaderboard tiebreakers, anti-cheat hooks, custom statistics, and more — as lightweight services deployed on AccelByte's infrastructure, without managing your own servers.

#### What it covers

Picking the right Extend pattern, scaffolding a new service, defining its API, running it locally, deploying it to AGS, and debugging it in production.

#### Examples

```
/ags-extend What Extend pattern fits a custom matchmaking filter?
```
```
/ags-extend Scaffold a new Override service for leaderboard ranking
```
```
/ags-extend My service won't start after deploy — help me debug it
```

#### What you can do

- **Plan your service** — `/ags-extend wizard` helps you pick the right pattern (Override, Custom Function, Event Handler) for your use case.
- **Scaffold a project** — `/ags-extend init` sets up a new service from an official template, with dependencies and tooling ready.
- **Define the interface** — `/ags-extend proto` helps you write the protobuf definition for your service's API.
- **Run and test locally** — `/ags-extend test` runs your service against a local AGS environment before you deploy.
- **Deploy to AGS** — `/ags-extend deploy` packages and pushes your service to your AGS namespace.
- **Check logs and health** — `/ags-extend observe` and `/ags-extend debug` trace what's happening once it's live.
- **Set up CI** — `/ags-extend ci` wires automated builds and deploys into your pipeline.

#### Intended workflow

1. **Not sure where to start?** `/ags-extend ask` explains Extend patterns and when to use each one.
2. **Planning a multi-app project?** `/ags-extend design` helps you shape the architecture before writing a line of code (optional for single-service work).
3. **Starting a service** — `/ags-extend init` does the full setup: scaffolds a template, installs dependencies and the CLI, and optionally sets up MCP servers. Or step through it: `/ags-extend wizard` → `/ags-extend install-dep` → `/ags-extend install-cli`.
4. **Iterating** — `/ags-extend proto` after SDK or contract changes, `/ags-extend debug` to run locally, `/ags-extend test` for unit, integration, and contract tests.
5. **Ready to ship** — `/ags-extend deploy` builds, pushes, and deploys to AGS. `/ags-extend ci` wires it into GitHub Actions or GitLab CI.
6. **In production** — `/ags-extend observe` for logs and health, `/ags-extend doctor` if something's off, `/ags-extend upgrade` for SDK or proto version bumps.

### ags-matchmaking

AGS Matchmaking gives you deep, grounded assistance for the full matchmaking lifecycle — from authoring alliance rules and MMR criteria to debugging stuck tickets in X-Ray — without leaving your editor.

#### What it covers

Rule design (alliance, matching_rule, flexing_rule, MMR, role-based composition, rebalance methods), match pool configuration, Unreal and Unity SDK integration with QoS measurement, region routing (latency expansion, preferred-region restriction), backfill design (auto vs manual, proposal lifecycle, partial acceptance), X-Ray debugging, and symptom-driven diagnosis.

#### Examples

```
/ags-matchmaking ruleset  I need a 5v5 ruleset with role composition (tank/healer/dps) and MMR flexing
```
```
/ags-matchmaking debug  Tickets were matching in 30 s yesterday; today everyone waits 3+ minutes
```
```
/ags-matchmaking integrate  How do I submit a Unity ticket with the player's latency map?
```
```
/ags-matchmaking doctor  Teams are lopsided even though MMR matching is on
```

#### What you can do

- **Author a ruleset** — `/ags-matchmaking ruleset` writes the alliance definition, matching_rule criteria, flexing_rule staircase, and rebalance method; includes ready-to-use patterns for 1v1 ranked, team deathmatch, and role-based composition.
- **Configure a pool** — `/ags-matchmaking pool` sets session template, ticket expiration, latency method (average vs P95), backfill flags, cross-play mode, and `match_options_referred_for_backfill`.
- **Integrate the SDK** — `/ags-matchmaking integrate` produces Unreal and Unity snippets for QoS measurement, ticket submission, match notification, cancellation, and session join — including reserved attribute keys and the session exclusion system.
- **Set up region routing** — `/ags-matchmaking region` recommends the latency method, generates QoS integration code, and guides latency expansion tuning on the ruleset.
- **Design backfill** — `/ags-matchmaking backfill` covers auto vs manual mode, partial proposal acceptance, `StopBackfilling`, server permissions, and per-ticket `new_session_only` override.
- **Debug with X-Ray** — `/ags-matchmaking debug` walks through X-Ray Overview and Timeline to find the blocking criterion behind stuck tickets, wait-time spikes, or lopsided matches.
- **Diagnose problems** — `/ags-matchmaking doctor` maps symptoms (no matches forming, unfair teams, backfill not working) to documented causes and points to the right fix subskill.

#### Intended workflow

1. **New to matchmaking?** `/ags-matchmaking ask` explains the ticket lifecycle, how rulesets relate to pools, and when to use native rules vs an Extend Override.
2. **Designing the rules** — `/ags-matchmaking ruleset` produces the ruleset JSON; `/ags-matchmaking pool` links it to a session template and sets timing and backfill parameters.
3. **Wiring the SDK** — `/ags-matchmaking integrate` for Unreal/Unity, `/ags-matchmaking region` for latency configuration, `/ags-matchmaking backfill` for session backfill.
4. **Debugging** — `/ags-matchmaking debug` for X-Ray investigation, `/ags-matchmaking doctor` when the symptom isn't obvious.
5. **Custom logic needed?** If native rules can't express what you need, `/ags-matchmaking ask` will say so; then `/ags-extend` owns the Override deployment lifecycle.


## MCP Servers

### AGS API MCP Server

Connects your AI assistant directly to your live AGS environment. Instead of guessing, it can read your actual namespace config, check API responses, and give advice grounded in your real setup.

Useful when debugging a live integration or validating how your game's backend is actually configured.


### AGS Extend SDK MCP Server

Gives your AI assistant direct access to AccelByte Extend SDK types, functions, and models while you code. Supports Go, Java, Python, and C#.

Instead of hallucinating API shapes, your assistant can look them up — making AI-generated Extend code significantly more accurate.


### AccelByte Unreal SDK MCP Server

Indexes the AccelByte Unreal SDK — classes, methods, code snippets, and ready-made Slate UI panels for Login, Achievements, and Matchmaking.

Your assistant can search real SDK symbols and examples instead of guessing, making Unreal Engine integration with AccelByte significantly more reliable.



## Installation

### Claude Code

```
/plugin marketplace add AccelByte/ai-plugins
/plugin install accelbyte-ai-plugins@accelbyte
```

### Claude Desktop

**Automatic (Cowork) — paste this prompt into a Cowork chat:**

```
Download `https://github.com/AccelByte/ai-plugins/archive/refs/heads/main.zip`, unzip it, remove the `mcpServers` and `userConfig` fields from .claude-plugin/plugin.json (Cowork's plugin validator does not support these fields yet), repack it as a .zip with all contents at the archive root — if the zip contains a single top-level directory (as GitHub typically adds), strip that wrapper so files like `.claude-plugin/` appear directly at the root — rename it to `accelbyte-ai-plugins.plugin`, and use the `present_files` tool to present it to me.
```

**Manual (Chat and Cowork):**

1. Download the repo archive: [AccelByte/ai-plugins/archive/refs/heads/main.zip](https://github.com/AccelByte/ai-plugins/archive/refs/heads/main.zip)
2. In Claude Desktop, open **Customize → Upload plugin** and select the downloaded file.
3. Confirm the install.

### Any agent (Agent Skills)

```
npx skills add AccelByte/ai-plugins
```

### Cursor, Codex, Kiro, OpenCode

Paste this into your AI assistant:

```
Fetch and follow instructions from https://raw.githubusercontent.com/AccelByte/ai-plugins/refs/heads/main/INSTALL.md
```

---

Built with AccelByte External Marketplace compiler `v0.2.0`.
