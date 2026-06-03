---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-match-rulesets/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-match-pools/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrate-matchmaking/
see-also:
- '[overview.md](references/overview.md)'
- '[ruleset.md](ruleset.md)'
- '[pool.md](pool.md)'
- '[integrate.md](integrate.md)'
---

# AGS Matchmaking - Full Integration Planner

Create an end-to-end matchmaking integration plan for a concrete game-facing feature request, such as "add casual matchmaking to the game", "add ranked 2v2 to the game", or "make a solo-testable 4-player queue in Unreal". This subskill plans AGS-side configuration, game-code integration, and the user-visible flow through match-found, session join, and travel/connect behavior. It does not execute the plan.

This subskill overrides the agent's normal implementation autonomy. Even if the user's wording says "add", "implement", "build", or "wire", the first `/ags matchmaking` invocation must stop at a plan draft and approval question. Actual file edits and builds happen only in `/ags matchmaking integrate` after an approved plan exists.

Use this when the user already chose **AGS + game integration** or clearly asks to add/wire matchmaking to the game. Do not use this for AGS config-only requests unless the user chooses the AGS + game integration scope. Do not add a separate feature subskill; "feature" is the workflow this plan describes, and execution belongs to `integrate`.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before writing the plan. Ruleset schema, pool fields, ticket lifecycle, SDK integration surface, and region/backfill behavior are grounded there.
- Read `../../workflows/online-game-flow.md` before planning any player-facing matchmaking, session join, or DS/P2P travel flow.
- A complete matchmaking feature includes AGS configuration, game code, and the post-match session handoff unless the user explicitly asks for config-only work.
- Do not treat ruleset/pool creation as "done" if no game code submits tickets, handles cancellation, receives match-found notification, joins the created session, and reports join/travel/connect success or failure to the player.
- Do not treat backend matchmaking/session/AMS evidence as completion unless the plan also identifies the player-facing trigger and the game-flow evidence required to verify it.
- Matchmaking produces a session outcome. Before drafting the implementation plan, identify the intended session type: **None**, **DS**, or **P2P**. If the user did not specify it, ask and stop.
- If the session type is **DS**, include `/ags ams` as a required downstream workstream for dedicated-server fleet/session readiness. Do not treat DS matchmaking as complete with matchmaking config alone.
- If DS matchmaking targets a local DS, `server_name`, AMS Simulator, or local server registration, the plan must include `/ags ams debug` as a required verification workstream for watchdog readiness and local registration/claim evidence where applicable. Do not treat local DS matchmaking as end-to-end complete until `amssim` logs show DS connected, ready received, and heartbeat, plus a post-ready claim attempt or equivalent portal/session evidence confirms claimability.
- If DS matchmaking targets a local DS, the plan must include a section named **AMS local DS debug checklist**. This is the handoff contract for `/ags ams debug`; do not leave the AMS side as a generic "run debug" note. The checklist must specify:
  - Local server identity: AMSSim `config.json` `ServerName`, client `server_name`, Unreal `SETTING_GAMESESSION_SERVERNAME` when Unreal is used, and any project-specific DS server-name launch arg if the project reads one.
  - Claim routing: session template name, preferred/client-version/fallback claim keys, local `ClaimKeys`, and the expected exact match between template/fleet/local-server keys.
  - Launch commands and DS launch args: `amssim run --configPath <path-to-config.json>` for AGS-backed local registration or `amssim run` for watchdog-only testing; the DS command shape with `-dsid`, `-watchdog_url`, `-port`, and any project-specific server-name arg; and a note that the `ds_<uuid>` value must come from the current `amssim info` output.
  - Evidence expectations: AMSSim session id/log path, timestamps or log lines for DS connected, ready received, heartbeat after ready, and a post-ready claim attempt or equivalent Admin Portal/session evidence for claimability.
  - Reporting state: `configured but unverified` or `claim verified`.
