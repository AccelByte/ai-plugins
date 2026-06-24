---
name: ags-manage-permissions
description: Add, update, or delete IAM/OAuth client permissions on an existing AGS
  client. Uses the authorization preflight to scope the exact resource/action and
  environment, then applies the change via the AGS CLI or the AGS API MCP server under
  a confirmation gate. For first-time namespace/client bootstrap use connect-portal
  instead.
allowed-tools: Read Bash Glob
model: sonnet
last-verified: 2026-06-24
sources:
- https://docs.accelbyte.io/
- https://github.com/AccelByte/ags-api-mcp-server
see-also:
- '[iam-authorization-preflight.md](../references/security/iam-authorization-preflight.md)'
- '[shared-cloud-client-permission-groups.md](../references/synthetic/shared-cloud-client-permission-groups.md)'
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[connect-portal.md](connect-portal.md)'
- '[install-cli.md](install-cli.md)'
- '[install-mcp.md](install-mcp.md)'
---

# AGS IAM Client Permission Management

Add, update, or remove permissions on an **existing** IAM/OAuth client. This is the operational CRUD path for client permissions — distinct from `connect-portal`, which sets a client's initial permissions while *creating* it during project bootstrap.

Every change here is scoped by the authorization preflight first, then applied through a discover → confirm → execute → verify loop, using either the AGS CLI or the AGS API MCP server. This subskill **never widens permissions beyond what the user asked for** and **never mutates without explicit confirmation**.

## Behavior Constraints

<grounding_rules>

Scope every change through `references/security/iam-authorization-preflight.md` before touching a client. Don't invent permission resource strings, action values, `groupId`s, or command/body shapes. Discover the exact required resource/action and the exact mutation operation from live tooling — `ags describe` and generated help, or the AGS API MCP server's `describe-apis` — not from memory or from another AGS version. For Shared Cloud, map the resource to a permission group with `references/synthetic/shared-cloud-client-permission-groups.md`; do not use that group model until environment detection resolves to Shared Cloud.

If the exact mutation operation for the environment isn't exposed by the CLI or the MCP server, say so and route to the Admin Portal owner. Do not approximate a write you can't verify.

</grounding_rules>

<tool_usage_rules>

- `Read` for `references/security/iam-authorization-preflight.md`, `references/synthetic/shared-cloud-client-permission-groups.md`, and `references/observe/cli-commands.md`.
- `Glob` to locate project runtime config when the target namespace must come from a game project on disk.
- `Bash` for the AGS CLI when it's installed and authenticated. Use read-only discovery (`ags describe`, `--help`, `ags iam clients get/list`, `ags iam client-config list-permissions`) freely; run state-changing commands only after showing the command/body and receiving explicit confirmation.
- When the AGS API MCP server is configured for this environment, its `search-apis` / `describe-apis` / `run-apis` tools are an equivalent path — useful when the CLI is not installed or authenticated. Treat `run-apis` write operations (`POST` / `PUT` / `PATCH` / `DELETE`) as mutations under the same confirmation gate; the tool itself also prompts for consent.
- Don't read other subskills except when redirecting (see Error handling).
- Don't write project files. This subskill changes AGS-side client state only.

</tool_usage_rules>

<dependency_checks>

Before changing anything, confirm:

1. A discovery + mutation path is available: the AGS CLI is installed and authenticated (`ags --version`, `ags auth status`), **or** the AGS API MCP server is configured for the target environment. If neither, route to `/ags install-cli` or `/ags install-mcp`, or hand the change to the Admin Portal owner, and stop.
2. The target **client ID** is known. If the user only describes the client ("my dedicated server client"), discover it read-only (`ags iam clients list --namespace <ns> --format json` or the MCP equivalent) and confirm which client before mutating.
3. The target **namespace** is known. For game projects, derive it from project runtime config (Unreal `Config/DefaultEngine.ini`, Unity SDK config asset/json, Web/custom `.env`) before CLI defaults. For pure ops contexts, take it from explicit user input. If project config and CLI profile disagree, stop and report the mismatch.
4. The **environment model** is resolved (Shared Cloud vs Private Cloud / BYOC vs unknown) per the preflight, because it decides whether the change is expressed as a permission group or a free-form resource/action.

If any of those are missing, surface the gap before doing work.

</dependency_checks>

<action_safety>

This subskill mutates IAM client permissions on a live namespace. Permission changes are security-sensitive — over-granting weakens the namespace, and deletes can break a running integration.

