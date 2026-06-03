---
last-verified: 2026-05-20
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/configure-P2P-matchmaking-oss/
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/play/module-quick-match-p2p/
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/play/module-quick-match-p2p/unreal-module-quick-match-p2p-implement-subsystem
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/play/module-match-session-p2p/
- https://docs.accelbyte.io/gaming-services/tutorials/byte-wars/unreal-engine/learning-modules/play/module-match-session-p2p/unreal-module-joinable-session-p2p-implement-subsystem/
- https://github.com/AccelByte/accelbyte-unreal-oss
- https://github.com/AccelByte/accelbyte-unreal-network-utilities
see-also:
- '[unreal.md](unreal.md)'
- '[unreal-verification.md](unreal-verification.md)'
- '[unreal-install.md](unreal/install.md)'
- '[session.md](../../modules/session.md)'
- '[lobby-session.md](../../integrate/lobby-session.md)'
---

# Unreal P2P Sessions

Use this reference when an Unreal project needs peer-to-peer session connectivity through `OnlineSubsystemAccelByte`. This covers both player-created/joinable sessions and matchmaking-created sessions.

The P2P path is not a standalone Unreal integration. It needs the normal AGS Unreal plugin set plus the AccelByte Network Utilities net driver:

- `OnlineSubsystemAccelByte`
- `AccelByteUe4Sdk`
- `AccelByteNetworkUtilities`

P2P sessions are Session V2 game sessions with server type `P2P`. They do not require AMS by default. AMS is for dedicated-server session outcomes.

## Required Config

Add the OSS, Network Utilities, and net driver config to `Config/DefaultEngine.ini`.

```ini
[OnlineSubsystemAccelByte]
bEnableV2Sessions=true

[AccelByteNetworkUtilities]
UseTurnManager=true
bNonSeamlessTravelUseNewConnection=true
HostCheckTimeout=5

[/Script/AccelByteNetworkUtilities.IpNetDriverAccelByte]
NetConnectionClassName=AccelByteNetworkUtilities.IpConnectionAccelByte
AllowDownloads=false

[/Script/Engine.Engine]
!NetDriverDefinitions=ClearArray
+NetDriverDefinitions=(DefName="GameNetDriver",DriverClassName="/Script/AccelByteNetworkUtilities.IpNetDriverAccelByte",DriverClassNameFallback="/Script/OnlineSubsystemUtils.IpNetDriver")
+NetDriverDefinitions=(DefName="DemoNetDriver",DriverClassName="/Script/Engine.DemoNetDriver",DriverClassNameFallback="/Script/Engine.DemoNetDriver")
```

If `[OnlineSubsystemAccelByte]` already exists, merge `bEnableV2Sessions=true` into the existing section instead of creating a duplicate section.

The `NetDriverDefinitions` lines must stay on one physical line each. Do not wrap the `DriverClassName="/Script/..."` value across lines. Unreal treats that as a malformed quoted string and `GameNetDriver` resolves to an invalid class.

## Non-Seamless Travel

Set `bNonSeamlessTravelUseNewConnection=true` whenever the project uses non-seamless travel for P2P sessions.

Without this setting, Unreal's base `UIpConnection` path can try DNS resolution against AccelByte's P2P address format. That address is not a DNS hostname, so address resolution can fail and surface as a network/travel error.

## Entry Points

There are two common ways to arrive at the same P2P travel path:

- **Custom / joinable session** - one player creates a P2P game session, other players browse or find sessions, then join the selected session.
- **Matchmaking-created session** - the client starts matchmaking, AGS creates or returns a P2P game session when a match is found, then each matched player joins that result.

In both paths, the project still needs the required config above, a P2P session template, `JoinSession(...)`, and host/member travel handling.

## Custom Session Flow

Use this path for player-created sessions, custom lobbies, match browsers, invite flows, or any flow where the game creates a session directly instead of entering matchmaking.

Create session:

1. Get the subsystem with `Online::GetSubsystem(GetWorld())`.
2. Get the AccelByte OSS Session V2 interface.
3. Build `FOnlineSessionSettings` for the game mode.
4. Set the session template/name expected by the project and backend configuration.
5. Ensure the chosen backend session template uses server type `P2P`.
6. Bind `FOnCreateSessionCompleteDelegate`.
7. Call `CreateSession(...)`.
8. After create succeeds, the creator is the P2P host and should travel to the gameplay map with `?listen`.

Browse and join session:

