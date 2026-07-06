# accelbyte-ai-plugins

![version](https://img.shields.io/badge/version-0.6.6-blue)

Public AI coding agents, skills, and MCP servers for AccelByte.

## How it works

Once installed, skills activate automatically when your AI assistant recognizes a relevant AccelByte question — no special commands needed. You can also invoke any skill directly using its slash command.

For connecting your assistant to a live AccelByte environment, each skill can configure MCP servers on a per-project basis — your assistant will walk you through it when you're ready.


## Skills

### accelbyte

The `accelbyte` skill is the main router for this plugin. It recognizes AccelByte-related prompts, sends AGS work to `/ags`, sends Extend work to `/ags-extend`, and keeps answers grounded in bundled references.

Use the AGS and Extend sections below for the actual start commands and workflow details.

### ags

AccelByte Gaming Services (AGS) is the managed backend that handles player accounts, sessions, matchmaking, leaderboards, achievements, the item store, wallet, and more — so you can focus on building your game.

> [!NOTE]
> - **/ags init** - start here for a clean-slate setup. It scans the current project, detects the engine or app type, and guides the setup for AGS configuration, SDKs, the AGS CLI, MCP servers, namespace access, and IAM client settings
> - **/ags <prompt>** - use this for every question, goal, or symptom after that, such as `/ags help me add login and matchmaking` or `/ags debug why tickets are timing out`.

#### What it covers

The full AGS platform: player authentication (IAM), real-time lobby and presence, sessions and matchmaking, leaderboards, achievements, item store, wallet, entitlements, and namespace management.

#### Examples

```
/ags what AGS modules do I need for a co-op shooter?
```
```
/ags init
```
```
/ags help me add login and matchmaking to this Unreal project
```
```
/ags debug why matchmaking tickets are timing out
```
```
/ags check my namespace setup before I change anything
```
```
/ags do I need AMS or Extend for this?
```
```
/ags add AGS login to this game
```
```
/ags set up matchmaking for a 4-player co-op mode
```
```
/ags help me add achievements and leaderboards
```

#### What `/ags` can help with

- **Understand AGS** - choose the right modules for auth, lobby, matchmaking, sessions, store, achievements, live ops, and more.
- **Set up a project** - bootstrap namespace access, IAM client config, SDK install, CLI setup, and optional MCP configuration.
- **Integrate game features** - wire AGS into Unreal, Unity, Godot, Roblox, web, or a custom engine.
- **Debug issues** - trace auth failures, lobby disconnects, matchmaking timeouts, store problems, and namespace/config mistakes.
- **Review safely** - inspect an existing namespace or diagnose a symptom before changing anything.
- **Plan multiplayer depth** - design or troubleshoot matchmaking rules, ticket flow, region routing, sessions, and dedicated-server use.
- **Decide boundaries** - know when to stay in AGS, use AMS, add Extend, consider ADT, or involve AccelByte support.

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


## AGS CLI

The AGS CLI (binary: `ags`) is AccelByte's command-line tool for operating a live AGS environment from the terminal. Several `/ags` subskills install and drive it on your behalf — but you can use it directly too.

> [!NOTE]
> The AGS CLI is **not** `extend-helper-cli`. Extend builds and deploys use a separate CLI owned by `/ags-extend`.

### Goal

Give developers, scripts, and AI assistants a single scriptable interface for namespace, IAM, authentication, diagnostics, and AGS API operations — the same actions the Admin Portal supports, but usable from a shell, CI pipeline, or coding agent. Service commands are generated from bundled OpenAPI specs, so the CLI tracks the real AGS API surface instead of a hand-maintained subset.

### Usability

- **Install** — run `/ags install-cli` (or let `/ags init` handle it). The CLI ships as prebuilt archives from the official [GitHub releases](https://github.com/AccelByte/accelbyte-ags-cli/releases/latest) for macOS, Linux, and Windows.
- **Authenticate** — `ags auth login` opens an interactive browser flow; `ags auth login --grant client-credentials` supports headless CI and service-to-service use. Check state anytime with `ags auth status`.
- **Discover before running** — `ags describe` returns structured metadata for any generated command, and `--skeleton` prints the request body schema, so you (or your assistant) never have to guess flags or JSON shapes.
- **Run safely** — `--dry-run` shows the resolved command and body before a mutation executes.
- **Pick your interface** — interactive prompts via `--ui plain`, `--ui inline`, or `--ui fullscreen` (a full TUI), or fully non-interactive with explicit flags and `--format json` for scripting and automation.

### What you can use on the CLI

| Command | What it does |
|---|---|
| `ags auth login` / `status` / `logout` | Authenticate to an AGS environment and inspect session state |
| `ags profile ...` / `ags config ...` | Manage CLI profiles and configuration |
| `ags doctor` | Run local diagnostics on the CLI setup and connectivity |
| `ags describe <service> <resource> <method>` | Discover the exact contract of any generated command as structured output |
| `ags <service> <resource> <method>` | Generated AGS API commands — e.g. `ags iam clients list`, `ags session game-sessions list` — for listing, creating, and managing IAM clients, users, sessions, matchmaking objects, and other AGS resources |
| `ags iam client-config list-permissions` | Map Shared Cloud IAM client permission groups |
| `ags workflow list` / `ags workflow run <workflow-id>` | Multi-step setup templates — e.g. `competitive-multiplayer` provisions a matchmaking ruleset, session template, match pool, and AMS fleet in one guided run |

The exact command surface depends on the specs bundled with your installed version — `ags workflow list` and `ags describe` are always the authoritative view.

## MCP Servers

### AGS API MCP Server

Connects your AI assistant directly to your live AGS environment. Instead of guessing, it can read your actual namespace config, check API responses, and give advice grounded in your real setup.

Useful when debugging a live integration or validating how your game's backend is actually configured.


### AGS Extend SDK MCP Server

Gives your AI assistant direct access to AccelByte Extend SDK types, functions, and models while you code. Supports Go, Java, Python, and C#.

Instead of hallucinating API shapes, your assistant can look them up — making AI-generated Extend code significantly more accurate.


### AccelByte Unity MCP

Adds Unity-specific AccelByte tooling, starting with deterministic AGS uGUI prefab generation.

Your assistant can discover project style, inspect AGS kit/spec drift, validate shared AGS recipes, resolve Unity prefab specs, and generate typed TMP/uGUI screens through the live editor bridge or Unity batch mode.


### AccelByte Unreal SDK MCP Server

Indexes the AccelByte Unreal SDK - classes, methods, code snippets, and ready-made Slate UI panels for Login, Achievements, and Matchmaking.

Your assistant can search real SDK symbols and examples instead of guessing, making Unreal Engine integration with AccelByte significantly more reliable.



## Installation

### Claude Code

**CLI:**

```
/plugin marketplace add AccelByte/ai-plugins
/plugin install accelbyte-ai-plugins@accelbyte
```

**From within Claude Code:**

1. Run `/plugin` and navigate to the **Marketplaces** tab.
2. Select **Add Marketplace**, enter `AccelByte/ai-plugins`, and confirm.
3. Install the **accelbyte-ai-plugins** plugin.
4. Run `/reload-plugins` to activate the plugin.

### Claude Desktop

**Automatic (Cowork) — paste this prompt into a Cowork chat:**

```
Download `https://github.com/AccelByte/ai-plugins/archive/refs/heads/main.zip`, unzip it, remove the `mcpServers` and `userConfig` fields from .claude-plugin/plugin.json (Cowork's plugin validator does not support these fields yet), repack it as a .zip with all contents at the archive root — if the zip contains a single top-level directory (as GitHub typically adds), strip that wrapper so files like `.claude-plugin/` appear directly at the root — rename it to `accelbyte-ai-plugins.plugin`, and use the `present_files` tool to present it to me.
```

**Manual (Chat and Cowork):**

1. Download the repo archive: [AccelByte/ai-plugins/archive/refs/heads/main.zip](https://github.com/AccelByte/ai-plugins/archive/refs/heads/main.zip)
2. In Claude Desktop, open **Customize → Upload plugin** and select the downloaded file.
3. Confirm the install.

### Codex

**CLI:**

```
codex plugin marketplace add AccelByte/ai-plugins
```

**From within Codex:**

1. Run `/plugins` and navigate to the **Add Marketplace** tab.
2. Enter `AccelByte/ai-plugins` and confirm.
3. Install the **accelbyte-ai-plugins** plugin.
4. Restart Codex to activate the plugin.

### Any agent (Agent Skills)

```
npx skills add AccelByte/ai-plugins
```

### Cursor, Kiro, OpenCode

Paste this into your AI assistant:

```
Fetch and follow instructions from https://raw.githubusercontent.com/AccelByte/ai-plugins/refs/heads/main/INSTALL.md
```

---

Built with AccelByte External Marketplace compiler `v0.4.1`.
