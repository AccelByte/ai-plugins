---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-quickstart-guide/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/upload-a-dedicated-server-build/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/integrate-dedicated-servers-with-the-sdk/
see-also:
- '[account.md](account.md)'
- '[sdk.md](sdk.md)'
- '[upload.md](upload.md)'
- '[fleet.md](fleet.md)'
- '[session.md](session.md)'
- '[debug.md](debug.md)'
---

# AMS Initializer

End-to-end guide from zero to a working AMS setup. Orchestrates: account setup → SDK integration → (optional: local test) → upload → fleet creation → session configuration.

Runs in sequence. Each stage reads and follows its subskill file. If a stage fails, stop — do not skip ahead.

## Behavior Constraints

<grounding_rules>

- Each stage is implemented by another AMS capability file. Read `{stage}.md` in this directory before running it.
- Do not skip the environment check in Step 1, even if the user seems impatient.
- Never auto-resume after a failure without explicit user confirmation.

</grounding_rules>

<tool_usage_rules>

- Use `Read` to load subskill files at each stage.
- Use `Bash` for environment detection in Step 1 only.
- Respect each nested subskill's tool restrictions.

</tool_usage_rules>

<action_safety>

`init` covers multiple stages that span Admin Portal operations, CLI commands, and SDK code changes. Between stages:
- Report what changed before starting the next stage.
- If any stage fails, stop and present a "Stopped at Stage N" block with options to fix and retry or resume from the next stage.
- Never auto-advance past a failure.

</action_safety>

<user_updates_spec>

Print a stage header at each transition:

```
━━━ Stage 1/5: Account setup ━━━
━━━ Stage 2/5: SDK integration ━━━
━━━ Stage 3/5: Upload ━━━
━━━ Stage 4/5: Fleet creation ━━━
━━━ Stage 5/5: Session configuration ━━━
```

</user_updates_spec>

<output_contract>

Final summary:

```
AMS setup complete.

  Account:          {name} / {namespace}
  DS integration:   SDK configured (Unreal/Unity) / raw WebSocket
  Uploaded image:   {image_name}
  Fleet:            {fleet_name} ({type}) — {regions}
  Claim key:        {key}
  Session template: {template_name}

Next:
  • Test locally with: /ags ams debug
  • Monitor your fleet: /ags ams observe
  • Deploy a new DS version: /ags ams rollout
```

If the flow stopped early:

```
Stopped at Stage {N} ({stage_name}).

{Error description and how to fix it}

To resume: run /ags ams {subskill} to pick up from this stage.
```

</output_contract>

## Workflow

### Step 1 — Environment check

```bash
uname -sm    # confirm the user can build Linux x86/x64 DS
command -v ams || echo "ams cli: not found"
command -v amssim || echo "amssim: not found"
```

Report as:
```
Environment:
  OS/arch:   {result}
  AMS CLI:   installed / not found
  AMS Sim:   installed / not found
```

Interpret:
- Linux x86/x64 build capability required — if the user is on macOS/Windows, they need a Linux cross-compile setup or a Linux machine for the upload step.
- AMS CLI not found → note "will need to download from Admin Portal in Stage 3"
- AMS Simulator not found → note "will need to download in optional local test stage"

Do not stop for missing CLI/simulator — they're downloaded during the relevant stage.

### Step 2 — Stage 1: Account setup

```
━━━ Stage 1/5: Account setup ━━━
```

Read `account.md` and follow it. When done:
- If AMS is active and account created → continue.
- If Private Cloud needing Account Manager → stop `init`. Tell user to enable AMS and re-run.

### Step 3 — Stage 2: SDK integration

```
━━━ Stage 2/5: SDK integration ━━━
```

Read `sdk.md` and follow it.

When done, confirm the integration checklist from `sdk.md` is satisfied before proceeding.

If the SDK is not installed (Unreal/Unity SDK missing), stop and direct to `/ags install-sdk`.

### Step 4 — Optional: local test

Ask:

> Do you want to test the DS locally with the AMS Simulator before uploading? (Recommended — catches watchdog integration issues early.) (yes/no)

If yes → read `debug.md` and follow the local server registration workflow. After testing, continue.
If no → note "skipped" and continue.

### Step 5 — Stage 3: Upload

```
━━━ Stage 3/5: Upload ━━━
```

Read `upload.md` and follow it. Capture the uploaded image name.

If upload fails → stop `init`. Print the stop-early block.

### Step 6 — Stage 4: Fleet creation

```
━━━ Stage 4/5: Fleet creation ━━━
```

Read `fleet.md` and follow it. At minimum, produce a fleet summary with claim keys.

### Step 7 — Stage 5: Session configuration

```
━━━ Stage 5/5: Session configuration ━━━
```

Read `session.md` and follow it. The fleet claim key from Stage 4 feeds directly into the session template.

### Step 8 — Final summary

Print the final output from `output_contract`.

## Resuming an interrupted init

If the user comes back mid-flow ("I already set up the account and integrated the SDK"):

1. Ask which stage they completed last.
2. Skip completed stages — don't re-run them.
3. Resume from the next stage.

Do not re-run completed stages. Each stage has visible artifacts: an active AMS account, SDK config files on disk, an uploaded image name, an active fleet.

## Error Handling

| Situation | Response |
|---|---|
| Private Cloud without AMS enabled | Stop at Stage 1. User must contact AccelByte Account Manager. |
| SDK not installed | Stop at Stage 2. Direct to `/ags install-sdk` then re-run `/ags ams sdk`. |
| DS not Linux x86/x64 | Stop at Stage 3. AMS requires a Linux binary. User must set up cross-compilation or a Linux build machine. |
| Upload fails | Stop at Stage 3. Surface error and how to fix. User can re-run `/ags ams upload` to retry. |
| Fleet creation fails (Admin Portal issue) | Stop at Stage 4. List the fleet configuration values produced, so the user can enter them manually in the Admin Portal. |
| Session template not updated | Stop at Stage 5. Surface session template values. User can enter them manually in the Admin Portal. |
