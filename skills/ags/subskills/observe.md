---
name: ags-observe
description: Pull read-only signals from a deployed AGS namespace. Use when the user
  wants to understand live namespace state, IAM client activity, session state, command
  availability, auth health, or connectivity.
allowed-tools: Read Bash Glob
model: sonnet
last-verified: 2026-05-09
sources:
- https://github.com/AccelByte/accelbyte-ags-cli/releases/latest
see-also:
- '[cli-commands.md](../references/observe/cli-commands.md)'
- '[event-catalog.md](../references/observe/event-catalog.md)'
- '[install-cli.md](install-cli.md)'
- '[doctor.md](doctor.md)'
---

# AGS Live Namespace Observability

Read-only observability over a live AGS namespace. Use the AGS CLI (`ags`) for auth, diagnostics, command discovery, and generated read-only AGS API commands. Use the Admin Portal event browser where the current CLI does not expose the requested signal directly.

This subskill **never modifies state**. For mutating fixes based on what observation surfaces, route to `subskills/debug.md` or `subskills/connect-portal.md` after.

## Behavior Constraints

<grounding_rules>

CLI commands trace to `references/observe/cli-commands.md`. Event-catalog claims trace to `references/observe/event-catalog.md`. Don't fabricate command names; use `ags describe`, `ags <service> --help`, and `ags <service> <resource> --help` before running service-specific commands.

</grounding_rules>

<tool_usage_rules>

- `Bash` for the AGS CLI's read-only commands (`ags auth status`, `ags doctor`, `ags describe`, generated list/get/show commands). Never use it for state-changing operations here.
- `Read` for `references/observe/*.md`.
- Don't read other subskills.

</tool_usage_rules>

<dependency_checks>

Before observing:

1. The AGS CLI is installed (`ags --version` or `ags --help`). If not, route to `/ags install-cli`.
2. The CLI is authenticated (`ags auth status`).
3. The namespace name is known.

</dependency_checks>

<action_safety>

Read-only by contract. If the user wants to act on what observation reveals (kick a player, ban an account, update a Store item), route to the appropriate subskill or the Admin Portal - don't make the change here.

</action_safety>

<output_contract>

Each observation pulls a specific signal. Output shape:

```
[Signal name]

  Namespace:     <name>
  Window:        <since when>
  Result:
    <signal-specific output, formatted for readability>

Notes:
  - <interpretation, if non-obvious>
  - <follow-up subskill if action is implied>
```

</output_contract>

<completeness_contract>

An observation is complete when:

1. The signal the user asked for has been pulled, or the inability to pull it has been explained.
2. The output is in a digestible shape, not a wall of raw CLI output.
3. Notable patterns or anomalies are surfaced.

</completeness_contract>

## Workflow

### Step 1: Confirm preconditions

Per `dependency_checks`. If CLI isn't installed or authenticated, route accordingly.

### Step 2: Identify the signal

What does the user want to know?

| Signal | CLI shape (verify with `ags describe` before running) |
|---|---|
| CLI health / connectivity | `ags doctor` |
| Auth state | `ags auth status` |
| Active sessions | `ags session game-sessions list --namespace <ns>` if exposed by the current specs |
| IAM client list | `ags iam clients list --namespace <ns>` if exposed by the current specs |
| Command discovery | `ags describe <service> <resource> <method>` |
| Event activity | Admin Portal event browser, or a generated CLI event command if exposed |
| Specific player's recent activity | discover with `ags describe iam users` and run the matching read-only user lookup command |

If the signal isn't supported via the CLI, point at the Admin Portal.

### Step 3: Run the query

Run the read-only command. Use `--format json` when the result will be parsed or summarized programmatically. Capture output.

### Step 4: Format and interpret

Don't paste raw CLI output. Distill into the output contract shape:

- For diagnostics: separate config, auth, and network status.
- For session lists: count, group by region / mode where the data includes those fields, and surface anomalies.
- For IAM: list clients, flag obvious unused or mis-scoped clients when the data supports that conclusion.

Surface anomalies. Don't just dump data.

### Step 5: Suggest follow-up

If observation reveals an issue:

- Auth-related -> `/ags debug` or `references/debug/auth-failures.md`.
- IAM client misconfiguration -> `/ags connect-portal`.
- AGS-side incident pattern -> AccelByte support.
- Operational AMS issue -> `/ags-ams`.
- Matchmaking-side issue -> `/ags-matchmaking`.
- Extend app issue -> `/ags-extend observe`.

## Examples

### CLI health

```
User: /ags observe - check whether my CLI can reach myteam-prod.

Skill: OK ags auth status
       OK ags doctor

       CLI health

         Namespace:  myteam-prod
         Window:     now
         Result:
           Auth:        authenticated
           Config:      base URL and namespace configured
           Network:     reachable

       Notes:
         - CLI prerequisites are healthy. Use `ags describe` to find the
           exact read-only service command for the signal you want next.
```

### Active sessions

```
User: /ags observe - how many active sessions right now?

Skill: OK ags describe session game-sessions list
       OK ags session game-sessions list --namespace myteam-prod

       Active sessions

         Namespace:  myteam-prod
         Window:     now
         Result:
           Total active:    342
           By region:       us-east 156, eu-west 124, ap-southeast 62
           By mode:         ranked 287, casual 55
           In allocation:   3 (servers being assigned)
           Stalled (>5m):   0

       Notes:
         - Healthy distribution. No stalled allocations.
```

### CLI not installed

```
User: /ags observe

Skill: AGS CLI not installed. Run /ags install-cli first.

       Alternative: use the Admin Portal directly. Its event browser and
       dashboards can show signals that may not be exposed by the current CLI.
```

## Error handling

- **CLI rate-limited** - back off, retry. Don't loop hammering the CLI.
- **Namespace not found** - surface the typo or wrong-portal-auth scenario.
- **CLI returned an opaque 5xx** - try once more with `--verbose`; if still 5xx, suggest checking the AccelByte status page.
- **User asks for a metric the CLI doesn't expose** - point at the Admin Portal or AccelByte's analytics export pipeline.
