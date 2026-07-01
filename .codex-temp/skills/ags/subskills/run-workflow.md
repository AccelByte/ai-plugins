---
name: ags-run-workflow
description: Execute a registered AGS CLI workflow (e.g. competitive-multiplayer)
  via `ags workflow run`, always using the fullscreen TUI input mode (--ui fullscreen).
  This is a thin CLI-execution wrapper, distinct from /ags matchmaking plan, which
  produces a player-facing game-integration plan rather than running CLI scaffolding.
allowed-tools: Read Bash PowerShell Glob AskUserQuestion
model: sonnet
last-verified: 2026-06-26
see-also:
- '[workflows.md](../references/cli/workflows.md)'
- '[ui-execution.md](../references/cli/ui-execution.md)'
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[matchmaking plan.md](../capabilities/matchmaking/plan.md)'
- '[install-cli.md](install-cli.md)'
---

# AGS CLI Workflow Execution

Run a registered AGS CLI multi-step workflow (currently `competitive-multiplayer`) via the standalone `ags workflow run <id>` command. This subskill only operates the CLI's workflow scaffolding — it does not plan or write game-integration code. For a full player-facing matchmaking integration plan (game code, session join, travel/connect behavior), route to `capabilities/matchmaking/plan.md` instead; that subskill is for planning a feature end to end, this one is for executing an existing registered CLI workflow.

This subskill is workflow-agnostic: it handles whatever ids `ags workflow list` returns, discovering each one's flags fresh from `--help` rather than hardcoding a specific workflow. `competitive-multiplayer` is currently the only registered workflow, so it's the only concrete example in this file — nothing below should be read as a special case beyond what is genuinely true only for it (mainly its `--resource-prefix` flag and the resources it provisions).

## Behavior Constraints

<grounding_rules>

Discover the workflow id and its exact flag contract live — `ags workflow list --format json` and `ags workflow run <id> --help` — before drafting a command. Use `references/cli/workflows.md` only as a starting hint for whichever workflow is selected (today, only `competitive-multiplayer` is documented there); do not hardcode flags from memory if the installed CLI's `--help` disagrees. For a workflow with no written reference, `ags workflow run <id> --help` is the sole source of truth. Follow the safety rules in `references/cli/workflows.md`: treat workflow execution as mutating unless the current CLI proves otherwise with a dry-run, never assume a production namespace without explicit confirmation, and never use `ags describe workflow` (it is not a generated service command).

</grounding_rules>

<tool_usage_rules>

- `Bash` for `ags workflow list`, `ags workflow run <id> --help`, `ags auth status`, `ags --dry-run workflow run ...` (discovery and dry-run).
- PowerShell tool and `AskUserQuestion` for the fullscreen-vs-plain execution choice and the actual run — follow `references/cli/ui-execution.md` for that whole mechanic (the question, the spawn-and-wait path, the inline plain path) rather than reinventing it here. `AskUserQuestion` is also used for an ambiguous workflow id (Step 2) and the resource-naming collision options (`action_safety`).
- `Read` for `references/cli/workflows.md`, `references/cli/ui-execution.md`, and `references/observe/cli-commands.md`.
- `Glob` to locate project runtime config when the namespace must come from a game project on disk.
- Don't read other subskills except `capabilities/matchmaking/plan.md`, and only when redirecting a request that actually wants full integration planning.

</tool_usage_rules>

<dependency_checks>

Before running a workflow, confirm:

1. The AGS CLI is installed and authenticated (`ags --version`, `ags auth status --format json`). If not, route to `/ags install-cli`.
2. The target namespace is known — from project runtime config for game projects (Unreal `Config/DefaultEngine.ini`, Unity SDK config asset/json, Web/custom `.env`), or explicit user input for pure ops contexts. If project config and CLI profile disagree, stop and ask.
3. The workflow id is confirmed against the live `ags workflow list --format json` output, not assumed from this skill's docs. Workflow registration can change across CLI versions.

</dependency_checks>

<action_safety>

`ags workflow run` provisions backend resources that depend on the workflow (e.g. ruleset, session template, match pool, fleet, claim key for `competitive-multiplayer`) — discover what a different workflow creates from its `--help` description before running; don't assume this list applies. Treat every workflow run as a mutation:

- **The execution-mode choice.** Follow `references/cli/ui-execution.md` for the fullscreen-vs-plain choice and execution — never pick silently between them, and never substitute `--format json` or `--ui inline` for either path. `--format json` is still fine, and preferred, for the discovery calls (`ags workflow list --format json`).
- **Production gate.** If the target namespace looks like production, confirm that intent explicitly before running.
- **Dry-run first, on the plain path.** When the installed CLI supports `--dry-run`, `ui-execution.md`'s plain path already attempts the partial command with `--dry-run` to discover what's missing — that attempt doubles as the dry-run-first safety check, so its output (expected resources, or the parsed missing-input list) is what gets shown before the real run. The fullscreen path doesn't get a pre-attempted dry-run this way (the TUI handles everything once the window opens); if a dry-run preview matters for a fullscreen run, that's it as a future enhancement and not something to fake by attempting an inline dry-run yourself.
- **Resource-naming collisions (conditional).** If the selected workflow exposes a resource-naming flag (`--resource-prefix` for `competitive-multiplayer`; discover the actual flag name from `--help` for any other workflow), confirm the resulting resource names don't collide with existing resources of the types that workflow creates, before running. If the workflow has no such flag, skip this check rather than inventing one. If a collision is found, use `AskUserQuestion` with options "Use a different prefix", "Overwrite the existing resources", and "Cancel" — don't present this as a numbered free-text list.

