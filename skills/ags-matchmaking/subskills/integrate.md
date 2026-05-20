---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrating-matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/unity-integrating-matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/record-exclude-sessions/
see-also:
- '[overview.md](../references/overview.md)'
---

# AGS Matchmaking — SDK Integrator

Wire AGS Matchmaking into a game using the Unreal or Unity SDK. Covers QoS measurement, ticket submission, cancellation, match notification, and session join. Produces working code snippets the user can adapt.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before quoting any SDK call, type name, or delegate name. Do not restate SDK signatures from training memory — the reference is the source of truth.
- SDK method names and parameters come only from the reference. Do not invent method signatures.
- If a question needs a specific SDK version detail, configuration file path, or Admin Portal step not in the reference, say so and point to `https://docs.accelbyte.io/`.

</grounding_rules>

<tool_usage_rules>

- Use `Read` to read existing project files the user points to (e.g. a session settings header, a lobby manager class).
- Use `Bash` to check whether the AGS SDK is already installed: `find . -name "AccelByteUe4Sdk.uplugin" 2>/dev/null` (Unreal) or `find . -name "com.accelbyte.unity.sdk*" 2>/dev/null` (Unity).
- Use `Edit` or `Write` to produce code snippets into project files when the user asks.
- Do not run builds or package managers from this subskill — redirect to `/ags install-unity-sdk` or `/ags install-unreal-sdk` if the SDK isn't installed.

</tool_usage_rules>

<output_contract>

Produce working code snippets with:
1. **QoS measurement** — measure region latencies before submitting a ticket.
2. **Ticket submission** — call the matchmaking API with the pool name and any custom attributes.
3. **Status polling / notification** — how to know when a match is found.
4. **Ticket cancellation** — how to cancel if the player backs out.
5. **Session join** — how to join the session created by the match.

For Unreal: C++ snippets with the Online Subsystem AccelByte API.
For Unity: C# snippets with the `MatchmakingV2` namespace.

After the snippets:
- **Integration checklist** — 6-item list (QoS, ticket submission, status handling, cancellation, join, error handling).
- **Next step** — "Run `/ags-matchmaking debug` to test the flow end-to-end."

</output_contract>

<completeness_contract>

Integration is complete when:
- QoS measurement is wired (players submit latency maps, not empty objects).
- Ticket submission uses the correct pool name.
- The match-found notification is handled and the session join is triggered.
- Ticket cancellation is handled for the "back" button case.
- Error paths (expired ticket, server error) are handled.

</completeness_contract>

<empty_result_recovery>

If the engine and SDK aren't specified, ask:
1. **Engine:** Unreal or Unity?
2. **SDK already installed?** If not, run `/ags install-unreal-sdk` or `/ags install-unity-sdk` first.
3. **Pool name** — which match pool should the ticket target?
4. **Custom attributes** — any ticket attributes beyond the defaults (e.g. MMR value, rank tier, preferred game mode)?

</empty_result_recovery>

## Workflow

### Step 1 — Read the reference

Read `references/overview.md`, specifically the Unreal SDK and Unity SDK sections.

### Step 2 — Detect SDK (optional)

If the user is in a project directory:

```bash
# Unreal
find . -name "AccelByteUe4Sdk.uplugin" 2>/dev/null | head -1
# Unity
find . -path "*/Packages/com.accelbyte.unity.sdk*" 2>/dev/null | head -1
```

If not found, tell the user to run `/ags install-unreal-sdk` or `/ags install-unity-sdk` first.

### Step 3 — Produce the integration code

#### Unreal

**Step A — QoS measurement**

```cpp
// Call before submitting a ticket. Results are used automatically by the SDK
// when building the latency map for the ticket.
IOnlineSubsystem* Subsystem = IOnlineSubsystem::Get(ACCELBYTE_SUBSYSTEM);
IOnlineSessionPtr SessionInterface = Subsystem->GetSessionInterface();

// Start QoS ping to all registered regions
SessionInterface->QueryServerRegions();
// Wait for OnQueryServerRegionsComplete delegate, then proceed to ticket submission.
```

**Step B — Ticket submission**

```cpp
FOnlineSessionSettings SessionSettings;
SessionSettings.Set(
    SETTING_SESSION_MATCHPOOL,
    FString(TEXT("my-pool-name")),
    EOnlineDataAdvertisementType::ViaOnlineService
);
// Add custom attributes if needed:
SessionSettings.Set(FName("mmr"), 1500, EOnlineDataAdvertisementType::ViaOnlineService);

// The local player index (0 for single local player)
SessionInterface->StartMatchmaking(
    TArray<FSessionMatchmakingUser>{{0}},
    NAME_GameSession,
    FOnlineSessionSettings(),
    SessionSettings,
    OnMatchmakingCompleteDelegate
);
```

**Step C — Match found notification**

```cpp
// Bind before calling StartMatchmaking
FOnMatchmakingCompleteDelegate OnMatchmakingCompleteDelegate =
    FOnMatchmakingCompleteDelegate::CreateUObject(
        this, &UMyGameInstance::OnMatchmakingComplete
    );

void UMyGameInstance::OnMatchmakingComplete(FName SessionName, bool bWasSuccessful)
{
    if (!bWasSuccessful)
    {
        // Ticket expired, error, or cancelled — update UI
        return;
    }
    // Match found — join the session
    // Note: verify GetSessionResult is the correct result-retrieval method for your SDK version
    SessionInterface->JoinSession(0, SessionName, *SessionInterface->GetSessionResult(SessionName));
}
```

**Step D — Cancellation**

```cpp
SessionInterface->CancelMatchmaking(0, NAME_GameSession);
```

