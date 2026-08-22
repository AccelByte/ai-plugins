---
name: teammate-run-setup
description: 'What a health-check run does before it scans anything: resolve the report
  tool''s absolute path, prove it answers, open a run directory outside the repo,
  and open the access log. Read once, at the top of a run.'
last-verified: 2026-08-14
see-also:
- '[health-check.md](../subskills/health-check.md)'
- '[report/report-schema.md](report/report-schema.md)'
---

# Setting up a run

Three things have to be true before a scan starts: the report tool is at a path
this run resolved rather than assumed, every file the run writes lands outside
the project being scanned, and the access log is open so the first read is
already in the trail.

Read this once, at the top of the run. Everything here binds `$TOOL`, `$RUNDIR`
and `$LOG`, which the stages afterwards use literally.

## Locate the install

At runtime the working directory is the user's project, and
`${CLAUDE_PLUGIN_ROOT}` does not resolve inside instructions
([claude-code#9354](https://github.com/anthropics/claude-code/issues/9354)). So
resolve the tool's absolute path before invoking it — never assume the cwd.

1. **Prefer the loaded skill path.** These instructions were loaded from this
   skill's install directory. The tool is at, relative to that directory,
   `references/report/scripts/report_tool.ts`. If the host exposes the path of
   the file it loaded, join it and go straight to the run directory below.
2. **Otherwise, search the places a plugin is installed** — never the home
   directory at large. The skill's own `<action_safety>` rules, and the
   `accelbyte` skill's git consent boundary they inherit, both say not to go
   looking across the filesystem; that applies to finding this skill as much as
   to reading a repo:
   ```bash
   find . ~/.claude/plugins ~/.config/opencode ~/.codex ~/.cursor \
     -path '*/skills/teammate/references/report/scripts/report_tool.ts' \
     2>/dev/null | head -n 1
   ```
3. **Bind the path once** to `$TOOL`. If no match is found, **ask the user where
   the skill is installed** — do not widen the search on your own, and do not
   fabricate a path.

Confirm the tool answers before scanning:

```bash
npx tsx "$TOOL" validate "$(dirname "$TOOL")/sample-report.json"
```

A tool that cannot validate its own sample is one whose later refusals mean
nothing, so this runs first and stops the run rather than degrading it.

## The run directory, and the access log

Open both together, and record the first read into the log as you open it:

```bash
RUNDIR="$(mktemp -d -t teammate-run.XXXXXX)"   # never inside the scanned repo
LOG="$RUNDIR/teammate-access.jsonl"
npx tsx "$TOOL" log --file "$LOG" --kind read --value "<repo root>" --note "stage1"
```

Every file the run writes — the access log, `report.json`, and the exported
Report — goes in `$RUNDIR`, and every later command writes there literally.
**Never write a run artifact into the repo being scanned.** A scan that leaves
files behind has edited the thing it was asked to read, and on a dirty-tree run
those files are indistinguishable from the developer's own uncommitted work.

Tell the user where it is, once:

```bash
echo "run dir: $RUNDIR"
```

## The commit list the walk-back needs

The prior-report lookup ranks candidates by distance along this repo's history,
so it needs that history as a file:

```bash
# → the reuse lookup's --commits. Bounded: a walk-back has no use for deep history.
git rev-list -n 200 HEAD > "$RUNDIR/commits.txt"
```

The bound is deliberate. A stored report two hundred commits back is not an
answer to this scan under any ranking, so reading further costs time and buys a
candidate the run would refuse to offer anyway.
