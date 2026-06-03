---
last-verified: 2026-05-28
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/register-local-dedicated-servers/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-quickstart-guide/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/
see-also:
- '[overview.md](references/overview.md)'
- '[sdk.md](sdk.md)'
- '[upload.md](upload.md)'
- '[unreal-local-testing.md](references/unreal-local-testing.md)'
- '[unreal-amssim-local-ds.md](references/synthetic/unreal-amssim-local-ds.md)'
- '[amssim-command-reference.md](references/synthetic/amssim-command-reference.md)'
---

# AMS Local Tester

Test a dedicated server's AMS integration locally using the AMS Simulator (`amssim`) before uploading to production. The normal path is AGS-backed local server registration with `amssim run --configPath`; watchdog connection, ready, and heartbeat are required evidence inside that path.

## Behavior Constraints

<grounding_rules>

- Read `../../workflows/online-game-flow.md` before reporting AMS debug evidence for a player-facing login, matchmaking, session, or DS travel journey.

- Read `references/overview.md` — specifically the Watchdog Protocol section — before advising on what the DS should send/receive.
- `amssim` is downloaded from the Admin Portal (AMS → Download Resource → AMS Simulator). It requires the DS to be built and runnable on the local OS.
- Local server registration requires a real AGS namespace with AMS enabled. The DS must be running on a machine reachable from the internet (or via a tunnel).
- Local DS registrations are capped at **10 per namespace**.
- When an approved `docs/ags/matchmaking/*-plan.md` or legacy `docs/ags-matchmaking/*-plan.md` exists for a DS/local-DS matchmaking flow, read the plan before launching `amssim`. If the plan contains an **AMS local DS debug checklist**, use it as the run contract for `ServerName`, client `server_name`, Unreal `SETTING_GAMESESSION_SERVERNAME`, `ClaimKeys`, DS launch args, and evidence expectations. If any checklist value is missing or conflicts with local config, stop and report the mismatch before testing claimability.
- AMS claim evidence alone does not prove a player-facing game flow. If this subskill only verifies watchdog/local registration/claim evidence, report only the AMS verification state and do not call the login -> matchmaking -> session -> DS travel journey `Complete`.
- Never write real IAM client secrets into repo-tracked sample configs, docs, or final answers. Use ignored local files, environment variables, or redacted placeholders for examples. If a secret is already exposed in a repo file or transcript, tell the user to rotate it.

</grounding_rules>

<tool_usage_rules>

- `Bash` for running `amssim`, checking tool presence, and launching the DS locally.
- `Read` for overview.md and local DS config files.
- Never modify DS source files, project gameplay code, SDK plugin code, OSS plugin code, or vendor code from this debug subskill. This subskill is for diagnosis and runtime verification. If the root cause requires a code/config change, stop with the evidence and point to the owner: `/ags ams sdk` for watchdog integration, `/ags matchmaking integrate` for ticket/session client behavior, or the user's project code after explicit approval.
- If you briefly inspect SDK/OSS/plugin code to understand behavior, keep it read-only. Do not patch dependency code as a local workaround.

</tool_usage_rules>

<completion_contract>

When the user asks for local DS, `amssim`, local server registration, local DS claimability, or a session/matchmaking flow that targets a local DS, configuration alone is not complete. Treat requests to fill or verify AMS environment config, register a local DS with AGS, or launch a client to confirm local DS join as AGS-backed local server registration.

Do not offer a standalone DS-to-watchdog run as a substitute for local DS registration. Watchdog evidence is diagnostic until AGS registration and post-ready claim evidence exist.

Local DS work is complete only when the agent has verified evidence from `amssim` output showing:
1. The simulator started with the intended config.
2. The dedicated server connected to the simulator watchdog.
3. The simulator received the DS ready message.
4. The simulator received at least one heartbeat or equivalent health signal.
5. For end-to-end claim tests, a session or matchmaking claim was attempted after the DS was ready.

If `amssim` cannot be run, the DS cannot be launched, credentials are missing, the environment is unreachable, or logs cannot be inspected, do not say local DS support is complete. Report the state as "configured but unverified" and name the exact missing verification step.

Use these reporting states:
- "configured but unverified" = config/code prepared but `amssim` logs were not inspected or `amssim`/DS could not run.
- "claim verified" = watchdog evidence plus local registration/session/matchmaking post-ready claim attempt or equivalent portal/session evidence.

