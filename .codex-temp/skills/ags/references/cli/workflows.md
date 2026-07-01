---
last-verified: 2026-06-25
see-also:
- '[Observe CLI commands](../observe/cli-commands.md)'
- '[Matchmaking planner](../../capabilities/matchmaking/plan.md)'
- '[Matchmaking overview](../../capabilities/matchmaking/references/overview.md)'
- '[AMS CLI commands](../../capabilities/ams/references/cli-commands.md)'
- '[run-workflow.md](../../subskills/run-workflow.md)'
- '[ui-execution.md](ui-execution.md)'
---

# AGS CLI Workflows

The AGS CLI includes a standalone `workflow` command for registered multi-step templates. Workflows are different from generated service commands: `ags describe workflow` does not describe them. Discover workflows with `ags workflow list` and concrete workflow input contracts with `ags workflow run <workflow-id> --help`.

Use this reference when a user asks about AGS CLI workflow templates, competitive multiplayer setup, or the "competitive matchmaking" setup path.

## Current observed workflow

As of local `ags 0.3.0` verification on 2026-06-25, the registered workflow is:

```text
competitive-multiplayer  Set up competitive multiplayer
```

If the user calls this "competitive matchmaking", verify the current id first:

```sh
ags workflow list --format json
ags workflow run competitive-multiplayer --help
```

Do not assume the id is stable across CLI versions.

## Command model

Observed command shape:

```sh
ags workflow list --format json
ags workflow run <workflow-id> [OPTIONS]
```

The concrete workflow declares its own flags. For `competitive-multiplayer`, the observed flags are:

| Flag | Purpose |
|---|---|
| `--namespace` | Target AGS game namespace. Same value as the global namespace override. |
| `--players-per-team` | Players on each team. With two teams, `4` creates a 4v4 setup. |
| `--team-count` | Number of teams. Defaults to 2; higher values support FFA-like layouts. |
| `--fleet-image-id` | AMS image UUID for the uploaded dedicated-server build. |
| `--fleet-region` | Region where the AMS fleet will run. |
| `--fleet-instance-id` | AMS instance type UUID. |
| `--stat-code` | Skill/MMR stat code used for distance-based matchmaking. |
| `--resource-prefix` | Prefix for created resources: ruleset, session template, match pool, fleet, and claim key. |

## Input modes

`--ui` is a **global** AGS CLI flag — confirmed in top-level `ags --help`'s Flags section, not something specific to `workflow run`. It's inherited by every standalone command and every `<service> <resource> <method>` combination, and doesn't appear in any individual command's own `--help` output (global flags aren't re-listed per-subcommand there).

| Mode | Flag | Behavior |
|---|---|---|
| Auto (default) | `--ui auto`, or omit `--ui` | Picks plain-equivalent rendering when stdout/stderr aren't a real terminal. |
| Plain | `--ui plain` | One input prompt per line. |
| Inline | `--ui inline` | Brief, in-place prompt screen. |
| Fullscreen | `--ui fullscreen` | Full interactive TUI screen. |
| Flags only | `--format json` | A separate flag from `--ui`, not one of its values. No prompting; every value must be passed as a flag. For automation/CI. |

Agent-driven runs of `ags workflow run` from this skill always pass `--ui fullscreen` for the fullscreen path — this is a fixed convention, not a fallback used only when some input is missing. Use it even when every flag value is already known and could otherwise be passed non-interactively. `--format json` stays the right choice for discovery calls (`ags workflow list --format json`) — it is not used for the `run` invocation itself.

### Non-interactive refusal (does not hang or garble)

When required input is missing and stdin/stderr aren't real terminals (the agent's sandboxed `Bash`/PowerShell tool environment), the CLI fails fast with a clear, parseable error — verified for default/`auto`, explicit `--ui plain`, and explicit `--ui fullscreen` alike — rather than hanging or rendering garbled output:

