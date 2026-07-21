---
last-verified: 2026-07-20
see-also:
- '[workflows.md](workflows.md)'
- '[run-workflow.md](../../subskills/run-workflow.md)'
---

# AGS CLI Fullscreen/Plain Execution

A reusable procedure for executing an AGS CLI command, once a subskill has already built a resolved (possibly partial) `ags <command> ...` invocation. `--ui` is a **global** AGS CLI flag — confirmed in top-level `ags --help`'s Flags section (`--ui <ui> Presentation backend for human output [auto|plain|inline|fullscreen]`), inherited by every standalone command and every `<service> <resource> <method>` combination. It does not appear in any individual command's own `--help` output (global flags aren't re-listed per-subcommand there), but it always applies. Originally written for `ags workflow run <id>`, and directly confirmed working on other commands too (e.g. `ags iam clients create --ui fullscreen`) — treat `--ui` as universal, not something to re-verify per command.

`auto` is the default value (used when `--ui` is omitted entirely) — it picks plain-equivalent rendering when stdout/stderr aren't a real terminal, which is exactly the agent's sandboxed tool environment.

## When to use this

Any subskill that has resolved an `ags <command> ...` invocation (some flags known/auto-filled, possibly some left open) should follow this procedure to execute it, instead of inventing its own execution-mode handling.

## The TTY problem

`--ui fullscreen` is a real terminal UI — cursor control, screen redraws, live keyboard input. It needs a real TTY. The agent's own `Bash`/PowerShell tool calls don't provide one (they read from a pipe), so running a fullscreen command inline through them produces garbled output or an apparent hang. This is universal fullscreen-TUI behavior, not a bug in `ags-cli` — nothing about the CLI itself needs fixing. `--ui plain` doesn't have this problem: it's a one-prompt-per-line mode with no cursor control, so it runs fine through a pipe.

## The choice: ask, every time — even when nothing is missing

Once the resolved (possibly partial) command is ready, use `AskUserQuestion` — never infer or default silently — with the resolved command shown in the question text, and exactly two options:

- **"Fullscreen (separate window)"** — opens the CLI's fullscreen TUI in a new window to review, edit, and fill in the rest; the agent resumes automatically once it closes.
- **"Plain (run here)"** — the agent figures out what's still needed and asks for it in chat, then runs the fully-flagged command directly, no separate window.

Ask this **every time**, regardless of whether the caller's resolved command already covers every required flag. Fullscreen isn't only a "fill in what's missing" tool — it's also how the user reviews and edits the resolved values in the CLI's own UI before submitting, even when nothing is technically missing. Don't skip the question just because nothing appears to be missing, and don't pre-compute a "deferred values" list to put in the question text — neither path needs one in advance (see below).

Selecting an option **is** the user's confirmation to execute — proceed straight to the matching path below. Don't ask a second "should I run it now?" or "are you sure?" afterward (a command-specific mutation-confirmation gate, e.g. a production-namespace check, can still apply separately — that's not this choice).

## Fullscreen path

`--ui fullscreen` needs a real TTY that the sandboxed `Bash`/PowerShell tool can't provide, so don't run it inline there. Instead:

1. Spawn a new, visible console window running the exact confirmed command, via the PowerShell tool:
   ```powershell
   Start-Process -FilePath powershell -ArgumentList '-NoExit','-Command','<resolved command, including --ui fullscreen>' -PassThru
   ```
   Capture the returned process object's `Id` (PID).
2. Immediately issue a backgrounded wait on that PID so you're notified the moment the window closes, instead of polling or blocking the conversation:
   ```powershell
   Wait-Process -Id <pid>
   ```
   issued with `run_in_background: true`.
3. Tell the user the fullscreen TUI opened in a new window, that they should complete the prompts there, and that you'll resume automatically once that window closes. Don't claim completion yet.
4. When notified the background wait finished, treat that as "the TUI session ended" (completed, cancelled, or errored — the exit alone doesn't tell you which). Don't assume success; verify separately (per the calling subskill's own post-run verification).
5. **Fallback** — if `Start-Process` fails to open a visible window (headless/sandboxed environment, or a shell with no equivalent), tell the user the spawn failed and switch to the plain path instead (ask for the deferred values in chat, then run inline) rather than handing back a manual copy/paste command.

## Plain path

`--ui plain` is a one-prompt-per-line mode, not a full TUI with cursor control, so it runs fine through the sandboxed `Bash`/PowerShell tool without a real TTY. Don't guess which values are missing — discover them the same way the CLI itself would tell you:

1. **Attempt the resolved (possibly partial) command first**, with `--dry-run` if the calling subskill is doing a dry-run-first flow, and no explicit `--ui` (let it default to `auto`).
2. **If it fails with a non-interactive-refusal error** — `Cannot run ... non-interactively: ... input '<name>' is required ...` (or, less likely here since no `--ui fullscreen` was passed, `A rich terminal UI (--ui=fullscreen) cannot be shown`) — parse the named input(s) directly from the error text. That parsed list is the authoritative set of values to ask about; ask for exactly those in chat (this is gathering missing information, not a second confirmation — selecting "Plain" already authorized the run).
3. **If the attempt succeeds outright** (nothing was actually missing), skip straight to step 4 — there's nothing to ask about in chat.
4. Once every flag is known (parsed-missing values filled in by the user, or nothing was missing to begin with), show the fully-resolved command for visibility and run it for real — don't ask another "confirm? (y/n)" unless a command-specific safety gate applies:

   ```sh
   ags <command> --ui plain --<every flag> <value> ...
   ```

5. **If the attempt fails for any other reason** (auth error, API/validation error, network error — anything not matching the non-interactive-refusal shapes above), that's a normal command failure, not a missing-input prompt. Surface it as-is and hand it back to the calling subskill's own error handling — don't try to interpret it as something to ask about in chat.

Capture the output and hand back to the calling subskill's next step.

## Examples

### Choosing plain mode — something is genuinely missing

```
Skill: [AskUserQuestion: "How should I run this?" — Fullscreen (separate
        window) / Plain (run here)]

User selects: Plain (run here)

Skill: [attempts `ags <command> --dry-run --<known flags>`, no explicit --ui]

       ✕ Cannot run this workflow non-interactively:
         workflow input 'fleetRegion' is required ...
         workflow input 'fleetInstanceId' is required ...

       OK, I'll gather the rest here — this confirms the run, so I'll execute
       once I have these (named by the CLI itself, not guessed): fleet
       region, fleet instance type.

User: [provides the missing values]

Skill: Running it now — no separate window needed for plain mode:
         ags <command> --ui plain --<every flag> <value> ...

       [runs inline via Bash/PowerShell tool, captures output]
```

### Choosing plain mode — nothing was actually missing

```
User selects: Plain (run here)

Skill: [attempts `ags <command> --dry-run --<known flags>`, no explicit --ui]

       That went through — nothing was missing, so I'm running it for real:
         ags <command> --ui plain --<every flag> <value> ...

       [runs inline via Bash/PowerShell tool, captures output]
```

### Spawning a visible window isn't possible (falls back to plain)

```
User selects: Fullscreen (separate window)

Skill: I tried to open a separate console window but couldn't (Start-Process
       failed in this environment). I'll switch to plain mode instead and
       gather the remaining values here: [lists the missing values]

       (continues like the plain-mode example above)
```

### Fullscreen chosen, but the command requires every flag upfront

```
Skill: [user chose fullscreen; spawns the partial command in a new window]

       The window closed almost immediately instead of opening the TUI — this
       command looks like it needs every flag up front rather than prompting
       for the missing ones. I still need: [lists the missing values]

User: [provides the missing values]

Skill: Resolved command:
         ags <command> --ui fullscreen --<every flag> <value> ...
       Confirm? (y/n)

User: y

Skill: [spawns the window again with the full command; this time it opens and
        stays open until the user finishes]
```

## Error handling

- **Plain path's discovery attempt fails with something other than a non-interactive-refusal error** (auth error, API/validation error, network error) — that's a normal command failure, not a missing-input signal. Surface it as-is and hand it back to the calling subskill's own error handling; don't try to interpret it as values to ask about in chat.
- **`--ui fullscreen` not supported by the installed CLI version** (per `--help`) — run the `/ags install-cli` freshness check before declaring the capability unavailable. If outdated, offer an upgrade and retry `--help` after approval. If the user declines or a current CLI still lacks it, report the version-specific gap and use plain mode. Authentication and authorization failures are not upgrade candidates.
- **Spawning a visible console window fails** (headless/sandboxed environment, or a shell with no `Start-Process` equivalent) — don't fall back to a manual copy/paste handoff. Switch to the plain path instead: tell the user the spawn failed and why, then ask in chat for the missing values and run the fully-flagged command inline.
- **Fullscreen TUI output looks garbled when run through the sandboxed tool directly** — this means the spawn step was skipped and the command was run inline by mistake; do not attempt to interpret garbled output as a result. Re-run via the spawn-and-wait path, or switch to plain mode.
- **Spawned window's process exits almost immediately instead of opening the TUI** (fullscreen was chosen) — this CLI build or this specific command likely requires every flag up front and doesn't fall back to interactive prompting for missing required flags. Don't treat the quick exit as a successful run. Ask the user in chat for the specific values that were left for the TUI, rebuild a fully-flagged command, and retry the spawn (or just switch to the plain path).
- **User asks to "just run it manually" or "run it myself" without picking fullscreen or plain** — treat this as choosing plain mode: gather the missing values in chat, then run the fully-flagged command inline yourself. Don't hand the user a command to paste into their own terminal — the point of this procedure is that the agent always executes it, via fullscreen-in-a-window or plain-inline, never a manual copy/paste handoff.
