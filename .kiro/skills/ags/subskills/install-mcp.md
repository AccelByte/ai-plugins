---
name: ags-install-mcp
description: Customize the URL for the AGS API MCP server after installing the plugin.
  The MCP server itself is distributed with the plugin (see content/mcps/ags-api.yaml);
  this subskill helps the user pick and apply the right URL — default Shared Cloud,
  per-studio Shared Cloud, or Private Cloud / BYOC.
allowed-tools: Read Edit Bash Glob
model: sonnet
last-verified: 2026-04-29
sources:
- https://github.com/AccelByte/ags-api-mcp-server
- https://prod.gamingservices.accelbyte.io/mcp
see-also:
- '[install-cli.md](install-cli.md)'
---

# AGS API MCP Server URL Selector

The **AGS API MCP server** is distributed with this plugin. When you installed the plugin (e.g. via `claude --plugin-dir /path/to/accelbyte-ai-plugins`, or by merging `.mcp.json` into your IDE per `INSTALL.md`), the MCP server entry was added to your IDE's MCP config with a default URL. This subskill helps you pick and apply the right URL for your environment.

The MCP server source-of-truth is `content/mcps/ags-api.yaml`. The plugin's `INSTALL.md` (in the compiled plugin output) walks the user through merging the MCP config; this subskill is the conversation about **which URL to use**, since that varies per customer.

There's a sibling Extend SDK MCP server (`ags-extend-sdk`, declared in `content/mcps/ags-extend-sdk.yaml`) that's owned by `/ags-extend install-mcp` — different MCP, different purpose (Extend SDK code generation, not AGS API calls). Power users wire both.

## Behavior Constraints

<grounding_rules>

The URL patterns are exactly what `content/mcps/ags-api.yaml` declares in its `post-install` prose:

- **Default (Shared Cloud, plugin-installed):** `https://prod.gamingservices.accelbyte.io/mcp`
- **Shared Cloud, per-studio:** `https://{studio_namespace}.prod.gamingservices.accelbyte.io/mcp`
- **Private Cloud / BYOC:** `https://{environment_name}.accelbyte.io/mcp`

Don't invent other URL shapes. If the user's environment doesn't fit one of those three, point at AccelByte support / their Delivery Manager.

</grounding_rules>

<tool_usage_rules>

- `Glob` to find the user's IDE MCP config file (where the plugin installed the entry):
  - Claude Code (project): `.mcp.json`
  - Claude Code (user): `~/.claude.json`
  - Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
  - Cursor: `.cursor/mcp.json` (project) or user settings
  - VS Code: `.vscode/mcp.json` or user settings
  - Kiro: `.kiro/settings/mcp.json`
  - Codex: `.codex/config.toml` (under `mcp_servers.*`)
- `Read` the user's IDE config to confirm the AGS API MCP entry is present (it will be if the plugin was installed correctly).
- `Edit` to change the `url` field for the `AGS API MCP Server` entry only — never touch other MCP entries.
- `Bash` to confirm the chosen URL is reachable (`curl -sIL <url>` returns 200 / a sane status).
- Don't read other subskills.

</tool_usage_rules>

<dependency_checks>

Before changing anything:

1. Confirm the plugin is installed and the AGS API MCP entry exists in the user's IDE config. If not, route them at the plugin's `INSTALL.md` first.
2. Confirm which deployment the user is on (Shared Cloud / Private Cloud / BYOC). If they don't know, ask their Delivery Manager or AccelByte sales contact — don't guess.

</dependency_checks>

<action_safety>

Edits the user's IDE MCP config. Specifically:

- Show the diff for the `url` change before applying.
- Don't change anything else in the config — leave other MCP entries untouched.
- If the IDE config is workspace-scoped (`.mcp.json` in project root), warn the user that the URL change will be checked into the repo if `.mcp.json` is tracked. For per-studio or per-environment URLs that shouldn't be shared, suggest user-scoped config or a `.gitignore` entry.

</action_safety>

<output_contract>

End with a "set" block:

```
AGS API MCP URL set

  IDE:               <Claude Code / Claude Desktop / Cursor / VS Code / Kiro / Codex>
  Deployment:        Shared Cloud (default) | Shared Cloud (per-studio) | Private Cloud / BYOC
  URL:               <URL>
  Config file:       <path>
  Reachability:      OK / unreachable (note details)

Next step:
  • Restart the IDE if MCP servers don't auto-reload.
  • For Extend development, also wire the Extend SDK MCP: /ags-extend install-mcp.
```

</output_contract>

<completeness_contract>

The URL selection is complete when:

1. The IDE config's `AGS API MCP Server` entry has the correct URL for the user's deployment.
2. A reachability check has been attempted (and the result reported even if the URL is unreachable from this machine, e.g. due to a firewall — that's the user's network, not necessarily a wrong URL).
3. The "set" block is printed.

If the plugin isn't installed yet, "complete" means the user has been routed to `INSTALL.md` and knows to come back here once the plugin is in.

</completeness_contract>

## Workflow

### Codex-only config handling

Use `.codex/config.toml` only when the user is running Codex. Codex stores MCP servers under TOML tables such as `[mcp_servers.ags_api]`; the JSON examples and `.mcp.json` merge flow in this subskill are for other IDEs.

For non-Codex IDEs, do not create or edit `.codex/config.toml`. Use the IDE-specific MCP config file listed above, or route the user to the plugin `INSTALL.md` if the plugin-managed MCP entry is missing.

### Step 1: Confirm the plugin is installed

`Glob` for the IDE's MCP config and `Read` it to verify the `AGS API MCP Server` entry is present. If not:

> The plugin's MCP config doesn't appear to be wired into your IDE yet. Follow the plugin's `INSTALL.md` first to merge `.mcp.json` (or the IDE-specific equivalent), then re-run `/ags install-mcp` to customize the URL.