- **Confirm every mutation.** Show the client ID, the exact resource/action (or group) being added, updated, or removed, and the discovered command/request body. Get explicit confirmation before running it.
- **Least privilege.** Add only the permission/action the user asked for. Don't bundle extra actions (`CREATE`/`READ`/`UPDATE`/`DELETE`) or extra resources "to be safe."
- **Deletes are destructive.** Name exactly which resource/action will be removed and warn that in-flight calls relying on it will start failing. Confirm before removing.
- **Caller kind gate.** For game server / backend / trusted-tooling permissions, the client must be **confidential** (per the preflight). If the target is a public client, stop and reclassify before granting server-side permissions.
- **Production.** If the namespace or client is production, confirm that intent explicitly before any change.
- **Never put secrets in scope.** This path changes permissions, not credentials. Don't echo or store client secrets.

If the CLI or MCP server doesn't expose the needed mutation, stop and give the Admin Portal owner the exact resource/action (Private Cloud) or module / group / `groupId` / action (Shared Cloud) to apply.

</action_safety>

<output_contract>

End with a change block:

```text
Permission change applied

  Namespace:        <name>
  Environment:      <shared cloud | private cloud | unknown>
  Client:           <client-id> (<public | confidential>)
  Operation:        <add | update | delete>
  Permission:       <resource [actions]>  |  <module / group / groupId / actions>
  Path used:        <AGS CLI | AGS API MCP run-apis | Admin Portal handoff>
  Verified:         <yes — re-read client permissions | no | blocked>
```

If the change was scoped but not executed (no path available, or user declined), print the block with `Operation: not applied` and the exact resource/action or group the Admin Portal owner needs.

</output_contract>

<completeness_contract>

The change is complete when:

1. The authorization preflight has scoped the exact resource/action (Private Cloud) or permission group (Shared Cloud) and the environment is classified.
2. The target client and namespace are confirmed.
3. For a confirmed change, the mutation ran through the CLI or MCP server after explicit confirmation, or the inability to run it was reported with the exact change to apply manually.
4. The result was verified by re-reading the client's permissions where the tooling allows.
5. The change block is printed.

</completeness_contract>

## Workflow

### Step 1: Confirm preconditions

Run `dependency_checks`. If neither the CLI nor the MCP server is usable, route to `/ags install-cli` or `/ags install-mcp`, or hand off to the Admin Portal, and stop.

### Step 2: Scope the change with the authorization preflight

Read `references/security/iam-authorization-preflight.md` and follow it to:

- Classify the caller the permission is for (game client / game server / backend / trusted tool / web-admin) and confirm the client kind matches (server-side ⇒ confidential).
- Detect the environment (Shared Cloud vs Private Cloud / BYOC vs unknown). If unknown, report the missing evidence instead of guessing the format.
- Discover the exact resource and action the change concerns, rather than guessing the string. Two equivalent discovery paths:
  - **AGS CLI** — `ags describe <service> <resource> <method>`, generated `--help`, and JSON output.
  - **AGS API MCP server** — `search-apis` / `describe-apis` for the operation and its auth requirements.

For Shared Cloud, map the discovered resource to its permission group with `references/synthetic/shared-cloud-client-permission-groups.md` (catalog command `ags iam client-config list-permissions --exclude-permissions false --output -`, endpoint `GET /iam/v3/admin/clientConfig/permissions`). The action bits are `1=CREATE 2=READ 4=UPDATE 8=DELETE`.

### Step 3: Read the client's current permissions

Before changing anything, read the current state so the diff is real, not assumed:

- **CLI** — discover and run the client read command (`ags describe iam clients get`, then `ags iam clients get --namespace <ns> --client-id <id> --format json`).
- **MCP** — `run-apis` on `GET /iam/v3/admin/namespaces/{namespace}/clients/{clientId}`.

Identify whether the requested permission/action is already present, partially present (some actions), or absent. This decides add vs update vs no-op, and prevents an accidental over-grant.

### Step 4: Determine and show the change

State the operation and the minimal change:

- **Add** — grant a resource/action (Private Cloud) or assign a group (Shared Cloud) the client doesn't have.
- **Update** — change the action bits on a resource the client already has (e.g. add `UPDATE` to an existing `READ`).
- **Delete** — remove a resource/action the client no longer needs.

Discover the exact mutation operation and request body — don't hardcode it:

| Operation | Endpoint (discover the exact CLI/MCP shape first) |
|---|---|
| Add permission(s) | `POST /iam/v3/admin/namespaces/{namespace}/clients/{clientId}/permissions` |
| Replace permission set | `PUT /iam/v3/admin/namespaces/{namespace}/clients/{clientId}/permissions` |
| Delete one permission | `DELETE /iam/v3/admin/namespaces/{namespace}/clients/{clientId}/permissions/{resource}/{action}` |

Use `--skeleton` / `--dry-run` (CLI) or `describe-apis` (MCP) to build the body. Show the user the client ID, the before/after permission state, and the resolved command or request body.

