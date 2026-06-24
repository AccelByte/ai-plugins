---
last-verified: 2026-06-08
sources:
- https://docs.accelbyte.io/
---

# Online Game Flow Workflow

This is the single canonical contract for player-facing AGS game integration such as login, lobby connection, Play Online, matchmaking, session join, dedicated-server travel, active-session UI, cancel, and recoverable errors.

This workflow owns player-facing game integration. Read module and capability files as supporting references, but do not let `subskills/integrate.md` define completion for a game project by itself.

## Required Reads

- `../maps/capability-map.md`
- `../maps/dependency-map.md`
- `../subskills/integrate.md`
- `../references/security/iam-authorization-preflight.md`
- `../subskills/generate-ui.md` when the flow adds or patches visible game UI

## Supporting Context

Read these only when the confirmed player-facing slice needs them:

- Skill-based matchmaking, MMR, ratings, ranked state, win/loss history, or role performance -> `../references/modules/statistics.md` plus `../capabilities/matchmaking/router.md`.
- Dedicated-server matchmaking, Play Online, or session join that must claim AMS -> `../capabilities/matchmaking/router.md`, `../capabilities/ams/router.md`, and `../references/modules/session.md`.
- P2P or listen-server matchmaking -> `../capabilities/matchmaking/router.md` and `../references/modules/session.md`; for Unreal P2P/listen-server networking, also read `../references/sdks/game-engine/unreal-p2p.md`.

## Routing Rule

All AGS game integration requests default to this workflow, including single-module requests such as login/auth, lobby, matchmaking, session, and server travel. Smoke-only, backend-only, debug-only, doctor-only, SDK setup, and namespace setup are explicit exceptions.

Use `subskills/integrate.md` as the module-wiring helper after this workflow has established the player-facing plan.

## Default Assumption

AGS game integration defaults to player-facing end-to-end flow. When a developer asks to integrate AGS into a game, assume the desired outcome is a usable player path through the game unless they explicitly ask for smoke-only, backend-only, debug-only, doctor-only, SDK setup, or namespace setup work.

Smoke-only work is opt-in. Backend/API/log evidence can prove a service path, but it does not prove the player-facing game flow.

Console commands count as game-flow triggers only when the user explicitly accepts them as the intended player or developer path. Do not invent a console command as the product path just to avoid asking about UI, input, or gameplay flow.

The product promise is a usable player path, not one successful SDK call.

## Matchmaking Outcome Notes

For skill-based matchmaking, the Game Flow Plan must identify the stat codes used for matchmaking and who writes each stat before match tickets depend on those values.

For dedicated-server matchmaking through AMS, the Game Flow Plan must capture the match pool, session template, session type and join policy, expected `ServerName` or equivalent DS name, client `server_name` attribute when used, Unreal `SETTING_GAMESESSION_SERVERNAME` when used, AMS claim keys, local AMS Simulator command/config path when local verification is requested, and local DS evidence state (`configured but unverified` or `claim verified`).

For P2P or listen-server matchmaking, the Game Flow Plan must capture the match pool, ruleset, session template, party behavior, joinability/session visibility, and the network path after match-found: lobby notification, session join, travel, and in-game success.

Do not route these outcomes to separate workflow files. `online-game-flow.md` owns the player-facing contract; capability routers and references provide supporting detail.

## Outcome Ownership

Matchmaking owns tickets, rules, pools, match formation, and client ticket/session behavior. AMS owns dedicated-server upload, fleet configuration, watchdog readiness, simulator verification, and claimability. Session references own session lifecycle and join policy details. This workflow owns the end-to-end player journey and completion vocabulary.

## Multi-Slice Game Integration Gate

Before codebase or AGS tooling discovery, classify the user's request from the prompt only.

Do not inspect game files, AGS CLI state, namespace configuration, SDK symbols, or generated output until the user confirms the first slice.

This gate applies to player-facing game integration involving IAM, Lobby, Session, Matchmaking, AMS, Statistics, Leaderboards, Achievements, Store, Analytics, or related game-facing AGS modules.

Treat a request as multi-slice when it asks for more than one independent AGS-backed game integration or combines a feature with an unmet prerequisite.

Examples:

- `login + matchmaking + AMS` -> multi-slice. Recommend `login` first.
- `skill-based matchmaking + update MMR statistics after a win` -> multi-slice. Recommend `statistics/MMR` first because matchmaking consumes the stat.
- `matchmaking + dedicated server travel + AMS fleet/debug` -> multi-slice unless the prompt confirms the earlier pieces already exist. Recommend the earliest missing player-flow slice.
- `leaderboard + post-match score update + achievement unlock` -> multi-slice. Recommend `statistics/score update` first when leaderboard or achievement criteria depend on it.

Requests can stay one slice when the modules are part of one narrow flow and prerequisites are already explicit, such as wiring an existing Play Online button to submit a matchmaking ticket using an already configured session template.

If the gate triggers, stop before observation and ask the user to confirm one first slice.

Show:

- Requested slices detected.
- Suggested phases.
- Recommended first slice with a short dependency reason.
- A confirmation question asking whether to start with that first slice.

Default dependency order:

1. IAM/login before Lobby, Matchmaking, Store, Statistics, Leaderboards, Achievements, and AMS-backed game flows.
2. Lobby/Session before Matchmaking flows that need party/session join behavior.
3. Statistics before skill-based matchmaking, MMR, leaderboard, and statistic-backed achievement work when stats are source data.
4. Matchmaking/Session before AMS claim/debug work when no match/session path exists.
5. AMS server runtime/fleet readiness before final dedicated-server travel verification when the match/session path already exists.

Do not include a full implementation plan before the first slice is confirmed.

If two first slices are equally plausible, ask the user to choose one and do not observe yet.

If the user insists on all slices at once, explain that the workflow needs one confirmed slice first to avoid context overload and preserve verification quality.

If the user clarifies that the request is smoke-only, backend-only, debug-only, doctor-only, SDK setup, or namespace setup, route through the existing exceptions instead of this game-integration gate.

If the request mentions AMS or Matchmaking as pure operational/capability work without game integration, use the relevant capability router instead of the online game-flow gate.

After the user confirms the first slice, perform codebase and AGS tooling discovery for that slice only.

- Find the engine, SDK/plugin, AGS config source, existing game path, and target files relevant to the confirmed slice.
- Run read-only AGS CLI checks only when they affect the confirmed slice.
- Run the authorization preflight from `../references/security/iam-authorization-preflight.md` for the confirmed slice. Classify caller type, token source, IAM client type, planned AGS calls, and required permissions. Use AGS CLI discovery first when the current CLI exposes operation or permission metadata.
- Read supporting module/capability files only for the confirmed slice.

After observation, write a plan file under:

`docs/ags-plans/<yyyy-mm-dd>-<first-slice-slug>.md`

The plan file should follow the existing AGS wizard/integration plan shape and include:

- Approved feature.
- Confirmed context.
- Goal.
- Non-goals.
- Affected areas.
- AGS modules.
- Authorization Plan.
- Required AGS Admin Portal setup when a requested third-party login provider
  is not already active.
- Implementation steps.
- Verification.
- Risks and open questions.
- Next step.
- `Deferred Requested Integrations` with checkbox items for the other requested slices.

The plan file must include `Deferred Requested Integrations` with checkbox items for the other requested slices.

Example:

```markdown
## Deferred Requested Integrations

- [ ] Matchmaking ticket submission and match-found handling.
- [ ] AMS dedicated-server claim/travel verification.
```

For dependency-driven requests, order deferred items by the recommended phase sequence:

```markdown
## Deferred Requested Integrations

- [ ] Skill-based matchmaking rules that consume the MMR statistic.
- [ ] Post-match matchmaking tuning after MMR read/write is verified.
```

Writing the plan file does not approve code edits. The existing `Game Flow Plan` approval gate still applies before implementation.

## Codebase And AGS Tooling Discovery

Before drafting the Game Flow Plan, perform codebase and AGS tooling discovery. Run this discovery only after the multi-slice gate has either not triggered or the user has confirmed the first slice.

- Find the engine, SDK/plugin, AGS config source, existing login/bootstrap/menu/gameplay path, and target files/classes/functions.
- Run read-only AGS CLI checks when AGS-side config affects the request. Start with `Get-Command ags` on Windows or `command -v ags` on macOS/Linux, then use `ags --version`, `ags auth status`, `ags doctor`, and `ags describe` when available.
- Follow `../references/observe/cli-commands.md` for generated command discovery. Use `ags describe` before unfamiliar service/resource commands and prefer JSON output when the CLI exposes it.
- Do not create, update, delete, enable, grant, revoke, or otherwise mutate AGS state before the Game Flow Plan is approved.
- If CLI is unavailable, unauthenticated, or cannot verify the namespace/client/login method, record that blocker or gap in the Game Flow Plan instead of silently skipping it.
- For third-party login providers, read `../references/platforms/auth-provider-configuration.md` before asking for plan approval. If the provider is missing or inactive, construct the manual Admin Portal URL from the discovered AGS base URL and namespace and include the provider-specific field checklist from that reference.
- Do not force an interactive AGS CLI login while planning. Ask only when the user must authenticate or choose between conflicting namespace/client/config sources.

