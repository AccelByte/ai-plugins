---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrating-matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/unity-integrating-matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/record-exclude-sessions/
see-also:
- '[overview.md](references/overview.md)'
- '[unreal-verification.md](../../references/sdks/game-engine/unreal-verification.md)'
---

# AGS Matchmaking — SDK Integrator

Wire AGS Matchmaking into a game using the Unreal or Unity SDK. Covers QoS measurement, ticket submission, cancellation, match notification, session join, and travel/connect handling for the planned session outcome. When an approved `docs/ags/matchmaking/*-plan.md` or a legacy matchmaking plan is referenced, execute that plan in project code. Otherwise, produce working code snippets the user can adapt.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before quoting any SDK call, type name, or delegate name. Do not restate SDK signatures from training memory — the reference is the source of truth.
- Read `../../workflows/online-game-flow.md` before reporting status for player-facing matchmaking, session join, or DS/P2P travel work.
- SDK method names and parameters come only from the reference. Do not invent method signatures.
- If a question needs a specific SDK version detail, configuration file path, or Admin Portal step not in the reference, say so and point to `https://docs.accelbyte.io/`.
- When the detected project is Unreal and this subskill edits or verifies C++ files, read `../../ags/references/sdks/game-engine/unreal-verification.md` before verification. If Unreal Editor is already running and the Unreal SDK MCP tools are available, prefer `unreal_live_coding_compile`; otherwise use the normal Unreal build path when verification is required.
- If an approved plan includes active-session UI, implement or update the planned session ID/member display entry point as part of the same integration. Do not stop after the matchmaking button or ticket call.
- Before generating or patching any Unreal Widget Blueprint from this subskill, enforce the `/ags generate-ui` Unreal UI-system gate: the user must explicitly choose `UMG`, `Common UI`, or `Follow Project UI System`, or must already have asked to follow project style and you must state the discovered convention. Do not silently default to UMG, and do not call AccelByteUITools tools until that choice is resolved.
- Follow the `/ags generate-ui` Unreal Editor lifecycle in `../../ags/references/sdks/game-engine/unreal/ui/generate-ui.md`: inspect existing Blueprint assets first only when using `Follow Project UI System`, patching an existing widget, or targeting an unknown widget container. For new UI with clear requirements, code/spec/backing-class preparation may happen before requiring the editor bridge; the bridge is still required for actual Blueprint generation or patching.
- For visible Unreal UI changes (adding a button, screen, panel, widget, or patching an existing widget asset), prefer the `/ags generate-ui` workflow. Do not hand-roll runtime widget insertion or repurpose an existing button as the first approach.
- Runtime insertion is a fallback only. Use it only when AccelByteUITools cannot target the asset cleanly (for example, the destination panel is not named or patchable), and either the user approves that fallback or the user already asked for a code-only workaround. When using the fallback, explain why the Blueprint route was not used.
- Use the namespace from project runtime config for AGS mutations and generated backend instructions. If CLI auth points at a different namespace, mention the mismatch only as a caution; do not switch away from project config unless the user explicitly asks.
- If the integration uses DS matchmaking with local DS, `server_name`, AMS Simulator, or local server registration, implementation is not complete after code/config changes. Final answers must use one of two local DS states: `configured but unverified` when code/config is prepared but `amssim` logs were not inspected, or when watchdog evidence exists without a post-ready claim attempt or equivalent portal/session evidence; or `claim verified` when watchdog evidence plus a post-ready claim attempt or equivalent portal/session evidence exists. Do not imply `amssim` logs alone prove full local DS claimability.
- Use the game-flow completion vocabulary from `../../workflows/online-game-flow.md`: `Smoke-verified`, `Game-flow integrated`, and `Complete`. A backend smoke test is not a manual in-game path.

</grounding_rules>

<tool_usage_rules>

