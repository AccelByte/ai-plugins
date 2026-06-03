---
description: Install or scaffold the AGS Unreal plugin set in an Unreal Engine project.
  Defaults to OnlineSubsystemAccelByte plus AccelByteUe4Sdk and AccelByteNetworkUtilities,
  with pinned official sources and OSS identity verification.
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/getting-started/setup-game-sdk/unreal-sdk/
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/general/module-initial-setup/unreal-module-initial-setup-install-the-accelbyte-game-sdk/
- https://github.com/AccelByte/accelbyte-unreal-oss
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin
- https://github.com/AccelByte/accelbyte-unreal-network-utilities
see-also:
- '[install-sdk.md](../../../../subskills/install-sdk.md)'
- '[unreal.md](../unreal.md)'
- '[sdk-quickstart.md](../../../init/sdk-quickstart.md)'
- '[connect-portal.md](../../../../subskills/connect-portal.md)'
---

# AGS Unreal SDK Install Reference

Detailed install flow for `/ags install-sdk` when the detected target is an Unreal Engine project. Install the AGS Unreal plugin set and verify that the project can authenticate against AGS.

Default to `OnlineSubsystemAccelByte` as the Unreal integration surface. Use direct `AccelByteUe4Sdk` / `FRegistry::User.*` calls only when the user explicitly asks for raw SDK integration, is building a low-level wrapper, or the project intentionally does not use Unreal OSS.

## Behavior Constraints

<grounding_rules>

Read `references/sdks/game-engine/unreal.md` before installing. Do not fabricate version compatibility or repo tags.

Note on declared sources: the first source (`setup-game-sdk/unreal-sdk/`) covers the standalone AccelByteUe4Sdk download-and-extract workflow. The OSS-first + git-submodule approach used by this reference is grounded in the Byte Wars tutorial source. Use the tutorial source as the authoritative reference for the `Plugins/AccelByte/` submodule install pattern.

Do not use generic web search for version discovery. Use only the official repo URLs listed in this file and the Unreal reference. To inspect available versions, ask for approval to run targeted Git commands such as `git ls-remote --tags <official-repo-url>` or use a user-provided tag. If the compatible tag is still unclear, ask the user to choose it before installing.

After installing the plugins, read the installed plugin docs, README files, sample config, or version-matched documentation for the exact `.uproject`, `Target.cs`, `Build.cs`, and `Config/DefaultEngine.ini` entries before writing configuration. Do not invent Unreal `.ini` key names or module names from memory.

When verifying Unreal C++ edits, read `references/sdks/game-engine/unreal-verification.md`. If Unreal Editor is already running and the Unreal SDK MCP tools are available, prefer `unreal_live_coding_compile`; otherwise use the normal Unreal build command.

</grounding_rules>

<dependency_checks>

Before installing:

1. An Unreal `.uproject` exists and the user confirms this is the target project.
2. AGS config values are useful for config and verification, but they are not required to install the Unreal plugins. If base URL, namespace, or client ID are missing from the project's chosen config source, still install the plugin set, then stop before AGS config/login verification and route to `/ags connect-portal`, which can use the AGS CLI to create/select IAM clients and enable login methods.
3. Unreal engine tooling exists well enough to regenerate or compile project files after installation. Do not run a baseline compile to infer whether AGS plugins are "discoverable through the engine install"; AGS Unreal plugins are project plugins for this workflow.

</dependency_checks>

<action_safety>

