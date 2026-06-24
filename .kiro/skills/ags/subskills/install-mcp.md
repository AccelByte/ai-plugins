---
name: ags-install-mcp
description: Set up AGS-related MCP entries in the user's AI IDE. Handles the engine-neutral
  AGS API MCP URL workflow and routes engine SDK MCP requests to engine-specific references.
allowed-tools: Read Edit Bash Glob
model: sonnet
last-verified: 2026-06-17
sources:
- https://github.com/AccelByte/ags-api-mcp-server
- https://prod.gamingservices.accelbyte.io/mcp
see-also:
- '[install-cli.md](install-cli.md)'
- '[unreal-mcp.md](../references/sdks/game-engine/unreal/mcp.md)'
- '[unity-mcp.md](../references/sdks/game-engine/unity/mcp.md)'
- '[godot-mcp.md](../references/sdks/game-engine/godot/mcp.md)'
---

# AGS MCP Setup

This subskill is the engine-neutral MCP setup router for AGS-related MCP servers.

It has three paths:

1. **AGS API MCP Server** - the default path for `/ags install-mcp`. This configures the MCP URL for the user's AGS deployment and works for every engine and custom project type.
2. **Game Engine SDK MCP** - engine-specific SDK context MCPs. Detect or ask for the engine, then read the matching engine MCP reference.
3. **AGS Extend SDK MCP** - owned by `/ags-extend install-mcp`; redirect there.

The AGS API MCP server source of truth is `content/mcps/ags-api.yaml`. Engine SDK MCP behavior lives in `references/sdks/game-engine/<engine>/mcp.md`.

## Behavior Constraints

<grounding_rules>

For the AGS API MCP Server, the URL patterns are exactly what `content/mcps/ags-api.yaml` declares:

- **Default Shared Cloud:** `https://prod.gamingservices.accelbyte.io/mcp`
- **Shared Cloud, per-studio:** `https://{studio_namespace}.prod.gamingservices.accelbyte.io/mcp`
- **Private Cloud / BYOC:** `https://{environment_name}.accelbyte.io/mcp`

Do not invent other AGS API MCP URL shapes. If the user's environment does not fit one of those three, point at AccelByte support or their Delivery Manager.

For Game Engine SDK MCP requests:

- Detect the engine from project files when possible: `.uproject` for Unreal, `Assets/` plus `ProjectSettings/` for Unity, and `project.godot` for Godot.
- If no engine or multiple engines are detected, ask whether to target Unreal, Unity, or Godot.
- Unreal SDK MCP setup is documented in `references/sdks/game-engine/unreal/mcp.md`.
- Unity MCP setup is documented in `references/sdks/game-engine/unity/mcp.md`.
- Godot SDK MCP is not supported yet; read its placeholder MCP reference and report the unsupported status.
- Do not install AccelByteUITools from this generic MCP router. Unreal UI generation and generator install are owned by `/ags generate-ui` and the Unreal UI references.

</grounding_rules>

<tool_usage_rules>

- `Glob` to find the user's IDE MCP config file and project engine markers:
  - Claude Code (project): `.mcp.json`
  - Claude Code (user): `~/.claude.json`
  - Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
  - Cursor: `.cursor/mcp.json` (project) or user settings
  - VS Code: `.vscode/mcp.json` or user settings
  - Kiro: `.kiro/settings/mcp.json`
  - Codex: `.codex/config.toml` under `mcp_servers.*`
- `Read` the user's IDE config to confirm the AGS API MCP entry is present.
- `Read` exactly one engine MCP reference for Game Engine SDK MCP requests.
- `Edit` to change the `url` field for the `AGS API MCP Server` entry only; never touch unrelated MCP entries.
- `Bash` to confirm the chosen AGS API MCP URL is reachable (`curl -sIL <url>` returns 200 / a sane status).
- Don't read other subskills except when redirecting the user to `/ags-extend install-mcp`.

</tool_usage_rules>

<dependency_checks>

Before changing anything:

1. Identify which MCP the user means: AGS API MCP Server, Game Engine SDK MCP, AGS Extend SDK MCP, or multiple.
2. For AGS API MCP Server, confirm the plugin is installed and the AGS API MCP entry exists in the user's IDE config. If not, route them to the plugin `INSTALL.md` first.
3. For AGS API MCP Server, confirm which deployment the user is on: Shared Cloud, Private Cloud, or BYOC. If they do not know, ask their Delivery Manager or AccelByte sales contact; do not guess.
4. For Game Engine SDK MCP, detect or ask for the engine and read the matching engine MCP reference.

</dependency_checks>

<action_safety>

This subskill may edit the user's IDE MCP config.

- Show the diff for AGS API MCP `url` changes before applying.
- Do not change unrelated MCP entries.
- If the IDE config is workspace-scoped, warn the user that the URL change may be checked into the repo if the file is tracked.
- Do not copy engine SDK MCP packages, install game-engine plugins, or install AccelByteUITools from this file. Engine-specific setup steps belong in engine MCP or UI references.

</action_safety>

<output_contract>

For AGS API MCP URL setup, end with:

