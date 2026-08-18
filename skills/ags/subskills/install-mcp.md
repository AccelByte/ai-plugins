---
name: ags-install-mcp
description: Set up AGS-related MCP entries in the user's AI IDE. Handles the engine-neutral
  AGS API MCP URL workflow and routes engine SDK MCP requests to engine-specific references.
allowed-tools: Read Edit Bash Glob
model: sonnet
last-verified: 2026-08-17
sources:
- https://github.com/AccelByte/ags-api-mcp-server
- https://github.com/grafana/mcp-grafana
see-also:
- '[install-cli.md](install-cli.md)'
- '[mcp-auth-recovery.md](../../accelbyte/references/mcp-auth-recovery.md)'
- '[grafana-mcp.md](../references/observe/grafana-mcp.md)'
- '[unreal-mcp.md](../references/sdks/game-engine/unreal/mcp.md)'
- '[unity-mcp.md](../references/sdks/game-engine/unity/mcp.md)'
- '[godot-mcp.md](../references/sdks/game-engine/godot/mcp.md)'
---

# AGS MCP Setup

This subskill is the engine-neutral MCP setup router for AGS-related MCP servers.

It has four paths:

1. **AGS API MCP Server** - the default path for `/ags install-mcp`. This configures the MCP URL for the user's AGS deployment and works for every engine and custom project type.
2. **Game Engine SDK MCP** - engine-specific SDK context MCPs. Detect or ask for the engine, then read the matching engine MCP reference.
3. **Grafana MCP** - read-only querying of the tenant's Grafana (AGS service metrics and logs). **Private Cloud only.** Owned here, and used by `/ags-extend` too.
4. **AGS Extend SDK MCP** - owned by `/ags-extend install-mcp`; redirect there.

The AGS API MCP server source of truth is `content/mcps/ags-api.yaml`. Engine SDK MCP behavior lives in `references/sdks/game-engine/<engine>/mcp.md`. Grafana MCP behavior lives in `references/observe/grafana-mcp.md`.

## Behavior Constraints

<grounding_rules>

For the AGS API MCP Server, the URL patterns are exactly what `content/mcps/ags-api.yaml` declares. There is no shared default endpoint — every deployment has its own host:

- **Public Cloud:** `https://{studio}-{game}.prod.gamingservices.accelbyte.io/mcp/{studio}-{game}` — the `{studio}-{game}` namespace appears in both the host and the path.
- **Private Cloud / BYOC:** `https://{environment_name}.accelbyte.io/mcp`

Do not invent other AGS API MCP URL shapes. If the user's environment does not fit one of those, point at AccelByte support or their Delivery Manager.

For Game Engine SDK MCP requests:

- Detect the engine from project files when possible: `.uproject` for Unreal, `Assets/` plus `ProjectSettings/` for Unity, and `project.godot` for Godot.
- If no engine or multiple engines are detected, ask whether to target Unreal, Unity, or Godot.
- Unreal SDK MCP setup is documented in `references/sdks/game-engine/unreal/mcp.md`.
- Unity MCP setup is documented in `references/sdks/game-engine/unity/mcp.md`.
- Godot SDK MCP is not supported yet; read its placeholder MCP reference and report the unsupported status.
- Do not install AccelByteUITools from this generic MCP router. Unreal UI generation and generator install are owned by `/ags generate-ui` and the Unreal UI references.

For Grafana MCP requests:

