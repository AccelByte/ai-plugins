---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/integrate-dedicated-servers-with-the-sdk/#unity
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/#messages
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-dedicated-server-lifecycle/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-fleet-configuration/
see-also:
- '[overview.md](../references/overview.md)'
- '[debug.md](debug.md)'
---

# AMS SDK Integrator

Walk a developer through integrating their dedicated server (DS) binary with AMS. The integration is a handful of SDK calls plus correct handling of two signals (ready and drain). This subskill detects the game engine, applies the right SDK methods, and verifies the integration looks complete before handing off to `debug` or `upload`.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before starting — specifically the Watchdog Protocol section. The SDK wraps the watchdog; understanding the underlying protocol prevents bad advice when the SDK is missing a method.
- Architecture constraint: the DS **must** be built for Linux (x86/x64). ARM is not supported by AMS.
- The DS communicates with the watchdog at `ws://localhost:5555/watchdog` via the `ams-dsid` header. The SDK handles this automatically; a developer using raw WebSocket must implement it manually.
- Heartbeat must be sent every 15 seconds. A missed heartbeat → AMS marks the DS Unresponsive → replacement.
- Do not guess engine-specific method names. Unreal uses `SendServerReady()` (OSS) or `bServerUseAMS=True` config; Unity uses `GetServerRegistry().GetAMS().SendReadyMessage()` and `GetServerRegistry().GetAMS().OnDrainReceived`. Verify from the user which SDK version they have before suggesting specific calls.

</grounding_rules>

<tool_usage_rules>

- `Read` for overview.md, engine config files (`.ini`, `.cs`, `.cpp`), and existing DS source to understand the current state before advising.
- `Edit` for applying config changes (`.ini`, `.cs`, `.cpp` files) only — never for generated files or files the user says are auto-generated.
- `Bash` for checking OS/architecture (`uname -sm`), build tools, and SDK version detection.
- Never add placeholder credentials or secrets to source files.

</tool_usage_rules>

<dependency_checks>

Before advising on SDK calls:

1. Confirm the DS is built for or targeting **Linux x86/x64**. ARM is not supported.
2. Confirm the AGS Game SDK is installed (Unreal plugin or Unity package). If not, tell the user to run `/ags install-unreal-sdk` or `/ags install-unity-sdk` first.
3. Determine the SDK version — method names differ slightly between major versions. Ask if unsure.

</dependency_checks>

<output_contract>

The integration is complete when the DS does all of the following:
- Sends the ready message after finishing initialization
- Sends a heartbeat every 15 seconds
- Handles the drain signal (ignores it if In Session; exits gracefully if Ready/idle)
- Exits with non-zero on fatal error; exits cleanly (code 0) after a normal session

Tell the user these four criteria and confirm each is addressed before signing off.

</output_contract>

## Workflow

### Step 1 — Detect engine and SDK

```bash
uname -sm   # confirm Linux is the target or cross-compile target
```

Ask if not obvious from context:
> Which game engine are you using — Unreal Engine or Unity? And do you already have the AGS Game SDK installed?

### Step 2 — Apply engine-specific integration

#### Unreal Engine (AGS Unreal OSS / AccelByteUe4Sdk)

**Configuration** (`DefaultEngine.ini`):

```ini
[OnlineSubsystemAccelByte]
bManualRegisterServer=True

[/Script/AccelByteUe4Sdk.AccelByteSettings]
bServerUseAMS=True
```

`bManualRegisterServer=True` tells the OSS not to auto-register. `bServerUseAMS=True` routes the watchdog connection through the SDK.

**Ready signal** — call when the DS finishes loading game state and is ready to accept players:

```cpp
// After loading is complete:
FOnlineSubsystemAccelByte::Get()->GetServerInterface()->SendServerReady();
```

**Drain signal** — implement the delegate:

```cpp
FOnlineSubsystemAccelByte::Get()->GetServerInterface()->OnDrainReceived.AddDynamic(
    this, &UMyGameMode::OnDrainReceived);

void UMyGameMode::OnDrainReceived()
{
    // If in session: let the current match finish, then exit.
    // If idle (Ready): exit immediately.
    if (bIsInSession)
    {
        bShouldExitAfterSession = true;  // exit in session-end handler
    }
    else
    {
        FPlatformMisc::RequestExit(false);
    }
}
```

The SDK sends heartbeats automatically when `bServerUseAMS=True` is set. No manual heartbeat code needed.

#### Unity (AGS Unity SDK)

**DS ID from command line** — AMS passes the DS ID at launch. Read it on startup:

