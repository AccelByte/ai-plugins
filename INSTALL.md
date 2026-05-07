# Install Guide — accelbyte-ai-plugins

Public AI coding agents, skills, and MCP servers for AccelByte.

Source: `AccelByte/ai-plugins`


## 1. Claude Code
Plugin root: `/path/to/accelbyte-ai-plugins`

Recommended local use for this compiled target:

```bash
claude --plugin-dir /path/to/accelbyte-ai-plugins
```

This loads the plugin directly from the target root for the current Claude Code session. Agents and skills are discovered from the plugin bundle. MCP configs are intentionally left empty until an init subskill configures the current project.

If you want standalone Claude Code files instead of plugin mode, copy or merge them explicitly:

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/skills/` | `~/.claude/skills/` or `<project>/.claude/skills/` | Copy the directory contents. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/.mcp.json` | configured later by init subskills | Empty placeholder. Do not merge it during plugin install; project-scoped MCP entries are created after project detection. |

If you publish this target through the Anthropic marketplace or an independent marketplace later, install it through Claude Code's marketplace flows rather than `--plugin-dir`.

## 2. Cursor
Plugin root: `/path/to/accelbyte-ai-plugins`

Choose one of these local setup paths:

- Local plugin folder:
  Copy `/path/to/accelbyte-ai-plugins/` to `~/.cursor/plugins/local/accelbyte-ai-plugins/`, then restart Cursor or run `Developer: Reload Window`.
  This makes Cursor load plugin artifacts present at the plugin root, such as `skills/`.

- Standalone Cursor files:
  Copy the platform-native files into Cursor's user or project paths.

Additional manual config from this compiled target:

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/skills/` | `~/.cursor/skills/` or `<project>/.cursor/skills/` | Optional standalone install. Cursor also supports compatible project skills under `<project>/.agents/skills/`. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/.cursor/mcp.json` | configured later by init subskills | Empty placeholder. Do not merge it during plugin install; project-scoped MCP entries are created after project detection. |

## 3. Codex
Plugin root: `/path/to/accelbyte-ai-plugins`

Recommended local install flow for AI-assisted setup:

1. Clone, download, or otherwise place the compiled plugin target at a stable local path.
2. Link that path into the selected Codex plugin location. Prefer a symlink or junction for local development so future repo updates are picked up without copying again. Use a plain copy when symlinks are not allowed.
3. Create or update the selected `.agents/plugins/marketplace.json` file with the local marketplace entry below.
4. Restart or reload Codex. Depending on the current Codex plugin lifecycle, the plugin may still need to be selected, installed, or enabled through Codex's plugin UI or `/plugin` flow after the local marketplace entry exists.

Default to the personal marketplace (`~`) for this plugin so it is available across Codex workspaces. Do not switch to a project marketplace just because it is writable from the current workspace. Use the project marketplace only when the user explicitly requests a project-local install or explicitly declines/does not grant the approval needed for user-scope writes.

Choose one of these local marketplace scopes:

Upgrading from an older Codex install:

If this plugin was previously registered from `~/.codex/plugins/accelbyte-ai-plugins/`, remove that old marketplace entry from `~/.agents/plugins/marketplace.json` and remove or archive the old `~/.codex/plugins/accelbyte-ai-plugins/` copy before re-registering from `~/plugins/accelbyte-ai-plugins/`. Keeping both paths can make Codex load a stale plugin copy.