- Read `references/observe/grafana-mcp.md` before brokering a token, writing config, or explaining expiry. Do not restate the broker endpoint, its `Content-Type` requirement, the response fields, or the TTL from memory.
- **Private Cloud only.** Public Cloud is not eligible — the broker rejects those tenants by design. BYOC is a separate deployment model and is not covered. Confirm the tier before offering this path; do not treat "not Public Cloud" as "eligible".
- Eligibility does not guarantee reachability: the broker has so far been confirmed only on the development environment. Attempt the call and fall back to the browser flow if it is not exposed.
- Always configure `mcp-grafana` with `--disable-write`. Every AGS skill that reads Grafana is read-only by contract, and the server advertises mutation tools without that flag.
- A `403` from the broker is ambiguous — missing `NAMESPACE:{namespace}:USER:* [READ]`, or an ineligible tenant. Establish which before reporting.

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
- If the active IDE already exposes the AGS API MCP tools, run one lightweight read-only MCP call after URL setup to confirm auth is fresh. If it reports expired auth, unauthenticated, consent required, or re-auth needed, report setup as blocked on re-auth instead of ready.
- Don't read other subskills except when redirecting the user to `/ags-extend install-mcp`.

</tool_usage_rules>

<dependency_checks>

Before changing anything:

1. Identify which MCP the user means: AGS API MCP Server, Game Engine SDK MCP, Grafana MCP, AGS Extend SDK MCP, or multiple.
2. For AGS API MCP Server, confirm the plugin is installed and the AGS API MCP entry exists in the user's IDE config. If not, route them to the plugin `INSTALL.md` first.
3. For AGS API MCP Server, confirm which deployment the user is on: Public Cloud, Private Cloud, or BYOC. If they do not know, ask their Delivery Manager or AccelByte sales contact; do not guess.
4. For Game Engine SDK MCP, detect or ask for the engine and read the matching engine MCP reference.
5. For Grafana MCP, confirm the deployment is Private Cloud and that `uvx` is on PATH (`command -v uvx`). Check these independently — they gate only this path, and neither should block another MCP the user also asked for.

</dependency_checks>

<action_safety>

This subskill may edit the user's IDE MCP config.

- Show the diff for AGS API MCP `url` changes before applying.
- Do not change unrelated MCP entries.
- If the IDE config is workspace-scoped, warn the user that the URL change may be checked into the repo if the file is tracked.
- Do not copy engine SDK MCP packages, install game-engine plugins, or install AccelByteUITools from this file. Engine-specific setup steps belong in engine MCP or UI references.
- A brokered Grafana token is a live credential. Redact it in every merge plan, result block, and message; write it only into the MCP config file. Prefer a scope the user does not track in git, and say so before writing if the only sensible target is a tracked file. Never put it in a commit message or a log.
- On a `grafana` key conflict, show both entries with tokens redacted and ask which to keep. Do not overwrite. The same rule applies to Codex's `[mcp_servers.grafana]` table — the config shape differs, the handling does not.

</action_safety>

<output_contract>

For AGS API MCP URL setup, end with:

```text
AGS API MCP URL set

  IDE:               <Claude Code / Codex / Cursor / VS Code / Kiro / OpenCode>
  Deployment:        Public Cloud | Private Cloud / BYOC
  URL:               <URL>
  Config file:       <path>
  Reachability:      OK / unreachable (note details)
  Auth check:        OK / blocked - <re-auth required> / not available until IDE restart

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

For Grafana MCP requests, end with:

```text
Grafana MCP configured

  Deployment:      Private Cloud (confirmed)
  Config file:     <path>
  Read-only flag:  --disable-write present
  Token expires:   <expires_at> (~4h, no refresh)
  Verification:    <datasources returned> / not available until reload / blocked - <reason>

Next step:
  Reload MCP servers, or restart the IDE. Tools do not appear until then.