## Game Flow Plan Gate

Before any code edit, inspect the codebase and maintain a `Game Flow Plan` inside this workflow.

The plan gate is user-facing, but the full field list is internal. Present approvals progressively instead of listing every field at once.

Use the `Game Flow Plan` as internal planning state before game-code edits. Track: In-game trigger, Requested end state, AGS modules involved, Existing code path, AGS config/tooling, Authorization Plan, UI surface, Work scope, Success state, Error/cancel state, Service evidence, and Game-flow evidence.

Treat these fields as a planning scaffold, not a fixed questionnaire or hardcoded option list. Adapt, rename, combine, omit, or add fields based on what the codebase, AGS config, and requested feature actually reveal.

Separate discovered facts from user choices. After discovery, show a short research digest with facts such as AGS modules involved, AGS config/tooling status, and the existing code path or likely entry points. Do not ask the user to reconfirm discovered facts unless evidence conflicts or multiple plausible paths exist.

The research digest must include an Authorization Plan when the slice calls any AGS API:

```text
Authorization Plan

  Caller:               <game client | game server | backend service | trusted tool | web app/admin UI>
  Token source:          <user access token | service/server token | unknown>
  IAM client type:       <public | confidential | unknown>
  AGS calls:             <SDK methods or REST endpoints, including secondary lookup calls>
  Permission discovery:  <AGS CLI evidence, docs fallback, or gap>
  Required permissions:  <exact permissions or "not exposed by current CLI">
  Verified access:       <yes | no | blocked>
```

If the Authorization Plan says a game server, backend service, or trusted tool would use a Public IAM client, block Game Flow Plan approval and route to `/ags connect-portal` before implementation. If required permission discovery is unavailable, record the gap and do not imply the client is properly configured.

Third-party provider setup is a pre-approval gate. When a requested login provider is not already active in AGS, do not ask the user to approve the Game Flow Plan yet. Instead, show a `Required AGS Admin Portal Setup` block that includes:

- Direct Admin Portal URL: `<ags-base-url>/admin/namespaces/<namespace>/login-methods` after trimming any trailing slash from the base URL. Example: `https://development.accelbyte.io/admin/namespaces/bitwars/login-methods`.
- Portal action: add the requested third-party provider manually under the login-methods / Auth & Account Linking page, then activate or save it.
- Fields to populate: copy the exact provider-specific list from `../references/platforms/auth-provider-configuration.md`. For confidentiality-limited providers such as PSN, Xbox, or Nintendo, explicitly say the public docs do not expose the field names and ask the user to fill every required field from the confidential AccelByte/platform-holder guide or paste the portal field labels for review.
- Approval blocker: state that Game Flow Plan approval is blocked until the user completes this Admin Portal setup, or confirms the provider is already active, and a read-only CLI/provider check can be run.

Use progressive confirmation when several meaningful decisions remain. Do not present every Game Flow Plan field in one approval block when more than one decision or evidence contract is still open.

Checkpoint 1 - Player entry and scope:
- In-game trigger.
- Existing code path or new path.
- Work scope.
- UI surface.

Checkpoint 2 - Completion contract:
- Requested end state.
- Success state.
- Error/cancel state.
- Service evidence.
- Game-flow evidence.

Ask only the next unresolved checkpoint. If one checkpoint is already clear from the request and discovery, state it as a fact and move to the next unresolved choice.

Example choices such as `Main Menu Play Online`, `GUI Cheat`, or `smoke-only` are illustrative, not required labels. Replace them with project-specific options found during discovery, and omit any option that is irrelevant.

Do not invent a console command as the intended product path unless the user explicitly approves it.

Do not treat a console command, GUI-cheat entry, debug-only binding, or Blueprint-callable API alone as the product UI path unless the user explicitly approves that fallback.

When real product choices exist, offer two or three concrete choices for the unresolved player-facing decision(s). Do not invent choices merely to look thorough.