- If the session type is **P2P** or **None**, no AMS dependency is required unless the project has an existing AMS/session requirement.
- Ask whether the user wants UI for the current active session, showing at least session ID and members. If yes, inspect the game code deeper for session/member UI entry points and ask the user to confirm the plan before writing it.
- For game projects, namespace comes from project runtime config, not memory or CLI defaults. Unreal: `Config/DefaultEngine.ini`. Unity: AccelByte SDK config asset/json. Web/custom: `.env` or app config.
- Before proposing AGS backend create/update work, inspect the current backend state through the AGS CLI skill path. In this bundle, use `/ags observe` for read-only CLI discovery; if a standalone `/ags-cli` skill exists in the runtime, use that. Do not invent CLI commands from memory: route through the AGS CLI skill/reference and `ags describe`-discovered commands.
- Backend inspection is read-only in this subskill. Check whether the requested ruleset, match pool, session template, or related matchmaking configuration already exists before planning new creation work. If CLI install/auth/context is missing, record that blocker and route the prerequisite to `/ags install-cli`, `/ags observe`, or `/ags connect-portal` instead of guessing.
- If the request needs post-match session template or AMS work, include it as a dependency/risk and point to `/ags` or `/ags ams`; do not pretend native matchmaking alone provisions fleets.
- The plan must include a "full integration flow" from player action to active session:
  1. Player starts matchmaking from the UI or gameplay entry point.
  2. Client measures QoS or supplies region/latency data when region routing is used.
  3. Client submits the ticket with pool name, attributes, and party/member data.
  4. Client handles cancel/back, ticket failure, ticket expiration, and already-in-session cases.
  5. Client receives match-found notification.
  6. Client joins the created or assigned game session.
  7. Client travels/connects according to the session type: no network travel for `None`, peer/session travel for `P2P`, or DS address/port travel after AMS/session readiness for `DS`. For local DS end-to-end claim validation, this requires `amssim` evidence that the DS connected, became ready, and sent heartbeat, followed by a post-ready claim attempt or equivalent portal/session evidence.
  8. Client shows active-session ID and members when that UI is in scope.
- For login -> matchmaking -> session/DS requests, prefer the canonical `Play Online` flow from `../../workflows/online-game-flow.md`: `Play Online` -> login if needed -> connect lobby if needed -> start matchmaking -> join session -> travel/connect to DS/P2P if needed -> show success/error/cancel state.
- Plans that include a visible online flow should expose these player states in UI and logs where the project has a matching surface: `LoggingIn`, `ConnectingLobby`, `Matchmaking`, `JoiningServer`, `InGame`, `Error`, and `Cancelled`.

</grounding_rules>

<tool_usage_rules>

- Use `Read` and `Glob` to inspect project shape, existing AGS config, existing menu/session/lobby/matchmaking code, and existing docs/config payloads.
- Use `Write` only to save the approved plan under `docs/ags/matchmaking/`.
- Use `Bash` only for read-only project inspection commands and read-only AGS CLI checks routed through the AGS CLI skill path (`/ags observe` in this bundle, or `/ags-cli` if present). Do not call AGS CLI mutations from this subskill.
- Do not edit game source code, AGS JSON config, Blueprints, project settings, build files, or generated files. Do not use `Edit`, `apply_patch`, shell redirection, code generators, or scripts that write project files.
- Do not run builds, tests, formatters, Unreal header generation, SDK code generation, or AGS CLI mutations from this subskill. Verification commands that compile or mutate state belong to `integrate`.
- Do not implement "just the entry point", "a small C++ surface", "a quick config file", or any other partial slice during planning. Code execution belongs to `integrate`.
- Do not read other subskills except `ruleset.md`, `pool.md`, and `integrate.md` when needed to shape the plan.

</tool_usage_rules>

<output_contract>

Produce:

1. **Project context summary** - engine, project config source, detected namespace/base URL, SDK presence, likely UI/code entry points.
2. **Plan draft** - concise end-to-end plan with:
   - Goal and non-goals
   - Confirmed session outcome: `None`, `DS`, or `P2P`
   - Active-session UI decision: yes/no, and if yes, the planned session ID/member display entry point
   - AGS backend inspection: what the AGS CLI skill path verified, what already exists, what is missing, and any CLI/auth/context blocker
   - AGS backend/config work: ruleset, pool, session template dependency, region/backfill assumptions
   - Full integration flow: player action, QoS/attributes, ticket lifecycle, match-found notification, session join, travel/connect behavior, active-session display if in scope
   - Game-flow completion target: expected final status using `Smoke-verified`, `Game-flow integrated`, or `Complete`, plus the service evidence and game-flow evidence required
   - Session work: session template, join/travel/connect behavior, member visibility, and `/ags ams` dependency for DS
   - AMS local DS debug checklist: exact local `ServerName`, client `server_name` / Unreal `SETTING_GAMESESSION_SERVERNAME`, `ClaimKeys`, session template claim keys, launch commands/DS launch args, evidence expectations, and reporting state when local DS is in scope
   - Game-code work: UI entry, QoS, ticket submit, cancel/back behavior, match-found handling, session join/travel/connect, active-session refresh, errors
   - Multi-step execution plan, grouped into workstreams when scope is large
   - Files/areas likely to change
   - Verification steps
   - Risks/open questions
3. Ask for approval or revision.
4. If the user has not already approved the draft in a separate reply, stop here. Do not write files and do not implement anything.
5. After approval, write `docs/ags/matchmaking/<yyyy-mm-dd>-<slug>-plan.md`.
6. End with:

```text
AGS matchmaking plan written.

  Plan:       docs/ags/matchmaking/<yyyy-mm-dd>-<slug>-plan.md
  Feature:    <feature>
  Next step:  /ags matchmaking integrate
```

</output_contract>

<completeness_contract>

Planning is complete when:
- Project runtime config has been inspected or a missing config risk is explicitly recorded.
- The current backend state has been checked through the AGS CLI skill path, or a CLI/auth/context blocker is explicitly recorded with the required prerequisite skill.
- Session type has been confirmed as `None`, `DS`, or `P2P`.
- Active-session UI scope has been confirmed as yes or no.
- The plan covers AGS config, session outcome, game-code integration, and match-found-to-session-join/travel behavior.
- DS plans include a required `/ags ams` workstream or explicit prerequisite.
- Local DS plans include an **AMS local DS debug checklist** with the exact identifiers, launch args, and evidence expectations needed by `/ags ams debug`.
- The user approves the plan.
- The plan document is written under `docs/ags/matchmaking/`.
- The next step is `/ags matchmaking integrate`.

If the user has not approved the plan yet, planning is intentionally incomplete. Stop after the approval question.

</completeness_contract>

<empty_result_recovery>

If the request is too vague to plan, ask for the minimum missing details in one message:

1. **Mode/format:** casual/ranked/custom? FFA or teams? players per match?
2. **Session type:** `None`, `DS`, or `P2P`? Matchmaking results in a session, and this choice changes the plan.
3. **Engine:** Unreal or Unity?
4. **Active-session UI:** should the game show current session ID and members?
5. **Match criteria:** none/MMR/rank/role/region/backfill?
6. **Test behavior:** should it flex down for solo/local testing?

</empty_result_recovery>

## Workflow

### Step 1 - Read references and project context

Read `references/overview.md`. Inspect project files enough to identify:

- Engine/runtime: Unreal, Unity, or unknown.
- Project runtime config and namespace.
- AGS SDK/plugin presence.
- Existing UI/menu/session/lobby/matchmaking files.
- Existing AGS config payloads under `Config/AGS/`, `docs/ags/matchmaking/`, a legacy matchmaking plan directory, or similar.

### Step 2 - Inspect backend state through the AGS CLI skill

Before drafting backend work, use the AGS CLI skill path to inspect the namespace resolved from project runtime config:

- Prefer `/ags observe` in this bundle for read-only AGS CLI discovery. If the runtime provides a dedicated `/ags-cli` skill, use that instead.
- Verify CLI/auth/context first. If the CLI is missing, auth is invalid, or the namespace context cannot be determined, stop backend inspection and record the prerequisite route: `/ags install-cli`, `/ags observe`, or `/ags connect-portal`.
- Use the AGS CLI skill/reference and `ags describe` output to discover exact read-only list/get/show commands. Do not fabricate commands from memory.
- Check whether the requested matchmaking ruleset, match pool, session template, and related config already exist before proposing creation or updates.
- Summarize the result in the plan as "exists", "missing", or "blocked" for each backend item.