```text
✕ Cannot run this workflow non-interactively:
  workflow input '<name>' is required (first referenced by step '<step>')
    Reason: The run is non-interactive (--no-input, or stdin and stderr are not terminals).
→ Fix: Pass the missing inputs as --<name> flags (use --yes to skip confirmations), or run interactively with stdin and stderr attached to a terminal.
```

or, when `--ui fullscreen` is passed explicitly:

```text
✕ A rich terminal UI (--ui=fullscreen) cannot be shown
    Reason: Attempting to run interactively, but stdin and stderr are not terminals.
→ Fix: Omit --ui=fullscreen for plain human output, or use --format=json for scripting.
```

The named input(s) in this error are the authoritative "what's actually missing" list — see `references/cli/ui-execution.md`'s plain path for how that's used instead of guessing in advance. When every required flag is already supplied, the command runs cleanly inline regardless of `--ui` value, with no TTY needed.

## Safety rules

- Treat workflow execution as a mutating operation unless the current CLI proves otherwise with a dry-run.
- Do not run a workflow against production unless the user explicitly confirms the target namespace is production.
- Discover the exact workflow id and flags in the user's installed CLI before drafting or running a command.
- Prefer explicit flags over interactive prompts when operating for a user, especially in CI or non-interactive shells.
- Run dry-run first when supported by the current CLI, then show the resolved command and expected resources before the real run.
- Never use `ags describe workflow`; it is not a generated service command in the observed CLI.

## Competitive multiplayer preflight

Before proposing `ags workflow run competitive-multiplayer`, confirm:

1. The AGS CLI is installed and authenticated.
2. The target namespace comes from project runtime config or explicit user input.
3. An AMS image already exists for the dedicated-server build, or the user knows they must upload one before running the workflow.
4. The target AMS region and instance type are known from the user's AMS account.
5. The skill/MMR stat code exists or is part of the approved setup plan.
6. The resource prefix is safe and does not collide with existing rulesets, session templates, match pools, fleets, or claim keys.

Useful discovery commands:

```sh
ags auth status --format json
ags workflow list --format json
ags workflow run competitive-multiplayer --help
ags ams images list --namespace <namespace> --target-architecture linux-x86_64 --status READY
ags ams info list-regions --namespace <namespace>
ags ams info list-supported-instances --namespace <namespace>
```

Verify the AMS commands with `ags describe` before using them in automation.

## Dry-run and execution shape

Global flags appear before the standalone command:

```sh
ags --dry-run workflow run competitive-multiplayer --ui fullscreen \
  --namespace <namespace> \
  --players-per-team <players-per-team> \
  --team-count <team-count> \
  --fleet-image-id <fleet-image-id> \
  --fleet-region <fleet-region> \
  --fleet-instance-id <fleet-instance-id> \
  --stat-code <stat-code> \
  --resource-prefix <resource-prefix>
```

After the user approves the dry-run plan, run the same command without `--dry-run`.

`--ui fullscreen` is shown here without `--no-input`, since the two may be mutually exclusive — `--no-input` exists to suppress prompting, while `--ui fullscreen` is itself an interactive prompting mode. Confirm the exact compatibility in the installed CLI's `--help` before combining them; if they conflict, drop `--no-input` and rely on explicit flags plus `--ui fullscreen`.

## Post-run verification

Running a workflow is not enough to call a game feature complete. Verify the created backend resources and then continue through the player-facing integration flow.

For competitive multiplayer, discover exact list/get commands with `ags describe`, then verify:

- Matchmaking ruleset exists.
- Session template exists and points at the expected DS/claim behavior.
- Match pool exists and uses the expected ruleset/session template.
- AMS fleet exists, is active, and uses the expected image, region, instance type, and claim key.
- Skill/MMR stat code exists and is written by the game or another approved backend path.
- The game still submits tickets, handles match-found, joins the session, and travels/connects to the server according to `online-game-flow.md`.

If backend resources exist but the game cannot complete the player flow, report the state as backend configured, not complete.
