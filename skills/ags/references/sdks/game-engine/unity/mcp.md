---
description: Set up the AccelByte Unity MCP for Unity-specific AGS UI prefab generation
  and future Unity SDK integration tooling.
last-verified: 2026-06-17
sources:
- https://github.com/AccelByte/accelbyte-unity-sdk
see-also:
- '[install-mcp.md](../../../../subskills/install-mcp.md)'
- '[unity.md](../unity.md)'
---

# Unity MCP

The AccelByte Unity MCP server provides Unity-specific AGS tooling. Its first
supported vertical slice is deterministic TMP/uGUI prefab generation through the
embedded `com.accelbyte.ui-tools` package. Use the engine-neutral AGS API MCP
alongside it for live namespace and service context.

## Behavior Constraints

- The published MCP declaration is `content/mcps/unity-mcp.yaml`.
- For Codex, prefer a project-local `.codex/mcp/accelbyte-unity-mcp` clone.
- Install `com.accelbyte.ui-tools` via Unity Package Manager by adding it to `Packages/manifest.json` before generating UI (see workflow below).
- The Unity UI package uses component specs under `Specs/Components/ags/` as the production source of truth for package-owned AGS kit prefabs.
- Use `unity_ui_kit_inspect` to check kit/spec drift before rebuilding or generating from manually edited package prefabs.
- Confirm the Unity editor version declared by `ProjectSettings/ProjectVersion.txt` is installed or set `UNITY_EDITOR_PATH`.
- If a git-URL package (e.g. `com.accelbyte.ui-tools`) fails to resolve with a `packages-lock.json` hash that doesn't match its `Library/PackageCache` folder, or a resolve/reimport fails with an `EPERM` rename error, close the Unity editor and call `unity_repair_package_cache` rather than editing project files by hand. See the Troubleshooting section in the MCP server's README for details.
- SDK symbol lookup, snippets, and install assistance are planned additions. Do not claim they are available until the server exposes them.

## Workflow

### Step 1 — Confirm active IDE

Detect which IDE the user is running (Claude Code, Cursor, Kiro, Windsurf, Codex, or other). The MCP config format and discovery path differ per IDE:

- **Claude Code / Cursor / Kiro / Windsurf** — project-scoped `.mcp.json` or global MCP settings.
- **Codex** — project-scoped `.codex/config.toml`; prefer a local clone over `uvx`.
- **Other** — use that IDE's native MCP server config surface.

### Step 2 — Check if the MCP entry is already configured

Look for an `accelbyte-unity-mcp` (or equivalent) entry in the IDE's active MCP config. If it is already present and the server starts cleanly, skip to Step 4.

If it is missing, route the user to the plugin `INSTALL.md` for their IDE's MCP setup steps, or follow the IDE-specific setup below.

### Step 3 — Add the MCP server entry

#### Non-Codex IDEs (Claude Code, Cursor, Kiro, Windsurf)

Add to the project's `.mcp.json` (create it if absent):

```json
{
  "mcpServers": {
    "accelbyte-unity-mcp": {
      "type": "stdio",
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/AccelByte/accelbyte-unity-mcp@main",
        "accelbyte-unity-mcp"
      ]
    }
  }
}
```

`uvx` pulls the server from GitHub and runs it — no manual clone or `pip install` needed.
Requires `uvx` ([install](https://docs.astral.sh/uv/)).

Restart the IDE or reload MCP servers after writing the entry. Confirm the server starts
and the `unity_ui_bridge_health` tool is available before continuing.

#### Codex

Codex does not read `.mcp.json`. Use a project-local clone instead:

```powershell
git clone https://github.com/AccelByte/accelbyte-unity-mcp.git .codex/mcp/accelbyte-unity-mcp
python -m pip install -r .codex/mcp/accelbyte-unity-mcp/requirements.txt
```

Then add to `.codex/config.toml`:

```toml
[mcp_servers.unity_sdk]
command = "python"
args = [".codex/mcp/accelbyte-unity-mcp/server.py"]
```

### Step 4 — Install com.accelbyte.ui-tools

Add the UI tools package to `Packages/manifest.json` under `dependencies`:

```json
"com.accelbyte.ui-tools": "https://github.com/AccelByte/accelbyte-unity-mcp.git?path=data/com.accelbyte.ui-tools#main"
```

Unity Package Manager resolves and downloads the package automatically on the next
editor open or Package Manager refresh. No manual directory copy is needed.

To confirm: open the Unity editor, navigate to **Window → Package Manager**, and verify
`AccelByte UI Tools` appears under **In Project**.

## Output Contract

```text
Game Engine SDK MCP checked

  Engine:        Unity
  IDE:           <Claude Code / Cursor / Kiro / Windsurf / Codex / other>
  Status:        configured / already present / blocked - <reason>
  UI package:    manifest.json updated / already present / blocked - <reason>
  Reference:     references/sdks/game-engine/unity/mcp.md

Next step:
  Open (or reopen) the Unity project so Package Manager resolves com.accelbyte.ui-tools,
  then restart the IDE if MCP servers do not auto-reload, or run /ags generate-ui.
```
