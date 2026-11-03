---
last-verified: 2026-11-02
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/advanced-topics/extend-mcp-servers/
- https://github.com/AccelByte/ags-api-mcp-server
- https://github.com/AccelByte/ags-extend-sdk-mcp-server
see-also:
- '[init.md](init.md)'
- '[mcp-auth-recovery.md](../../accelbyte/references/mcp-auth-recovery.md)'
---

# AGS Extend MCP Installer

Wire the two AGS Extend MCP servers (`ags-api` and `ags-extend-sdk`) into the user's AI IDE so the IDE can query AGS directly and pull Extend SDK context during code generation.

> Use this subskill for IDEs that do not ship with plugin-managed MCPs, or whose plugin support doesn't cover the SDK MCP. That currently includes: Claude Code (file-scoped), Cursor, Windsurf, and Kiro.
>
> Codex is handled separately because it uses `.codex/config.toml` instead of the JSON `mcpServers` files below.

The Grafana MCP server — for querying a deployed app's logs and metrics directly instead of using the browser — is **not** installed here. `/ags` owns it: route those requests to `/ags install-mcp`, and read `../references/observe/grafana-guide.md#programmatic-access-the-grafana-mcp-server` for what it does. Do not broker a token or write a `grafana` entry from this subskill.

## Behavior Constraints

<grounding_rules>

- Each supported IDE has a specific config path and JSON structure — use exactly the structure given in this file. Do not blend Cursor's shape into Claude Code's file or vice versa.
- The `ags-api` Docker command and the `ags-extend-sdk` hosted URL are fixed. Do not substitute alternate packages, versions, images, or hosts without user direction.
- `ags-extend-sdk` is a hosted HTTP server. Never configure it as a Docker command unless the user explicitly asks to run it locally.
- Do not invent env var names. Each server reads a specific set of env vars listed below.

</grounding_rules>

<tool_usage_rules>

- Use `Read` to check whether a config file already exists and what's inside it.
- Use `Edit` to merge new server entries into an existing file — **never** overwrite. Preserve existing `mcpServers` entries, other top-level keys, and formatting.
- Use `Write` only to create a config file when none exists.
- Do not touch anything outside the target config file. Do not modify shell profiles, environment files, or the user's global git config.

</tool_usage_rules>

<dependency_checks>

Before merging the config, check:

| Dependency | Required for | Detection |
|---|---|---|
| Docker daemon running | `ags-api` only | `docker info` |

`ags-extend-sdk` is hosted and needs no local dependency. If `ags-api` is being installed and Docker isn't running, stop and tell the user to start Docker before continuing.

</dependency_checks>

<action_safety>

Show the exact JSON that will be merged before making any change. Show the target file path. Ask yes/no.