```

Never print the token itself in this block.

</output_contract>

<completeness_contract>

The AGS API MCP URL path is complete when:

1. The IDE config's `AGS API MCP Server` entry has the correct URL for the user's deployment.
2. A reachability check has been attempted and reported.
3. If the active IDE exposes the MCP tools before restart, an auth freshness check has been attempted and reported.
4. The AGS API MCP URL set block is printed.

The Game Engine SDK MCP path is complete when:

1. The target engine has been detected or confirmed.
2. The matching engine MCP reference has been read.
3. The Game Engine SDK MCP checked block is printed.

The Grafana MCP path is complete when:

1. Private Cloud eligibility has been confirmed, or the request has been declined as ineligible with the reason stated.
2. A token has been brokered, or the failure reported with its established cause.
3. The config entry has been written with `--disable-write`, after an approved merge plan showing the token redacted.
4. The reload requirement and the expiry time have both been stated.
5. The Grafana MCP configured block is printed.

</completeness_contract>

## Workflow

### Step 0: Select MCP path

Determine the requested MCP setup before editing anything:

- If the user asks for AGS API MCP, AGS API URL setup, namespace/studio/private-cloud MCP URL, or a generic `/ags install-mcp` after `connect-portal`, use the AGS API MCP URL workflow.
- If the user asks for Game Engine SDK MCP, Unreal SDK MCP, Unity MCP, Godot SDK MCP, SDK symbol/snippet lookup, `unreal_sdk`, or engine-specific MCP setup, use the Game Engine SDK MCP router.
- If the user asks for Grafana MCP, Grafana access, querying logs or metrics directly, PromQL/LogQL from the IDE, or a Grafana service-account token, use the Grafana MCP workflow.
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

### Grafana MCP Workflow

Read `references/observe/grafana-mcp.md` first. It owns the procedure; this section only sequences it.

1. **Confirm eligibility.** Ask which deployment the user is on if it isn't already established. Private Cloud only. On Public Cloud, stop here:

   > Grafana's MCP server needs a service-account token, and AGS only brokers those for Private Cloud tenants — Public Cloud is rejected by design, and there are no AGS service metrics there either. Use the Admin Portal instead. For Extend app logs specifically, `/ags-extend observe` walks through the browser flow.

2. **Check `uvx`.** `command -v uvx`. If missing, tell the user to install `uv` and stop — don't substitute another runner.

3. **Broker a token**, per `references/observe/grafana-mcp.md#step-1--broker-a-token`. Needs `Content-Type: application/json` and a `{}` body. On failure, report the cause: a `403` is ambiguous between a missing permission and an ineligible tenant, so establish which rather than asserting either.

4. **Resolve the config file** using the IDE table in the AGS API MCP workflow below — the same paths apply.

5. **Show the merge plan and ask.** Include the `grafana` key. **Redact the token** in anything displayed. If `mcpServers.grafana` already exists, show both entries and ask which to keep; never overwrite silently.

6. **Write** the entry with `--disable-write`, in the JSON or Codex TOML form given in `references/observe/grafana-mcp.md#step-2--configure-the-mcp-server`.

7. **Reload and verify.** Writing config does not connect the server; the session must reload MCP servers or restart the IDE. Then list datasources and diagnose the actual result — an empty list or `401` can mean an expired token, a wrong URL, insufficient permissions, or environment-specific datasource configuration.

8. **State the expiry.** The token lives ~4 hours with no refresh. Tell the user when it dies and that re-running `/ags install-mcp` brokers a fresh one.

### AGS API MCP URL Workflow

#### Step 1: Confirm the plugin is installed

`Glob` for the IDE's MCP config and `Read` it to verify the `AGS API MCP Server` entry is present. If not:

> The plugin's MCP config does not appear to be wired into your IDE yet. Follow the plugin's `INSTALL.md` first to merge the IDE-specific MCP config, then re-run `/ags install-mcp` to customize the URL.

#### Step 2: Confirm deployment

Ask which AGS deployment the user is on. There is no shared default endpoint — each deployment has its own host:

1. **Public Cloud** - `https://{studio}-{game}.prod.gamingservices.accelbyte.io/mcp/{studio}-{game}`. The `{studio}-{game}` namespace appears in both the host and the path.
2. **Private Cloud / BYOC** - `https://{environment_name}.accelbyte.io/mcp`.

If they do not know their namespace or host, tell them their Delivery Manager or AccelByte sales contact can confirm.

#### Step 3: Apply the URL

Show the diff in the IDE config before applying the user's deployment URL:

```diff
   "AGS API MCP Server": {
     "type": "http",
-    "url": "https://{studio}-{game}.prod.gamingservices.accelbyte.io/mcp/{studio}-{game}"
+    "url": "<the user's deployment URL>"
   }
```

Then apply via `Edit` after confirmation.

#### Step 4: Reachability check

```bash
curl -sIL -o /dev/null -w "%{http_code}\n" "<the URL>"
```

Treat 200, 401, and 405 as reachable. Other 4xx, 5xx, DNS failure, or timeout should be reported as unreachable or inconclusive with details.

#### Step 5: Auth freshness check

If the active IDE already exposes the AGS API MCP tools after setup, run a lightweight read-only MCP call before reporting ready. Use capability discovery, search/describe, or a harmless read operation. If the tool reports expired auth, unauthenticated, login required, consent required, or re-auth needed, stop and tell the user to re-authenticate/reload the MCP server. If the MCP tools are not available until restart, report `Auth check: not available until IDE restart`.

If re-authentication itself fails with an invalid-client signature — "invalid client ID", "client ID not found", or IAM's generic "Invalid Request" page — the cached DCR registration may be stale rather than the token simply being expired. Read `../../accelbyte/references/mcp-auth-recovery.md` and follow its evidence check and client-specific recovery before telling the user to reinstall or re-add the MCP server. Do not jump to clearing authentication for an ordinary expired token.

#### Step 6: Print the result block

Print the relevant block from `output_contract`.

## Error Handling

- **Ambiguous MCP request** - ask which MCP the user means before editing config.
- **Ambiguous engine SDK MCP request** - ask whether to target Unreal, Unity, or Godot.
- **Plugin installed but the AGS API MCP entry is gone or renamed** - surface the discrepancy. Do not auto-add a new AGS API MCP entry unless the user asks for that config creation flow.
- **User-supplied AGS API MCP URL does not match any supported pattern** - explain the supported patterns. If the user insists on a custom URL, apply it only after warning that it may not be a supported AccelByte endpoint.
- **Reachability check fails** - surface DNS, 5xx, timeout, or unexpected status details.
- **Sign-in fails with "invalid client ID", "client ID not found", or a generic IAM "Invalid Request" page** - the cached DCR client registration may be stale. Read `../../accelbyte/references/mcp-auth-recovery.md` for the evidence check and client-specific recovery (Claude Code **Clear authentication**; Codex `mcp logout`/`mcp login`). Do not reinstall or re-add the MCP server, and do not clear authentication for an ordinary expired token.
- **Godot SDK MCP requested** - report unsupported using the engine MCP placeholder reference.
- **User wants the Extend SDK MCP** - route to `/ags-extend install-mcp`.
- **Grafana MCP requested on Public Cloud** - not eligible; the broker rejects those tenants by design and there are no AGS service metrics there. Decline with the reason and point at the Admin Portal. Do not attempt the broker call.
- **Grafana MCP requested on BYOC** - not covered. Say so rather than assuming Private Cloud behavior applies.
- **Broker returns `406 Not Acceptable`** - missing `Content-Type: application/json` and a `{}` body. Add both and retry. Not a broken endpoint.
- **Broker returns `403`** - ambiguous between a missing `NAMESPACE:{namespace}:USER:* [READ]` permission and an ineligible tenant. Check both and report whichever is established; do not assert one.
- **Broker endpoint not exposed on this environment** - it has so far been confirmed only on development. Report it as unproven for this environment and fall back to the browser flow, not as a tenant fault.
- **`uvx` not found** - tell the user to install `uv`. Skip Grafana and continue with any other MCP they asked for.
- **Grafana tools missing after writing config** - the session has not reloaded. Reload MCP servers or restart the IDE before investigating. Do not re-write the config.
- **Grafana tools return 401 later in a session** - the token expired (~4h, no refresh). Broker a new one and replace `GRAFANA_SERVICE_ACCOUNT_TOKEN`.
