---
last-verified: 2026-07-02
sources:
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/main/Source/AccelByteUe4Sdk/Private/GameServerApi/AccelByteServerAMSApi.cpp
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/main/Source/AccelByteUe4Sdk/Public/GameServerApi/AccelByteServerAMSApi.h
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/main/Source/AccelByteUe4Sdk/Private/Core/AccelByteServerSettings.cpp
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/main/Source/AccelByteUe4Sdk/Private/GameServerApi/AccelByteServerDSHubApi.cpp
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/main/Source/AccelByteUe4Sdk/Public/Models/AccelByteDSHubModels.h
- https://github.com/AccelByte/accelbyte-unreal-oss/blob/main/Source/OnlineSubsystemAccelByte/Private/AsyncTasks/Server/OnlineAsyncTaskAccelByteSendReadyToAMS.cpp
- https://github.com/AccelByte/accelbyte-unreal-oss/blob/main/Source/OnlineSubsystemAccelByte/Private/OnlineSessionInterfaceV2AccelByte.cpp
---

# Engine-Agnostic AMS Connection Flow

Use this reference when the user is building a dedicated server in an engine or language that is not Unreal or Unity. It extracts the behavior implemented by the Unreal SDK and converts it into a portable integration contract.

Public Unreal source files:

- `AccelByteServerAMSApi.cpp` and `.h` for watchdog connect, ready, heartbeat, claim, drain, and timeout messages.
- `AccelByteServerSettings.cpp` for `-dsid`, `-watchdog_url`, `-WatchdogUrl`, and heartbeat launch parsing.
- `AccelByteServerDSHubApi.cpp` and `AccelByteDSHubModels.h` for the DSHub `serverClaimed` topic and payload model.
- `OnlineAsyncTaskAccelByteSendReadyToAMS.cpp` and `OnlineSessionInterfaceV2AccelByte.cpp` for the OSS ordering: AMS connect, DSHub connect, bind session delegates, then send AMS ready.

## What AMS Expects From the Dedicated Server

An AMS-hosted dedicated server process must:

1. Read the AMS runtime values injected at launch.
2. Open the local watchdog WebSocket.
3. Wait until game initialization is actually complete.
4. Send the AMS `ready` message.
5. Start periodic heartbeat messages.
6. Listen for AMS `drain` messages.
7. Optionally integrate DSHub if the game uses AGS Session/Matchmaking notifications.
8. Exit cleanly when the match is over or when drained while idle.

The important behavior from Unreal is ordering: ready is not sent just because the process starts. In the OSS flow, Unreal connects AMS first, then connects DSHub and binds session notifications, then sends AMS ready. For non-Unreal engines, keep the same principle: do not mark the server ready until the process can accept the claim/session path you rely on.

## Expected AGS Session + AMS Lifecycle

Use this lifecycle when AGS Session/Matchmaking owns server assignment:

1. AMS spawns the DS process with launch values such as `-dsid`, `-watchdog_url`, and `-port`.
2. The DS initializes, connects to the AMS watchdog, connects DSHub if it needs AGS Session notifications, then sends watchdog `ready`.
3. Watchdog `ready` means the DS is claimable by AMS. It does not mean a game session is already assigned.
4. AGS Session creates or updates the game session and claims an AMS DS for that session.
5. The DS receives the DSHub `serverClaimed` event with `payload.session_id`.
6. The DS fetches the full game session details, binds that session locally, and only then treats itself as ready for the players assigned to that session to connect.
7. AMS may later send watchdog `drain`.
8. On drain, if the DS is idle or has no active players/session work, exit with code `0`. If the DS still has active players or an active game session, stop accepting new work, wait until the session is ended/deactivated, then exit with code `0`.

## Launch Inputs

AMS passes the dedicated server identity and watchdog endpoint through command-line arguments. A custom runtime should accept these names:

| Input | Purpose |
|---|---|
| `-dsid` | Dedicated server ID. Required. Unreal refuses AMS connection when this is empty. |
| `-watchdog_url` | AMS watchdog WebSocket URL. Optional fallback is the local watchdog URL. |
| `-WatchdogUrl` | Alternate Unreal-compatible spelling. |
| `-heartbeat` | Optional heartbeat interval override in seconds. Default is 15. |
| `-port` | Game listen port. Needed by the game/network layer even though watchdog messages do not include it. |

