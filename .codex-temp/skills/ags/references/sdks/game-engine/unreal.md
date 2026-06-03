---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/getting-started/setup-game-sdk/unreal-sdk/
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/general/module-initial-setup/unreal-module-initial-setup-install-the-accelbyte-game-sdk/
- https://github.com/AccelByte/accelbyte-unreal-oss
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin
- https://github.com/AccelByte/accelbyte-unreal-network-utilities
see-also:
- '[unity.md](unity.md)'
- '[godot.md](godot.md)'
- '[roblox.md](roblox.md)'
- '[typescript.md](../web/typescript.md)'
- '[unreal-verification.md](unreal-verification.md)'
- '[unreal-p2p.md](unreal-p2p.md)'
- '[install-sdk.md](../../../subskills/install-sdk.md)'
- '[unreal-install.md](unreal/install.md)'
---

# SDK — Unreal Engine

The AGS **Unreal Engine SDK** for game clients and dedicated game servers. Supports Unreal Engine 4.27+ (4.25+ per GitHub SDK plugin repos); UE 5.0–5.6.x stable, 5.7.x Beta. Wraps the AGS REST + OpenAPI surface; same module shape as the Unity, Godot, and Roblox SDKs.

For normal Unreal game-client work, prefer the AGS Unreal Online Subsystem (`OnlineSubsystemAccelByte`) as the integration surface. It implements Unreal's Online Subsystem interfaces and should be the default path for identity/auth, sessions, lobby, and gameplay-facing AGS flows. Use direct `AccelByteUe4Sdk` / `FRegistry::User.*` calls only when the user explicitly asks for raw SDK integration, is building a low-level wrapper, or the project is intentionally not using OSS.

When editing or verifying Unreal C++ code, also read `unreal-verification.md`. If the Unreal Editor is already running and the Unreal SDK MCP tools are available, prefer live coding compile verification before falling back to a normal Unreal build.

For peer-to-peer sessions, also read `unreal-p2p.md`; it contains the reusable Session V2, Network Utilities, and `GameNetDriver` setup for both custom/joinable sessions and matchmaking-created sessions.

> **Versions move.** Treat the version range above as a starting point. Do not use generic web search to discover compatible tags. Use targeted Git queries against the official repos listed below, a user-provided tag, or a user-approved official release archive.

---

## What's in scope here

- Installation paths: Marketplace/manual plugin install from official release archives, Git submodules, or pinned Git clones depending on team workflow.
- Default Unreal plugin set:
  - `OnlineSubsystemAccelByte` from `https://github.com/AccelByte/accelbyte-unreal-oss.git`
  - `AccelByteUe4Sdk` from `https://github.com/AccelByte/accelbyte-unreal-sdk-plugin.git`
  - `AccelByteNetworkUtilities` from `https://github.com/AccelByte/accelbyte-unreal-network-utilities.git`
- Recommended project layout: `Plugins/AccelByte/OnlineSubsystemAccelByte`, `Plugins/AccelByte/AccelByteUe4Sdk`, and `Plugins/AccelByte/AccelByteNetworkUtilities`.
- Module structure: `OnlineSubsystemAccelByte` is the preferred high-level Unreal integration API; `AccelByteUe4Sdk` exposes lower-level AGS module services; `AccelByteNetworkUtilities` provides ICE-based P2P NAT punchthrough and is a required companion to `OnlineSubsystemAccelByte` for peer-to-peer session connectivity.
- Convention: Unreal-friendly delegate-based async — request → success delegate / error delegate. (Inferred convention based on Unreal idioms — verify against SDK README.)
- Build target shape: client builds use a public IAM client; dedicated server builds use a confidential IAM client with a server secret.

`references/sdks/game-engine/unreal/install.md` is the operational install flow used by `/ags install-sdk` for Unreal projects. This file is the conceptual "what is the Unreal SDK?" reference.

## Install workflow

Default to a reproducible install. For Git-backed projects, recommend Git submodules so official plugin repos are tracked as external dependencies in `.gitmodules`:

```bash
git submodule add https://github.com/AccelByte/accelbyte-unreal-oss.git Plugins/AccelByte/OnlineSubsystemAccelByte
git submodule add https://github.com/AccelByte/accelbyte-unreal-sdk-plugin.git Plugins/AccelByte/AccelByteUe4Sdk
git submodule add https://github.com/AccelByte/accelbyte-unreal-network-utilities.git Plugins/AccelByte/AccelByteNetworkUtilities
```

