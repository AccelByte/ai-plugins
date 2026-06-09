# accelbyte-ai-plugins

![version](https://img.shields.io/badge/version-0.2.1-blue)

Public AI coding agents, skills, and MCP servers for AccelByte.

## How it works

Once installed, skills activate automatically when your AI assistant recognizes a relevant AccelByte question — no special commands needed. You can also invoke any skill directly using its slash command.

For connecting your assistant to a live AccelByte environment, each skill can configure MCP servers on a per-project basis — your assistant will walk you through it when you're ready.


## Skills

- **accelbyte** — Use before working with AccelByte skills or when a request mentions AccelByte, AGS, AMS, Extend, Matchmaking, ADT, IAM, namespaces, SDKs, AccelByte CLI, or AccelByte MCP servers. Establishes AccelByte skill routing, grounding rules, and host-native progress tracking across harnesses.
### ags

AccelByte Gaming Services (AGS) is the managed backend that handles player accounts, sessions, matchmaking, leaderboards, achievements, the item store, wallet, and more — so you can focus on building your game.

#### What it covers

The full AGS platform: player authentication (IAM), real-time lobby and presence, sessions and matchmaking, leaderboards, achievements, item store, wallet, entitlements, and namespace management.

#### Examples

```
/ags matchmaking plan
```
```
/ags matchmaking debug
```
```
/ags ams fleet
```
```
/ags ams debug
```
```
/ags integrate
```
```
/ags doctor
```

#### What you can do

- **Set up a new project** — `/ags init` walks you through namespace setup, SDK install, and IAM client config from scratch.
- **Integrate a feature** — `/ags integrate` guides you module by module: auth, lobby, matchmaking, store, achievements, and more.
- **Install the SDK** — `/ags install-sdk` detects your engine (Unreal, Unity, Godot, web) and runs the right installer.
- **Debug a live issue** — `/ags debug` traces auth errors, lobby disconnects, matchmaking timeouts, and store failures.
- **Diagnose without touching anything** — `/ags doctor` walks from symptom to root cause, then hands off to the right fix.
- **Explore your namespace** — `/ags explore` gives you a read-only overview of what's configured in your AGS environment.
- **Plan your next feature** — `/ags wizard` helps you decide what to build next and produces an implementation plan.
- **Plan and debug matchmaking** — `/ags matchmaking plan` and `/ags matchmaking debug` cover rules, tickets, MMR, pools, and X-Ray.
- **Operate dedicated servers** — `/ags ams fleet` and `/ags ams debug` cover fleet sizing, uploads, AMS Simulator, and claimability.

Legacy Matchmaking and AMS compatibility shims remain for one release. New prompts should use `/ags matchmaking ...` and `/ags ams ...`.

#### Intended workflow

1. **New to AGS?** `/ags ask` explains what AGS is and which modules cover your needs.
2. **Starting a project** — `/ags init` does the full setup: picks modules, bootstraps your namespace and IAM client, installs the SDK and CLI. Or step through it manually: `/ags wizard` → `/ags connect-portal` → `/ags install-sdk` → `/ags install-cli`.
3. **Taking stock of an existing namespace** — `/ags explore` gives you a read-only overview of what's already configured before you touch anything.
4. **Wiring AGS into your game** — `/ags integrate` walks you module by module: auth, lobby, matchmaking, store, achievements, and more.
5. **Something broken?** `/ags doctor` narrows the symptom to a cause, then `/ags debug` traces the failure in your running game.
6. **Checking live state** — `/ags observe` pulls logs and signals from a deployed namespace. Pair it with the AGS API MCP server for real-time data.

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


## MCP Servers

### AGS API MCP Server

Connects your AI assistant directly to your live AGS environment. Instead of guessing, it can read your actual namespace config, check API responses, and give advice grounded in your real setup.

Useful when debugging a live integration or validating how your game's backend is actually configured.


### AGS Extend SDK MCP Server

Gives your AI assistant direct access to AccelByte Extend SDK types, functions, and models while you code. Supports Go, Java, Python, and C#.

Instead of hallucinating API shapes, your assistant can look them up — making AI-generated Extend code significantly more accurate.


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

Built with AccelByte External Marketplace compiler `v0.2.1`.
