---
last-verified: 2026-07-20
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[wizard.md](wizard.md)'
- '[install-dep.md](install-dep.md)'
- '[install-cli.md](install-cli.md)'
- '[install-mcp.md](install-mcp.md)'
---

# AGS Extend Project Initializer

End-to-end guide from zero to a ready-to-code Extend project. Runs an environment check, then orchestrates `wizard` → `install-dep` → `install-cli` → optional `install-mcp` in sequence, with explicit handoff and failure handling between each stage.

## Behavior Constraints

<grounding_rules>

- Each stage is implemented by another subskill. Read `subskills/{stage}.md` before running it and follow it exactly — do not paraphrase or re-implement its logic from memory.
- Do not skip the environment check in Step 1 even if the user seems impatient. Missing tools surface here cause opaque failures three stages later.
- Never auto-install language runtimes, Docker, or git. Detect them, report them, and let the user install them out-of-band.

</grounding_rules>

<tool_usage_rules>

- Use `Bash` only for environment detection in Step 1 and for whatever the nested subskills instruct.
- Use `Read` to load the four subskill files when it's their turn.
- Respect the `allowed-tools` restrictions of each nested subskill — don't use tools the subskill itself wouldn't use.

</tool_usage_rules>

<parallel_tool_calling>

In Step 1, run all environment-detection commands in parallel (single message with multiple `Bash` calls). Do not check runtimes serially — it's slower and gives a worse user experience.

</parallel_tool_calling>

<dependency_checks>

Step 1 is the dependency check for the entire flow. Before handing off to `wizard`, report findings but do not block on:

- Missing language runtime (user may not have picked a language yet; re-check inside `install-dep`)
- Missing `extend-helper-cli` (not needed until `deploy`; `install-cli` runs later in this flow)

Do block on:

- Missing `git` → `wizard` can't clone. Tell the user to install git, then re-run `/ags-extend init`.
- Missing `docker` → patches for databases, messaging, and the Dockerfile build all require it. Tell the user to install Docker Desktop and retry.

</dependency_checks>

<action_safety>

`init` makes multiple changes across stages (clone, file edits, global binary install, config file edits). Between stages:

- Report what the previous stage changed before starting the next.
- If any stage fails, stop the orchestration. Do not skip ahead — the user should decide whether to fix and retry, resume from the next stage, or abandon.
- Never auto-resume after an error without explicit confirmation.

</action_safety>

<user_updates_spec>

Print a single-line header at each stage transition so the user knows where they are:

```
━━━ Stage 1/4: Scaffold ━━━
━━━ Stage 2/4: Install dependencies ━━━
━━━ Stage 3/4: Install CLI ━━━
━━━ Stage 4/4: Install MCP (optional) ━━━
```

The active stage runs its own subskill output normally. After each stage completes, print a one-line summary before the next header.

</user_updates_spec>

<completeness_contract>

`init` is complete when:

1. Step 1 (environment check) has surfaced all missing/present tools.
2. `wizard` has produced an app directory with `IMPLEMENTATION_PLAN.md` (and any patches applied passed Verify).
3. `install-dep` has run for the scaffolded app (or every app dir, if multiple) — either success, or an explicit skip with the reason (runtime missing) reported.
4. `install-cli` has installed `extend-helper-cli` or reported it was already installed.
5. `install-mcp` has run if the user said yes, or been explicitly skipped if they said no.
6. Final summary printed with next steps.

A stage that the user explicitly declines counts as complete for its slot but is marked "skipped by user" in the final summary.

</completeness_contract>

<output_contract>

Final summary format:

```
Done initializing {app-name}.

  Environment:      {os} {arch}, {runtime} {version}
  Scaffold:         ./{app-name}/ (pattern={pattern}, language={language})
  Integrations:     {list or "none"}
  Dependencies:     installed / skipped ({reason})
  extend-helper-cli: installed / already present / skipped
  MCP integration:  installed / declined / skipped

Next:
  • Edit {app-path}/pkg/... to implement your logic
  • /ags-extend debug — run locally
  • /ags-extend deploy — ship to AGS
```