- Personal marketplace (`~`):
  Recommended default. Use this for a user-wide install. In sandboxed AI sessions, writing to `~/plugins/` or `~/.agents/plugins/marketplace.json` may require explicit approval/elevated execution. The agent should request that approval first. If approval is unavailable or denied, stop and tell the user to run the shown user-scope commands manually; ask before using the project marketplace as a fallback.
  1. Link `/path/to/accelbyte-ai-plugins/` to `~/plugins/accelbyte-ai-plugins/`
     - Windows PowerShell: `New-Item -ItemType Junction -Path "$HOME/plugins/accelbyte-ai-plugins" -Target "/path/to/accelbyte-ai-plugins"`
     - macOS/Linux: `ln -s "/path/to/accelbyte-ai-plugins" "$HOME/plugins/accelbyte-ai-plugins"`
     - Fallback: copy `/path/to/accelbyte-ai-plugins/` to `~/plugins/accelbyte-ai-plugins/`
  2. Create or update `~/.agents/plugins/marketplace.json`
  3. Add a plugin entry whose `source.path` is `./plugins/accelbyte-ai-plugins`
  4. Restart or reload Codex

- Project marketplace (`<project>`):
  Use this only when the user explicitly wants project-local plugin discovery, or after the user explicitly approves project-local fallback because user-scope installation could not be performed.
  1. Link `/path/to/accelbyte-ai-plugins/` to `<project>/plugins/accelbyte-ai-plugins/`
     - Windows PowerShell: `New-Item -ItemType Junction -Path "<project>/plugins/accelbyte-ai-plugins" -Target "/path/to/accelbyte-ai-plugins"`
     - macOS/Linux: `ln -s "/path/to/accelbyte-ai-plugins" "<project>/plugins/accelbyte-ai-plugins"`
     - Fallback: copy `/path/to/accelbyte-ai-plugins/` to `<project>/plugins/accelbyte-ai-plugins/`
  2. Create or update `<project>/.agents/plugins/marketplace.json`
  3. Add a plugin entry whose `source.path` is `./plugins/accelbyte-ai-plugins`
  4. Restart or reload Codex

Minimal marketplace entry shape:

```json
{
  "name": "local-plugins",
  "interface": {
    "displayName": "Local Plugins"
  },
  "plugins": [
    {
      "name": "accelbyte-ai-plugins",
      "source": {
        "source": "local",
        "path": "./plugins/accelbyte-ai-plugins"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

Paths in `source.path` are relative to the scope root (`~` for personal, `<project>` for project), not relative to the `marketplace.json` file. Use `./plugins/accelbyte-ai-plugins` for both a personal marketplace and a project marketplace.

Write `marketplace.json` as UTF-8 without a byte-order mark. Older Windows PowerShell `Set-Content -Encoding UTF8` can write a BOM, which Codex rejects as an invalid marketplace file. Prefer PowerShell 7 `Set-Content -Encoding utf8NoBOM` or `[System.IO.File]::WriteAllText($path, $json, [System.Text.UTF8Encoding]::new($false))`.

This local marketplace registration makes the plugin discoverable to Codex. Do not describe it as a silent install: Codex may still require user-visible plugin installation or activation after restart.

Additional manual Codex config from this compiled target:

Codex plugin activation intentionally does not auto-start bundled MCP servers. The generated `/path/to/accelbyte-ai-plugins/.codex/config.toml` is empty by design. Install the plugin first, then let `/ags init`, `/ags install-mcp`, `/ags-extend init`, or `/ags-extend install-mcp` create project-scoped `<project>/.codex/config.toml` entries only for the MCP servers the current project needs. This avoids plugin activation failures when Docker, `uvx`, credentials, or local MCP checkouts are missing.

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `left-alone` | `/path/to/accelbyte-ai-plugins/skills/` | covered by the marketplace-installed plugin | No extra copy required for bundled skills once the plugin is discoverable through `marketplace.json`. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/.codex/config.toml` | configured later by init subskills | Empty placeholder. Do not merge it during plugin install; project-scoped MCP entries are created after project detection. |

## 4. Kiro
Plugin root: `/path/to/accelbyte-ai-plugins`

Kiro does not have a plugin system. Nothing is installed automatically from the target root.

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/.kiro/skills/` | `~/.kiro/skills/` or `<project>/.kiro/skills/` | Copy the directory contents. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/.kiro/settings/mcp.json` | configured later by init subskills | Empty placeholder. Do not merge it during plugin install; project-scoped MCP entries are created after project detection. |