Do not run create/update/delete commands from this subskill.

### Step 3 - Clarify session outcome

Matchmaking results in a session. Determine whether the intended session type is:

- **None** - matchmaking/session result without dedicated server or P2P networking dependency; plan still handles match-found and active-session state.
- **DS** - session claims or routes players to a dedicated server. This requires an `/ags ams` workstream for fleet/session readiness, plus game-code join/travel handling.
- **P2P** - players connect peer-to-peer through the session result. No AMS dependency by default.

If the user did not specify the session type, ask:

```text
What session type should matchmaking create?
1. None - session result only, no DS or P2P networking dependency
2. DS - dedicated server session; this will also need an /ags ams workstream and join/travel handling
3. P2P - peer-to-peer session, no AMS dependency by default
```

Then stop. Do not draft or write the plan until the session type is known.

### Step 4 - Clarify active-session UI

Ask whether the user wants the game to show the current active session:

```text
Should the integration include UI that shows the current active session ID and members?
```

If the user says yes, inspect the game code deeper for likely menu/HUD/session/member UI entry points and include those files/areas in the plan. If the UI entry point is ambiguous, ask the user to confirm the target UI before writing the plan.

If the user says no, record active-session UI as out of scope.

### Step 5 - Decide whether enough detail exists

If the user gave enough feature detail, draft the plan. If not, use `empty_result_recovery`.

### Step 6 - Draft the multi-step plan

The plan must include both AGS and game sides. For large scopes, produce a multi-step plan grouped into workstreams instead of a single flat plan:

- AGS-side: read-only backend inspection result, ruleset, pool, session template, AMS/DS dependency if relevant, region/backfill choices.
- Full integration flow: player action, QoS/attributes, ticket submission, cancellation, match-found notification, session join, travel/connect, and success/failure UI.
- Session outcome: `None`, `DS`, or `P2P`, including join/travel/connect/member visibility behavior.
- AMS-side: only when session type is `DS`; route this workstream to `/ags ams`.
- Local DS verification: when local DS is in scope, require `/ags ams debug` to verify watchdog readiness and local registration/claim evidence where applicable. `amssim` logs showing DS connected, ready received, and heartbeat are diagnostic until a post-ready claim attempt or equivalent portal/session evidence exists. If logs cannot be inspected, or if only watchdog evidence exists, the plan must call the feature configured but unverified. Add an **AMS local DS debug checklist** containing exact `ServerName`, client `server_name` / Unreal `SETTING_GAMESESSION_SERVERNAME`, `ClaimKeys`, session template claim keys, `amssim run --configPath <path-to-config.json>` or watchdog-only launch command, DS launch args with `-dsid`, `-watchdog_url`, `-port`, and the evidence expectations `/ags ams debug` must collect.
- Game-side: where the player starts matchmaking, how the pool name is supplied, QoS/latency map, ticket submit, cancellation, notification, session join/travel/connect, UI/error states.
- Optional active-session UI: current session ID and members, if the user requested it.

For DS plans, include explicit sequencing:

1. `/ags matchmaking integrate` for ticket lifecycle, match-found handling, session join, and client travel/connect handling.
2. `/ags ams debug` for local DS watchdog readiness and local registration/claim evidence when using `amssim`, local server registration, or `server_name`; local DS end-to-end claim validation requires a post-ready claim attempt or equivalent portal/session evidence. Otherwise use `/ags ams` for dedicated-server fleet/session readiness.
3. `/ags` or project-specific session integration if post-match session UI/travel is outside matchmaking.

### Step 7 - Get approval

Ask the user to approve or revise the plan. Do not write the plan document until approved.
Do not edit source files or build the project while waiting for approval.

### Step 8 - Write the plan document

Write the approved plan to:

`docs/ags/matchmaking/<yyyy-mm-dd>-<slug>-plan.md`

Then point to `/ags matchmaking integrate`.
