---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/register-local-dedicated-servers/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-quickstart-guide/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/
see-also:
- '[overview.md](../references/overview.md)'
- '[sdk.md](sdk.md)'
- '[upload.md](upload.md)'
---

# AMS Local Tester

Test a dedicated server's AMS integration locally using the AMS Simulator (`amssim`) before uploading to production. The AMS Simulator emulates watchdog behavior on your local machine — no cloud connection required.

Two testing modes:
1. **AMS Simulator** (`amssim`) — runs the watchdog locally; tests the DS ↔ watchdog protocol
2. **Local server registration** — registers a local DS with a real AGS namespace for end-to-end session testing

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` — specifically the Watchdog Protocol section — before advising on what the DS should send/receive.
- `amssim` is downloaded from the Admin Portal (AMS → Download Resource → AMS Simulator). It requires the DS to be built and runnable on the local OS.
- Local server registration requires a real AGS namespace with AMS enabled. The DS must be running on a machine reachable from the internet (or via a tunnel).
- Local DS registrations are capped at **10 per namespace**.

</grounding_rules>

<tool_usage_rules>

- `Bash` for running `amssim`, checking tool presence, and launching the DS locally.
- `Read` for overview.md and local DS config files.
- Never modify DS source files. If the SDK integration looks wrong, point to `/ags-ams sdk`.

</tool_usage_rules>

## Workflow

### Mode 1: AMS Simulator (recommended first step)

The AMS Simulator emulates the watchdog locally without connecting to AGS. Use it to verify the DS correctly:
- Sends the ready message
- Sends heartbeats
- Handles drain gracefully

#### Step 1 — Prerequisites

```bash
command -v amssim || echo "not found"
```

If not found, direct to the Admin Portal: AMS → Download Resource → AMS Simulator. Extract and add to PATH.

#### Step 2 — Run `amssim` alongside the DS

In one terminal, start the simulator:

```bash
amssim run
```

`amssim` listens on `ws://localhost:5555/watchdog` and emulates AMS signals.

In a second terminal, start the DS binary with the required AMS flags:

```bash
./<your-ds-binary> \
  -dsid ds_local_test \
  -port 7777 \
  -watchdog_url ws://localhost:5555/watchdog
```

#### Step 3 — Verify the output

The simulator logs should show:
1. DS connected (WebSocket handshake)
2. Ready message received → DS transitions to "Ready"
3. Heartbeat received every ~15 seconds

To test drain handling, `amssim` will send a drain signal after a configurable timeout. Verify the DS exits gracefully.

**What success looks like:**
```
[amssim] DS connected: ds_local_test
[amssim] Ready message received — DS is now Ready
[amssim] Heartbeat received (t+15s)
[amssim] Heartbeat received (t+30s)
[amssim] Sending drain signal...
[amssim] DS disconnected cleanly
```

**Common failures:**
- No connection → DS didn't open WebSocket (check SDK config or raw WebSocket address)
- No ready message → DS sent ready before connecting, or SDK not configured with `bServerUseAMS=True` / `SendReadyMessage()` not called
- No heartbeat → SDK heartbeat not running; check SDK version
- DS crashed on drain → drain handler not implemented; see `/ags-ams sdk`

### Mode 2: Local server registration (end-to-end test)

Use when you want to test the full claim flow — matchmaking → session → DS claim — against a real AGS namespace.

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
amssim run --config config.json
```

The simulator connects to AGS, registers the local DS, and appears in the Admin Portal under AMS → Local Servers.

#### Step 3 — Claim the local DS

Local servers take **priority** over fleet servers in claim requests. To claim your local DS from a session:
- Create a session template with `DS - AMS` type and a claim key matching your `ClaimKeys` list
- Or specify `server_name: my-local-ds` in the matchmaking ticket attributes (Unreal: `SETTING_GAMESESSION_SERVERNAME`, Unity: `server_name` attribute)

#### Step 4 — Verify

Check the Admin Portal → AMS → Local Servers tab. Your DS should appear as "Ready" and transition to "In Session" when claimed. Session logs are at `session/<sessionid>.log`.

### When testing is complete

```
Local testing complete.
  AMS Simulator: watchdog protocol verified
  Local registration: claim flow verified (if tested)

Next: Run /ags-ams upload to upload the DS binary to AMS.
```

## Error Handling

| Situation | Response |
|---|---|
| DS doesn't connect to amssim | Check that the DS is opening a WebSocket to `ws://localhost:5555/watchdog`. For Unreal, verify `bServerUseAMS=True` in DefaultEngine.ini. For Unity, confirm SDK is initializing AMS connection. |
| amssim not found | Download from Admin Portal → AMS → Download Resource → AMS Simulator. |
| No ready message received | The DS is either sending ready before connecting to the watchdog, or the SDK call isn't being reached. Add logging around the ready call to verify it's executed. |
| Drain causes DS crash | Implement drain handling in the DS. See `/ags-ams sdk` for the drain signal handler pattern. |
| Local DS not appearing in Admin Portal | Check IAM client has `NAMESPACE:{namespace}:AMS:LOCALDS [CREATE]` permission. Verify `config.json` values — URL, namespace, and network reachability. |
| DS registers but session can't claim it | Verify the session template has a matching claim key or server name. Local DSes take priority but still require a matching claim key. |
| 10 local DS registration limit reached | Maximum 10 per namespace. Remove old registrations in the Admin Portal before adding new ones. |