For Unreal OSS local DS, ready can depend on DS Hub or session-registration code after the AMS watchdog connects. If the DS connects to the watchdog and heartbeats appear, but DS Hub/session registration fails before `SendServerReady`, report `watchdog connected; ready path blocked by DS Hub; claim/travel not verified`. This is `configured but unverified`, because the ready evidence is missing. Do not force or simulate ready to turn a DS Hub failure into success evidence.

Keep an evidence ledger for the current run and do not mix stale simulator output with fresh verification:
- `amssim` session id and session log path
- exact `ds_<uuid>` copied from the current `amssim info` output
- DS command line, including `-dsid`, `-watchdog_url`, game port, and any game-specific `-ServerName`
- AGS-backed `config.json` values after redaction: namespace, `ServerName`, `ClaimKeys`, `LocalDSHost`, `LocalDSPort`, and IAM client id
- timestamps for DS connected, ready received, heartbeat after ready, and claim attempt

If an old `session/<id>.log` contains a claim or ready transition, treat it as historical context only unless its timestamp is after the current DS launch and it uses the current DS id.

</completion_contract>

## Workflow

### Step 0 - Consume a matchmaking handoff checklist when present

When an approved `docs/ags/matchmaking/*-plan.md` or legacy `docs/ags-matchmaking/*-plan.md` exists, read the plan before launching `amssim`. For DS/local-DS matchmaking, prefer the plan's **AMS local DS debug checklist** over guesses from memory or stale simulator config.

The checklist should name:
- Local server identity: `ServerName`, client `server_name`, and Unreal `SETTING_GAMESESSION_SERVERNAME` when Unreal is used.
- Claim routing: `ClaimKeys`, session template claim keys, and any client-version/fallback claim key behavior.
- DS launch args: `-dsid`, `-watchdog_url`, `-port`, and any project-specific server-name arg.
- `amssim` launch command and config path.
- Evidence expectations: simulator session id/log path, DS connected, ready received, heartbeat after ready, and post-ready claim attempt or portal/session evidence.

If the checklist is absent, continue with the normal workflow but record that the matchmaking handoff was incomplete.

### Prerequisites

```bash
command -v amssim || echo "not found"
```

If not found, direct to the Admin Portal: AMS → Download Resource → AMS Simulator. Extract and add to PATH.

For full command flags and interactive command behavior, use `references/synthetic/amssim-command-reference.md`.

### Local server registration (end-to-end test)

Use when you want to test the full claim flow — matchmaking → session → DS claim — against a real AGS namespace, including reruns after the user fills AMS environment config.

#### Preflight gate - AGS config and IAM permission required

Before running `amssim run --configPath <path-to-config.json>` for AGS-backed local server registration, inspect the selected `config.json` and detected server/runtime IAM settings. Stop if any required field, the confidential IAM client, or `NAMESPACE:{namespace}:AMS:LOCALDS [CREATE]` is missing, placeholder, public-client-only, or known-invalid. Do not launch registration or retry the same invalid config.

Detect the server runtime before asking for config changes. Use project shape and the active plan/checklist to classify the runtime as `Unreal`, `Unity`, `Godot`, or `unknown`. For Unreal, inspect `*.uproject`, `Config/DefaultEngine.ini`, and platform-local overrides when available. For Unity, inspect `ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`, and the project's server/runtime config source when available. For Godot, inspect `project.godot` and the project's exported/server config source when available. If the runtime is unknown, ask for the server runtime instead of naming an engine-specific settings file.

When asking for config changes, use the detected runtime. For Unreal server settings, prefer `DefaultEngine.ini` or an ignored platform-local override. For other runtimes, name the detected config source if known; otherwise ask the user to populate the server/runtime IAM settings.

Required `config.json` fields:
- `AGSEnvironmentURL`
- `AGSNamespace`
- `IAM.ClientID`
- `IAM.ClientSecret`
- `LocalDSHost`
- `LocalDSPort`
- `ServerName`
- `ClaimKeys`

The IAM client must be confidential and have `NAMESPACE:{namespace}:AMS:LOCALDS [CREATE]` permission for the target namespace. If CLI access is available and the user wants AGS verification, check this before starting `amssim` with AGS registration. If the IAM client must be created or modified, hand off to `/ags ams account` or ask for explicit approval before mutating AGS state.