Do not produce the summary if the orchestration stopped early due to an error. Instead print a "Stopped at Stage {n}" block with the error and how to resume.

</output_contract>

## Workflow

### Step 1 — Environment check

Run these in parallel:

```bash
uname -s -m
git --version 2>&1
docker --version 2>&1
docker info 2>/dev/null | grep "Server Version" 2>&1
go version 2>&1
python3 --version 2>&1
dotnet --version 2>&1
java --version 2>&1
command -v extend-helper-cli || echo "not installed"
```

Report as:

```
Environment:
  OS:          {os} {arch}
  ✓ git         2.43.0
  ✓ docker      25.0.3 (daemon running)
  ✓ go          1.22.0
  ✗ python3     not found
  ✗ dotnet      not found
  ✗ java        not found
  ✗ extend-helper-cli  not found — will install in Stage 3
```

Interpret:

- `git` missing → stop. Say: "Install git from git-scm.com and re-run `/ags-extend init`."
- `docker` missing or daemon not running → stop. Say: "Install Docker from docs.docker.com (or start Docker Desktop) and re-run."
- All four language runtimes missing → warn but don't stop; the user may install whichever matches their chosen language during the wizard interview.
- `extend-helper-cli` missing → note "will install in Stage 3" and continue.

### Step 2 — Stage 1: Wizard

Print:

```
━━━ Stage 1/4: Scaffold ━━━
```

Read `subskills/wizard.md` and follow it start to finish. When it completes:

- If `wizard` ended at its own "Done" checkpoint, capture the app name, pattern, language, integrations, and path.
- If `wizard` stopped early (clone failed, patch Verify failed and user chose to stop), stop `init` and print the stop-early block (see `output_contract`).

### Step 3 — Stage 2: Install dependencies

Print:

```
━━━ Stage 2/4: Install dependencies ━━━
```

Read `subskills/install-dep.md` and follow it. The wizard just ran, so the app directory and language are known — `install-dep` only needs to verify the runtime for the chosen language and run the appropriate dependency command inside the app dir.

If `install-dep` skipped because the runtime is missing, capture the skip reason. Don't stop `init` — the user can install the runtime and re-run `/ags-extend install-dep` without redoing the wizard.

### Step 4 — Stage 3: Install CLI

Print:

```
━━━ Stage 3/4: Install CLI ━━━
```

Read `subskills/install-cli.md` and follow its freshness check even when `extend-helper-cli` is already on `PATH`. Skip the download only when that flow reports `Status: current`. If the user declines an install or upgrade, record the reported status plus `declined` and continue — deploy will surface the same prerequisite later.

### Step 5 — Stage 4: Install MCP (optional)

Print:

```
━━━ Stage 4/4: Install MCP (optional) ━━━
```

Ask:

> Want to hook the Extend MCP servers into your AI IDE now? This lets the IDE query AGS and reference Extend SDK context while you code. (yes/no — skip is fine, you can run `/ags-extend install-mcp` later.)

If yes → read `subskills/install-mcp.md` and follow it.
If no → record "declined" and proceed to the final summary.

### Step 6 — Final summary

Print the summary from `output_contract`. Then stop.

## Resuming an interrupted init

If the user comes back and says "I already ran wizard, now run the rest" (or something like it):

1. Check whether the current directory (or one level up) holds an Extend app: `Makefile` + `Dockerfile` together. If found, treat Stage 1 as already done. If `go.sum` / `.venv` / `target/` / `bin/` is present alongside, treat Stage 2 as already done too.
2. Check `command -v extend-helper-cli`, then read and run `subskills/install-cli.md` to classify freshness. Skip the Stage 3 download only when it reports `Status: current`; do not infer freshness from presence alone.
3. Ask about MCP (Stage 4).

Do not re-run earlier stages once their artifact (cloned app dir, installed deps, installed binary, merged MCP config) is in place. Users invoke `init` to get to a ready state, not to redo work.

## Error Handling

