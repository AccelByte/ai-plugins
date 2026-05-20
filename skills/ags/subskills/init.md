---
name: ags-init
description: 'Checklist-driven AGS initializer: project check, SDK/plugin install,
  AGS CLI and Unreal SDK MCP setup, connect-portal with user-supplied base URL/namespace/client
  ID, optional AGS API MCP URL setup, and final summary.'
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/getting-started/setup-game-sdk/unreal-sdk/
see-also:
- '[connect-portal.md](connect-portal.md)'
- '[install-sdk.md](install-sdk.md)'
- '[install-unreal-sdk.md](install-unreal-sdk.md)'
- '[install-unity-sdk.md](install-unity-sdk.md)'
- '[install-cli.md](install-cli.md)'
- '[install-mcp.md](install-mcp.md)'
---

# AGS Project Initializer

Checklist-driven guide for getting an existing game or app project ready for AGS integration. This initializer is intentionally procedural: expose the checklist, mirror it into `update_plan`, then execute one step at a time.

## Mandatory Checklist Protocol

### Codex-only checklist handling

Codex must read this checklist before taking action, then call `update_plan` with each checklist item as a plan step. Before starting a checklist item, update that item to `in_progress`. After finishing and verifying it, update that item to `completed`. Only one checklist item may be `in_progress` at a time.

Do not collapse steps, skip `update_plan`, or mark multiple items `in_progress`. If a step stops early, leave it `in_progress` or move it back to `pending` only if the user explicitly chooses to pause or retry later.

For non-Codex agents, mirror the checklist using the agent's native task-tracking mechanism if one exists. If the runtime has no task tracker, announce the active checklist item in text and keep the same one-step-at-a-time sequencing.

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
  Unreal SDK MCP:    configured / already present / skipped - <reason>
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

1. The checklist has been mirrored into `update_plan`.
2. Project type has been detected and reported.
3. Required AGS game SDK/plugins for the detected project have been installed or confirmed already present.
4. AGS CLI and the Unreal SDK MCP server tooling have been installed/configured or explicitly skipped with a reason.
5. `connect-portal` has run with confirmed base URL, namespace, and client ID.
6. The user has been asked whether to configure the AGS API MCP. If yes, the MCP URL uses the confirmed base URL plus `/mcp`.
7. The final summary has been printed.

</completeness_contract>

## Workflow

### Step 0: Mirror The Checklist Into update_plan

Before Step 1, call `update_plan` with these exact plan steps:

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

Use the detected project type to select the installer subskill. Read the selected subskill before taking action.

- Unreal -> read and run `subskills/install-unreal-sdk.md`.
- Unity -> read and run `subskills/install-unity-sdk.md`.
- Godot, Roblox, Web, or other/custom -> read and run `subskills/install-sdk.md`.

This step must check whether the relevant AGS SDK/plugin is already installed. If it is missing, install it through the selected subskill. If it is already present, verify enough to report "already present" with evidence.

If plugin/SDK installation or verification fails, stop here and print:

```text
Stopped at checklist item: Install game SDK/plugins

Reason: <error>
Resume: fix the issue, then re-run /ags init or run the selected SDK installer directly.
```

When verified, mark `Install game SDK/plugins` completed and `Set up tools` in progress.

### Step 3: Set up tools

Set up both required tools:

1. AGS CLI.
2. AccelByte Unreal SDK MCP server.

For AGS CLI:

- Check `ags --version`.
- If present, record "already present".
- If missing, read and run `subskills/install-cli.md`.
- If the user declines installation, record "declined" and continue only if the next stage can proceed with user-provided values.

For the Unreal SDK MCP server:

#### Codex-only Unreal SDK MCP setup

This block applies only when the user is running Codex. Codex needs a project-scoped `.codex/config.toml` entry because it does not consume the JSON MCP config used by Claude Code, Cursor, Kiro, or similar IDEs.

- Check whether the project-scoped Codex config exists at `<project>/.codex/config.toml` when the user is running Codex.
- Codex plugin install intentionally leaves `plugins/accelbyte-ai-plugins/.codex/config.toml` empty. Do not merge that file as a ready-made MCP config.
- The MCP declaration source is `content/mcps/unreal-sdk.yaml`, but for Codex prefer a project-scoped local clone over `uvx --from git`.
- Clone the MCP server into `.codex/mcp/unreal-sdk-mcp-server` if it is not already present.
- Install its Python requirements with `python -m pip install -r .codex/mcp/unreal-sdk-mcp-server/requirements.txt`.
- Write only the needed project-scoped `[mcp_servers.unreal_sdk]` entry.
- Do not use the AGS API MCP subskill for this tool; AGS API MCP is handled later.

For Codex Unreal projects, prefer this local-clone setup:

```powershell
git clone https://github.com/AccelByte/unreal-sdk-mcp-server.git .codex/mcp/unreal-sdk-mcp-server
python -m pip install -r .codex/mcp/unreal-sdk-mcp-server/requirements.txt
python .codex/mcp/unreal-sdk-mcp-server/generate_cache.py
```

The `generate_cache.py` step is mandatory — without it the server starts but has no symbol cache and provides no useful tool responses. It requires Doxygen XML files in `data/unreal-sdk/` and `data/oss-sdk/` inside the cloned server directory.

Then write this project-scoped config entry:

```toml
[mcp_servers.unreal_sdk]
command = "python"
args = [".codex/mcp/unreal-sdk-mcp-server/server.py"]
```

Do not use `uvx --from git+https://github.com/AccelByte/unreal-sdk-mcp-server@main` as the preferred Codex config. Keep `uvx` as a fallback only when the user explicitly wants no local clone.

After writing config, tell the user to restart Codex or reload MCP servers. The setup is not verified until Codex shows tools for `unreal_sdk` or a smoke run of the local `server.py` reaches MCP initialization without crashing.

#### Non-Codex Unreal SDK MCP setup

If the user is not running Codex, do not edit `.codex/config.toml` and do not require the local `.codex/mcp/...` clone path. Guide them through the relevant `INSTALL.md` MCP setup for `AccelByte Unreal SDK MCP Server`, using that IDE's native MCP config format.

If tool setup fails in a way that blocks connect-portal, stop here. Otherwise mark `Set up tools` completed and `Connect portal` in progress.

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

1. Recreate the full checklist with `update_plan`.
2. Inspect disk/config to identify completed items.
3. Mark already-verified items as `completed`.
4. Mark the next incomplete item as `in_progress`.
5. Continue from that item only.

Do not re-run plugin/SDK installers, tool installers, or connect-portal if their artifacts are already verified, unless the user explicitly asks to reinstall or overwrite.

## Error handling

- **Multiple project types detected** - ask which project should be initialized.
- **No project type detected** - treat as other/custom only after telling the user no Unreal, Unity, Godot, Roblox, or Web project markers were found.
- **SDK/plugin installer unavailable for project type** - stop at `Install game SDK/plugins` and point to the closest installer.
- **AGS CLI install declined** - continue only if connect-portal can proceed from the user-provided base URL, namespace, and client ID.
- **Unreal SDK MCP setup skipped** - continue, but record the skip reason in the final summary.
- **Missing base URL, namespace, or client ID** - ask. Do not run connect-portal until all three are known.
- **AGS API MCP declined** - record declined and finish.