Do not write a real IAM secret into tracked project config such as `DefaultEngine.ini`, sample files, docs, or final answers. If a local simulator config requires a secret, keep it in an ignored local file or environment variable. If a real secret is found in a tracked diff, stop and tell the user to rotate that client before committing.

If the AGS-backed simulator config is missing or invalid, ask the user to fill the config file and wait. Include the exact config path when known, redact existing secrets, and name the required permission:

```text
AGS-backed local DS registration needs AMS Simulator config before I launch `amssim`, the DS, or the client.

Detected runtime: <Unreal|Unity|Godot|unknown>
Config file: <path-to-config.json>
Missing/invalid config: <AGSEnvironmentURL|AGSNamespace|IAM.ClientID|IAM.ClientSecret|LocalDSHost|LocalDSPort|ServerName|ClaimKeys|server/runtime IAM settings>

Please populate `config.json` with `AGSEnvironmentURL`, `AGSNamespace`, `IAM.ClientID`, `IAM.ClientSecret`, `LocalDSHost`, `LocalDSPort`, `ServerName`, and `ClaimKeys`.

The IAM client must be confidential and have `NAMESPACE:<AGSNamespace>:AMS:LOCALDS [CREATE]`. Do not commit or paste the real `IAM.ClientSecret`; keep it in an ignored local config or environment-specific secret source.

After updating the config, ask me to continue and I will run `amssim run --configPath <path-to-config.json>` with secrets redacted.
```

#### Prerequisites

- AMS enabled on the target namespace
- A confidential IAM client with `NAMESPACE:{namespace}:AMS:LOCALDS [CREATE]` permission
- The DS running on a machine reachable from AGS (or via a tunnel like ngrok)

#### Step 1 — Configure the AMS Simulator for AGS connection

Create a `config.json`:

```json
{
  "AGSEnvironmentURL": "mystudio-mygame.prod.gamingservices.accelbyte.io",
  "AGSNamespace": "my-namespace",
  "IAM": {
    "ClientID": "<iam-client-id>",
    "ClientSecret": "<iam-client-secret>"
  },
  "LocalDSHost": "123.456.789.0",
  "LocalDSPort": 7777,
  "ServerName": "my-local-ds",
  "ClaimKeys": ["battle-royale-v1"]
}
```

`LocalDSHost` must be the public IP/hostname reachable by game clients. If behind NAT, use ngrok:

```bash
ngrok tcp 7777   # use the generated hostname/port in LocalDSHost/LocalDSPort
```

#### Step 2 — Start the simulator with AGS registration

```bash
amssim run --configPath config.json
```

The simulator connects to AGS, prints a valid local DS ID in `ds_<uuid>` format, and listens on `ws://localhost:5555/watchdog`. Use that current simulator-provided value for the DS `-dsid`; do not use a friendly server name as the DS ID.

Copy the complete DS ID carefully. Console line wrapping can split the UUID. Before launching the DS, verify it matches:

```text
^ds_[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$
```

Launch the DS with the current ID and watchdog URL:

```bash
./<your-ds-binary> \
  -dsid ds_00000000-0000-0000-0000-000000000000 \
  -port 7777 \
  -watchdog_url ws://localhost:5555/watchdog # nosemgrep: detect-insecure-websocket -- AMS Simulator local watchdog intentionally uses loopback ws://.
```

For Unreal local testing, use `references/unreal-local-testing.md`. If the DS does not connect or the agent is diagnosing a live local run, also use `references/synthetic/unreal-amssim-local-ds.md`. The short form is to start `amssim run --configPath <path-to-config.json>`, copy the generated `ds_<uuid>`, then launch either a packaged Windows server or `UnrealEditor.exe <Project>.uproject -server -log -nosteam -watchdog_url="ws://localhost:5555/watchdog" -dsid=<ds-id>`. <!-- nosemgrep: detect-insecure-websocket -- AMS Simulator local watchdog intentionally uses loopback ws://. -->

Inspect `amssim` logs before claiming readiness. Required pre-claim evidence:
1. DS connected (WebSocket handshake)
2. Ready message received -> DS transitions to `Ready`
3. Heartbeat received after ready

Use the interactive `amssim` prompt for observation while testing:

```text
info
ds status
help
exit
```

If `ds status` reports no connected dedicated server, the DS is not connected to the watchdog yet. Check DS ID format, watchdog URL, server credentials/config, and DS logs before moving to matchmaking/session testing.