**Step E — Session join**

```cpp
// Triggered from OnMatchmakingComplete
SessionInterface->JoinSession(0, NAME_GameSession, MatchResult);
// Bind OnJoinSessionComplete to handle success/failure and travel to the server
```

---

#### Unity

**Step A — QoS measurement**

```csharp
using AccelByte.Api;
using AccelByte.Core;

QosManager qosManager = AccelByteSDK.GetClientRegistry().GetApi().GetQosManager();
qosManager.GetServerLatencies(result =>
{
    if (result.IsError)
    {
        Debug.LogError("QoS failed: " + result.Error.Message);
        return;
    }
    latencies = result.Value; // Dictionary<string, int> — pass to CreateMatchmakingTicket
});
```

**Step B — Ticket submission**

```csharp
MatchmakingV2 matchmaking = AccelByteSDK.GetClientRegistry().GetApi().GetMatchmakingV2();

// Pass latency map from QoS step above as sessionAttributesJson
var attributes = new Dictionary<string, object> { { "mmr", 1500 } };

matchmaking.CreateMatchmakingTicket(
    "my-pool-name",
    attributes,
    result =>
    {
        if (result.IsError)
        {
            Debug.LogError("Ticket creation failed: " + result.Error.Message);
            return;
        }
        currentTicketId = result.Value.matchTicketId;
        // Start polling for match notification (or use Lobby websocket events)
    }
);
```

**Step C — Match found (Lobby websocket)**

```csharp
// The match notification arrives via the Lobby websocket — wire it up before submitting a ticket
Lobby lobby = AccelByteSDK.GetClientRegistry().GetApi().GetLobby();
lobby.MatchmakingV2MatchFound += OnMatchFound;

void OnMatchFound(Result<MatchmakingV2MatchFoundNotif> result)
{
    if (result.IsError) return;
    string sessionId = result.Value.id;
    JoinSession(sessionId);
}
```

**Step D — Cancellation**

```csharp
matchmaking.DeleteMatchmakingTicket(currentTicketId, result =>
{
    if (result.IsError)
        Debug.LogError("Cancel failed: " + result.Error.Message);
});
```

**Step E — Session join**

```csharp
Session session = AccelByteSDK.GetClientRegistry().GetApi().GetSession();
session.JoinGameSession(sessionId, result =>
{
    if (result.IsError)
    {
        Debug.LogError("Join failed: " + result.Error.Message);
        return;
    }
    // result.Value contains the session data (server IP, port, etc.)
    ConnectToServer(result.Value);
});
```

---

### Step 4 — Reserved ticket attributes

Several attribute keys have special matchmaking behavior. Include them in the ticket's `attributes` map as needed:

| Key | Type | When to use |
|---|---|---|
| `client_version` | string | Route to AMS fleets matching a specific game version |
| `role` | string | Player's role preference in role-based matching |
| `cross_platform` | string | Player's current platform (set automatically when `crossplayEnabled: true`) |
| `current_platform` | array | Platforms this player will match with |
| `new_session_only` | boolean | Per-ticket opt-out from joining existing sessions (overrides pool default) |
| `server_name` | string | Targets a specific local/dev dedicated server (dev/testing use only) |

Platform ID values: `steam`, `xbl`, `ps5`, `ps4`, `xbox`, `epicgames`.

### Step 5 — Session exclusion (optional)

If the game should avoid re-matching players against opponents they recently faced, use the **session exclusion** system:

1. Enable past-session recording: `SetEnablePartyMemberPastSessionRecordSync(true)` and set `PastGameSessionIdRecordCount` (e.g. 20 sessions to remember).
2. When submitting a ticket, create an exclusion list and attach it:
   - `CreateExclusionList()` — exclude specific session IDs
   - `CreateExclusionEntireSessionMemberPastSession()` — exclude anyone from any past session
   - `CreateExclusionCount(n)` — exclude the last n sessions' members
   - `CreateNoExclusion()` — explicitly disable exclusion
3. Party leaders can sync their exclusion list to all party members via `UpdatePartySessionStorageWithPastSessionInfo()`.

Use with caution — exclusion reduces the effective matchmaking pool. It works best for competitive games with large player bases.

### Step 6 — Integration checklist

After producing snippets, print:

```
Integration checklist:
  ☐ QoS measurement wired before ticket submission
  ☐ Correct pool name in ticket request
  ☐ Reserved attributes set (client_version, role, crossplayEnabled as needed)
  ☐ Match notification handler bound (OnMatchmakingComplete / MatchmakingV2MatchFound)
  ☐ Cancellation hooked to the back/cancel button
  ☐ Session join triggered on match found
  ☐ Error paths handled (ticket expired, server error, cancelled)
  ☐ Session exclusion wired (if avoiding rematch is required)
```

## Error Handling

| Situation | Response |
|---|---|
| SDK not installed | Direct to `/ags install-unreal-sdk` or `/ags install-unity-sdk`. Stop. |
| User asks about a different engine (Godot, Roblox) | "The reference covers Unreal and Unity. For Godot/Roblox, see the AGS REST API docs at https://docs.accelbyte.io/ — matchmaking uses the `POST /v1/public/namespaces/{namespace}/tickets` endpoint (verify against the AGS API reference for the exact path)." |
| User asks about the Extend Override match function wiring | "That's an Extend topic — the `match_function` field in the pool config points to the Override app. Run `/ags-extend` for the override deployment lifecycle. The SDK integration for ticket submission is the same regardless." |
| Match notification not firing | "Verify the Lobby websocket is connected before the ticket is submitted. The notification only arrives over the websocket, not via polling." |