### Step 5: Confirm and execute

Get explicit confirmation per `action_safety`. Then run the mutation through whichever path is available:

- **CLI** — run the confirmed `ags iam clients ...` command. On PowerShell, write JSON bodies to a file and pass `--json @file` after verifying that flag with `--help`.
- **MCP** — `run-apis` with the confirmed method, path, and body. Its write-op consent prompt is in addition to — not a replacement for — the confirmation you already showed.

Apply one change at a time when the user asked for several, so each is individually confirmable and reversible.

### Step 6: Verify and report

Re-read the client's permissions (Step 3 command) and confirm the resource/action (or group) now reflects the intended state. Print the change block from `output_contract`. If verification isn't possible with the available tooling, say so rather than assuming success.

## Examples

### Add a permission (Private Cloud)

```
User: /ags manage-permissions — give my dedicated server client the AMS local DS create permission.

Skill: Preconditions: ✓ ags authenticated.
       Preflight: caller = game server ⇒ confidential client (✓ client abc123 is confidential).
       Environment: Private Cloud (base URL not on gamingservices.accelbyte.io) ⇒ free-form resource string.
       Discovered required permission: NAMESPACE:{namespace}:AMS:LOCALDS [CREATE]

       Current state of client abc123: does not have AMS:LOCALDS.

       Change (add):
         POST /iam/v3/admin/namespaces/myteam-prod/clients/abc123/permissions
         body: { "Permissions": [ { "Resource": "NAMESPACE:myteam-prod:AMS:LOCALDS", "Action": 1 } ] }
       Confirm? (y/n)

User: y

Skill: ✓ Applied. Re-read client abc123 — AMS:LOCALDS [CREATE] present.

       Permission change applied

         Namespace:    myteam-prod
         Environment:  private cloud
         Client:       abc123 (confidential)
         Operation:    add
         Permission:   NAMESPACE:myteam-prod:AMS:LOCALDS [CREATE]
         Path used:    AGS CLI
         Verified:     yes
```

### Delete a permission (destructive confirm)

```
User: /ags manage-permissions — remove the store write permission from client abc123.

Skill: Preflight: discovered resource NAMESPACE:myteam-prod:STORE, action 4 (UPDATE).
       Current state: client abc123 has STORE [READ, UPDATE].

       Delete will remove UPDATE only (READ stays). Any code path on this client
       that writes the store will start returning 403.

         DELETE /iam/v3/admin/namespaces/myteam-prod/clients/abc123/permissions/NAMESPACE:myteam-prod:STORE/4
       Confirm removal? (y/n)

User: y

Skill: ✓ Removed. Re-read client abc123 — STORE now [READ] only.
       (change block …)
```

### Shared Cloud — map to a group first

```
User: /ags manage-permissions — let my client read game sessions. We're on Shared Cloud.

Skill: Environment: Shared Cloud (base URL on gamingservices.accelbyte.io) ⇒ permission-group model.
       Preflight discovered resource: NAMESPACE:{namespace}:SESSION:GAME [READ].
       Catalog match: Session / Game Session / g_game_session covers READ (action 2).

       I'll assign that group's session-read permission to the client. Let me
       discover the exact assignment command with `ags describe` before showing
       the body to confirm.
       …
```

### No path available

```
User: /ags manage-permissions — add a permission to client abc123.

Skill: AGS CLI not installed and no AGS API MCP server configured for this environment.

       Run /ags install-cli or /ags install-mcp, or have your Admin Portal owner
       add it manually. Once you tell me the AGS call this client needs to make,
       I can scope the exact resource/action (Private Cloud) or module/group
       (Shared Cloud) for them to apply.
```

## Error handling

- **Client not found** — surface the wrong-namespace or wrong-portal-auth scenario; re-list clients read-only and confirm the ID before retrying.
- **Public client asked to hold a server permission** — stop and reclassify per the preflight. Server-side permissions belong on a confidential client; route to `/ags connect-portal` if a confidential client must be created first.
- **Environment unknown** — don't guess the format. Report the resource/action plus the missing environment evidence and ask for it.
- **Permission resource can't be discovered** — say the CLI/MCP doesn't expose it; fall back to official docs or AccelByte support. Don't invent a string.
- **403 running the mutation itself** — the authenticated CLI/MCP identity lacks permission to manage clients. Surface that; this is an operator-permission gap, not the target client's gap.
- **Bootstrap, not a change** — if the user actually needs a new namespace or a brand-new client, route to `/ags connect-portal`.
- **Role-based access, not client permissions** — assigning permissions to *users* via roles is a different surface; if the request is about user roles rather than an OAuth client, say so and point at the IAM role/admin docs.
