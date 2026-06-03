# Install Guide — accelbyte-ai-plugins

Public AI coding agents, skills, and MCP servers for AccelByte.

Source: `AccelByte/ai-plugins`


## 1. Claude Code

Plugin root: `/path/to/accelbyte-ai-plugins`

### Install (recommended)

From a terminal:

```bash
claude plugin marketplace add AccelByte/ai-plugins
claude plugin install accelbyte-ai-plugins@accelbyte
```

From inside Claude Code:

```
> /plugin marketplace add https://github.com/AccelByte/ai-plugins.git
> /plugin
```

In the `/plugin` UI: Marketplaces → `accelbyte` → install `accelbyte-ai-plugins`.

Agents and skills are discovered from the plugin bundle. Some MCP servers in this bundle are intended to be installed via a skill included in this plugin.

### Advanced

**From a local checkout.** Load the plugin from a local clone in the current Claude Code session — useful when iterating on this repo:

```bash
claude --plugin-dir /path/to/accelbyte-ai-plugins
```

**Standalone files.** Bypass plugin mode and copy or merge files into Claude Code's native paths:

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/skills/` | `~/.claude/skills/` or `<project>/.claude/skills/` | Copy the directory contents. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/.claude-plugin/plugin.json` | no pre-configured MCP entries | Plugin manifest has no pre-configured MCP servers. Some MCP servers in this bundle are intended to be installed via a skill included in this plugin. |

## 2. Claude Desktop

### Install (recommended)

Paste this prompt into a Cowork chat:

```
Download `https://github.com/AccelByte/ai-plugins/archive/refs/heads/main.zip`, unzip it, remove the `mcpServers` and `userConfig` fields from .claude-plugin/plugin.json (Cowork's plugin validator does not support these fields yet), repack it as a .zip with all contents at the archive root — if the zip contains a single top-level directory (as GitHub typically adds), strip that wrapper so files like `.claude-plugin/` appear directly at the root — rename it to `accelbyte-ai-plugins.plugin`, and use the `present_files` tool to present it to me.
```

### Advanced

**Manual upload (Chat and Cowork).** Bypass the Cowork prompt and upload the plugin file yourself:

1. Download the repo archive: [AccelByte/ai-plugins/archive/refs/heads/main.zip](https://github.com/AccelByte/ai-plugins/archive/refs/heads/main.zip)
2. In Claude Desktop, open **Customize → Upload plugin** and select the downloaded file.
3. Confirm the install.

### Notes

- Cowork's plugin validator does not currently support the `mcpServers` or `userConfig` plugin fields, which is why the recommended prompt strips them before upload. If you need MCP servers configured for Claude Desktop, install via Claude Code instead.

## 3. Cursor

Plugin root: `/path/to/accelbyte-ai-plugins`

### Advanced

**From a local checkout.** Copy the plugin directory into Cursor's local plugins folder, then restart Cursor or run `Developer: Reload Window`:

```bash
cp -r /path/to/accelbyte-ai-plugins/ ~/.cursor/plugins/local/accelbyte-ai-plugins/
```

Cursor loads plugin artifacts from the plugin root (`skills/`).

**Standalone files.** Bypass plugin mode and copy files into Cursor's native paths:

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/skills/` | `~/.cursor/skills/` or `<project>/.cursor/skills/` | Copy the directory contents. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/.cursor/mcp.json` | installed via an included skill | Empty placeholder. Do not merge it during plugin install; project-scoped MCP entries are created after project detection. |

### Notes

- Cursor also accepts compatible project skills under `<project>/.agents/skills/`, but the `.cursor/skills/` destination above is the explicit native path.

## 4. Codex

Plugin root: `/path/to/accelbyte-ai-plugins`

### Install (recommended)

```bash
codex plugin marketplace add AccelByte/ai-plugins
```

### Advanced

**From a local checkout.** Register the marketplace against a local clone instead of the published repo:

```bash
codex plugin marketplace add /path/to/accelbyte-ai-plugins
```

### Notes

- After registration, restart or reload Codex. The plugin appears in Codex's `/plugins` flow for the user to install or enable; activation is not silent.
- Default to user scope (no extra flags) so the plugin is available across Codex workspaces. Use a project-scoped install only when the user explicitly requests it.
- Manual-install MCP servers (listed in the MCP Servers section below) are installed separately via an included skill, which writes project-scoped `<project>/.codex/config.toml` entries only for the MCP servers the current project needs. This avoids plugin activation failures when Docker, `uvx`, credentials, or local MCP checkouts are missing.

## 5. Kiro

Plugin root: `/path/to/accelbyte-ai-plugins`

### Advanced

**Standalone files.** Copy or merge files into Kiro's native paths:

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/.kiro/skills/` | `~/.kiro/skills/` or `<project>/.kiro/skills/` | Copy the directory contents. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/.kiro/settings/mcp.json` | installed via an included skill | Empty placeholder. Do not merge it during plugin install; project-scoped MCP entries are created after project detection. |

### Notes

- Kiro does not have a plugin system. Everything in this section is a manual copy or merge.

## 6. OpenCode

Plugin root: `/path/to/accelbyte-ai-plugins`

### Advanced

**Standalone files.** Copy or merge files into OpenCode's native paths:

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/skills/` | `~/.config/opencode/skills/` or `<project>/.opencode/skills/` | Copy the directory contents. |
| `left-alone` | `/path/to/accelbyte-ai-plugins/opencode.json` | installed via an included skill | Empty placeholder. Do not merge it during plugin install; project-scoped MCP entries are created after project detection. |

### Notes

- OpenCode does not have a manifest-based plugin system. Everything in this section is a manual copy or merge.
- OpenCode supports compatibility loading for skills from Claude and Agent Skills directories, so skills copied there will also be picked up.

## 7. Agent Skills

Plugin root: `/path/to/accelbyte-ai-plugins`

### Install (recommended)

```bash
npx skills add AccelByte/ai-plugins
```

### Advanced

**From a local checkout.** Copy the `skills/` directory into any Agent Skills-compatible agent directory:

| Status | Source path | Destination path | Notes |
|--------|-------------|------------------|-------|
| `copy` | `/path/to/accelbyte-ai-plugins/skills/` | `~/.agents/skills/` or `<project>/.agents/skills/` | Copy the directory contents. |

### Notes

- Skills follow the [skills.sh](https://skills.sh) frontmatter spec and load into any compatible agent directory.

## MCP Servers

These MCP servers are intended to be installed via a skill included in this plugin. Use one of those skills to add only the MCP entries your project needs.

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

Use when integrating AccelByte into an Unreal Engine project. Indexes real SDK symbols, code snippets, and Slate UI examples (Login, Achievements, Matchmaking) so lookups use actual SDK content instead of guesses. For SDK installation flows, use `/ags install-sdk`.

```
Requires `uvx` (https://docs.astral.sh/uv/) to launch this MCP server.
See the MCP server README for cache generation and startup details.
```
