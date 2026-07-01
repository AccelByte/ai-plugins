---
name: ags-manage-resource
description: Create, update, or delete a single AGS backend resource via the generated
  AGS CLI service commands (e.g. ags social stats create, ags leaderboard configs
  create, ags platform items create) — not a registered multi-step workflow, not an
  IAM/OAuth permission change, and not namespace/IAM-client/login onboarding. Discovers
  the exact command/body live, auto-fills what's known, and hands off to ui-execution.md
  for the fill-and-run step.
allowed-tools: Read Bash PowerShell Glob AskUserQuestion
model: sonnet
last-verified: 2026-06-29
see-also:
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[ui-execution.md](../references/cli/ui-execution.md)'
- '[run-workflow.md](run-workflow.md)'
- '[manage-permissions.md](manage-permissions.md)'
- '[connect-portal.md](connect-portal.md)'
- '[install-cli.md](install-cli.md)'
---

# AGS Backend Resource Management

Create, update, or delete a **single** AGS backend resource via a generated `ags <service> <resource> <method>` CLI command — a stat configuration, a leaderboard config, a store item, and similar standalone admin/ops mutations. This is distinct from three other subskills that look similar but aren't:

- `run-workflow.md` — a *registered, multi-step* CLI workflow (`ags workflow run <id>`) that orchestrates several resources as one scaffold. If the request matches a registered workflow id, that's the right subskill, not this one.
- `manage-permissions.md` — IAM/OAuth client *permission* changes specifically. If the resource in question is a permission, scope, or role on an existing client, that's the right subskill.
- `connect-portal.md` — namespace/IAM-client/login-method *onboarding* for a new project. If the resource is the namespace, the IAM client, or a login method as part of bootstrapping a project, that's the right subskill.

