---
last-verified: 2026-07-20
sources:
- https://github.com/AccelByte/ags-api-mcp-server
see-also:
- '[install-cli.md](../../subskills/install-cli.md)'
- '[install-mcp.md](../../subskills/install-mcp.md)'
- '[observe.md](../../subskills/observe.md)'
- '[shared-cloud-client-permission-groups.md](../synthetic/shared-cloud-client-permission-groups.md)'
- '[ui-execution.md](../cli/ui-execution.md)'
---

# Observe - CLI Commands

Operational commands via the **AGS CLI** (`ags`) for namespace, IAM, auth, profile, diagnostics, and generated AGS API queries.

> **Note on CLI families.** AGS uses `ags` for namespace / IAM / operational API work. Extend uses a different CLI (`extend-helper-cli`) - those commands are owned by `/ags-extend`, not `/ags`. This file covers the AGS CLI only.

> **Verify before relying.** The AGS CLI generates service commands from bundled OpenAPI specs. Use `ags describe` as the primary, structured discovery mechanism for exact command shapes before running them. Use `--help` only as a fallback for non-generated commands or when `describe` is unavailable for that command family.

---

## Rules of Engagement for LLMs

When operating the AGS CLI on a user's behalf:

1. Treat `ags describe` as the source of truth for generated service commands. Run it before using unfamiliar service/resource/method commands.
2. Use `--skeleton` where available to discover request body schemas before writing JSON. Do not invent model fields from memory or examples for another resource.
3. Use `--dry-run` where available before mutating operations so the user can inspect the resolved command/body.
4. Use `--format json` for automation and evidence gathering. Do not parse human-readable output when JSON output is available.
5. Treat create, update, delete, kick, ban, grant, revoke, and similar operations as mutations. Show the discovered command/body and get explicit user confirmation before running them. (LLM safety layer — not in the CLI's source documentation; complements the four source-documented rules above.)
6. Do not hardcode guessed service, resource, method, flag, `--api-scope`, or `--api-version` values. Discover them from `ags describe` first; use CLI help only as a fallback when `describe` does not cover the command family, then report when the current CLI does not expose the needed operation.

### Executing a mutation once the command is resolved

Once a subskill has discovered the exact command/body for a mutation (rules 1-3 above) and is ready to run it, follow `references/cli/ui-execution.md` for the execution step — it owns the fullscreen-vs-plain choice and both execution paths (a spawned TUI window, or an inline plain run with CLI-driven discovery of any still-missing values). Don't invent a different execution flow per subskill.

### AGS CLI auth gate

For any `/ags` workflow that needs to refresh the AGS CLI token:

1. Check the current session with `ags auth status --format json`.
2. Refresh the current profile with bare `ags auth login`.

Do not add client/profile/config flags or credentials from project/runtime files while refreshing
the current CLI session.

### Namespace source of truth

For game projects, derive the target `--namespace` from the project's runtime config before running namespace-scoped commands. Do not use memory, previous sessions, or CLI defaults as the namespace source of truth. For Unreal, read `Config/DefaultEngine.ini` and the AccelByte SDK settings sections. For Unity, read the project's AccelByte SDK config asset/json if present. For Web/custom projects, read `.env` or the app config. If project config and CLI profile disagree, stop and ask before running any namespace-scoped command.

## What you can do via the CLI

- **Authenticate and inspect auth state** with `ags auth login`, `ags auth status`, and `ags auth logout`.
- **Manage profiles and config** with `ags profile ...` and `ags config ...`.
- **Run local diagnostics** with `ags doctor`.
- **List IAM clients, users, sessions, matchmaking objects, and other AGS resources** when the generated service command exposes that operation and the authenticated client has permission.
- **Inspect command metadata** with `ags describe` instead of parsing human-readable help.
- **Map Shared Cloud IAM client permission groups** with `ags iam client-config list-permissions --exclude-permissions false --output -`; follow `../synthetic/shared-cloud-client-permission-groups.md` for the permission group catalog shape and action-bit mapping.
- **Trigger admin actions** that the Admin Portal also supports - useful for scripts and automation, with explicit confirmation for mutations.
- **Provision integration prerequisites** such as IAM clients and login-method settings when the generated IAM command surface exposes those operations. Use `ags describe` and `--skeleton` / `--dry-run` where available; do not hardcode guessed command names or JSON body shapes.

## What CLI commands look like

```sh
# Authenticate the CLI to an AGS environment
ags auth login

# Check auth and connectivity
ags auth status
ags doctor

# List IAM clients, if exposed by the generated IAM command set
ags iam clients list --namespace <namespace>

# Query active sessions, if exposed by the generated Session command set
ags session game-sessions list --namespace <namespace>

# Discover the stable command and parameter contract as JSON
ags describe iam clients list

# List Shared Cloud client permission groups and their resource permissions
ags iam client-config list-permissions --exclude-permissions false --output -
```

The actual command surface depends on the bundled OpenAPI specs. Run `ags describe` for structured command discovery, including top-level service/resource exploration where available. Use `ags --help` only as a fallback for non-generated commands or when `describe` is unavailable. Automation must use `--format json`; do not parse human-readable output. For LLM/agent usage, follow the rules above before relying on a generated command.

## When the CLI is the right answer

- **Scripted ops** - you want to query, ingest, or trigger from a shell script or CI pipeline.
- **Bulk operations** - you have many resources to inspect or provision; the Admin Portal would be tedious.
- **Operational automation** - using `--format json`, `--dry-run`, pinned `--api-scope`, and pinned `--api-version` where available.

## When the Admin Portal is better

- **One-off operations** - manually creating one IAM client, editing one Store item.
- **Visual debugging** - when you want to see relationships (player to entitlements to orders) at a glance.
- **Live event streams or dashboards** - when the desired signal is not exposed by the current `ags` command surface.
- **Unfamiliar territory** - the Admin Portal has UI that disambiguates options the CLI lists as flags.

## When the AGS API MCP server is preferred

If the AGS API MCP server is configured for the target environment, it runs the same discover-then-execute flow as the CLI — against the same live AGS API — without a local CLI install:

- `search-apis` / `describe-apis` to find an operation and its parameters, request/response shapes, and auth requirements (the MCP equivalent of `ags describe`).
- `run-apis` to execute it. Write operations (`POST` / `PUT` / `PATCH` / `DELETE`) prompt for consent before running, so the "confirm mutations" rule above still holds.

Apply the shared `accelbyte` policy before choosing a path. Prefer MCP for remote operations that both tools support; use CLI for local diagnostics, scripted/product-lifecycle work, or when MCP is unavailable or lacks the required capability. The IAM admin client and permission endpoints (`/iam/v3/admin/namespaces/{namespace}/clients/...`) are reachable through MCP, so permission discovery *and* permission configuration can use it. Set its URL with `/ags install-mcp`.

After selecting a path, stop on authentication or authorization failures, missing consent, or required confirmation. Do not switch tools to bypass the gate. The rules of engagement above still apply: discover before executing, and confirm every mutation.

## When Extend's CLI is the right answer instead

If the user is asking about deploying / observing / debugging an Extend app - that's `extend-helper-cli`, not the AGS CLI. Route to `/ags-extend install-cli` or `/ags-extend observe`.

## Where to look

- AGS CLI releases: `https://github.com/AccelByte/accelbyte-ags-cli/releases/latest`
- For Extend operational CLI work: `/ags-extend install-cli` and `/ags-extend observe`.