```text
AGS API MCP URL set

  IDE:               <Claude Code / Codex / Cursor / VS Code / Kiro / OpenCode>
  Deployment:        Shared Cloud (default) | Shared Cloud (per-studio) | Private Cloud / BYOC
  URL:               <URL>
  Config file:       <path>
  Reachability:      OK / unreachable (note details)

Next step:
  Restart the IDE if MCP servers do not auto-reload.
```

For Game Engine SDK MCP requests, end with:

```text
Game Engine SDK MCP checked

  Engine:      Unreal | Unity | Godot
  Status:      configured / already present / unsupported / blocked - <reason>
  Reference:   references/sdks/game-engine/<engine>/mcp.md

Next step:
  <restart IDE / use AGS API MCP / run /ags generate-ui / none>
```

</output_contract>

<completeness_contract>

The AGS API MCP URL path is complete when:

1. The IDE config's `AGS API MCP Server` entry has the correct URL for the user's deployment.
2. A reachability check has been attempted and reported.
3. The AGS API MCP URL set block is printed.

The Game Engine SDK MCP path is complete when:

1. The target engine has been detected or confirmed.
2. The matching engine MCP reference has been read.
3. The Game Engine SDK MCP checked block is printed.

</completeness_contract>

## Workflow

### Step 0: Select MCP path

Determine the requested MCP setup before editing anything:

- If the user asks for AGS API MCP, AGS API URL setup, namespace/studio/private-cloud MCP URL, or a generic `/ags install-mcp` after `connect-portal`, use the AGS API MCP URL workflow.
- If the user asks for Game Engine SDK MCP, Unreal SDK MCP, Unity MCP, Godot SDK MCP, SDK symbol/snippet lookup, `unreal_sdk`, or engine-specific MCP setup, use the Game Engine SDK MCP router.
- If the user asks for Extend SDK MCP, route to `/ags-extend install-mcp`.
- If the user asks for more than one, handle one at a time and start with AGS API MCP unless a missing engine SDK MCP blocks the current task.

### Game Engine SDK MCP Router

1. Detect the engine:

   ```powershell
   Get-ChildItem -Recurse -Filter *.uproject
   Get-ChildItem -Recurse -Filter ProjectSettings -Directory
   Get-ChildItem -Recurse -Filter Assets -Directory
   Get-ChildItem -Recurse -Filter project.godot
   ```

2. Route based on the confirmed engine:
   - Unreal -> read `references/sdks/game-engine/unreal/mcp.md`.
   - Unity -> read `references/sdks/game-engine/unity/mcp.md` and follow its setup flow.
   - Godot -> read `references/sdks/game-engine/godot/mcp.md`.
3. Follow that reference's result contract. For Godot, report unsupported and remind the user AGS API MCP remains available.

### AGS API MCP URL Workflow

#### Step 1: Confirm the plugin is installed

`Glob` for the IDE's MCP config and `Read` it to verify the `AGS API MCP Server` entry is present. If not:

> The plugin's MCP config does not appear to be wired into your IDE yet. Follow the plugin's `INSTALL.md` first to merge the IDE-specific MCP config, then re-run `/ags install-mcp` to customize the URL.

#### Step 2: Confirm deployment

Ask which AGS deployment the user is on:

1. **Shared Cloud default** - `https://prod.gamingservices.accelbyte.io/mcp`.
2. **Shared Cloud per-studio** - `https://{studio_namespace}.prod.gamingservices.accelbyte.io/mcp`.
3. **Private Cloud / BYOC** - `https://{environment_name}.accelbyte.io/mcp`.

If they do not know, tell them their Delivery Manager or AccelByte sales contact can confirm.

#### Step 3: Apply the URL

If the user picked the default and the config already matches, no change is needed.

For per-studio or private/BYOC URLs, show the diff in the IDE config before applying:

```diff
   "AGS API MCP Server": {
     "type": "http",
-    "url": "https://prod.gamingservices.accelbyte.io/mcp"
+    "url": "<the user's URL>"
   }
```

Then apply via `Edit` after confirmation.

#### Step 4: Reachability check

```bash
curl -sIL -o /dev/null -w "%{http_code}\n" "<the URL>"
```

Treat 200, 401, and 405 as reachable. Other 4xx, 5xx, DNS failure, or timeout should be reported as unreachable or inconclusive with details.

#### Step 5: Print the result block

Print the relevant block from `output_contract`.

## Error Handling

- **Ambiguous MCP request** - ask which MCP the user means before editing config.
- **Ambiguous engine SDK MCP request** - ask whether to target Unreal, Unity, or Godot.
- **Plugin installed but the AGS API MCP entry is gone or renamed** - surface the discrepancy. Do not auto-add a new AGS API MCP entry unless the user asks for that config creation flow.
- **User-supplied AGS API MCP URL does not match any supported pattern** - explain the supported patterns. If the user insists on a custom URL, apply it only after warning that it may not be a supported AccelByte endpoint.
- **Reachability check fails** - surface DNS, 5xx, timeout, or unexpected status details.
- **Godot SDK MCP requested** - report unsupported using the engine MCP placeholder reference.
- **User wants the Extend SDK MCP** - route to `/ags-extend install-mcp`.