- Confirm the install method and versions before running commands.
- Check whether the target Unreal project is inside a Git worktree before choosing the install method.
- For Git-backed game projects, recommend `git submodule add` so official plugin repos are tracked as external dependencies in `.gitmodules`.
- For non-Git projects, use pinned `git clone` into `Plugins/AccelByte/`.
- Official release/source archives are the last resort when Git is unavailable or the team explicitly uses Marketplace/manual plugin workflows.
- Never copy plugins from arbitrary local checkouts or another workspace.
- Never search whole local drives (`D:\`, `E:\`, home directories, engine source trees, or other workspaces) for missing AccelByte plugin directories. A missing `Plugins/AccelByte/*` directory or a missing `.uproject` plugin dependency means "install from official source", not "discover a local copy".
- If network access is restricted, ask for permission to run the official `git submodule add`, `git clone`, or release download command. Do not replace the network install with local-drive discovery.
- Show config/code diffs before applying project edits.

</action_safety>

## Workflow

### Step 1: Confirm Unreal

Detect `.uproject`, read the engine version, and confirm with the user if multiple game projects are present.

Check only the target project's `Plugins/` directory and `.uproject` plugin references. If the project references `AccelByteUe4Sdk`, `OnlineSubsystemAccelByte`, or `AccelByteNetworkUtilities` but the matching plugin directory is absent, report the missing project plugin and continue to Step 2. Do not search other drives or the Unreal Engine install for a substitute.

Do not search the whole project for `*AccelByte*` as a substitute for installation. The relevant install state is limited to `.uproject`, `Plugins/AccelByte/`, `Config/DefaultEngine.ini`, and the module/target build files.

### Step 2: Pick Versions

Install the official plugin set under `Plugins/AccelByte/`:

- `OnlineSubsystemAccelByte` from `https://github.com/AccelByte/accelbyte-unreal-oss.git`
- `AccelByteUe4Sdk` from `https://github.com/AccelByte/accelbyte-unreal-sdk-plugin.git`
- `AccelByteNetworkUtilities` from `https://github.com/AccelByte/accelbyte-unreal-network-utilities.git`

Pin all three repos to tags or branches compatible with the project's Unreal Engine version.

Do not search the web for the tag. Use one of these allowed sources:

- A tag, branch, or commit the user provides.
- A targeted Git query against the official repo URL, after approval if network access is restricted.
- A release archive URL the user provides or explicitly approves.

### Step 3: Install

If the target project is Git-backed, recommend submodules and show commands shaped like:

```bash
git submodule add https://github.com/AccelByte/accelbyte-unreal-oss.git Plugins/AccelByte/OnlineSubsystemAccelByte
git submodule add https://github.com/AccelByte/accelbyte-unreal-sdk-plugin.git Plugins/AccelByte/AccelByteUe4Sdk
git submodule add https://github.com/AccelByte/accelbyte-unreal-network-utilities.git Plugins/AccelByte/AccelByteNetworkUtilities
```

Then check out the confirmed tags or branches in each submodule.

If the target project is not Git-backed, use pinned clones:

```bash
git clone --branch <confirmed-tag-or-branch> https://github.com/AccelByte/accelbyte-unreal-oss.git Plugins/AccelByte/OnlineSubsystemAccelByte
git clone --branch <confirmed-tag-or-branch> https://github.com/AccelByte/accelbyte-unreal-sdk-plugin.git Plugins/AccelByte/AccelByteUe4Sdk
git clone --branch <confirmed-tag-or-branch> https://github.com/AccelByte/accelbyte-unreal-network-utilities.git Plugins/AccelByte/AccelByteNetworkUtilities
```

For exact commits, clone the official repo, then check out the confirmed commit in the plugin directory. Do not run `git submodule add` in a non-Git Unreal project; it will fail because there is no parent Git worktree.

If Git is unavailable or the user explicitly chooses a manual plugin workflow, download official GitHub release/source archives with an available platform tool (`curl`, `wget`, or PowerShell `Invoke-WebRequest`), extract each archive into the matching `Plugins/AccelByte/<PluginName>` directory, and record the pinned archive URL or tag.

If any install command requires network access and the environment blocks it, request approval for that official command. The fallback is a user-confirmed official release archive, not a recursive local filesystem search.

### Step 4: Configure

Enable all three plugins in the `.uproject` as required by the current docs. Update `Target.cs`, `Build.cs`, and `Config/DefaultEngine.ini` as needed for `OnlineSubsystemAccelByte`, identity, sessions, lobby, and the current SDK configuration keys.

If AGS settings are missing from the project's chosen config source, do only the plugin enable/build-file edits that do not require namespace/client values. Then stop with:

```text
Unreal SDK plugins installed

  Engine:           Unreal Engine <version>
  SDK version:      <pinned OSS/Game SDK/Network Utilities tags>
  Install path:     ./Plugins/AccelByte/
  AGS config:       missing
  Verification:     skipped; AGS config missing

Next step: /ags connect-portal, then rerun /ags install-sdk to configure and verify login
```

Do not fall back to integration code or device ID login wiring before the plugin install step is complete.

Do not add empty placeholder values to `Config/DefaultEngine.ini`. If AGS values are missing, hand off to `/ags connect-portal`; that subskill owns using the AGS CLI to create/select a public IAM client, enable Device ID login when exposed by the CLI, and write real config values into the project's chosen config source.

### Step 5: Verify

Use the OSS identity path for the test login, including device ID login. Confirm a token comes back and a profile call works. Do not verify a default OSS install by calling `FRegistry::User.LoginWithDeviceId(...)` directly.

### Step 6: Output

End with:

```text
SDK installed

  Engine:           Unreal Engine <version>
  SDK version:      <pinned OSS/Game SDK/Network Utilities tags>
  Install path:     ./Plugins/AccelByte/
  AGS config:       present
  Verification:     OSS identity login OK

Next step: /ags integrate (start with IAM)
```