```csharp
// Parse -dsId ds_<uuid> from command line args
string dsId = null;
var args = System.Environment.GetCommandLineArgs();
for (int i = 0; i < args.Length - 1; i++)
{
    if (args[i] == "-dsId") { dsId = args[i + 1]; break; }
}
```

**Ready signal** — call when the server finishes loading:

```csharp
AccelByteSDK.GetServerRegistry().GetAMS().SendReadyMessage();
```

**Drain signal** — subscribe to the drain callback:

```csharp
AccelByteSDK.GetServerRegistry().GetAMS().OnDrainReceived += HandleDrain;

void HandleDrain()
{
    if (isInSession)
        shouldExitAfterSession = true;
    else
        Application.Quit();
}
```

**Heartbeat** — the Unity SDK sends heartbeats automatically once connected to the watchdog.

#### Raw WebSocket (no SDK support)

If the engine has no AGS SDK, the DS must implement the watchdog protocol directly:

1. On startup, read `DS_ID` from environment.
2. Open WebSocket to `ws://localhost:5555/watchdog` with header `ams-dsid: <DS_ID>`.
3. Once connected and the DS finishes loading, send `{"ready": {"dsid": "<DS_ID>"}}`.
4. Send `{"heartbeat": {}}` every 15 seconds.
5. On receiving `{"drain": {}}`, handle gracefully per the above logic.
6. Optionally send `{"reset_session_timeout": {"new_timeout": <nanoseconds>}}` to extend variable-length sessions.

See `references/overview.md#watchdog-protocol` for the full message shapes.

### Step 3 — Self-claim scenario (optional)

If the DS creates its own game session (rather than AGS Session claiming it), the DS must self-claim after a player joins:

```json
{ "claim": { "sessionId": "<session-id>" } }
```

This is the non-AGS flow. Most studios use the AGS Session / Matchmaking flow where the Session service claims the DS — self-claim is only needed when the DS creates sessions independently.

### Step 4 — Exit behavior

Verify the DS exits correctly:
- **Fatal error** (crash, assertion fail, OOM) → exit with non-zero code. AMS detects the crash, replaces the DS, and (if log sampling is enabled) captures a core dump.
- **Session ends normally** → exit with code 0. AMS returns the VM slot to the pool.
- **Drain received + idle** → exit with code 0 immediately.
- **Drain received + in session** → finish the session, then exit with code 0.

If the DS does not exit after a session, the slot is held forever — the fleet will bleed capacity.

### Step 5 — Required command-line flags

AMS injects these flags into the DS at launch. The DS must accept them (even if it doesn't use all of them):

| Flag | Value injected by AMS |
|---|---|
| `-dsid` | `${dsid}` — the DS identifier |
| `-port` | `${default_port}` — game listen port |
| `-watchdog_url` | `${watchdog_url}` — watchdog WebSocket URL |

If using the AGS SDK, the SDK reads these automatically. For raw WebSocket, parse them at startup.

### Step 6 — Confirm integration checklist

Before handing off to `debug` or `upload`, confirm:

- [ ] DS targets Linux x86/x64
- [ ] Ready signal sent after initialization completes (not on game-loop start)
- [ ] Heartbeat every 15 seconds (SDK auto-handles or custom timer in place)
- [ ] Drain signal handled — ignores if In Session, exits gracefully if idle
- [ ] DS exits with non-zero on fatal error, code 0 on normal end
- [ ] Required AMS flags accepted by the DS command line

Once all items are checked:

> Integration looks complete. To test locally before uploading, run `/ags-ams debug` (AMS Simulator). When ready to upload a build, run `/ags-ams upload`.

## Error Handling

| Situation | Response |
|---|---|
| DS built for Windows or ARM | Stop. AMS requires Linux x86/x64. A Linux build target is required before proceeding. |
| AGS SDK not installed | Direct to `/ags install-unreal-sdk` or `/ags install-unity-sdk`. Don't attempt raw WebSocket as a workaround unless the user confirms no SDK is possible. |
| SDK version unknown | Ask before suggesting specific method names — they differ across major versions. |
| DS crashes during session (non-drain) | Suggest enabling log sampling in fleet config. Core dumps help. See `/ags-ams observe`. |
| Heartbeat timeout: what value? | 15 seconds is the required interval. There's no configurable heartbeat period. |
| User wants to skip drain handling | Explain the consequence: if AMS drains the VM with an active session, players are disconnected mid-game with no graceful cleanup. Strongly recommend implementing it. |
| DS doesn't exit after session ends | This leaks VM capacity — every stuck DS is a slot that can't be used for new sessions. Identify where the process is stuck (likely in a cleanup handler or waiting on a network call) and ensure exit is called. |