Manual test controls such as `ds ready`, `ds claim`, and `ds drain` change simulator state and must not be used as evidence that the DS itself sent ready, sent heartbeat, or was claimable. Do not use `ds ready` to bypass a failed DS Hub/session-registration path.

#### Step 3 — Claim the local DS

Local servers take **priority** over fleet servers in claim requests. To claim your local DS from a session:
- Create a session template with `DS - AMS` type and a claim key matching your `ClaimKeys` list
- Or specify `server_name: my-local-ds` in the matchmaking ticket attributes (Unreal: `SETTING_GAMESESSION_SERVERNAME`, Unity: `server_name` attribute)

Keep these identifiers distinct:
- `-dsid` is the watchdog DS identity from `amssim`; it must be `ds_<uuid>`.
- `ServerName` in `config.json` is the AGS local-server name used for targeted local DS claims.
- Client matchmaking/session attribute `server_name` must match `config.json` `ServerName` exactly when targeting a local DS.
- `ClaimKeys` must match the DS session template or fleet claim key routing. A matching `server_name` does not fix a claim-key mismatch.
- A game-specific DS command-line `-ServerName` only matters if that project reads it and forwards the same value into the client/session attribute. Do not assume it affects AMSSim registration unless the logs/config prove it.

#### Step 4 — Verify

Check the Admin Portal → AMS → Local Servers tab. Your DS should appear as "Ready" and transition to "In Session" when claimed. Session logs are at `session/<sessionid>.log`.

For local DS claimability, verification requires both:
- `amssim` log evidence that the DS connected, became ready, and sent heartbeat.
- Admin Portal/session evidence that the local server is `Ready` before the session or matchmaking claim is attempted, then transitions to `In Session` or produces a concrete claim error.

If only `config.json` was created or the session template was updated, report "configured but unverified".

### When testing is complete

```
Local testing complete.
  Local registration: claim verified
  Evidence: amssim connected to AGS, DS connected, ready received, heartbeat received, and post-ready claim evidence exists

Next: Run /ags ams upload to upload the DS binary to AMS.
```

## Error Handling

When `amssim` reports `no connected dedicated server`, verify `-dsid` uses the `ds_<uuid>` printed by `amssim`, the DS uses the simulator's watchdog URL, no stale DS process is running, and the DS has valid server-side AGS credentials/config.

| Situation | Response |
|---|---|
| DS doesn't connect to amssim | Check that the DS is opening a WebSocket to `ws://localhost:5555/watchdog` <!-- nosemgrep: detect-insecure-websocket -- AMS Simulator local watchdog intentionally uses loopback ws://. -->. For Unreal, verify `bServerUseAMS=True` in DefaultEngine.ini. For Unity, confirm SDK is initializing AMS connection. |
| amssim not found | Download from Admin Portal → AMS → Download Resource → AMS Simulator. |
| No ready message received | Inspect DS/game logs for watchdog connection, server registration, ready API calls, and manual-ready config. If connection/heartbeat exists but no ready trace exists, report "watchdog connected but ready path not reached" and hand off to `/ags ams sdk` or explicit project integration work. Do not patch OSS/SDK from this debug subskill. |
| Heartbeat before ready | Treat this as a ready-path diagnostic, not a heartbeat success. Check whether the ready call is gated behind server registration, DSHub/session registration, manual-ready config, or project lifecycle code. |
| Invalid DS ID | Relaunch the DS with the exact current `ds_<uuid>` from `amssim info`; console wrapping commonly drops or duplicates UUID characters. |
| Drain causes DS crash | Implement drain handling in the DS. See `/ags ams sdk` for the drain signal handler pattern. |
| `amssim` reports `invalid_client` | Stop and treat the IAM preflight as failed. Do not retry with the same config. Ask the user to provide a valid confidential IAM client or approve creating/verifying one in AGS. Report the AGS registration state as "configured but unverified". |
| Local DS not appearing in Admin Portal | Check IAM client has `NAMESPACE:{namespace}:AMS:LOCALDS [CREATE]` permission. Verify `config.json` values — URL, namespace, and network reachability. |
| DS registers but session can't claim it | Verify the session template has a matching claim key or server name. Local DSes take priority but still require a matching claim key. |
| 10 local DS registration limit reached | Maximum 10 per namespace. Remove old registrations in the Admin Portal before adding new ones. |
