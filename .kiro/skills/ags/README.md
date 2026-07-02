---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/getting-started/
see-also:
- '[SKILL.md](SKILL.md)'
- '[overview.md](references/overview.md)'
---

# ags

The default landing skill for AccelByte Gaming Services (AGS). One entry point — `/ags <subskill>` — covers everything from understanding what AGS is, to bootstrapping a namespace, integrating the SDK, debugging a live setup, planning Matchmaking, operating AMS fleets, and deciding whether you need to expand into Extend, ADT, or Access.

For Extend-specific work (Override / Event Handler / Service Extension / App UI), use `/ags-extend` instead. This skill defers the entire Extend lifecycle there.

For new Matchmaking and AMS work, use `/ags matchmaking ...` and `/ags ams ...`. Legacy Matchmaking and AMS compatibility shims remain for one release.

---

## Intended Workflow

```
 0. ask            — understand what AGS is and which modules cover your needs
 1. explore        — read-only walkthrough of an existing namespace (optional)
 2. wizard         — interview → pick modules + SDK + target platforms
 3. connect-portal — bootstrap a namespace + IAM client + .env
 4. install-sdk    — detect SDK target and install Unreal, Unity, Godot, Roblox, Web SDK, or custom-engine REST fallback
    generate-ui    — detect engine and generate AGS UI where supported
 5. install-cli    — install the AGS CLI
 6. install-mcp    — customize the AGS API MCP URL (Shared Cloud / per-studio / Private Cloud). The MCP server itself ships with the plugin.
 7. integrate      — module-by-module SDK wiring (auth, lobby, matchmaking, store, …)
 8. debug          — run the game locally and trace integration failures
 9. observe        — pull logs, metrics, and events from a live namespace
10. doctor         — read-only diagnosis when something's off
11. handoff        — decide when to bring in ags-extend, ADT, Access, or deeper AGS capabilities
```

`init` runs steps 2–6 end-to-end for a clean-slate setup.

`ask`, `explore`, `doctor`, and `handoff` are read-only and can be invoked at any phase. `ask` answers concept questions; `explore` walks an existing namespace; `doctor` narrows symptoms to a cause and hands off to whatever subskill owns the fix; `handoff` decides whether `/ags` is even the right skill, whether you should use `/ags ams ...`, whether Access packaging under IAM fits, or whether you should be in `/ags-extend`, `/adt`, or talking to AccelByte sales.

`install-mcp` is optional. It connects your AI IDE to AGS so the IDE can query the AccelByte API and reference SDK context while you code. Best set up before step 7 if you want it.

`install-cli` is a prerequisite for some `connect-portal` and `observe` flows. If you skip it, those subskills will detect the missing CLI and prompt you to run it.

---

## Examples

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

---

## Subskills

