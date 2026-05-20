---
last-verified: 2026-05-09
see-also:
- '[install-cli.md](../../subskills/install-cli.md)'
- '[observe.md](../../subskills/observe.md)'
---

# Observe - CLI Commands

Operational commands via the **AGS CLI** (`ags`) for namespace, IAM, auth, profile, diagnostics, and generated AGS API queries.

> **Note on CLI families.** AGS uses `ags` for namespace / IAM / operational API work. Extend uses a different CLI (`extend-helper-cli`) - those commands are owned by `/ags-extend`, not `/ags`. This file covers the AGS CLI only.

> **Verify before relying.** The AGS CLI generates service commands from bundled OpenAPI specs. Use `ags describe`, `ags <service> --help`, and `ags <service> <resource> --help` to discover the exact command shape before running it.

---

## Rules of Engagement for LLMs

When operating the AGS CLI on a user's behalf:

1. Treat `ags describe` as the source of truth for generated service commands. Run it before using unfamiliar service/resource/method commands.
2. Use `--skeleton` where available to discover request body schemas before writing JSON. Do not invent model fields from memory or examples for another resource.
3. Use `--dry-run` where available before mutating operations so the user can inspect the resolved command/body.
4. Use `--format json` for automation and evidence gathering. Do not parse human-readable output when JSON output is available.
5. Treat create, update, delete, kick, ban, grant, revoke, and similar operations as mutations. Show the discovered command/body and get explicit user confirmation before running them. (LLM safety layer — not in the CLI's source documentation; complements the four source-documented rules above.)
6. Do not hardcode guessed service, resource, method, flag, `--api-scope`, or `--api-version` values. Discover them from `ags describe` or CLI help, then report when the current CLI does not expose the needed operation.

## What you can do via the CLI

- **Authenticate and inspect auth state** with `ags auth login`, `ags auth status`, and `ags auth logout`.
- **Manage profiles and config** with `ags profile ...` and `ags config ...`.
- **Run local diagnostics** with `ags doctor`.
- **List IAM clients, users, sessions, matchmaking objects, and other AGS resources** when the generated service command exposes that operation and the authenticated client has permission.
- **Inspect command metadata** with `ags describe` instead of parsing human-readable help.
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
```

The actual command surface depends on the bundled OpenAPI specs. Run `ags --help` for top-level commands and `ags describe` for machine-readable discovery. Automation must use `--format json`; do not parse human-readable output. For LLM/agent usage, follow the rules above before relying on a generated command.

## When the CLI is the right answer

- **Scripted ops** - you want to query, ingest, or trigger from a shell script or CI pipeline.
- **Bulk operations** - you have many resources to inspect or provision; the Admin Portal would be tedious.
- **Operational automation** - using `--format json`, `--dry-run`, pinned `--api-scope`, and pinned `--api-version` where available.

## When the Admin Portal is better

- **One-off operations** - manually creating one IAM client, editing one Store item.
- **Visual debugging** - when you want to see relationships (player to entitlements to orders) at a glance.
- **Live event streams or dashboards** - when the desired signal is not exposed by the current `ags` command surface.
- **Unfamiliar territory** - the Admin Portal has UI that disambiguates options the CLI lists as flags.

## When Extend's CLI is the right answer instead

If the user is asking about deploying / observing / debugging an Extend app - that's `extend-helper-cli`, not the AGS CLI. Route to `/ags-extend install-cli` or `/ags-extend observe`.

## Where to look

- AGS CLI releases: `https://github.com/AccelByte/accelbyte-ags-cli/releases/latest`
- For Extend operational CLI work: `/ags-extend install-cli` and `/ags-extend observe`.
