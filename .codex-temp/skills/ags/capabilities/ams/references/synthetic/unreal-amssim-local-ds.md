---
last-verified: 2026-05-25
sources:
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/play/module-session-ds-ams/unreal-module-ds-ams-test-local-ds/
---

# Unreal AMS Simulator Local DS

Use this synthetic reference when an agent is actively testing an Unreal dedicated server with `amssim` and needs an operational diagnosis path. This captures observed failure modes and tool behavior that are not all obvious from the public docs.

## Version-Bound Reference

This reference was verified against AMS Simulator 1.41.765.2026.March.30.f48b5c8bf51bb21d37d08acf2b8b79d996e097f4. Before using this reference, run `amssim --help` and `amssim run --help` against the simulator binary in the user's environment, then update this reference if the flag names or defaults differ.

## Rules That Prevent Confusion

- `-dsid` must use a simulator-provided `ds_<uuid>` value. Do not use a friendly local server name as `-dsid`.
- `ServerName` / `server_name` is for AGS local-server claim targeting, not watchdog identity.
- `amssim run --configPath <file>` is the config-file flag. Do not use `--config`.
- `amssim run` creates `config.json` if it is missing.
- `amssim ds status` is the first truth check after launching the DS.
- Do not start matchmaking/session claim testing until the watchdog test has a connected DS and ready/heartbeat behavior.
- Redact `ClientSecret`, access tokens, refresh tokens, authorization headers, and full OAuth responses before sharing logs. If a real secret or token was written to a tracked file, terminal transcript, or shared log, tell the user to rotate it.
- In the Unreal OSS path, watchdog connection is not the same as DS ready. Ready can depend on DS Hub/session registration before `SendServerReady`.
- If DS Hub/session registration fails, do not use simulator `ds ready` to pretend the DS sent ready. Report `watchdog connected; ready path blocked by DS Hub; claim/travel not verified`.

## Simulator Commands

Start with the default config in the working directory:

```powershell
.\amssim.exe run
```

Start with an explicit config:

```powershell
.\amssim.exe run --configPath "C:\path\to\config.json"
```

Useful interactive commands:

```text
info
ds status
ds ready
ds claim
ds drain
help
exit
```

The simulator prints:

<!-- nosemgrep: detect-insecure-websocket -- AMS Simulator prints a local-only non-TLS watchdog URL. -->
- Watchdog URL, usually `ws://0.0.0.0:5555/watchdog`
- Session ID and `session\<session-id>.log`
- A copyable DS ID such as `ds_019e43ef-1fe4-70a7-afe9-25490c8442b9`

<!-- nosemgrep: detect-insecure-websocket -- AMS local simulator watchdog intentionally uses loopback ws://. -->
Use `ws://localhost:5555/watchdog` from the local DS process unless the simulator is bound to a different port. Use the printed `ds_<uuid>` as `-dsid`.

## Unreal Launch Checklist

The server command should include:

```powershell
-server
-log
-nosteam
-port=7777
# nosemgrep: detect-insecure-websocket -- AMS local simulator watchdog intentionally uses loopback ws://.
-watchdog_url="ws://localhost:5555/watchdog"
-dsid=ds_00000000-0000-0000-0000-000000000000
```

DDC is not an AMS product requirement. Use this only when `UnrealEditor-Cmd.exe` crashes before map load because the default DDC or Zen cache is invalid or unwritable. Retry with `-DDC=NoZenLocalFallback -LocalDataCachePath=Saved/DDC` and report that as an environment fallback, not a product requirement.

Configure the server-side AGS credentials in `Config/DefaultEngine.ini` instead of passing them on the command line:

```ini
[/Script/AccelByteUe4Sdk.AccelByteServerSettings]
ClientId=<confidential-server-client-id>
ClientSecret=<confidential-server-client-secret>
Namespace=<game-namespace>
PublisherNamespace=<publisher-namespace>
; nosemgrep: detect-insecure-http -- OAuth loopback redirect URI is local-only and required by the client flow.
RedirectURI="http://127.0.0.1"
BaseUrl="https://<ags-environment-host>"
```

Prefer ignored local config or environment-specific config handling for server secrets. `DefaultEngine.ini` is acceptable only when the project treats the value as local and ignored. Command-line credentials are easy to leak through process listings, terminal history, logs, and copied launch commands. Never commit real secrets into a public repository.

The Unreal SDK accepts AMS values from command-line switches. Known accepted forms include `-watchdog_url=...` / `-WatchdogUrl=...` and `-dsid=...`. Missing DS ID should produce a log that asks for `-dsid=${dsid}` or the AccelByte DS ID switch.

## Ordered Diagnosis

When local AMS testing fails, diagnose in this order:

1. **Simulator running**: `amssim run` is still open, shows `Ready to accept local DS`, and `info` shows the expected watchdog URL.
2. **Valid DS launch args**: Unreal server command includes `-server`, `-dsid=ds_<uuid>`, `-watchdog_url=...`, and `-port` if the project needs it.
3. **Server AGS config**: `Config/DefaultEngine.ini` has valid `[/Script/AccelByteUe4Sdk.AccelByteServerSettings]` values for base URL, namespace, publisher namespace, confidential client ID, and secret. A public game client ID is not enough for the DS.
4. **SDK AMS enabled**: `bServerUseAMS=True` is loaded by the server process.
5. **Watchdog connection**: `amssim ds status` reports a connected DS.
6. **Ready signal and DS Hub path**: only after the DS is connected, confirm DS Hub/session registration and `SendServerReady()` or auto-ready behavior. If DS Hub returns 404 or another backend error before ready, stop and report `watchdog connected; ready path blocked by DS Hub; claim/travel not verified`.
7. **Claim flow**: only after Ready, test local DS claiming with matching `ServerName` / `server_name`, claim keys, and session template.

If `amssim ds status` says `no connected dedicated server`, stay at step 5. Do not debug matchmaking yet.

## Log Patterns

Search Unreal logs for:

```text
ServerAMS
watchdog
DS Id
LoginWithClientCredentials
Failed to authenticate server
Invalid URL
Connection closed
1006
bServerUseAMS
```

Common interpretations:

| Signal | Likely Cause |
|---|---|
| `DS Id is not defined` | Missing or malformed `-dsid`; use the `ds_<uuid>` printed by `amssim`. |
| `no connected dedicated server` in `amssim` | DS never completed watchdog connection; check DS ID, watchdog URL, stale server processes, and server AGS config. |
| Invalid OAuth URL such as `/iam/v3/oauth/token` | Base URL is missing or not loaded by the server process. |
| `Failed to authenticate server` / `LoginWithClientCredentials` failure | Server client credentials are missing, wrong, public-client credentials were used, or namespace/base URL is wrong. |
| WebSocket close `1006` | Watchdog connection opened but closed abnormally; inspect surrounding auth/config and AMS logs before assuming ready/heartbeat code is wrong. |

## ServerName Claim Targeting

For local DS claim tests:

- `config.json` must contain `ServerName`.
- The client/session request must pass the same value as Unreal `SETTING_GAMESESSION_SERVERNAME` or raw `server_name`.
- Claim keys still need to match the session template.

If the local DS is Ready but not claimed, verify `ServerName` and `server_name` first, then claim keys.