After adding the submodules, check out tags or branches compatible with the project's Unreal Engine version. Do not guess compatibility from memory. Do not search the web for compatibility. If tags need discovery, ask approval for targeted Git commands such as `git ls-remote --tags <official-repo-url>` against the official repos listed in this file. If the compatible tags are unclear, ask the user to choose the tags before installing.

For non-Git projects, use pinned `git clone` installs into `Plugins/AccelByte/<PluginName>`. Manual release/source archives are the fallback when Git is unavailable or the team uses Marketplace/manual plugin workflows. Do not copy plugin directories from arbitrary local checkouts or another workspace; that is not reproducible and hides the source version.

Do not search whole local drives or engine source trees for `AccelByteUe4Sdk`, `OnlineSubsystemAccelByte`, or `AccelByteNetworkUtilities` when a project plugin is missing. A missing plugin directory under the target project's `Plugins/AccelByte/` path should be fixed by installing from the official repos or a user-confirmed official release archive. If the environment blocks Git/network access, ask for permission to run the official install command instead of substituting a local copy.

Enable all three plugins in the `.uproject`, add the modules to the relevant target/build files when required by the current docs, regenerate project files, and compile.

Installing the plugin set does not require `.env` or namespace/client values. If AGS config is missing, install and enable the plugins first, then route to `/ags connect-portal` before config and login verification. Do not add empty placeholder config values; `connect-portal` owns using the AGS CLI to create/select IAM clients, enable login methods such as Device ID when exposed by the CLI, and write real project config.

Configure AGS through `Config/DefaultEngine.ini`: SDK base settings go under `[/Script/AccelByteUe4Sdk.AccelByteSettings]` (client credentials, base URL, namespace) and `[/Script/AccelByteUe4Sdk.AccelByteServerSettings]` (dedicated server settings). `[OnlineSubsystemAccelByte]` is the OSS-layer configuration, on top of those base settings. For device ID login in an OSS project, verify through the OSS identity login path rather than direct `FRegistry::User.LoginWithDeviceId(...)`.

## Common gotchas

- **Public vs. confidential client mixup** — using the dedicated-server SDK with a public client (or vice versa) silently fails at token-exchange time. The error usually shows up in a Lobby or Session call later.
- **UE 5 module renames** — engine version transitions occasionally rename modules; pin SDK version against the engine version when supporting multiple branches.
- **SDK-only installs** — installing only `AccelByteUe4Sdk` is incomplete for the recommended Unreal path. Install `OnlineSubsystemAccelByte` and `AccelByteNetworkUtilities` as well unless the user explicitly chose raw SDK integration.
- **P2P net driver config wraps** — `NetDriverDefinitions` entries in `DefaultEngine.ini` must stay on one physical line. If `DriverClassName="/Script/..."` is split across lines, Unreal logs `Bad quoted string` and then fails to create `GameNetDriver`.
- **Non-Git projects** — `git submodule add` requires a parent Git worktree. Use pinned `git clone` first; use official release/source archives only when Git is unavailable or the team explicitly wants manual plugin management.
- **Local copy drift** — copying from `D:\...` or another local repo makes the workflow non-reproducible. Use a pinned official repo, submodule, clone, or release archive.
- **Drive-wide discovery** — recursive searches such as `Get-ChildItem D:\ -Recurse -Filter AccelByteUe4Sdk` are not part of the installer workflow. They are slow, brittle, and bias the agent toward non-reproducible local state.
- **Config-before-install deadlock** — missing `.env` should not block plugin installation. It only blocks AGS config and login verification.
- **Async ownership** — delegate captures must respect Unreal's GC. Use weak object pointers or `TWeakObjectPtr` to avoid stale captures across async boundaries.

## Where this SDK ends

- **Native C++ projects on a custom (non-Unreal) engine** — integrate via REST + OpenAPI, not the Unreal SDK.
- **Extend SDKs** (Go / Python / C# / Java) — these are unrelated to the Unreal SDK; they're used by Extend apps. Owned by `/ags-extend`.

## Where to look in the docs

- AccelByte Unreal SDK docs: `https://docs.accelbyte.io/`
- Unreal SDK source / releases: `https://github.com/AccelByte/accelbyte-unreal-sdk-plugin`
- Unreal OSS source / releases: `https://github.com/AccelByte/accelbyte-unreal-oss`
- Unreal Network Utilities source / releases: `https://github.com/AccelByte/accelbyte-unreal-network-utilities`
