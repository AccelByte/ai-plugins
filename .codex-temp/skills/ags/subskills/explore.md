---
name: ags-explore
description: 'Read-only walkthrough of an existing AGS namespace: which modules are
  enabled, which IAM clients exist, which environments are configured, what''s already
  wired. Use when the user wants to take stock of an existing setup before changing
  anything.'
allowed-tools: Read Glob Bash
model: sonnet
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[overview.md](../references/overview.md)'
- '[glossary.md](../references/glossary.md)'
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[connect-portal.md](connect-portal.md)'
---

# AGS Namespace Explorer

Read-only inspection of an existing AGS setup. Surfaces which modules are turned on, which IAM clients exist, which environments are wired, and which platform identity providers are configured — so the user can plan changes from a known starting point rather than guessing.

This subskill **never modifies anything.** No portal changes, no IAM client creation, no namespace edits. If the user wants to make changes, hand off to `/ags connect-portal` (for IAM / namespace work), `/ags integrate` (for SDK / module wiring), or the relevant peer skill.

## Behavior Constraints

<grounding_rules>

Walk the user through their *actual* setup, grounded in:

- Files on disk that describe the integration (`.env`, SDK config files, Admin Portal export files if available).
- Output of read-only AGS CLI queries (when the CLI is installed and authenticated).
- The user's stated context.

Don't fabricate findings. If something can't be inspected (e.g. CLI not installed, no `.env` file), say so and offer the alternative — usually "look in the Admin Portal".

</grounding_rules>

<tool_usage_rules>

- Use `Read` and `Glob` to find AGS-related config files in the project (`.env`, `accelbyte.config.*`, SDK plugin folders, etc.).
- Use `Bash` for read-only commands only - `ags auth status`, `ags doctor`, `ags describe`, and generated list/get/show commands. **Never** use it for `create`, `delete`, `update`, or any state-changing operation.
- Follow `references/observe/cli-commands.md#rules-of-engagement-for-llms` when discovering generated AGS CLI commands: use `ags describe` first and prefer `--format json` for command output.
- Don't read references unless the user asks a conceptual question mid-walkthrough.
- Don't read other subskills.

</tool_usage_rules>

<action_safety>

This subskill is read-only by contract. If the user asks for a change mid-walkthrough:

1. Stop the walkthrough.
2. Tell the user which subskill owns the change (`/ags connect-portal` for IAM, `/ags integrate` for SDK wiring, peer skills for their own surfaces).
3. Don't make the change here even if it's small.

</action_safety>

<output_contract>

End with a single summary block:

```
Namespace setup found:

  Environments:        <list>
  Default namespace:   <name>
  IAM clients:         <count> public, <count> confidential
  Platform IdPs:       <list>
  Modules in use:      <list> (inferred from SDK config / IAM scopes / observed traffic)
  CLI installed:       yes / no
  MCP wired:           yes / no

Notable gaps / observations:
  • <bullet>
  • <bullet>

Next-step pointers:
  • <subskill or peer skill>
```

If the user explicitly wants more detail on one of the items, dive in there. Otherwise the summary block is the deliverable.

</output_contract>

<completeness_contract>

The walkthrough is complete when:

- Environments and namespaces are identified (or noted as "couldn't determine").
- IAM client count and types are listed (or noted as "couldn't query").
- The modules in use are inferred and listed (best-effort inference from SDK config / IAM scopes).
- Notable gaps (missing config, unsupported scopes for a feature the user mentions, dev-token-against-prod situations) are surfaced.
- Pointers are given for next steps.

A walkthrough that couldn't inspect everything still completes — just say "couldn't determine" for items that aren't visible.

</completeness_contract>

## Workflow

1. **Find AGS config on disk.** Look for `.env`, `accelbyte.config.*`, SDK plugin folders, build configs that reference `accelbyte` URLs. List what's found.
2. **Identify environments and namespaces** from those configs. Distinguish dev / staging / prod where possible.
3. **If the AGS CLI is installed and authenticated:** run read-only queries:
   - `ags auth status` and `ags doctor`.
   - `ags describe <service> <resource> <method>` before generated service commands.
   - `ags iam clients list --namespace <name>` for each namespace if the current specs expose that command.
   - `ags session game-sessions list --namespace <name>` if the user is interested in active session count and the current specs expose that command.
   - Check which platform IdPs are configured.
4. **If the CLI isn't installed:** point at `/ags install-cli` and continue with what's visible from disk.
5. **Infer modules in use** from:
   - The SDK plugin / package set imported (e.g. `IAccelByteUe4Sdk*`, npm imports).
   - IAM client scopes (which AGS APIs the IAM client can access).
   - Observed code paths (matchmaking calls, lobby calls, store calls).
6. **Surface notable gaps** — common patterns:
   - Dev token configured against prod URL or vice versa.
   - Public IAM client used in a server build (or vice versa).
   - Missing platform IdP for a target the user said they're shipping on.
   - SDK version pinned far behind current.
7. **Print the summary block** per `output_contract`.
8. **Offer next-step pointers** based on the gaps, e.g. "the dev/prod URL mismatch belongs in `/ags connect-portal`."

## Examples

### Happy path (full info)

```
User: /ags explore — what's set up here?

Skill: [reads .env, accelbyte.config.json, runs ags auth status and a read-only IAM query]

       Namespace setup found:

         Environments:        dev, staging, prod
         Default namespace:   "myteam-dev"
         IAM clients:         2 public, 1 confidential
         Platform IdPs:       Steam, Apple, Google
         Modules in use:      IAM, Lobby, Matchmaking, Sessions, Store
         CLI installed:       yes
         MCP wired:           no

       Notable gaps:
         • PSN IdP is not configured but the README mentions PS5 launch.
         • SDK version pinned to 18.x; current release is 22.x.

       Next-step pointers:
         • PSN IdP setup: /ags connect-portal
         • SDK upgrade: /ags install-sdk (will detect the upgrade path)
         • Customize MCP URL (optional, only if not on Public Cloud default): /ags install-mcp
```

### Limited info (CLI not installed)

```
User: /ags explore

Skill: [reads .env]

       Namespace setup found:

         Environments:        dev (URL points at the dev cluster)
         Default namespace:   "myteam-dev"
         IAM clients:         couldn't query — AGS CLI not installed
         Platform IdPs:       couldn't query — AGS CLI not installed
         Modules in use:      IAM, Lobby (inferred from imports in pkg/)
         CLI installed:       no
         MCP wired:           no

       Notable gaps:
         • No staging or prod environment configured.
         • AGS CLI not installed — can't verify IAM client setup.

       Next-step pointers:
         • Install the CLI: /ags install-cli (then re-run /ags explore for
           the full picture).
         • Set up staging / prod environments: /ags connect-portal.
```

## Error handling

- **No AGS config found on disk** — say so. Ask the user whether they've started integrating yet; if not, route to `/ags wizard`.
- **CLI installed but not authenticated** — surface the auth step (`ags auth login`) but don't run it for the user (it's interactive).
- **Conflicting config files** (e.g. two `.env` files with different namespaces) — list both and note the conflict.
- **User asks for a change mid-walkthrough** — see `action_safety`. Stop, route to the right subskill.