- Use `Read` to read existing project files the user points to (e.g. a session settings header, a lobby manager class).
- Use `Read` to read an approved `docs/ags/matchmaking/*-plan.md` or referenced legacy matchmaking plan before reading SDK references when the user references a plan or exactly one plan exists.
- Use `Bash` to check whether the AGS SDK is already installed: `find . -name "AccelByteUe4Sdk.uplugin" 2>/dev/null` (Unreal) or `find . -name "com.accelbyte.unity.sdk*" 2>/dev/null` (Unity).
- Use `Edit` or `Write` to apply code changes for an approved plan, or to produce code snippets into project files when the user asks.
- Do not run builds or package managers from this subskill — redirect to `/ags install-sdk` if the SDK isn't installed.

</tool_usage_rules>

<output_contract>

When executing an approved plan, end with:

```text
AGS matchmaking integrated.

  Plan:           docs/ags/matchmaking/<file>.md
  Integrated:     <where the feature is wired: UI entry, manager/class, widget/scene/prefab, config constant, session join/travel path>
  Flow status:    <Smoke-verified | Game-flow integrated | Complete>
  Files touched:  <list>
  Backend config: <ruleset/pool/session template dependency status>
  Verification:   <build/test result; for local DS use "configured but unverified" or "claim verified" and include amssim log evidence when logs were inspected>
  Still left:     <backend config, runtime smoke test, clean build, AMS/session work, local DS amssim verification, or "None">
  Manual test:    <exact in-game path, expected button/widget, expected state changes, expected session panel/result>
  Next step:      <single concrete command/action the user should run next>
```

Do not wait for the user to ask "what's left?" after completing code/UI work. The final response must proactively name the integration points and the next step. If AGS backend config was drafted but not applied, say exactly which namespace/ruleset/pool remains. If verification was blocked by Live Coding, editor state, missing credentials, or missing backend config, say that plainly and make the next step the most useful unblocker. For visible UI changes, include the exact manual smoke test path because the agent cannot fully prove in-game visibility without a user/editor runtime test. Do not end with an open-ended question.

When no approved plan exists, produce working code snippets with:
1. **QoS measurement** — measure region latencies before submitting a ticket.
2. **Ticket submission** — call the matchmaking API with the pool name and any custom attributes.
3. **Status polling / notification** — how to know when a match is found.
4. **Ticket cancellation** — how to cancel if the player backs out.
5. **Session join and travel/connect** — how to join the session created by the match and move the player into the resulting session/server/peer flow.

For Unreal: C++ snippets with the Online Subsystem AccelByte API.
For Unity: C# snippets with the `MatchmakingV2` namespace.

After the snippets:
- **Integration checklist** — 6-item list (QoS, ticket submission, status handling, cancellation, join, error handling).
- **Next step** — "Run `/ags matchmaking debug` to test the flow end-to-end."

</output_contract>

<completeness_contract>

Integration is complete when:
- QoS measurement is wired (players submit latency maps, not empty objects).
- Ticket submission uses the correct pool name.
- The match-found notification is handled and the session join is triggered.
- Join success triggers the planned travel/connect or active-session state update for `None`, `P2P`, or `DS`.
- Active-session ID/member UI is populated when the approved plan includes it.
- Any visible Unreal UI addition was generated/patched through `/ags generate-ui`, or the final response clearly records the approved runtime-insertion fallback and why it was necessary.
- The final response gives a manual smoke test path the user can run in-game.
- For local DS matchmaking, the final response uses the two-state reporting model: `configured but unverified` if `amssim` logs were not inspected and `/ags ams debug` is the next step, or if logs show watchdog evidence but no post-ready claim attempt or equivalent portal/session evidence exists; or `claim verified` if watchdog evidence plus a post-ready claim attempt or equivalent portal/session evidence exists. Do not claim end-to-end local DS claimability from logs-only evidence.
- Ticket cancellation is handled for the "back" button case.
- Error paths (expired ticket, server error) are handled.

</completeness_contract>

<empty_result_recovery>

If the engine and SDK aren't specified, ask:
1. **Engine:** Unreal or Unity?
2. **SDK already installed?** If not, run `/ags install-sdk` first.
3. **Pool name** — which match pool should the ticket target?
4. **Custom attributes** — any ticket attributes beyond the defaults (e.g. MMR value, rank tier, preferred game mode)?

