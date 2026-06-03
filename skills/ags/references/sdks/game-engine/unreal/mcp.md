---
description: Set up the AccelByte Unreal SDK MCP Server for Unreal SDK symbols, snippets,
  and Unreal-specific AGS tooling.
last-verified: 2026-05-25
sources:
- https://github.com/AccelByte/unreal-sdk-mcp-server
see-also:
- '[install-mcp.md](../../../../subskills/install-mcp.md)'
---

# Unreal SDK MCP

The AccelByte Unreal SDK MCP Server provides Unreal SDK lookup, SDK symbols, snippets, and Unreal-specific tooling. It is the only supported Game Engine SDK MCP today.

## Behavior Constraints

- Use the user's active IDE MCP mechanism and native IDE MCP config or cache location.
- The published MCP declaration is `content/mcps/unreal-sdk.yaml`.
- For Codex, prefer a project-local `.codex/mcp/unreal-sdk-mcp-server` clone when present.
- For other IDEs, discover the Unreal SDK MCP checkout/cache from the IDE's MCP status, configured command, or targeted cache search.
- This reference covers Unreal SDK MCP setup only.

## Workflow

1. Confirm the active IDE and use its native MCP setup surface.
2. Confirm the `AccelByte Unreal SDK MCP Server` entry is configured from `content/mcps/unreal-sdk.yaml`, or route the user to the plugin `INSTALL.md` for their IDE's MCP setup.
3. Discover the server checkout/cache location. For Codex, prefer `.codex/mcp/unreal-sdk-mcp-server`; for other IDEs, do not assume that path.
4. For Codex, use the local-clone setup below unless the user explicitly asks for the `uvx` fallback.
5. For non-Codex IDEs, use the IDE's native MCP config and cache location.

### Codex local-clone setup

Codex needs a project-scoped `.codex/config.toml` entry because it does not consume the JSON MCP config used by Claude Code, Cursor, Kiro, or similar IDEs.

- Check whether the project-scoped Codex config exists at `<project>/.codex/config.toml`.
- Codex plugin install intentionally leaves `plugins/accelbyte-ai-plugins/.codex/config.toml` empty. Do not merge that file as a ready-made MCP config.
- The MCP declaration source is `content/mcps/unreal-sdk.yaml`, but for Codex prefer a project-scoped local clone over `uvx --from git`.
- Clone the MCP server into `.codex/mcp/unreal-sdk-mcp-server` if it is not already present.
- Install its Python requirements.
- Generate the symbol/snippet cache.
- Write only the needed project-scoped `[mcp_servers.unreal_sdk]` entry.

Preferred Codex commands:

```powershell
git clone https://github.com/AccelByte/unreal-sdk-mcp-server.git .codex/mcp/unreal-sdk-mcp-server
python -m pip install -r .codex/mcp/unreal-sdk-mcp-server/requirements.txt
python .codex/mcp/unreal-sdk-mcp-server/generate_cache.py
```

The `generate_cache.py` step is mandatory. Without it the server starts but has no symbol cache and provides no useful tool responses. It requires Doxygen XML files in `data/unreal-sdk/` and `data/oss-sdk/` inside the cloned server directory.

Then write this project-scoped config entry:

```toml
[mcp_servers.unreal_sdk]
command = "python"
args = [".codex/mcp/unreal-sdk-mcp-server/server.py"]
```

Do not use `uvx --from git+https://github.com/AccelByte/unreal-sdk-mcp-server@main` as the preferred Codex config. Keep `uvx` as a fallback only when the user explicitly wants no local clone.

After writing config, tell the user to restart Codex or reload MCP servers. The MCP setup is not verified until Codex shows tools for `unreal_sdk` or a smoke run of the local `server.py` reaches MCP initialization without crashing.

### Non-Codex setup

If the user is not running Codex, do not edit `.codex/config.toml` and do not require the local `.codex/mcp/...` clone path. Guide them through the relevant `INSTALL.md` MCP setup for `AccelByte Unreal SDK MCP Server`, using that IDE's native MCP config format.

## Output Contract

```text
Game Engine SDK MCP checked

  Engine:      Unreal
  Status:      configured / already present / blocked - <reason>
  Reference:   references/sdks/game-engine/unreal/mcp.md

Next step:
  Restart the IDE if MCP servers do not auto-reload.
```