| Subskill | What it does |
|---|---|
| `ask` | Answers questions about AGS — modules, deployment models, pricing shape, how it compares to EOS / PlayFab / DIY |
| `explore` | Read-only walkthrough of a customer's existing namespace: which modules are enabled, which IAM clients exist, which environments are configured |
| `wizard` | Interview-driven planning: which modules you need, which SDK fits your engine, which target platforms, and a starter integration plan |
| `connect-portal` | Bootstraps a namespace + IAM client + `.env` file for a new project |
| `install-sdk` | Detects the target SDK and installs/scaffolds Unreal, Unity, Godot, Roblox, the standalone **TypeScript Web SDK**, or custom-engine REST fallback. Unreal and Unity specifics live in engine references under `references/sdks/game-engine/`. **Extend SDKs (Go, Python, C#, Java) are owned by `/ags-extend`** — they're for Extend apps, not game clients. |
| `generate-ui` | Detects the game engine and routes AGS UI generation to the engine-specific workflow. Unreal is supported through `AccelByteUITools`; Unity is supported through the AccelByte Unity MCP server; Godot is explicitly unsupported for now. |
| `install-cli` | Installs the AGS CLI for namespace + IAM management |
| `install-mcp` | Picks and applies the right AGS API MCP URL for the user's deployment (Shared Cloud default / per-studio / Private Cloud). The MCP entry itself ships with the plugin via `content/mcps/ags-api.yaml`; this subskill is the URL-customization conversation. |
| `init` | End-to-end setup: runs wizard → connect-portal → install-sdk → install-cli → optional install-mcp |
| `integrate` | Module-by-module SDK wiring guide — auth, lobby, matchmaking, sessions, store, statistics, leaderboards, achievements, social, analytics |
| `debug` | Runs a game locally against AGS and traces integration failures (auth errors, lobby disconnects, matchmaking timeouts) |
| `observe` | Fetches logs, metrics, and event signals from a deployed namespace |
| `doctor` | Read-only symptom → cause diagnosis; hands off to the subskill that owns the fix |
| `handoff` | Decides when AGS isn't the right tool for the request, when to use internal `/ags ams ...`, when Access packaging under IAM fits, and when to point at `/ags-extend`, `/adt`, or AccelByte support |

---

## Structure

```
ags/
  SKILL.md              — router
  README.md             — this file
  workflows/
    online-game-flow.md  — canonical player-facing AGS game-flow contract
  capabilities/
    matchmaking/
      router.md
      plan.md
      ruleset.md
      pool.md
      integrate.md
      debug.md
    ams/
      router.md
      fleet.md
      upload.md
      session.md
      debug.md
  maps/
    capability-map.md
    dependency-map.md
    service-map.md
    migration-map.md
  subskills/
    ask.md
    explore.md
    wizard.md
    connect-portal.md
    install-sdk.md
    generate-ui.md
    install-cli.md
    install-mcp.md
    init.md
    integrate.md
    debug.md
    observe.md
    doctor.md
    handoff.md
  references/
    overview.md                  — shared: what AGS is, the core modules, deployment models
    glossary.md                  — shared: namespace, IAM client, OAuth, PCCU, environments
    faq.md                       — shared: common questions (pricing shape, EOS coexistence, on-prem, …)
    modules/
      iam.md                     — Identity & Access Management
      lobby.md                   — Party, presence, chat, invites (covers what public docs calls 'Chat' + 'Parties & Presence')
      matchmaking.md             — Rule-based matchmaking
      session.md                 — Session lifecycle, server assignment
      statistics.md              — Persistent player stats, cycles, and leaderboard inputs
      leaderboards.md            — Global & seasonal leaderboards
      achievements.md            — Achievement & progression system
      store-entitlements.md      — Catalog, purchase, wallet, DLC
      analytics.md               — Event ingestion & telemetry
      social.md                  — Friends, blocking, notifications (covers what public docs calls 'Friends' + related social features)
    sdks/                        — Game Engine SDKs + TypeScript Web SDK. Extend SDKs (Go/Python/C#/Java) live in /ags-extend.
      game-engine/
        unreal.md                — Unreal Engine SDK setup & idioms
        unity.md                 — Unity SDK setup & idioms
        unreal/install.md        — Unreal SDK install/scaffold flow used by /ags install-sdk
        unity/install.md         — Unity SDK install/scaffold flow used by /ags install-sdk
        godot.md                 — Godot SDK setup & idioms
        roblox.md                — Roblox SDK setup & idioms
        unreal/ui/               — Unreal AGS UI generation with AccelByteUITools
        unity/ui/                — Unity UI generation placeholder
        godot/ui/                — Godot UI generation placeholder
      web/
        typescript.md            — TypeScript SDK for web apps (standalone)
        webrtc-p2p.md            — Browser WebRTC P2P using AGS TURN/STUN concepts
    platforms/
      auth-provider-configuration.md — Per-provider login setup gates and required values
      pc-steam-epic.md           — Steam, Epic Games Store specifics
      console.md                 — PlayStation, Xbox, Switch specifics
      mobile.md                  — iOS, Android specifics
    deployment/
      shared-cloud.md            — Shared cloud (default)
      private-cloud.md           — Dedicated infra
      byoc.md                    — Bring-your-own AWS account
    pricing/
      pccu-bands.md              — PCCU bands and how they're metered
      tiers.md                   — Starter / Growth / Enterprise tiers
    ecosystem/                   — Pointers to adjacent products and AGS capability context. Architecturally:
                                 —   Extend, AMS, Matchmaking are all UNDER AGS.
                                 —   Matchmaking and AMS route through nested /ags capabilities.
                                 —   ADT is a separate AccelByte product.
                                 —   Access is the standalone packaging of AGS IAM.
      extend.md                  — Pointer to /ags-extend; when to use Extend
      ams.md                     — Pointer to /ags ams; when to use AMS
      matchmaking.md             — Pointer to /ags matchmaking; when to dive deep on matchmaking
      adt.md                     — Pointer to /adt; when to add ADT (build dist + crash reporting)
      access.md                  — Standalone Access packaging of AGS IAM
    init/
      modules-checklist.md       — Decision aid for module selection
      sdk-quickstart.md          — Per-engine starter snippets
    integrate/
      auth-flow.md               — End-to-end auth across platforms
      lobby-session.md           — Lobby + session interplay
      crossplay-identity.md      — Linking platform accounts
    debug/
      auth-failures.md           — Common auth error signatures and fixes
      lobby-disconnects.md       — Lobby disconnect symptoms and causes
      matchmaking-timeouts.md    — Matchmaking timeout symptoms and causes
    observe/
      cli-commands.md            — Operational commands via the AGS CLI
      event-catalog.md           — Pointer to the AGS event catalog
    cookbook/
      eos-coexistence.md         — Running AGS alongside Epic Online Services
      headless-account-linking.md — Bridging EOS / Steam / PSN identities
      live-ops-rollout.md        — Staged rollout patterns for AGS-backed features
    catalogs/
      modules.md                 — Quick lookup: every AGS module + one-line description
      sdks.md                    — SDK versions, supported platforms, install links
```

---

## Notes

- This skill is the **default entry point** for AccelByte questions, including deep Matchmaking and AMS work. Use `/ags matchmaking ...` and `/ags ams ...` for those lifecycles. Legacy Matchmaking and AMS compatibility shims remain for one release.
- Architecture clarification: Extend, AMS, and Matchmaking are *part of* AGS; Matchmaking and AMS now live under this canonical `/ags` entry point. Extend still has its own lifecycle skill, ADT is the only true sibling product, and Access is the standalone packaging of AGS IAM (a strict subset).
- Subskills are kept small. When a topic has multiple sub-areas (modules, SDKs, deployment, ecosystem), the subskill points into the right `references/` subdirectory rather than inlining everything.
- `references/modules/` covers the most common integration modules (IAM, Lobby, Matchmaking, Session, Statistics, Leaderboards, Achievements, Store/Entitlements, Analytics, Social) plus the generic TURN/STUN/P2P connectivity model. AGS has many additional modules (Cloud Save, Inventory, Rewards, Season Pass, Challenges, UGC, Chat, Guilds & Clans, Multiplayer Notifications, Legal & Privacy, and more) that are not covered by dedicated reference files here — point users to `https://docs.accelbyte.io/gaming-services/modules/` for the full list.
- `references/ecosystem/` is intentionally light — those files tell you *when* to bring in another capability router, workflow, skill, or product, not *how* to use it. The actual usage docs live in the owning capability, skill, or AccelByte's docs.
- `connect-portal` does not create production namespaces autonomously. It produces the IAM client and `.env` configuration; namespace creation and tier upgrades stay in the Admin Portal flow with an authorized human in the loop.
- Pricing references (PCCU bands, tier descriptions) are illustrative and grounded in AccelByte's published pricing. They go stale; subskills always point users at `https://accelbyte.io/pricing` for the current numbers rather than quoting them as authoritative.