This subskill is for everything else shaped like "create/update/delete a `<resource>`" — a single, standalone AGS backend object — where the intent is admin/ops backend configuration, not player-facing game-code wiring (that's `workflows/online-game-flow.md` / `subskills/integrate.md`).

## Behavior Constraints

<grounding_rules>

Follow `references/observe/cli-commands.md`'s rules of engagement for LLMs — `ags describe`, `--skeleton`, `--dry-run`, `--format json`, confirm mutations, never hardcode guessed service/resource/method/flag/body values — don't restate them here. Discover the exact `<service> <resource> <method>` triple and its body/flag contract live; never guess a command name from a similar-sounding resource or another AGS version.

</grounding_rules>

<tool_usage_rules>

- `Bash` for discovery (`ags describe`, `ags <service> --help`, `--skeleton`, `--dry-run`) and the read-back verification (`list`/`get`).
- PowerShell tool and `AskUserQuestion` strictly via `references/cli/ui-execution.md` for the execution choice — don't reinvent the fullscreen/plain mechanic here. `AskUserQuestion` is also used for an ambiguous `<service>`/`<resource>` match (Step 2).
- `Glob` only if the target namespace must come from a game project's runtime config on disk.
- `Read` for `references/observe/cli-commands.md`, `references/cli/ui-execution.md`, and (when redirecting) the subskill being handed off to.
- No `Write`/`Edit` — this subskill mutates AGS-side state only, never project files.

</tool_usage_rules>

<dependency_checks>

Before mutating anything, confirm:

1. The AGS CLI is installed and authenticated (`ags --version`, `ags auth status --format json`). If not, route to `/ags install-cli` and stop.
2. The target namespace is known — from project runtime config for game projects, or explicit user input for pure ops contexts. If project config and CLI profile disagree, stop and ask.
3. The exact `<service> <resource> <method>` triple is confirmed to exist via live `ags describe`/`--help` output, not guessed from the user's phrasing.

</dependency_checks>

<action_safety>

Treat create, update, and delete as mutations on live AGS-side state:

- **Don't steal scope from a more specific subskill.** If discovery reveals the request actually matches a registered workflow, an IAM permission change, or namespace/IAM-client/login onboarding, stop and hand off to `run-workflow.md`, `manage-permissions.md`, or `connect-portal.md` respectively instead of proceeding here.
- **The execution-mode choice.** Follow `references/cli/ui-execution.md` for the fullscreen-vs-plain choice and execution — never pick silently between them.
- **Production gate.** If the target namespace looks like production, confirm that intent explicitly before running.
- **Least fields.** Don't invent body fields or flag values beyond what's auto-filled, defaulted, or explicitly stated by the user.
- **Deletes need an extra explicit confirmation** naming exactly what's being removed and, where discoverable, what depends on it — mirrors `manage-permissions.md`'s delete handling.
- **Updates: read before you write when possible.** Best-effort discover a `get` command for the resource and show a before/after diff when one exists. If no single-item read path exists for this resource type, proceed without a diff rather than blocking on it.

</action_safety>

<output_contract>

End with a result block:

```text
AGS resource mutation

  Service/resource/method: <service> <resource> <method>
  Namespace:                <namespace>
  Fields:                   <auto-filled/defaulted field list>
  Input mode:               <--ui fullscreen (chosen) | --ui plain (chosen)>
  Executed:                 <yes | no — awaiting confirmation | no — blocked>
  Verified:                 <yes — re-read via list/get | no read-back path for this resource | no — blocked>
  Next step:                <none | redirect to another subskill>
```

</output_contract>

<completeness_contract>

A resource mutation is complete when:

1. CLI install/auth and namespace source are confirmed.
2. The `<service> <resource> <method>` triple is confirmed against live `ags describe`/`--help` output, and confirmed to not actually belong to `run-workflow`, `manage-permissions`, or `connect-portal`.
3. The body/flag contract is confirmed against live `--skeleton`/`--help` output. Each field is either auto-filled (single discoverable value or user-stated) or defaulted (CLI's own documented default) — none invented. Anything else is left for `ui-execution.md` to resolve.
4. The resolved (possibly partial) command was shown, and the fullscreen-vs-plain choice from `ui-execution.md` was offered and acted on.
5. A read-back verification was attempted (or explicitly reported as unavailable for this resource type).
6. The result block is printed.

</completeness_contract>

## Workflow

### Step 1: Confirm preconditions

Run `dependency_checks`. If the CLI isn't installed or authenticated, route to `/ags install-cli` and stop.

### Step 2: Resolve the exact service/resource/method triple

Parse the user's resource noun and verb (e.g. "create a statistic configuration" implies a create method on a stats/configs-shaped resource) against live `ags describe <service>` / `ags <service> --help` / `ags <service> <resource> --help` output — never guessed from memory or a similar-sounding resource in another context.

If more than one service or resource plausibly matches, use `AskUserQuestion` with the live candidates as options rather than guessing or asking an open-ended question.

If discovery reveals the request actually matches a registered workflow id, an IAM/OAuth permission change, or namespace/IAM-client/login-method onboarding, stop here and hand off to `run-workflow.md`, `manage-permissions.md`, or `connect-portal.md` respectively — don't proceed with a narrower single-resource mutation when one of those is the better fit.

### Step 3: Discover the body/flag contract

Run `ags describe <service> <resource> <method>` and `--skeleton` for the exact request body shape; `--help` for flags. This is the sole source of truth — not memory of a similarly-shaped resource.

### Step 4: Gather field values — auto-fill and default only

Sort each field into exactly one bucket — don't pre-guess which remaining fields are "genuine judgment calls"; `references/cli/ui-execution.md`'s plain path discovers what's actually required from the CLI's own error, not from guessing here:

1. **Auto-fill, no question asked.** Fields with exactly one valid value discoverable from the CLI or namespace state, or already explicitly stated by the user in their request. State what was picked and why; don't ask.
2. **Use the CLI's own default, no question asked.** Optional fields with a documented default in `--help`/`--skeleton`, unless the user already stated a preference.

Anything not covered by those two buckets is left off the command/body entirely.

### Step 5: Show the resolved (partial) command

Build the partial command/body from Step 4 and show it for visibility. Don't enumerate what's still missing — that's `ui-execution.md`'s job next.

### Step 6: Choose and execute

Hand off to `references/cli/ui-execution.md` verbatim: it owns the always-on fullscreen-vs-plain `AskUserQuestion`, the spawn-and-wait fullscreen path, and the attempt-with-dry-run-then-parse-error plain path. Pass it the resolved/partial command from Step 5. Don't reinvent any part of this mechanic here.

### Step 7: Verify via read-back

Discover the corresponding `list`/`get` command via `ags describe <service> <resource>` and run it to confirm the resource now exists, was updated, or was removed with the expected values. For update/delete, prefer a before/after comparison using the `get` discovered in `action_safety`'s "read before you write" rule, when one exists.

If this resource type exposes no read-back path at all, say so explicitly in the result block rather than assuming success.

### Step 8: Print the result block

Per `output_contract`.

## Examples

### Create a statistic configuration

```
User: /ags create a new statistic configuration for player kills.

Skill: OK ags describe social --format json -> stats service confirmed
       OK ags social stat-configs --help -> create method confirmed
       OK ags social stat-configs create --skeleton -> body shape confirmed

       Auto-filled (no question needed):
         --namespace myteam-dev (from auth profile)
         statCode: player-kills (from your request)
       Using CLI defaults: defaultValue=0, setBy=SERVER

       Resolved command so far:
         ags social stat-configs create --namespace myteam-dev \
           --json '{"statCode":"player-kills","defaultValue":0,"setBy":"SERVER"}'

       [AskUserQuestion: "How should I run this?"
         Option A: "Fullscreen (separate window)" — opens the CLI's fullscreen
                    TUI in a new window to review and fill in the rest.
         Option B: "Plain (run here)" — I'll figure out what's still needed
                    and ask for it in chat, then run directly.]

User selects: Plain (run here)

Skill: [follows references/cli/ui-execution.md's plain path: attempts
        --dry-run with no explicit --ui; it succeeds outright, nothing was
        missing]

       That went through — running it for real:
         ags social stat-configs create --namespace myteam-dev --ui plain \
           --json '{"statCode":"player-kills","defaultValue":0,"setBy":"SERVER"}'

       ✓ Created. Verifying with a read-back —
         ags social stat-configs get --namespace myteam-dev --stat-code player-kills

       AGS resource mutation

         Service/resource/method: social stat-configs create
         Namespace:                myteam-dev
         Fields:                   statCode=player-kills defaultValue=0 setBy=SERVER
         Input mode:                --ui plain (chosen)
         Executed:                  yes
         Verified:                  yes — re-read via get
         Next step:                 none
```

### Ambiguous between this subskill and a registered workflow

```
User: /ags set up leaderboard

Skill: A few things could match "set up leaderboard":
       1. Create one leaderboard configuration as a standalone backend
          resource — this subskill.
       2. Run a registered AGS CLI workflow that scaffolds a leaderboard as
          part of a larger setup, if one exists for your installed CLI
          version — /ags run-workflow.
       3. Wire a leaderboard widget/feature into your game's code — /ags
          integrate.

       Which one do you want?
```

## Error handling

- **`<service> <resource> <method>` not found in `ags describe`** — report what was searched, ask the user to clarify the exact resource/operation. Don't guess a near-miss command name.
- **Request actually matches `run-workflow`** — a registered workflow id wraps this resource as part of a multi-resource scaffold. Redirect there instead of doing a narrower single-resource mutation.
- **Request actually matches `manage-permissions`** — the resource is an IAM permission/scope on an existing client. Redirect.
- **Request actually matches `connect-portal`** — the resource is a namespace, IAM client, or login method as part of onboarding. Redirect.
- **No read-back path exists for this resource type** — report the mutation's own result and explicitly note that no read-back verification was possible; don't assume success silently.
- **Anything related to the fullscreen/plain choice itself** (spawn failures, garbled output, the command requiring every field upfront, the user asking to "just run it manually") — see `references/cli/ui-execution.md`'s Error handling; that mechanic lives there, not here.