On conflict (`ags-api` or `ags-extend-sdk` key already exists in the user's `mcpServers`), do not overwrite — surface both the existing entry and the proposed one, and ask which to keep.

Never commit the config file to git (the user's responsibility, but don't encourage it either).

</action_safety>

<output_contract>

Final output is a "Done." block that lists:

1. The config file modified (full path).
2. Which servers were added, skipped, or kept as-is.
3. What the user still needs to do before restarting their IDE — for `ags-api`, start its container; `ags-extend-sdk` needs nothing.
4. The instruction to restart the IDE.

</output_contract>

## MCP Servers

## Migration Note

If the user previously copied an older plugin-generated MCP config into their IDE, inspect any existing `ags-extend-sdk` entry before keeping it. Older entries run the server as a `docker` command with a `CONFIG_DIR` env var. Offer to replace it with the hosted entry below, which needs no Docker and no `CONFIG_DIR`. Treat it as a conflict (Step 5): show both entries and let the user choose.

### ags-api

Exposes AccelByte Gaming Services API operations — query players, namespaces, entitlements, events, and other AGS resources from the IDE.

- **Command:** `docker run -d -e AB_BASE_URL=<url> -p 3000:3000 ghcr.io/accelbyte/ags-api-mcp-server:2026.2.0`
- **Requires:** Docker daemon running
- **Transport:** HTTP — connect the IDE to `http://localhost:3000/mcp`
- **Auth:** OAuth handled via discovery — no `AB_CLIENT_ID` or `AB_CLIENT_SECRET` needed in IDE config

### ags-extend-sdk

Exposes AccelByte Extend SDK functions and models as context for AI code generation. Per-language — the last segment of the URL selects which SDK surface is loaded.

- **URL (Public Cloud):** `https://prod.gamingservices.accelbyte.io/extend-mcp/{language}`
- **URL (Private Cloud):** `https://{domain}/extend-mcp/{language}`, where `{domain}` is the environment's own domain
- **`{language}`:** one of `go`, `java`, `python`, `csharp`
- **Transport:** HTTP — hosted, so no Docker and no local process
- **Auth:** none — the server needs no sign-in and no env vars

If the user must run the server locally (for example, offline), point them to the server's local-run guide at `https://github.com/AccelByte/ags-extend-sdk-mcp-server/blob/master/docs/LOCAL.md` instead of writing a Docker entry yourself.

## Workflow

### Codex-only config handling

Use this section only when the user is running Codex. Codex requires project-scoped TOML entries in `<project>/.codex/config.toml`; do not ask Codex users to merge `.mcp.json`, `.cursor/mcp.json`, or `.kiro/settings/mcp.json`.

For Codex, add or update only the needed MCP server tables:

```toml
[mcp_servers.ags_api]
url = "http://localhost:3000/mcp"

[mcp_servers.ags_extend_sdk]
url = "{extend-sdk-url}"
```

If `ags-api` is being installed, tell the user to start its container before writing config:

```bash
docker run -d -e AB_BASE_URL=<url> -p 3000:3000 ghcr.io/accelbyte/ags-api-mcp-server:2026.2.0
```

Write only the tables for the servers being installed, and use the `ags-extend-sdk` URL resolved in Step 3. After writing config, tell the user to restart Codex or reload MCP servers. The setup is not verified until Codex shows tools for the configured servers.

If the user is not running Codex, skip this section and use the IDE-specific JSON workflow below.

### Step 1 — Identify the IDE

If the user's invocation names an IDE (e.g. "install mcp for Cursor"), use that. Otherwise ask:

> Which AI IDE are you setting up? (Claude Code / Cursor / Windsurf / Kiro / other)

If "other," show the generic `ags-api` + `ags-extend-sdk` JSON and tell the user to paste it into their IDE's MCP config — this subskill only auto-merges for the four named IDEs.

### Step 2 — Check dependencies

Skip this step when only `ags-extend-sdk` is being installed — it is hosted.

Otherwise run `docker info`. Report:

```
  ✓ docker daemon running
```

or

```
  ✗ docker daemon not running — ags-api requires Docker. Start Docker and retry.
```

If Docker isn't running, stop here without writing anything — or, if the user agrees, drop `ags-api` and continue with `ags-extend-sdk` alone.

### Step 3 — Pick SDK language and host

If `ags-extend-sdk` will be installed, ask (unless the user already said):

> Which language is your Extend app in? (Go / Java / Python / C#)

Map to `{language}`, the last segment of the `ags-extend-sdk` URL:

| Language | `{language}` |
|---|---|
| Go | `go` |
| Java | `java` |
| Python | `python` |
| C# | `csharp` |

If the user is working inside an Extend app directory (`Makefile` + `Dockerfile` present), detect the language from on-disk files (`go.mod` → Go, `requirements.txt` / `pyproject.toml` → Python, `*.csproj` → C#, `build.gradle` / `pom.xml` → Java) and use that as the default suggestion — still confirm with the user.

Then ask which deployment the user is on (unless they already said):

> Are you on Public Cloud or Private Cloud? (On Private Cloud, what is your environment's domain?)

Resolve `{extend-sdk-url}`, the URL every `ags-extend-sdk` entry below uses:

| Deployment | `{extend-sdk-url}` |
|---|---|
| Public Cloud | `https://prod.gamingservices.accelbyte.io/extend-mcp/{language}` |
| Private Cloud | `https://{domain}/extend-mcp/{language}` |

### Step 4 — Resolve the config file

| IDE | Preferred file | Fallback |
|---|---|---|
| Claude Code | `<project>/.mcp.json` (project-scoped) | `~/.claude.json` (global) |
| Cursor | `<project>/.cursor/mcp.json` (project) | `~/.cursor/mcp.json` (global) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | — |
| Kiro | `<project>/.kiro/settings/mcp.json` (project) | `~/.kiro/settings/mcp.json` (global) |

Ask which scope to use when both exist (project vs global). If neither scope is clearly correct, default to project-scoped — it keeps the config alongside the app.

Read the file if it exists. Parse its JSON. Check for `mcpServers.ags-api` and `mcpServers.ags-extend-sdk`.

### Step 5 — Show the merge plan

```
Will add these MCP servers to {config-file}:

  1. ags-api          — AGS API operations
  2. ags-extend-sdk   — Extend SDK context ({language}, hosted)

{"with existing entries preserved" or "creating new file"}

Continue? (yes/no)
```

If either key already exists, show both the existing entry and the new one, then ask which to keep. Treat "skip" as "leave existing alone, add the other."

### Step 6 — Write

Merge by reading the existing JSON, inserting only the entries for the servers being installed under `mcpServers`, and writing the file back. Preserve any other top-level keys (`tools`, `features`, etc.) and surrounding whitespace/indentation when possible.

#### Claude Code (`.mcp.json` or `~/.claude.json`)

If `ags-api` is being installed, start its container before configuring the IDE:

```bash
docker run -d -e AB_BASE_URL="${AB_BASE_URL:-https://demo.accelbyte.io}" -p 3000:3000 ghcr.io/accelbyte/ags-api-mcp-server:2026.2.0
```

Then add via CLI: `claude mcp add --transport http ags-api http://localhost:3000/mcp`

Or write directly to the config file:

```json
{
  "mcpServers": {
    "ags-api": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    },
    "ags-extend-sdk": {
      "type": "http",
      "url": "{extend-sdk-url}"
    }
  }
}
```

#### Cursor (`~/.cursor/mcp.json` or `<project>/.cursor/mcp.json`)

If `ags-api` is being installed, start its container first (see Claude Code section above). Then:

```json
{
  "mcpServers": {
    "ags-api": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    },
    "ags-extend-sdk": {
      "type": "http",
      "url": "{extend-sdk-url}"
    }
  }
}
```

#### Windsurf (`~/.codeium/windsurf/mcp_config.json`)

If `ags-api` is being installed, start its container first (see Claude Code section above). Then:

```json
{
  "mcpServers": {
    "ags-api": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    },
    "ags-extend-sdk": {
      "type": "http",
      "url": "{extend-sdk-url}"
    }
  }
}
```

#### Kiro (`.kiro/settings/mcp.json`, project or global)

Same JSON structure as Claude Code above.

### Step 7 — Check authentication

If the active IDE exposes `ags-api` after setup, run one lightweight read-only call to confirm authentication. `ags-extend-sdk` needs no sign-in; one `search-symbols` call confirms it is reachable. If the tools are unavailable until restart, defer the check until the IDE reloads.

The recovery below applies to `ags-api` only.

If sign-in fails with an invalid-client signature — "invalid client ID", "client ID not found", or IAM's generic "Invalid Request" page — the cached DCR registration may be stale. Read `../../accelbyte/references/mcp-auth-recovery.md`, confirm the surrounding evidence, and follow its client-specific recovery. Do not reinstall or re-add the MCP server. Do not clear authentication for an ordinary expired token; try normal refresh or re-authorization first.

### Step 8 — Post-install reminder

```
Done. MCP config updated:
  {config-file-path}

Added:
  ✓ ags-api
  ✓ ags-extend-sdk ({language}, hosted)

The ags-api container must be running before starting your IDE. Start it with:

  docker run -d -e AB_BASE_URL=<your-ags-url> -p 3000:3000 ghcr.io/accelbyte/ags-api-mcp-server:2026.2.0

ags-extend-sdk is hosted and needs nothing running locally. If you change
languages later, update the last segment of its URL in {config-file-path}.

Restart {IDE} for the new MCP connections to activate.
```

## Error Handling

| Situation | Response |
|---|---|
| Config file exists but isn't valid JSON | Stop. Show the parse error and the line. Do not auto-fix user JSON. |
| `mcpServers` key exists with a non-object value (e.g. array, null) | Stop. The user has an unusual config — show what's there and ask for guidance. |
| `ags-api` already present, different command | Show both entries, ask which to keep. Don't auto-pick either. |
| `ags-extend-sdk` present as a Docker command | An older config. Show both entries and recommend the hosted one (no Docker, no image to keep current), but let the user decide. |
| User picks a language not in the table | Stop — the SDK MCP supports only the four listed. Ask again. |
| Docker is installed but daemon not running | Only `ags-api` requires Docker. Tell the user to start Docker and retry, or continue with `ags-extend-sdk` alone. |
| Sign-in fails with "invalid client ID", "client ID not found", or a generic IAM "Invalid Request" page | The cached DCR client registration may be stale. Read `../../accelbyte/references/mcp-auth-recovery.md`, confirm its evidence, and follow the client-specific recovery. Do not reinstall or re-add the MCP server, and do not clear authentication for an ordinary expired token. |
| Windsurf path doesn't exist yet | Create it (and the `~/.codeium/windsurf/` directory). Don't fall back to a different file. |
| User wants both project and global configs | Pick one for this run. Say: "I'll write one at a time — re-run `/ags-extend install-mcp` and choose the other scope if you want both." |
| "other" IDE | Print the generic JSON block and the required env vars. Stop without writing. |
| User asks for the Grafana MCP server | Not owned here. Route to `/ags install-mcp`. Don't broker a token or write a `grafana` entry from this subskill. |

## Examples

### Claude Code, clean project config

```
User: /ags-extend install-mcp

Skill: Which AI IDE are you setting up? (Claude Code / Cursor / Windsurf / Kiro / other)

User: Claude Code

Skill: ✓ docker daemon running

       Which language is your Extend app in? (Go / Java / Python / C#)

User: Go

Skill: Scope:
         1. project → ./.mcp.json (doesn't exist yet)
         2. global  → ~/.claude.json (exists, 14 entries, no ags-* keys)
       Which?

User: 1

Skill: Will add these MCP servers to ./.mcp.json:
         1. ags-api
         2. ags-extend-sdk (go, hosted)
       Creating new file.
       Continue? (yes/no)

User: yes

Skill: [writes ./.mcp.json]
       Done. MCP config updated: ./.mcp.json

       Added:
         ✓ ags-api
         ✓ ags-extend-sdk (go, hosted)

       Start the ags-api container before restarting…

       Restart Claude Code for the new MCP connections to activate.
```

### ags-extend-sdk only (no Docker needed)

```
User: Just the Extend SDK MCP, I'm on Go. Docker isn't installed.

Skill: ags-extend-sdk is hosted, so Docker isn't needed — skipping the check.
       Will add to ./.mcp.json:
         1. ags-extend-sdk (go, hosted)
       Continue? (yes/no)

User: yes

Skill: [writes ./.mcp.json]
       Added:
         — ags-api (skipped)
         ✓ ags-extend-sdk (go, hosted)

       Restart Claude Code for the new MCP connection to activate.
```

### ags-api only (user requests it)

```
User: I only need ags-api

Skill: ✓ docker daemon running

       Which language is your Extend app in? (Go / Java / Python / C#)
       (Skip if only installing ags-api)

User: skip

Skill: [proceeds with ags-api only]
       …
       Added:
         ✓ ags-api
         — ags-extend-sdk (skipped)

       Start the ags-api container before restarting your IDE:
         docker run -d -e AB_BASE_URL=<url> -p 3000:3000 ghcr.io/accelbyte/ags-api-mcp-server:2026.2.0
```

### Conflict — ags-api already present

```
Skill: Reading ./.mcp.json…
       Found existing mcpServers.ags-api:
         {
           "command": "node",
           "args": ["/path/to/local/fork.js"],
           "env": { "AB_BASE_URL": "https://my-test.accelbyte.io" }
         }

       Proposed replacement:
         {
           "type": "http",
           "url": "http://localhost:3000/mcp"
         }

       Which to keep? (existing / replace / skip this server but add ags-extend-sdk)

User: skip

Skill: OK, keeping your existing ags-api. Continuing with ags-extend-sdk…
```

### "other" IDE

```
User: install-mcp, I'm using Zed

Skill: I don't have a merge path for Zed — configs differ across IDEs and I
       don't want to guess. Here's the generic config. Paste it into Zed's
       MCP configuration, adjust env vars as needed:

         [JSON block]

       Required env vars: AB_BASE_URL, AB_CLIENT_ID, AB_CLIENT_SECRET.
       See Zed's MCP docs for the exact config location and merge rules.
```