</action_safety>

<output_contract>

End with a result block:

```text
AGS CLI workflow run

  Workflow id:   <id>
  Namespace:     <namespace>
  Flags:         <auto-filled/defaulted flag list>
  Discovered missing: <values the CLI's own error named as required, filled in via chat on the plain path — or none, if nothing was missing>
  Input mode:    <--ui fullscreen (chosen) | --ui plain (chosen)>
  Dry-run shown: <yes | no | not supported by installed CLI>
  Window:        <opened in a separate console — waiting for it to close | n/a — ran inline (plain mode) | no — blocked>
  Executed:      <yes | no — awaiting confirmation | no — blocked>
  Next step:     see references/cli/workflows.md "Post-run verification"
```

</output_contract>

<completeness_contract>

A workflow run is complete when:

1. CLI install/auth and namespace source are confirmed.
2. The workflow id is confirmed against live `ags workflow list` output.
3. The flag contract is confirmed against live `ags workflow run <id> --help` output. Each flag is either auto-filled (single discoverable value) or defaulted (CLI's own documented default) — none invented, and none demanded from the user in chat unless `dependency_checks` or a safety check (e.g. resource-prefix collision) requires it. Anything not covered by those two buckets is left for `ui-execution.md` to resolve (fullscreen TUI prompts directly; plain path discovers it from the CLI's own error).
4. The resolved (possibly partial) command was shown, and the fullscreen-vs-plain choice from `ui-execution.md` was offered and acted on — every time, not only when something was missing.
5. The result block is printed, and the user is pointed at post-run verification.

</completeness_contract>

## Workflow

### Step 1: Confirm preconditions

Run `dependency_checks`. If the CLI isn't installed or authenticated, route to `/ags install-cli` and stop.

### Step 2: Discover the workflow id

Run `ags workflow list --format json`. Match the user's request (e.g. "matchmaking workflow", "competitive multiplayer workflow") to a registered id. If no clear match exists, use `AskUserQuestion` with one option per registered workflow id (plus its description) instead of listing them as free text — proceed straight to Step 3 with whichever id is selected.

### Step 3: Discover the flag contract

Run `ags workflow run <id> --help`. Use this — not memory or this skill's docs alone — as the source of truth for required and optional flags in the user's installed CLI version.

### Step 4: Gather flag values — auto-fill and default first, defer the rest to the TUI

Sort each flag into exactly one bucket — don't try to pre-guess which remaining flags are "genuine judgment calls" needing the user's input; `references/cli/ui-execution.md`'s plain path now discovers that from the CLI's own error rather than this subskill guessing in advance:

1. **Auto-fill, no question asked.** Flags with exactly one valid value discoverable from the CLI or namespace state: `--namespace` from project runtime config/auth profile (per `dependency_checks`), `--fleet-image-id` when only one image exists, `--stat-code` when only one stat definition exists, and similar single-option lookups. State what was picked and why; don't ask.
2. **Use the CLI's own default, no question asked.** Optional flags with a documented default in `--help` (e.g. `--team-count` defaulting to 2, `--resource-prefix` defaulting to something like `ranked`), unless the user already stated a preference. Still resolve the *effective* value from `--help` — silently, without asking — because the resource-prefix collision check in `action_safety` needs it before launch.

Any flag not covered by buckets 1-2 is simply left off the partial command built in Step 5 — not because it's been judged an "open choice," but because `ui-execution.md` will either let the fullscreen TUI prompt for it directly, or discover it's actually required via a real attempt-and-parse-the-error pass on the plain path.

Only fall back to asking in chat when a value is needed *before* launch for a safety check that can't be deferred (e.g. the user explicitly wants to override a default, or a resource-naming collision was found and a different value is needed). Don't invent values in any bucket.

These two buckets are driven by each flag's shape in the current workflow's `--help` output (single discoverable value vs. documented default), so they apply the same way to any workflow id. The example flag names above (`--fleet-image-id`, `--stat-code`, `--team-count`, `--resource-prefix`) are illustrative of `competitive-multiplayer` specifically — a different workflow will have a different, `--help`-discovered flag set, not this one.

### Step 5: Show the resolved (partial) command

Build the partial command using only the auto-filled and defaulted flags from Step 4 — leave any flag not covered by those two buckets off entirely, including `--ui` itself (the execution mode is chosen in Step 6, not here):

```sh
ags workflow run <id> --<auto-filled-or-defaulted-flag> <value> ...
```