## 5. OpenCode
Plugin root: `/path/to/accelbyte-ai-plugins`

OpenCode does not have a manifest-based plugin system for these compiled artifacts. Nothing is installed automatically from the target root.

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/skills/` | `~/.config/opencode/skills/` or `<project>/.opencode/skills/` | Copy the directory contents. OpenCode also supports compatibility loading from Claude and Agent Skills directories. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/opencode.json` | configured later by init subskills | Empty placeholder. Do not merge it during plugin install; project-scoped MCP entries are created after project detection. |

## 6. Agent Skills
Plugin root: `/path/to/accelbyte-ai-plugins`

The Agent Skills spec (skills.sh) distributes skills as published packages. If this target is published, install with:

```bash
npx skills add <owner>/<repo>
```

For local use, the compiled `skills/` directory follows the Agent Skills frontmatter spec and can be copied into any Agent Skills-compatible agent directory (e.g., `~/.agents/skills/` or `<project>/.agents/skills/`).

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/skills/` | `~/.agents/skills/` or `<project>/.agents/skills/` | Copy the directory contents. Skills follow the Agent Skills spec. |

## Optional MCP Servers

Bundled MCP server definitions are available for the AGS and AGS Extend skills to install on demand. They are not auto-configured during plugin install. Run `/ags init`, `/ags install-mcp`, `/ags-extend init`, or `/ags-extend install-mcp` from the target project so the assistant can add only the MCP entries that project needs.

### AGS API MCP Server

Use when the user needs answers specific to their live AGS environment — namespace config, IAM client state, API responses, or session state. Provides real data instead of general guidance. Requires the MCP URL to be configured for the user's deployment (Shared Cloud, per-studio, or Private Cloud).

```
Ask the user if the default URL is correct, if not:
Ask them if they are a Private Cloud or a Shared Cloud user.
Private Cloud: https://{environment_name}.accelbyte.io/mcp
Shared Cloud:  https://{studio_namespace}.prod.gamingservices.accelbyte.io/mcp
```

### AGS Extend SDK MCP Server

Use when generating or reviewing AccelByte Extend service code. Provides accurate SDK types, function signatures, and models for Go, Java, Python, and C# — prevents hallucinated API shapes in generated Extend code.

Set the following environment variables:

- `CONFIG_DIR`

```
Requires Docker. Set `CONFIG_DIR` to your SDK language:
- `config/go` (default)
- `config/java`
- `config/python`
- `config/csharp`
```

### AccelByte Unreal SDK MCP Server

Use when integrating AccelByte into an Unreal Engine project. Indexes real SDK symbols, code snippets, and Slate UI examples (Login, Achievements, Matchmaking) so lookups use actual SDK content instead of guesses. For SDK installation flows, prefer `/ags install-unreal-sdk` or `/ags install-sdk`.

```
Requires `uvx` (https://docs.astral.sh/uv/). On first run the server downloads the SDK
repo and builds its symbol/snippet/example-component caches into `.cache/`; this can take
a few minutes. After that, startup is fast.

Useful tools:
  - `search_example_components` / `describe_example_components` — find drop-in Slate panels
    (Login, Achievements, Matchmaking) and read their .h/.cpp via `example-file://` resources.
  - `search_symbols` / `describe_symbols` — Doxygen-indexed SDK classes and methods.
  - `search_snippets` — tutorial code snippets indexed from the SDK repo.
  - `get_accelbyte_how_to` — best-practice guides (auth, matchmaking, achievements, etc.).
  - `install_unreal_sdk` — helper for generating an Unreal SDK install script when explicitly requested; AGS skill flows should use `/ags install-unreal-sdk` or `/ags install-sdk` for installation routing.

If `uvx` isn't available, the server can also be cloned and run directly with Python 3.10+
(`pip install -r requirements.txt && python server.py`).
```
