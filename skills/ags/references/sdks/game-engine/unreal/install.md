---
description: Install or scaffold the AGS Unreal plugin set in an Unreal Engine project.
  Defaults to OnlineSubsystemAccelByte plus AccelByteUe4Sdk and AccelByteNetworkUtilities,
  with pinned official sources and OSS identity verification.
last-verified: 2026-07-14
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

Do not use generic web search for version discovery. Use only the official repo URLs listed in this file and the Unreal reference. To inspect available versions, ask for approval to run targeted Git commands such as `git ls-remote --tags --sort=-v:refname <official-repo-url>` (newest-first) or use a user-provided tag. Resolve a **tag**, not a branch. Do not trust raw tag order — these repos mix tag schemes, so cross-check each plugin's `.uplugin` `VersionName` for the authoritative current release, and gate engine compatibility on the repo README's `## Supported Unreal Engine` checklist read at the candidate tag — not on the `.uplugin` `EngineVersion`, which is only a base marker (Step 2 gives the exact commands). Select the newest tag compatible with the project's Unreal Engine version — do not pin a remembered version. If the compatible tag is still unclear, ask the user to choose it before installing.

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
- If a `git submodule add` or `git clone` fails to authenticate against a private or invite-only plugin repo, authenticate via `gh` or an SSH key and retry. A private repo reports this as `Repository not found` — that is an access problem, not a missing repo, a wrong URL, or a cue to search local drives. This plugin install keeps its no-local-copy rule: if access still can't be established, the last resort is a user-confirmed official release archive at a pinned version, not an arbitrary local copy. The AccelByte preflight's git-acquisition guidance covers the full ladder.
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

Pin all three repos to a **tag** compatible with the project's Unreal Engine version. Resolve the newest compatible tag rather than a remembered one, and confirm it with the user before installing. Resolve per plugin:

1. **Detect the project's Unreal Engine version** (from the `.uproject` engine association / project setup).

2. **List candidate tags, newest-first**, from the official repo:

   ```bash
   git ls-remote --tags --sort=-v:refname <official-repo-url> \
     | grep -v '\^{}' | awk '{print $2}' | sed 's#refs/tags/##'
   ```

   Ignore pre-release tags (`-beta`, `-rc`, `-alpha`) unless the user asks for one.

3. **Identify the true latest tag — cross-check the `.uplugin` `VersionName`.** Do not trust raw tag order — these repos mix tag schemes, so `--sort=-v:refname` can float a stale line to the top (real example: `accelbyte-unreal-sdk-plugin` sorts `v2.0.0` / `mpv2-2.0` above the current `28.8.0`; `accelbyte-unreal-network-utilities` sorts `v2.1.0` above the current `5.0.8`). The `VersionName` on the default branch is the authoritative current release; the tag matching it is the latest:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/AccelByte/accelbyte-unreal-oss/main/OnlineSubsystemAccelByte.uplugin        | grep '"VersionName"'
   curl -fsSL https://raw.githubusercontent.com/AccelByte/accelbyte-unreal-sdk-plugin/main/AccelByteUe4Sdk.uplugin          | grep '"VersionName"'
   curl -fsSL https://raw.githubusercontent.com/AccelByte/accelbyte-unreal-network-utilities/master/AccelByteNetworkUtilities.uplugin | grep '"VersionName"'
   ```

   **If `VersionName` can't be read** (missing field, private-repo fetch fails): still do not trust raw tag order. Read the `.uplugin` at the top few candidate tags to find the real version, or fall back to the newest clean numeric-scheme tag (skip `v*` / `mpv2-*` / pre-release lines), flag the mixed-scheme risk, and confirm the choice with the user before pinning.

4. **Gate compatibility on the README `## Supported Unreal Engine` checklist — not `EngineVersion`.** The `.uplugin` `EngineVersion` field is only a base marker (it is a constant `4.27` even on the latest release, and absent on older tags); it does **not** tell you which engine versions a release supports. The authoritative compatibility matrix is the repo README's `## Supported Unreal Engine` checklist, and it is versioned per tag. Read it **at the candidate tag** and confirm the project's engine version is checked `[x]`:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/AccelByte/accelbyte-unreal-sdk-plugin/<tag>/README.md \
     | grep -iE "Supported Unreal|Unreal Engine 5|Unreal Engine 4"
   ```

   If the newest tag does not check the project's engine version, step back to the newest tag whose README does.

   **If no README checklist exists** for a plugin or tag (e.g. `accelbyte-unreal-network-utilities`, a companion used as a submodule of the OSS, ships none; some older tags omit it): pin the latest tag by `VersionName`, but **state plainly that engine compatibility could not be auto-verified from the repo**, and confirm against the AccelByte docs compatibility matrix (`https://docs.accelbyte.io/`) or explicit user confirmation before pinning. `accelbyte-unreal-network-utilities` tracks the OSS's engine support — align its choice with the resolved OSS tag.

5. **Nothing resolvable or signals conflict — ask, don't guess.** When tag schemes conflict, no tag's README checks the project's engine version, or the repo signals can't be read at all, present the top candidate tags plus the detected engine version and have the user choose — or accept a user-supplied tag or an approved official release archive per `<action_safety>`. Never pin a guessed version.

Do not search the web for the tag; use only `git ls-remote`, the `.uplugin`/README from the official repos, a user-provided tag, or a user-approved official release archive. **Do not use `release/*` branches to select an engine version** — they are plugin-version backport lines (`release/24.11.1`, `release/23.2.2`, …), not engine-version selectors. Use a branch only if the user explicitly wants a specific older plugin line, and prefer a tag on that line. Select the newest compatible tag, show it to the user, and pin only after they confirm.

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

If a submodule/clone fails to authenticate (the repo is private or invite-only), authenticate with `gh` (it bootstraps git's credentials, so `git submodule add` then works) or SSH, then retry the same command. Do not switch to a different repo URL or search local drives. The AccelByte preflight's git-acquisition guidance has the full ladder, including installing `gh`.

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