Show this to the user. Don't enumerate which flags are still open — that list is no longer pre-known; `ui-execution.md`'s plain path discovers it from the CLI itself if and when it's needed. If the installed CLI supports `--dry-run` for `workflow run`, that's exactly what `ui-execution.md`'s plain path will attempt first; this step is just about presenting the partial command for the upcoming choice.

### Step 6: Choose and execute

Hand off to `references/cli/ui-execution.md`: it owns the `AskUserQuestion` fullscreen-vs-plain choice (always asked, even if Step 4 happened to cover every flag) and both execution paths — spawn-and-wait for fullscreen, and for plain, attempting the partial command first and parsing the CLI's own error to discover exactly what's still needed before asking in chat. Pass it the resolved/partial command from Step 5. Once it reports back (window closed, or inline run completed), move to Step 7 — don't assume success either way; Step 7's verification is what confirms the outcome.

### Step 7: Point to post-run verification

Direct the user to the "Post-run verification" section of `references/cli/workflows.md` to confirm the created backend resources, and to the relevant full game-integration-planning subskill for that feature, if one exists (e.g. `capabilities/matchmaking/plan.md` for `competitive-multiplayer`'s ticket submission, match-found handling, session join, and travel/connect work) — not every future workflow will have one.

## Examples

### Running the competitive-multiplayer workflow

```
User: /ags configure matchmaking workflow on AGS — set up competitive multiplayer for myteam-dev.

Skill: OK ags auth status --format json
       OK ags workflow list --format json -> found "competitive-multiplayer"
       OK ags workflow run competitive-multiplayer --help -> confirmed flags

       Auto-filled (no question needed):
         --namespace myteam-dev (from auth profile)
         --fleet-image-id <uuid> (only image in this namespace: bytewars-server-1.9.6)
         --stat-code mmr (only stat definition in this namespace)
       Using CLI defaults: --team-count 2, --resource-prefix ranked
       (checked: no existing resources named ranked-* — no collision)

       Resolved command so far (players per team, fleet region, and fleet
       instance type aren't covered by auto-fill/defaults — I don't know yet
       whether they're actually required, so they're just left off):
         ags workflow run competitive-multiplayer \
           --namespace myteam-dev --fleet-image-id <uuid> --stat-code mmr \
           --resource-prefix ranked

       [AskUserQuestion: "How should I run this?"
         Option A: "Fullscreen (separate window)" — opens the CLI's fullscreen
                    TUI in a new window to review and fill in the rest; I
                    resume automatically once it closes.
         Option B: "Plain (run here)" — I'll figure out what's still needed
                    and ask for it in chat, then run the fully-flagged command
                    directly.]

User selects: Fullscreen (separate window)

Skill: Opening a new console window for the real run with --ui fullscreen —
       review and complete the prompts there. I'll resume automatically once
       that window closes.

       [follows references/cli/ui-execution.md's fullscreen path: spawns a
        powershell window via Start-Process, captures PID, issues a
        backgrounded Wait-Process on it]

       ... [window closes; background wait notifies] ...

       That window closed — let me verify what got created.

       AGS CLI workflow run

         Workflow id:         competitive-multiplayer
         Namespace:           myteam-dev
         Flags:               fleet-image-id=<uuid> stat-code=mmr resource-prefix=ranked
         Discovered missing:  n/a — fullscreen TUI handled the rest directly
         Input mode:          --ui fullscreen (chosen)
         Dry-run shown:       no — fullscreen path doesn't pre-attempt a dry-run
         Window:              opened in a separate console — closed
         Executed:            yes
         Next step:           see references/cli/workflows.md "Post-run verification"
```

`references/cli/ui-execution.md` has the full set of examples for the choice itself (picking plain instead, the spawn-failure fallback, and the "CLI requires every flag upfront" retry) — they're not duplicated here since none of that mechanic is workflow-specific.

### Ambiguous between CLI scaffold and full integration plan

```
User: /ags configure matchmaking workflow on AGS

Skill: Two things could match "configure matchmaking workflow":
       1. Run the registered AGS CLI workflow (competitive-multiplayer) to
          scaffold backend resources — this subskill.
       2. Plan full player-facing matchmaking integration (game code, session
          join, travel/connect) — /ags matchmaking plan.

       Which one do you want?
```

## Error handling

- **Workflow id not found** — re-run `ags workflow list --format json`; report the current registered ids and ask the user to pick one. Don't assume `competitive-multiplayer` is still the only or correct id.
- **CLI not installed/authenticated** — route to `/ags install-cli`.
- **`--dry-run` incompatible with `--ui fullscreen`** — drop `--dry-run`, show the resolved command for approval without executing, and note the deviation.
- **Resource-naming collision** — surface the conflicting existing resource and ask for a different name/prefix before running.
- **Anything related to the fullscreen/plain choice itself** (spawn failures, garbled output, the command requiring every flag upfront, the user asking to "just run it manually") — see `references/cli/ui-execution.md`'s Error handling; that's where this mechanic lives now, not here.
- **User actually wants the full integration plan** — redirect to `capabilities/matchmaking/plan.md` per the ambiguous-intent example above.
