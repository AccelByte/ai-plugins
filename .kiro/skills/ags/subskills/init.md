---
name: ags-init
description: 'Checklist-driven AGS initializer: project check, SDK/plugin install,
  AGS CLI setup, optional engine SDK MCP setup, connect-portal with user-supplied
  base URL/namespace/client ID, optional AGS API MCP URL setup, and final summary.'
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/getting-started/setup-game-sdk/unreal-sdk/
see-also:
- '[connect-portal.md](connect-portal.md)'
- '[install-sdk.md](install-sdk.md)'
- '[unreal-install.md](../references/sdks/game-engine/unreal/install.md)'
- '[unity-install.md](../references/sdks/game-engine/unity/install.md)'
- '[install-cli.md](install-cli.md)'
- '[install-mcp.md](install-mcp.md)'
---

# AGS Project Initializer

Checklist-driven guide for getting an existing game or app project ready for AGS integration. This initializer is intentionally procedural: expose the checklist, mirror it into the host-native progress tracker, then execute one step at a time.

## Checklist

- [ ] Project check
- [ ] Install game SDK/plugins
- [ ] Set up tools
- [ ] Connect portal
- [ ] Configure AGS API MCP
- [ ] Final summary

## Behavior Constraints

<grounding_rules>

- Each install/setup stage is owned by another subskill or plugin artifact. Read the relevant file before running that stage and follow it exactly.
- Do not run the older `wizard` flow from this initializer. This flow starts from project detection, then installs what the detected project needs.
- Do not invent project types. Detect Unreal, Unity, Godot, Roblox, Web, or "other/custom" from files on disk, then report what was found.
- Never auto-install language runtimes, game engines, Docker, Node, or IDEs. Detect and report missing prerequisites.
- `connect-portal` must use user-supplied AGS values for base URL, namespace, and client ID. Ask for those values at that stage if they were not already supplied.
- The optional AGS API MCP URL is derived from the connect-portal base URL by appending `/mcp` after trimming a trailing slash.

</grounding_rules>

<tool_usage_rules>

- `Glob` and `Bash` for project detection and environment checks.
- `Read` to load each subskill before delegating to it.
- `Write` / `Edit` only when the delegated subskill allows project or config changes.
- Respect the allowed tools and action-safety rules of the delegated subskill.

</tool_usage_rules>

<action_safety>

This initializer can install SDK plugins, edit game/app config, install global tooling, and edit IDE MCP config.

- Announce the current checklist item before starting it.
- Report what changed before moving to the next checklist item.
- If any required step fails, stop immediately and print a "Stopped at checklist item" block. Do not continue to later steps.
- Ask before editing user-scoped or workspace-scoped IDE MCP config.
- Do not create or change AGS portal resources until the user has provided or confirmed base URL, namespace, and client ID.

</action_safety>

<output_contract>

Final summary format:

```text
Done initializing AGS integration.

  Project:           <Unreal / Unity / Godot / Roblox / Web / other> (<path or detection note>)
  Plugins/SDK:       installed / already present / skipped - <reason>
  AGS CLI:           installed / already present / declined / failed - <reason>
  Engine SDK MCP:    configured / already present / unsupported / skipped - <reason>
  Base URL:          <base-url>
  Namespace:         <namespace>
  Client ID:         <client-id>
  AGS API MCP:       configured at <base-url>/mcp / declined / skipped - <reason>

Next:
  - /ags integrate - wire IAM, then the next AGS module you need.
  - /ags debug - run locally and diagnose auth or runtime failures.
```

Do not print this summary if the flow stopped early. Print the stop block instead.

</output_contract>

<completeness_contract>

`init` is complete when:

1. The checklist has been mirrored into the host-native progress tracker or a visible checklist fallback.
2. Project type has been detected and reported.
3. Required AGS game SDK/plugins for the detected project have been installed or confirmed already present.
4. AGS CLI and any applicable engine SDK MCP tooling have been installed/configured, reported unsupported, or explicitly skipped with a reason.
5. `connect-portal` has run with confirmed base URL, namespace, and client ID.
6. The user has been asked whether to configure the AGS API MCP. If yes, the MCP URL uses the confirmed base URL plus `/mcp`.
7. The final summary has been printed.

</completeness_contract>

## Workflow

### Step 0: Mirror The Checklist Into The Host-Native Progress Tracker

Before Step 1, mirror these exact plan steps into the host-native progress tracker. If the harness has no native tracker, keep the same steps as a visible checklist in the response:

1. Project check
2. Install game SDK/plugins
3. Set up tools
4. Connect portal
5. Configure AGS API MCP
6. Final summary

Set only `Project check` to `in_progress`; all other steps start as `pending`.

### Step 1: Project check

Detect the project type from the current workspace.

Run project-shape checks:

```powershell
Get-ChildItem -Recurse -Filter *.uproject
Get-ChildItem -Recurse -Filter ProjectSettings -Directory
Get-ChildItem -Recurse -Filter Assets -Directory
Get-ChildItem -Recurse -Filter project.godot
Get-ChildItem -Recurse -Include *.rbxlx,*.rbxl -File
Get-ChildItem -Recurse -Filter package.json
```

Interpretation:

- `.uproject` -> Unreal.
- `Assets/` plus `ProjectSettings/` -> Unity.
- `project.godot` -> Godot.
- `.rbxlx` or `.rbxl` -> Roblox.
- `package.json` without a game-engine signal -> Web.
- None or mixed signals -> other/custom, or ask the user if multiple project types are plausible.