### Step 2: Confirm deployment

Ask:

> Which AGS deployment are you on?
>
> 1. **Shared Cloud (default)** — the URL is `https://prod.gamingservices.accelbyte.io/mcp`. This is the default the plugin ships with; if you haven't customized it, you're already done.
> 2. **Shared Cloud (per-studio)** — your studio has its own subdomain. URL is `https://{studio_namespace}.prod.gamingservices.accelbyte.io/mcp` — substitute your studio's namespace.
> 3. **Private Cloud / BYOC** — your studio has a dedicated environment. URL is `https://{environment_name}.accelbyte.io/mcp` — substitute your environment name (your Delivery Manager has this).
>
> If you don't know, your Delivery Manager or AccelByte sales contact can confirm.

### Step 3: Apply the URL

If the user picked option 1 (default), no change needed — confirm the existing config and stop.

For options 2 and 3, show the diff in the IDE config:

```diff
   "AGS API MCP Server": {
     "type": "http",
-    "url": "https://prod.gamingservices.accelbyte.io/mcp"
+    "url": "<the user's URL>"
   }
```

Confirm with the user, then apply via `Edit`.

### Step 4: Reachability check

```bash
curl -sIL -o /dev/null -w "%{http_code}\n" "<the URL>"
```

Capture the status code. 200 / 401 / 405 are all "server is reachable" (the MCP requires auth, so 401 is expected without a token; 405 is "method not allowed" for HEAD which is also fine). 4xx-non-auth or 5xx or DNS failure means the URL is wrong or the user's network can't reach it.

### Step 5: Print the "set" block

Per `output_contract`. Tell the user to restart the IDE if needed.

## Examples

### Default Shared Cloud — no change needed

```
User: /ags install-mcp

Skill: Reading .mcp.json...
       ✓ AGS API MCP Server entry present.
       ✓ URL is the default: https://prod.gamingservices.accelbyte.io/mcp

       Which deployment are you on? (Shared Cloud default / per-studio /
       Private Cloud)

User: Shared Cloud, default.

Skill: ✓ The default URL already matches your deployment. No change needed.

       AGS API MCP URL set

         IDE:           Claude Code
         Deployment:    Shared Cloud (default)
         URL:           https://prod.gamingservices.accelbyte.io/mcp
         Config file:   .mcp.json
         Reachability:  OK (200 from health check)

       Next step:
         • Restart Claude Code if MCP servers don't auto-reload.
         • For Extend development: /ags-extend install-mcp.
```

### Per-studio Shared Cloud

```
User: /ags install-mcp — our studio has its own subdomain, "myteam".

Skill: ✓ AGS API MCP Server entry present in .cursor/mcp.json.
       Will change URL to:
         https://myteam.prod.gamingservices.accelbyte.io/mcp
       Diff:
         - "url": "https://prod.gamingservices.accelbyte.io/mcp"
         + "url": "https://myteam.prod.gamingservices.accelbyte.io/mcp"
       Confirm? (y/n)

User: y

Skill: ✓ Applied. Reachability check: 401 (expected — auth required).

       AGS API MCP URL set

         IDE:           Cursor
         Deployment:    Shared Cloud (per-studio: myteam)
         URL:           https://myteam.prod.gamingservices.accelbyte.io/mcp
         Config file:   .cursor/mcp.json
         Reachability:  OK (401 — auth required, server is up)

       Note: .cursor/mcp.json is workspace-scoped. If your repo is shared
       and the studio namespace shouldn't be in version control, either
       move this entry to user-scoped Cursor settings, or add
       .cursor/mcp.json to .gitignore.

       Next step: restart Cursor.
```

### Private Cloud

```
User: /ags install-mcp — Private Cloud, env name "acme-prod".

Skill: ✓ AGS API MCP Server entry present in ~/.claude.json (user scope).
       Will change URL to:
         https://acme-prod.accelbyte.io/mcp
       Confirm? (y/n)

User: y

Skill: ✓ Applied. Reachability check: 405 (HEAD not allowed — server is up).

       AGS API MCP URL set

         IDE:           Claude Code (user scope)
         Deployment:    Private Cloud (env: acme-prod)
         URL:           https://acme-prod.accelbyte.io/mcp
         Config file:   ~/.claude.json
         Reachability:  OK (405 — HEAD blocked, server reachable)

       Next step: restart Claude Code.
```

### Plugin not installed

```
User: /ags install-mcp

Skill: Reading .mcp.json... no AGS API MCP Server entry found.
       The plugin's MCP config isn't wired into Claude Code yet.

       Follow the plugin's INSTALL.md first to merge .mcp.json (it's in
       the compiled plugin root), then re-run /ags install-mcp to set the
       URL for your deployment.
```

## Error handling

- **Plugin installed but the entry is gone or renamed** — surface the discrepancy. Don't auto-add a new entry; that path belongs in the plugin install flow, not here.
- **User-supplied URL doesn't match any of the three patterns** — explain the patterns. If the user insists on a custom URL, apply it but warn that it may not be a supported AccelByte endpoint.
- **Reachability check fails non-auth (DNS, 5xx, timeout)** — surface the failure. Common causes: typo in the namespace / environment name, corporate network blocking the AccelByte domain, the per-studio subdomain doesn't actually exist (Shared Cloud customers may need to confirm with AccelByte that their namespace has been provisioned).
- **User asks how to get a Bearer token** — point at their IAM client config in the Admin Portal. The MCP authenticates as the user via standard AGS OAuth; the IDE typically prompts for the token on first call or reads it from an environment variable.
- **User wants the Extend SDK MCP, not the AGS API MCP** — route to `/ags-extend install-mcp`.