Approval of the original AGS request is not approval of the Game Flow Plan. Do not implement in the same response that first presents the Game Flow Plan. Ask the user to approve the Game Flow Plan and stop.

Do not show a full diff by default while presenting the Game Flow Plan. Summarize the intended edit scope instead.

## Execution Rule

After the Game Flow Plan is approved, use `subskills/integrate.md` for module wiring. The module smoke test becomes service evidence inside the game-flow report.

## Visible UI Rule

Player-facing AGS game integration requires a visible game UI entry point and visible success/error/cancel state unless the user explicitly requests smoke-only, backend-only, or code-only work.

When the approved plan adds or patches visible Unreal UI, use `/ags generate-ui` or follow `subskills/generate-ui.md` for the actual widget generation or patch. This includes the Unreal UI-system gate: the user must explicitly choose `UMG`, `Common UI`, or `Follow Project UI System`, or must already have asked to follow project style and you must state the discovered convention before patching.

Do not hand-roll runtime widget insertion, reuse an unrelated visible button, or expose only a GUI-cheat/debug entry as the first approach. Runtime insertion or dev-only UI is a fallback only when AccelByteUITools cannot target the asset cleanly, and either the user approves that fallback or the user already asked for a code-only workaround. When using a fallback, record why `/ags generate-ui` was not used in the final response.

Confirm before auth-handling or broad shared-code changes. Show a full diff only when the user asks, a harness approval flow requires it, or the change is too broad to summarize safely.

## Evidence Rule

Report service evidence and game-flow evidence separately:

- `Smoke-verified`: backend, API, CLI, or log evidence proves a service path works.
- `Game-flow integrated`: the user-facing path is wired in the game but not fully manually verified.
- `Complete`: the requested end state is reached through the intended player-facing path.

## Completion Vocabulary

Use these words precisely:

- **Smoke-verified**: Backend/API/log evidence shows the service path works, but no proven player-facing trigger exists yet.
- **Game-flow integrated**: A player can trigger the flow through UI, input, console command, or an existing gameplay path, but the final requested end state has not been fully verified through that path.
- **Complete**: The requested end state is reached through the intended player-facing path with both service evidence and game-flow evidence.

Do not use "complete" for a game integration request when only backend state, CLI output, API calls, or logs prove the service path. That is smoke verification, not player-flow completion.

## Canonical Online Play Flow

For login + matchmaking + session/DS requests, prefer one player-facing action that drives the journey:

```text
Play Online
 -> login if needed
 -> connect lobby if needed
 -> start matchmaking
 -> join session
 -> travel/connect to DS/P2P if needed
 -> show success/error/cancel state
```

Expose intermediate states to UI and logs when the project has a visible online flow:

- `LoggingIn`
- `ConnectingLobby`
- `Matchmaking`
- `JoiningServer`
- `InGame`
- `Error`
- `Cancelled`

## Evidence Requirements

For service evidence, collect the backend proof that matches the requested AGS modules:

- IAM: login token plus a second authenticated call.
- Lobby: connection and expected lobby event.
- Matchmaking: ticket submitted, match found or expected queue state, and failure/cancel handling.
- Session: session joined, roster or member lookup works, and session state is visible.
- AMS DS: server claim or local registration evidence, plus watchdog/claim state when local DS is in scope.
- Authorization: caller type, token source, IAM client type, required permissions, and verified access from the Authorization Plan.

For game-flow evidence, identify and verify the player path:

- UI action, input binding, console command, or existing gameplay action that starts the flow.
- The state transitions the player sees while the flow runs.
- The success state, error state, and cancel/back behavior.
- For DS/P2P outcomes, the travel/connect result through the intended path.

If no player-facing path exists yet, say that clearly and report the work as `Smoke-verified` until a trigger path is implemented or deliberately accepted as out of scope.

## Output Contract

End with:

```text
Game-flow integration status

  - Flow status:        <Smoke-verified | Game-flow integrated | Complete>
  - Game trigger:       <UI/input/gameplay/approved console path/not implemented>
  - UI evidence:        <visible widget/control/state path or approved fallback with reason>
  - Intended end state: <state>
  - Authorization:     <caller, token source, IAM client type, required permissions, verified access>
  - Service evidence:   <backend/API/log/CLI proof>
  - Game-flow evidence: <player-path proof or missing proof>
  - Remaining gap:      <none or exact next step>
```