Report the detected project and any hard blockers, such as a missing required engine for a detected game project. When verified, mark `Project check` completed and `Install game SDK/plugins` in progress.

### Step 2: Install game SDK/plugins

Use the detected project type to run the unified SDK installer. Read `subskills/install-sdk.md` before taking action; it will read the matching engine reference for Unreal, Unity, Godot, Roblox, Web, or custom-engine REST fallback.

- Unreal -> `/ags install-sdk`, reading `references/sdks/game-engine/unreal/install.md`.
- Unity -> `/ags install-sdk`, reading `references/sdks/game-engine/unity/install.md`.
- Godot, Roblox, Web, or other/custom -> `/ags install-sdk`, reading the matching SDK reference.

This step must check whether the relevant AGS SDK/plugin is already installed. If it is missing, install it through `/ags install-sdk`. If it is already present, verify enough to report "already present" with evidence.

If plugin/SDK installation or verification fails, stop here and print:

```text
Stopped at checklist item: Install game SDK/plugins

Reason: <error>
Resume: fix the issue, then re-run /ags init or run /ags install-sdk directly.
```

When verified, mark `Install game SDK/plugins` completed and `Set up tools` in progress.

### Step 3: Set up tools

Set up required and optional tools:

1. AGS CLI.
2. Engine SDK MCP only when supported and useful for the detected project.

For AGS CLI:

- Check `ags --version`.
- If present, record "already present".
- If missing, read and run `subskills/install-cli.md`.
- If the user declines installation, record "declined" and continue only if the next stage can proceed with user-provided values.

For Engine SDK MCP:

- Unreal -> read `references/sdks/game-engine/unreal/mcp.md` and follow that workflow when the user is running an IDE that supports MCP, or record "skipped" with the exact reason.
- Unity, Godot, Roblox, Web, or other/custom -> record "unsupported - no engine SDK MCP is available for this project type"; do not run Unreal SDK MCP setup.
- AGS API MCP is handled later in Step 5 and remains available for every project type.


An unsupported or skipped Engine SDK MCP is non-blocking. Continue to `connect-portal` after recording that status. Stop here only if a failed tool setup prevents the project from reaching `connect-portal`.

### Step 4: Connect portal

Before reading or running `connect-portal`, ensure these values are known:

- `base_url`: AGS environment base URL, for example `https://development.accelbyte.io` or a studio/private-cloud base URL.
- `namespace`: AGS namespace to use.
- `client_id`: IAM client ID to write into the project config.

Ask the user for any missing value. Do not guess. Then read `subskills/connect-portal.md` and run it with those confirmed values.

The connect-portal stage should write or verify the project runtime configuration for the detected project type. For Unreal projects, the authoritative runtime config is `Config/DefaultEngine.ini`; do not treat `.env` alone as complete for Unreal.

When connect-portal has verified the config, mark `Connect portal` completed and `Configure AGS API MCP` in progress.

### Step 5: Configure AGS API MCP

Ask:

```text
Do you want to configure the AGS API MCP for this project? If yes, I will use:
<base_url-without-trailing-slash>/mcp
```

If the user says yes:

1. Compute `mcp_url` as the confirmed `base_url` with any trailing slash removed, plus `/mcp`.
2. If the user is running Codex, use this Codex-only config path. Codex requires the project-scoped `<project>/.codex/config.toml` `ags_api` entry; other IDEs should not be asked to edit this TOML file:

   ```toml
   [mcp_servers.ags_api]
   url = "<mcp_url>"
   ```

3. If the user is not running Codex, read `subskills/install-mcp.md` and run it using the computed URL in that IDE's native MCP config. If the subskill asks for deployment shape, use the explicit URL as the target and avoid changing it to a different pattern.

If the user says no, record "declined". If the plugin MCP config is not installed yet, record "skipped - plugin MCP config not installed" and tell the user they can run `/ags install-mcp` later.

When the MCP decision is recorded and any requested config is verified, mark `Configure AGS API MCP` completed and `Final summary` in progress.

### Step 6: Final summary

Print the summary from `output_contract` with the actual statuses gathered during the checklist.

After printing, mark `Final summary` completed. No checklist item should remain `in_progress`.

## Resuming an interrupted init

When resuming:

1. Recreate the full checklist in the host-native progress tracker or visible checklist fallback.
2. Inspect disk/config to identify completed items.
3. Mark already-verified items as `completed`.
4. Mark the next incomplete item as `in_progress`.
5. Continue from that item only.

Do not re-run plugin/SDK installers, tool installers, or connect-portal if their artifacts are already verified, unless the user explicitly asks to reinstall or overwrite.

## Error handling

- **Multiple project types detected** - ask which project should be initialized.
- **No project type detected** - treat as other/custom only after telling the user no Unreal, Unity, Godot, Roblox, or Web project markers were found.
- **SDK/plugin installer unavailable for project type** - stop at `Install game SDK/plugins` and point to `/ags install-sdk`.
- **AGS CLI install declined** - continue only if connect-portal can proceed from the user-provided base URL, namespace, and client ID.
- **Engine SDK MCP setup skipped or unsupported** - continue, but record the skip or unsupported reason in the final summary.
- **Missing base URL, namespace, or client ID** - ask. Do not run connect-portal until all three are known.
- **AGS API MCP declined** - record declined and finish.