1. Create a session search handle for the browser/filter UI.
2. Call `FindSessions(...)` or the project wrapper around it.
3. Present valid P2P game-session results to the player.
4. Bind `FOnJoinSessionCompleteDelegate`.
5. Call `JoinSession(...)` with the selected search result.
6. Use the shared P2P travel handling below after join succeeds.

Byte Wars' Joinable Sessions with P2P module separates this into an Online Session class for client session actions and a Game Instance subsystem for server/listen-host logic. Other projects can use different class boundaries, but the OSS flow is the same: create or find a P2P game session, join it, then travel.

## Matchmaking Flow

Start P2P matchmaking through the AccelByte OSS Session V2 interface:

1. Get the subsystem with `Online::GetSubsystem(GetWorld())`.
2. Get the session interface and cast it to the AccelByte Session V2 interface type used by the installed OSS version.
3. Create `FOnlineSessionSearchAccelByte`.
4. Set `SETTING_SESSION_MATCHPOOL` to the target match pool name.
5. Call `SetIsP2PMatchmaking(true)` on the search handle so TURN QoS/P2P matchmaking is used.
6. Call `StartMatchmaking(...)` with `NAME_GameSession`, empty `FOnlineSessionSettings()`, and the search handle.
7. Keep the search handle alive so `SearchResults` can be read when matchmaking completes.

The local client must already be authenticated and connected to Lobby before starting matchmaking.

## Shared Join And Travel

For matchmaking, `OnMatchmakingComplete` gives you a search result. For custom/joinable sessions, the selected browse result is already the session search result. Before calling `JoinSession(...)`:

1. Read the first result from the saved search handle's `SearchResults`.
2. Confirm the result is a game session.
3. Destroy any existing local `NAME_GameSession` before joining the returned session.
4. Bind `FOnJoinSessionCompleteDelegate`.
5. Call `JoinSession(...)` with `NAME_GameSession` and the returned search result.

When `OnJoinSessionComplete` succeeds:

1. Read the named game session from the session interface.
2. Cast `SessionInfo` to the AccelByte Session V2 session info type used by the installed OSS version.
3. Confirm `SessionInfo->GetServerType()` is `P2P`.
4. Resolve the connect string with `GetResolvedConnectString(SessionName, TravelUrl, NAME_GamePort)`.
5. If `IsPlayerP2PHost(...)` returns true, the host travels to the map with `?listen`.
6. Otherwise, the member client travels to the resolved P2P connect string.

Host example:

```cpp
Controller->ClientTravel(FString::Printf(TEXT("%s?listen"), *MapName), TRAVEL_Absolute);
```

Member example:

```cpp
Controller->ClientTravel(TravelUrl, TRAVEL_Absolute);
```

## Admin Portal Requirements

Before client code can complete the flow:

- The game client must have Session V2 permissions.
- Matchmaking flows also require Matchmaking permissions.
- Matchmaking flows need the match pool to refer to a session template whose session type is `P2P`.
- The session template must define the map/session settings the Unreal client expects.
- Custom / joinable session flows need open or otherwise appropriate joinability on the P2P session template.

In Byte Wars, both the Quick Match P2P tutorial and Joinable Sessions with P2P tutorial use P2P session templates for the supported game modes. The quick-match path adds matchmaking configuration; the joinable-session path creates, browses, and joins sessions directly.

## Troubleshooting

| Symptom | First check |
|---|---|
| `ReadToken: Bad quoted string: "/Script/` followed by `ImportText (NetDriverDefinitions)` | A `NetDriverDefinitions` value was line-wrapped. Put each `+NetDriverDefinitions=(...)` entry on one line. |
| `CreateNamedNetDriver failed to create driver from definition GameNetDriver` / `NetDriverCreateFailure` | Check malformed `NetDriverDefinitions` first, then verify `AccelByteNetworkUtilities` is installed and enabled. |
| Non-seamless P2P travel fails with address resolution or network errors | Verify `bNonSeamlessTravelUseNewConnection=true` exists under `[AccelByteNetworkUtilities]`. |
| Session create/find/matchmaking succeeds but no P2P travel happens | Verify the client calls `JoinSession(...)`, handles `OnJoinSessionComplete`, checks server type `P2P`, and calls `ClientTravel(...)` for both host and members. |
| P2P/TURN behavior needs forced relay for debugging | Launch the game with `-iceforcerelay` to force Relay/TURN ICE behavior. |