| Situation | Response |
|---|---|
| `git` missing | Stop. Do not proceed — scaffold depends on clone. |
| `docker` daemon down | Stop. Patches and Dockerfile builds fail opaquely otherwise. |
| Wizard fails on clone | Stop. Print the wizard's error. Suggest re-running `/ags-extend wizard` after fixing. |
| Wizard fails on patch Verify | Stop. Do not run install-dep against a half-patched project. |
| install-dep can't find runtime | Continue. Record the skip in the summary. User can install runtime and re-run `/ags-extend install-dep`. |
| install-dep fails for a non-runtime reason (e.g. `pip install` errors) | Continue but record the failure. Don't auto-retry. |
| install-cli download fails | Continue. Record as skipped. Deploy stage will re-prompt. |
| User Ctrl-C mid-stage | The stage's subskill handles its own cleanup. After control returns, ask whether to resume from the next stage or stop. |

## Examples

### Happy path

```
User: /ags-extend init

Skill: Environment:
         OS:   darwin arm64
         ✓ git         2.43.0
         ✓ docker      25.0.3 (daemon running)
         ✓ go          1.22.0
         ✗ python3     not found
         ✗ dotnet      not found
         ✗ java        not found
         ✗ extend-helper-cli  not found — will install in Stage 3

       ━━━ Stage 1/4: Scaffold ━━━

       What do you want to build?

User: Custom matchmaking override in Go, name it matchmaking-override.

Skill: [runs wizard]
       ✓ Cloned extend-override-go → ./matchmaking-override/
       ✓ No integrations selected

       ━━━ Stage 2/4: Install dependencies ━━━

       [runs install-dep]
       ✓ go mod tidy passed

       ━━━ Stage 3/4: Install CLI ━━━

       [runs install-cli]
       ✓ extend-helper-cli 0.4.1 installed to /usr/local/bin/

       ━━━ Stage 4/4: Install MCP (optional) ━━━

       Want to hook the Extend MCP servers into your AI IDE now? (yes/no)

User: no

Skill: Skipping MCP setup. Run /ags-extend install-mcp anytime.

       Done initializing matchmaking-override.

         Environment:       darwin arm64, go 1.22.0
         Scaffold:          ./matchmaking-override/ (override, go)
         Integrations:      none
         Dependencies:      installed
         extend-helper-cli: installed (0.4.1)
         MCP integration:   declined

       Next:
         • Edit matchmaking-override/pkg/service/ to implement your logic
         • /ags-extend debug — run locally
         • /ags-extend deploy — ship to AGS
```

### Stopped early (docker missing)

```
User: /ags-extend init

Skill: Environment:
         OS:   linux x86_64
         ✓ git         2.40.1
         ✗ docker      not found

       Stopping — Extend apps package as Docker containers; patches and the
       image-upload step both require Docker. Install it from
       https://docs.docker.com/engine/install/ and re-run /ags-extend init.
```

### Stopped mid-stage (patch Verify failed)

```
Skill: ━━━ Stage 1/4: Scaffold ━━━
       [wizard runs, applies nosql-go]
       ✗ Verify: go build ./... failed
         pkg/service/leaderboard_service.go:42:15: undefined: storage.NewCloudSaveStorage

       Stopped at Stage 1 (Scaffold).

       The nosql-go patch removed the CloudSave implementation but a caller
       in pkg/service/ still references it. Fix: update
       leaderboard_service.go to call storage.NewMongoDBStorage instead.

       Re-run /ags-extend init after fixing, or resume with:
         /ags-extend install-dep
```

### Resumed init

```
User: /ags-extend init — I already cloned and ran install-dep

Skill: Detected ./guild-service/Makefile + Dockerfile and go.sum — treating
       Stages 1–2 as already done.

       ━━━ Stage 3/4: Install CLI ━━━

       ✓ extend-helper-cli <version> at /usr/local/bin/extend-helper-cli
         Latest version: <version> — status current, download skipped.

       ━━━ Stage 4/4: Install MCP (optional) ━━━
       ...
```