Unreal also supports AccelByte-prefixed config switches internally, but custom engines should at minimum support the plain flags above.

Default watchdog URL for local simulator-style environments:

```text
ws://localhost:5555/watchdog # nosemgrep: detect-insecure-websocket -- AMS watchdog is local to the DS host and intentionally uses ws://.
```

## Watchdog WebSocket

Open a WebSocket connection to the watchdog URL. The Unreal SDK creates a WebSocket using the watchdog URL and server credentials object, but the AMS messages themselves are simple JSON objects.

Minimum connection behavior:

- Fail startup or stay Not Ready if `dsid` is missing.
- Connect to `watchdog_url` or the local default.
- Reconnect on transient socket loss if the runtime can do so safely.
- Log connection closed/error events with enough detail to diagnose `1006` and other abnormal closes.

## Message Shapes

Send ready after initialization:

```json
{"ready":{"dsid":"<dsid>"}}
```

Start heartbeat after ready. The Unreal SDK starts the heartbeat ticker only after sending ready:

```json
{"heartbeat":{}}
```

Send heartbeat every 15 seconds unless AMS has explicitly provided a different interval for your environment. Do not wait for the first heartbeat before sending ready.

If the server creates or owns its own session and must self-claim, send:

```json
{"claim":{"sessionId":"<session-id>"}}
```

Most AGS Session/Matchmaking flows do not need self-claim from game code because the Session service claims the DS. Use self-claim only for a custom flow where the DS independently creates/owns the session.

To change a running DS session timeout:

```json
{"resetSessionTimeout":{"newTimeout":"<seconds>"}}
```

To restore the fleet-configured timeout:

```json
{"resetSessionTimeout":{}}
```

## Drain Handling

AMS sends a watchdog message with a `drain` object:

```json
{"drain":{}}
```

On drain:

- If idle/Ready and not hosting a match, stop accepting work and exit with code `0`.
- If In Session, stop accepting new work, let the current match finish, then exit with code `0`.
- Do not disconnect from AMS/DSHub immediately just because drain arrived; keep enough connectivity to finish the session and report normal termination.

Fatal process errors should still exit non-zero so AMS can classify the server as failed rather than gracefully completed.

## DSHub When Using AGS Sessions

The watchdog tells AMS whether the process is alive and claimable. DSHub is the session-notification WebSocket used by the Unreal OSS layer for events such as:

- server claimed
- backfill proposal
- backfill ticket expired
- session member changed
- session ended
- session server secret update

For an engine-agnostic implementation, decide whether your game needs DSHub:

- If the server only needs watchdog readiness and a custom service handles session delivery, DSHub may be unnecessary.
- If the server relies on AGS Session/Matchmaking to notify it about claims, backfill, members, or session end, implement the DSHub connection before sending watchdog ready.

The Unreal OSS flow does this:

1. Connect AMS watchdog.
2. Connect DSHub with the DS ID as the bound server name.
3. Bind DSHub notification handlers.
4. Send AMS ready.

DSHub uses the AGS server DSHub URL, server credentials, and headers identifying the bound server. In AMS mode, Unreal marks the connection as not using a custom DS manager.

### Server Claimed Event

The claim event is a DSHub notification, not an AMS watchdog message. In the Unreal SDK, DSHub parses messages with a `topic` and `payload`. The dedicated-server claim topic is:

```text
serverClaimed
```

The payload is converted into `FAccelByteModelsServerClaimedNotification` with these fields:

```json
{
  "game_mode": "<match/game mode>",
  "matching_allies": [],
  "namespace": "<game namespace>",
  "session_id": "<game-session-id>"
}
```

Field casing can differ by language JSON mapper. The Unreal model uses `Game_mode`, `Matching_allies`, `Namespace`, and `Session_id`; the JSON payload should be treated as the wire contract.

On `serverClaimed`, the Unreal OSS flow:

1. Ignores the event if the process is not a dedicated server.
2. Ignores the event if the server already has a local game session.
3. Reads `payload.session_id`.
4. Calls the Session service to fetch the full game session details for that session ID.
5. Stores/updates local session state and then lets game code react to the session being assigned.

For a custom engine, implement the same behavior:

```pseudo
dshub.on_message = (message) => {
    envelope = parse_json(message)
    if envelope.topic == "serverClaimed":
        session_id = envelope.payload.session_id
        if not current_game_session:
            session = session_service.get_game_session(session_id)
            bind_session_to_server(session)
            state = IN_SESSION
}
```

Do not confuse this with the optional watchdog `claim` message:

```json
{"claim":{"sessionId":"<session-id>"}}
```

`serverClaimed` is inbound from DSHub when AGS Session/Matchmaking claims the DS. The watchdog `claim` message is outbound from the DS and is only for custom/self-claim flows where the DS independently owns or creates the session.

## Recommended State Machine

```text
STARTING
  parse dsid/watchdog_url/port
  initialize game server, map, gameplay services
  connect watchdog
  if using AGS Sessions: connect DSHub and bind handlers
  send ready
  start heartbeat
READY
  wait for DSHub serverClaimed/session assignment
IN_SESSION
  run match
  on normal match end: cleanup and exit 0
DRAINING
  if idle: exit 0
  if in session: finish match, then exit 0
FAILED
  fatal error: exit non-zero
```

Do not send ready from `main()` or the first game-loop tick. Send it after the network listener, map load, gameplay services, and session-notification path are ready.

## Minimal Pseudocode

```pseudo
config = parse_args()
require config.dsid

watchdog_url = config.watchdog_url or "ws://localhost:5555/watchdog" # nosemgrep: detect-insecure-websocket -- AMS watchdog is local to the DS host and intentionally uses ws://.
heartbeat_seconds = config.heartbeat or 15

initialize_game_server(config.port)

watchdog = websocket_connect(watchdog_url)
watchdog.on_message = (message) => {
    json = parse_json(message)
    if json has key "drain":
        if state == IN_SESSION:
            state = DRAINING
            exit_after_match = true
        else:
            graceful_shutdown(exit_code = 0)
}

if uses_ags_sessions:
    dshub = connect_dshub(bound_server_name = config.dsid)
    bind_session_claim_backfill_member_and_end_handlers(dshub)

watchdog.send({"ready": {"dsid": config.dsid}})
start_repeating_timer(heartbeat_seconds, () => {
    if watchdog.is_connected:
        watchdog.send({"heartbeat": {}})
})

state = READY
run_server_loop()
```

## Common Failure Points

| Symptom | Likely cause |
|---|---|
| AMS Simulator says no connected dedicated server | Missing/incorrect `-dsid`, wrong `-watchdog_url`, server never opened the watchdog WebSocket, or stale process. |
| Watchdog connects then closes abnormally | Inspect DS ID, watchdog URL, local simulator state, server credentials/config, and WebSocket close reason. |
| Server appears connected but is never claimable | Ready was never sent, ready was sent before required session notification path was ready, or heartbeat never started after ready. |
| Server gets claimed but game code never sees the session | DSHub/session notification path is missing or connected after ready. |
| Fleet capacity leaks | DS does not exit after normal session end or drain-idle path. |

## Agent Checklist

When helping a non-Unreal/non-Unity user, verify:

- [ ] Dedicated server target is Linux x86/x64 for AMS upload.
- [ ] Runtime accepts `-dsid`, `-watchdog_url`, `-WatchdogUrl`, `-heartbeat`, and `-port`.
- [ ] Watchdog WebSocket connects before ready is sent.
- [ ] Ready message includes the same DS ID from launch input.
- [ ] Heartbeat starts after ready and repeats every 15 seconds by default.
- [ ] Drain message is handled without dropping active matches.
- [ ] DSHub or an equivalent session-notification path is in place before ready when AGS Sessions/Matchmaking are used.
- [ ] Process exits `0` for normal completion/drain and non-zero for fatal errors.