</empty_result_recovery>

## Workflow

### Step 1 — Read the reference

Before the snippet-only flow, check for an approved `docs/ags/matchmaking/*-plan.md` or referenced legacy matchmaking plan. If the user references a plan, says "use the plan", or exactly one matchmaking plan exists, read that plan first and execute it in project code: validate SDK/config, locate the files named or implied by the plan, apply QoS, ticket submission, cancellation, match-found handling, session join, travel/connect handling, active-session UI updates when requested, and error UI changes, then run the plan's verification steps when available. If active-session UI requires generating or patching a Widget Blueprint and the UI-system choice is not already explicit in the plan or user request, stop and ask the `/ags generate-ui` Unreal UI-system question before touching widget assets. If visible UI cannot be patched/generated cleanly, explain the blocker and ask before using runtime insertion unless the user explicitly requested a code-only workaround. If the plan is missing, stale, or ambiguous, stop and ask the user to run `/ags matchmaking plan` or revise the existing plan before editing game code.

### Step 1.5 - Visible Unreal UI gate

When the approved plan adds or changes a visible Unreal UI entry point:

1. Identify the expected in-game path from project context, such as `Main Menu -> Play -> Start Matchmaking`. Treat this as a manual-test path, not proof that the agent can fully verify runtime visibility.
2. Use `/ags generate-ui` or follow its Unreal workflow for the actual widget generation/patch. This includes the UI-system hard gate: `UMG`, `Common UI`, or `Follow Project UI System`.
3. Inspect existing widgets before code/spec work only when using `Follow Project UI System`, patching an existing Widget Blueprint, or targeting an unknown widget container. For a new widget with clear requirements, prepare code/spec/backing class first, then use the editor bridge for generation.
4. If using `Follow Project UI System`, state the discovered convention before patching, for example: "Project uses Common UI via `UAccelByteWarsActivatableWidget` and `W_MenuButton`; I will patch with that convention."
5. Do not reuse or repurpose an existing visible button unless the user approves that design. Adding matchmaking normally means adding a distinct visible matchmaking entry.
6. If the AccelByteUITools path fails because the target container is not named or the asset is not patchable, stop and explain the fallback. Runtime insertion must be reported as a fallback in the final answer.
7. Final output must include `Manual test:` with the exact path, expected button label, cancel/searching state, and expected matched/session panel.

Read `references/overview.md`, specifically the Unreal SDK and Unity SDK sections.

### Step 2 — Detect SDK (optional)

If the user is in a project directory:

```bash
# Unreal
find . -name "AccelByteUe4Sdk.uplugin" 2>/dev/null | head -1
# Unity
find . -path "*/Packages/com.accelbyte.unity.sdk*" 2>/dev/null | head -1
```

If not found, tell the user to run `/ags install-sdk` first.

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
| `server_name` | string | Targets a specific local/dev dedicated server (`server_name targets` are for dev/testing use only) |

When `server_name` targets a local/dev DS, the agent must verify the matching `amssim` local registration, watchdog readiness, and a post-ready claim attempt or equivalent portal/session evidence before reporting `claim verified`. If only code/config was prepared, or if only `amssim` log evidence exists, report `configured but unverified` and do not imply full local DS claimability.

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
| SDK not installed | Direct to `/ags install-sdk`. Stop. |
| User asks about a different engine (Godot, Roblox) | "The reference covers Unreal and Unity. For Godot/Roblox, see the AGS REST API docs at https://docs.accelbyte.io/ — matchmaking uses the `POST /v1/public/namespaces/{namespace}/tickets` endpoint (verify against the AGS API reference for the exact path)." |
| User asks about the Extend Override match function wiring | "That's an Extend topic — the `match_function` field in the pool config points to the Override app. Run `/ags-extend` for the override deployment lifecycle. The SDK integration for ticket submission is the same regardless." |
| Match notification not firing | "Verify the Lobby websocket is connected before the ticket is submitted. The notification only arrives over the websocket, not via polling." |
