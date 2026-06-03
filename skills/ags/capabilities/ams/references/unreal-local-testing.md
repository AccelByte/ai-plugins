---
last-verified: 2026-05-26
sources:
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/play/module-session-ds-ams/unreal-module-ds-ams-test-local-ds/
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/play/module-session-ds-ams/unreal-module-ds-ams-implement-subsystem/
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/play/module-session-ds-ams/unreal-module-ds-ams-server-configuration/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/register-local-dedicated-servers/
see-also:
- '[unreal-amssim-local-ds.md](synthetic/unreal-amssim-local-ds.md)'
- '[amssim-command-reference.md](synthetic/amssim-command-reference.md)'
- '[unreal-linux-server-packaging.md](synthetic/unreal-linux-server-packaging.md)'
---

# Unreal Local AMS Testing

Use this reference when an Unreal project needs a local AMS watchdog test with the AMS Simulator before uploading a Linux dedicated server build.

## Local Server Options

Unreal local AMS testing has two useful shapes:

- **Packaged Windows dedicated server**: closer to an actual server runtime and uses fewer resources, but requires packaging first.
- **Uncooked editor server**: faster iteration through `UnrealEditor.exe -server`, but uses more resources.

For AMS upload and fleets, package a **Linux x86/x64** dedicated server build. Windows local tests only validate the game server's AMS behavior before upload.

## AMS Simulator Setup

1. Download AMS Simulator for Windows from the Admin Portal: Multiplayer / AccelByte Multiplayer Servers > Download Resource.
2. Create an IAM client for AMS Simulator using the Dedicated Server Tools template, then ensure it has `NAMESPACE:{namespace}:AMS:LOCALDS [CREATE]`.
3. Generate the simulator config:

```powershell
.\amssim.exe generate-config
```

For full `amssim` command and interactive-control details, see `synthetic/amssim-command-reference.md` before running.

4. Fill in `config.json` with the target AGS environment, namespace, IAM client ID/secret, local DS host/port, claim keys, and `ServerName`.
5. Start the simulator from the directory that contains `config.json`:

```powershell
.\amssim.exe run --configPath config.json
```

`amssim` prints a local DS ID such as `ds_<uuid>`. Use that value when launching the Unreal server. In AMS proper, AMS supplies this launch parameter automatically. For practical troubleshooting details, including `--configPath`, `ds status`, and common Unreal launch failures, use `synthetic/unreal-amssim-local-ds.md`.

## ServerName Requirement For Local DS Claims

`ServerName` is the identifier AGS uses to target a specific registered local DS. To make a client/session claim this local server instead of a fleet server:

1. Set `ServerName` in `config.json`, for example:

```json
{
  "ServerName": "my-local-ds"
}
```

2. Pass the same value from the Unreal client when creating matchmaking/session attributes. In Unreal, this is typically the `SETTING_GAMESESSION_SERVERNAME` value; in raw attributes it maps to `server_name`.

3. If your game also reads a local command-line override, pass the same name to the server and clients:

```powershell
-ServerName=my-local-ds
```

The names must match exactly. Without a matching `server_name` / `SETTING_GAMESESSION_SERVERNAME` value, the local DS can still register and become Ready, but the session may claim any matching AMS server based on claim keys rather than this specific local DS.

## Launch The Unreal Server

Packaged server example:

```powershell
& "C:\WindowsServer\MyProjectServer.exe" `
  -server `
  -log `
  -nosteam `
  -dsid=ds_00000000-0000-0000-0000-000000000000 `
  -watchdog_url="ws://localhost:5555/watchdog" # nosemgrep: detect-insecure-websocket -- AMS Simulator local watchdog intentionally uses loopback ws://.
```

Uncooked editor server example:

```powershell
& "C:\path\to\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" `
  "C:\path\to\MyGame\MyGame.uproject" `
  -server `
  -log `
  -nosteam `
  -dsid=ds_00000000-0000-0000-0000-000000000000 `
  -watchdog_url="ws://localhost:5555/watchdog" # nosemgrep: detect-insecure-websocket -- AMS Simulator local watchdog intentionally uses loopback ws://.
```

<!-- nosemgrep: detect-insecure-websocket -- AMS Simulator local watchdog intentionally uses loopback ws://. -->
`-watchdog_url` is explicit here so the simulator target is visible in scripts and logs. The default AMS Simulator URL is `ws://localhost:5555/watchdog`; change the value if `config.json` uses a different watchdog port.

## Optional Editor Clients

Launch one or more editor game clients when the test also needs local join / travel behavior:

```powershell
& "C:\path\to\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" `
  "C:\path\to\MyGame\MyGame.uproject" `
  -game `
  -log `
  -WINDOWED `
  -ResX=1280 `
  -ResY=720
```

If testing a named local server / session route, pass the same server name to both the server and clients:

```powershell
-ServerName=my-local-ds
```

## What To Verify

The Unreal server log should show AMS connection lines similar to:

```text
LogAccelByteAMS: Connecting to <watchdog-url>
LogAccelByteAMS: Connected
```

The `amssim` output should show:

1. The Unreal server connects to the watchdog.
2. The server sends ready after initialization.
3. Heartbeats arrive about every 15 seconds.
4. Drain handling exits cleanly when the server is idle, or after the active session ends.

If `amssim` never receives ready, check that `bServerUseAMS=True` is set and that the Unreal code reaches `SendServerReady()` or the project's equivalent server-ready path after initialization.

For failure diagnosis, use the synthetic reference `synthetic/unreal-amssim-local-ds.md`.

## Packaging Boundary

Local testing can be done with a Windows packaged server or with `UnrealEditor.exe -server`. AMS upload and fleets require a Linux x86/x64 dedicated server build. After local watchdog behavior is confirmed, package/build the Linux server target. Use `synthetic/unreal-linux-server-packaging.md` for a RunUAT Linux server packaging example, then use `/ags ams upload`.
