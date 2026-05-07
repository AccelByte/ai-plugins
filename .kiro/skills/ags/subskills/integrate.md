---
name: ags-integrate
description: 'Module-by-module SDK wiring guide: auth, lobby, matchmaking, sessions,
  store, statistics, leaderboards, achievements, social, analytics. Use when the SDK
  is installed and verified, and the user wants to actually wire AGS into their game
  / app code.'
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[iam.md](../references/modules/iam.md)'
- '[lobby.md](../references/modules/lobby.md)'
- '[matchmaking.md](../references/modules/matchmaking.md)'
- '[session.md](../references/modules/session.md)'
- '[store-entitlements.md](../references/modules/store-entitlements.md)'
- '[statistics.md](../references/modules/statistics.md)'
- '[leaderboards.md](../references/modules/leaderboards.md)'
- '[achievements.md](../references/modules/achievements.md)'
- '[social.md](../references/modules/social.md)'
- '[analytics.md](../references/modules/analytics.md)'
- '[auth-flow.md](../references/integrate/auth-flow.md)'
- '[lobby-session.md](../references/integrate/lobby-session.md)'
- '[crossplay-identity.md](../references/integrate/crossplay-identity.md)'
- '[live-ops-rollout.md](../references/cookbook/live-ops-rollout.md)'
- '[install-sdk.md](install-sdk.md)'
- '[install-unreal-sdk.md](install-unreal-sdk.md)'
- '[install-unity-sdk.md](install-unity-sdk.md)'
- '[debug.md](debug.md)'
---

# AGS Module Integration

Wire individual AGS modules into the project — IAM auth flow first, then everything else. Reads the per-module references and applies them to the user's specific engine and codebase.

If the user provides or references an approved wizard plan document from `docs/ags-plans/`, execute that plan first. The wizard plan is the contract for the requested feature slice; the generic module order below is the fallback when no approved plan document is supplied.

This subskill assumes the SDK is installed and the test login works. If not, route to the selected AGS SDK subskill first: `/ags install-unreal-sdk` for Unreal, `/ags install-unity-sdk` for Unity, or `/ags install-sdk` for Godot, Roblox, Web SDK, and custom-engine REST fallback.

Do not satisfy this prerequisite by calling the Unreal SDK MCP server's `install_unreal_sdk` tool. The Unreal SDK MCP is for SDK symbol/snippet/example lookup during integration; AGS SDK installation flow control belongs to the AGS subskills.

If AGS namespace/IAM settings are missing or placeholder-only, do not add code that merely fails more clearly. Route to `/ags connect-portal`; it owns AGS CLI-backed namespace/IAM setup, login-method enablement, `.env`, and engine config values.

## Behavior Constraints

<grounding_rules>

Module behavior must trace to `references/modules/<name>.md`. Cross-module flows (Lobby ↔ Matchmaking ↔ Sessions ↔ AMS) trace to `references/integrate/lobby-session.md`. Auth flow specifics trace to `references/integrate/auth-flow.md`.

Per-engine code idioms (delegate vs. callback vs. coroutine vs. Promise) trace to the matching `references/sdks/game-engine/<engine>.md` or `references/sdks/web/typescript.md`.

Auth integration is a specialization inside this subskill. For IAM work, always ground the flow in `references/modules/iam.md`, `references/integrate/auth-flow.md`, and, when login fails, `references/debug/auth-failures.md`.

Don't fabricate SDK method signatures. When the user needs a specific signature, point at the SDK's docs / GitHub.

</grounding_rules>

<tool_usage_rules>

- `Read` references for the module being wired and the matching SDK reference.
- `Read` any referenced wizard plan document under `docs/ags-plans/` before reading module references.
- `Glob` to locate the right files in the project (e.g. find the existing auth handler to wire AGS auth into).
- `Edit` / `Write` for code changes — show diffs before applying.
- `Bash` for build / smoke-test commands the user explicitly approves (compile, run, hit a test endpoint).
- Don't read other subskills.

</tool_usage_rules>

<dependency_checks>

Before wiring a module:

1. The SDK is installed and the test login passes (the selected AGS SDK subskill completed).
2. The IAM client has the scopes the module requires (Lobby needs lobby scopes, Matchmaking needs matchmaking scopes, etc.).
3. If the module depends on another (Sessions on Matchmaking on Lobby on IAM), confirm the dependency is wired first.

If a precondition fails, surface it and route appropriately (`/ags connect-portal` for missing/placeholder IAM settings, login-method enablement, or IAM client scope changes; `/ags install-unreal-sdk`, `/ags install-unity-sdk`, or `/ags install-sdk` if the SDK isn't healthy).

When executing a wizard plan document, also confirm that the current code/config still matches the plan's `Confirmed Context`, `Affected Areas`, and `AGS Modules`. If the plan is stale, stop and ask whether to revise the plan with `/ags wizard` before editing code.

</dependency_checks>

<action_safety>

Edits user code. Specifically:

- Show the diff before applying any code change.
- For new files, show the full file before writing.
- For changes to auth-handling code (the most sensitive area), confirm with the user before applying.
- Test logins before declaring a module wired — don't claim success without a working call.
- Do not silently reinterpret a wizard plan. If the plan is ambiguous, ask for clarification before editing.

</action_safety>

<output_contract>

End each module with a "wired" mini-summary:

```
[Module] wired

  Files touched:    <list>
  Verification:     <test call result>
  Module-specific:  <module-specific notes>

Next module: <name> (or "stop and run the game to verify, then come back")
```

After all requested modules are wired, end with:

```
Integration session complete.

  Modules wired this session:  <list>
  Modules still pending:       <list>
  Recommended next session:    <next module>
```

</output_contract>

<completeness_contract>

A module is "wired" when:

1. The relevant SDK calls are in the project at sensible places.
2. A smoke test exercises the module end-to-end (e.g. for Lobby: connect to lobby, send a message, receive presence update).
3. The smoke test passes.

A session is "complete" when the user is satisfied or has hit the limit of what they want done in one sitting.

</completeness_contract>

## Workflow

### Wizard plan document flow

Use this flow when the user says to integrate from a wizard plan, references a file under `docs/ags-plans/`, or says "use the plan" and exactly one plan exists.

1. **Find the plan document**:
   - If the user gives a path, read that file.
   - If the user gives a feature name, `Glob` `docs/ags-plans/*.md` and pick the matching file, asking if multiple match.
   - If no plan can be found, stop and ask the user to run `/ags wizard` first.
2. **Read the wizard plan document** before reading module references. Extract:
   - `Approved feature`
   - `Confirmed Context`
   - `Goal`
   - `Non-Goals`
   - `Affected Areas`
   - `AGS Modules`
   - `Implementation Steps`
   - `Verification`
   - `Risks And Open Questions`
3. **Validate current prerequisites** against the plan:
   - SDK/plugin setup still exists.
   - AGS config still contains real base URL, namespace, and client ID.
   - The affected files/areas still exist or have clear replacements.
   - Required AGS module references exist in this skill.
4. **Mirror plan steps into update_plan**:
   - Convert each item in `Implementation Steps` into an `update_plan` step.
   - Add one final verification step from the plan's `Verification` section if not already present.
   - Only one plan step may be `in_progress` at a time.
   - Before starting a plan step, update it to `in_progress`.
   - After finishing and verifying it, update it to `completed`.
5. **Execute step by step**:
   - For each step, read the relevant module and SDK references.
   - Locate files via `Glob` / `Read`.
   - Show diffs before editing.
   - Apply edits only after confirmation when the step touches auth or broad shared code.
6. **Verify using the plan**:
   - Run the verification commands or smoke path described in the plan.
   - If verification differs from the plan because the project changed, explain the delta and ask before substituting another check.
7. **Summarize plan execution**:

```text
Wizard plan integrated.

  Plan:              docs/ags-plans/<file>.md
  Feature:           <approved feature>
  Files touched:     <list>
  Verification:      <result>
  Follow-up:         <remaining risk / next module / none>
```

If the plan includes multiple modules, execute only the approved feature slice unless the user explicitly asks to continue into the next slice.

### Module wiring order (default)

```
   1. IAM            (auth flow — required for everything else)
   2. Lobby          (party / presence / chat)
   3. Matchmaking    (rule submission and ticket lifecycle)
   4. Session        (game session creation, server allocation)
   5. Store          (catalog browse, purchase flow)
   6. Statistics     (stat update, stat readback, cycles when needed)
   7. Leaderboards   (score posting / stat ranking queries)
   8. Achievements   (criteria evaluation, unlock handling)
   9. Social         (friends, blocking, notifications)
  10. Analytics      (custom event emission)
```

This order respects dependencies — IAM is the basis for everything; Sessions depends on Matchmaking depends on Lobby; Leaderboards and Achievements often depend on Statistics stat codes and cycles.

When the prompt combines progression, Statistics, and Achievements, wire Statistics as the source of progression first. For counter-style progression, prefer the native statistic-backed achievement path: configure or confirm an incrementing stat, update that stat from gameplay, then configure the achievement criterion to unlock from the stat value or threshold. Do not skip this option or route to custom achievement logic unless the requested rule cannot be represented by a statistic/cycle/event criterion.

For specific cross-module flows (Lobby → Matchmaking → Session → AMS), see `references/integrate/lobby-session.md`.

### IAM auth integration flow

When the requested module is IAM/auth/login, treat it as a focused auth integration inside this subskill:

1. **Confirm required tool** — `ags-cli` is available, or route to `/ags install-cli` before relying on CLI-backed IAM checks.
2. **Confirm related service** — IAM is the only AGS service in scope for the first auth slice. Defer Lobby, Matchmaking, Store, and other module wiring until login is verified.
3. **Confirm SDK prerequisite** — use the project type to pick the required AGS subskill: `/ags install-unreal-sdk` for Unreal, `/ags install-unity-sdk` for Unity, or `/ags install-sdk` for Godot, Roblox, Web SDK, and custom-engine REST fallback. Do not call the Unreal SDK MCP `install_unreal_sdk` tool from this integration flow.
4. **Read the auth docs** — read `references/modules/iam.md` and `references/integrate/auth-flow.md` before editing. If a login attempt already fails, also read `references/debug/auth-failures.md`.
5. **Check platform credentials** — identify the requested login method (Steam, PSN, Xbox, Epic, Apple, Google, Facebook, device/headless, email/password, etc.), then verify the namespace, public IAM client, login-method enablement, redirect/config values, and engine config are real rather than placeholders. Route to `/ags connect-portal` for missing or unclear AGS-side IAM setup.
6. **Wire game login logic** — locate the existing login/bootstrap/auth handler, add the minimal SDK login call using the engine's idioms, and keep token/session handling aligned with the project.
7. **Run the smoke test** — build or run the smallest available auth path. IAM is wired only when login returns an AGS token and a second authenticated call, such as current-user/profile lookup, succeeds.

### Per-module flow

For each module the user wants wired:

1. **Read** the matching `references/modules/<name>.md` and the relevant `references/integrate/<flow>.md`.
2. **Locate** the right place in the project (existing auth handler, existing matchmaking entry, etc.) using `Glob`.
3. **Show the wiring** as a diff. Confirm with the user.
4. **Apply** the change.
5. **Test** — run the smoke-test call for the module:
   - IAM: `Login` → token returned → second authenticated call works.
   - Lobby: `Connect` → presence event received.
   - Matchmaking: submit ticket → match formed (in dev with prepopulated tickets) or ticket queued.
   - Session: create / join → roster lookup OK.
   - Store: list catalog → at least one item returned (assuming dev catalog has items).
   - Statistics: update stat item → readback returns the new value; for cycle-backed stats, cycle item lookup returns the expected active-cycle value.
   - Leaderboards: post score or update backing stat → rank lookup returns the new score/rank.
   - Achievements: for statistic-backed achievements, increment the backing stat → read stat/progress back → unlock event observed at the configured threshold; for non-stat criteria, trigger criteria → unlock event observed.
   - Social: add friend → friend list returns the new entry.
   - Analytics: emit custom event → confirmed in event browser or via CLI.
6. **Print** the "wired" mini-summary.
7. **Decide** next module with the user.

### When to hand off mid-session

| Situation | Hand off |
|---|---|
| User asks about matchmaking rule design / MMR tuning mid-session | Stop here, route to `/ags-matchmaking` |
| User asks about AMS fleet config | Stop here, route to `/ags-ams` |
| User asks for custom backend logic | Stop here, route to `/ags-extend ask` |
| Test fails repeatedly with auth errors | Route to `subskills/debug.md` or `references/debug/auth-failures.md` |
| Test fails with non-auth errors | Route to `subskills/debug.md` |

## Examples

### IAM auth flow (Unreal)

```
User: /ags integrate — start with IAM.

Skill: [reads references/modules/iam.md and references/integrate/auth-flow.md;
        looks up the current Unreal SDK login API in the SDK's docs/repo]
       Located: Source/MyGame/Private/MyAuthHandler.cpp

       Showing diff for AGS login wiring (using the current Unreal SDK
       login signature — exact symbol pulled from the SDK's docs, not
       quoted in this skill since it varies by SDK version):
         + [include the Unreal SDK's User-API header]
         + [call the SDK's Login* API with platform credentials and
            success/error delegates]
       Confirm? (y/n)

User: y

Skill: ✓ Applied diff to MyAuthHandler.cpp
       ✓ Compiled.
       ✓ Smoke test: ran the editor, triggered login, got a token,
         called the get-current-user API — returned non-empty user_id.

       IAM wired

         Files touched:    Source/MyGame/Private/MyAuthHandler.cpp
         Verification:     login → token → GetMyProfile OK
         Module-specific:  Public IAM client; Steam IdP path will
                           be added when you wire Lobby.

       Next module: Lobby (or stop here and run the game to verify)
```

### Mid-session handoff

```
User: ...actually how do I tune the MMR formula?

Skill: That's matchmaking depth — wrong subskill. Stop /ags integrate
       here and run /ags-matchmaking when you're ready to design the rule
       set and tune MMR. The current Matchmaking wiring (ticket submit
       and result handling) is what /ags integrate covers; the rule and
       MMR side belongs in /ags-matchmaking.

       Want to keep going with the next module here, or stop?
```

## Error handling

- **Test fails after applying a diff** — surface the error; route to `subskills/debug.md` if it's not obvious.
- **User wants to skip IAM and go straight to Lobby** — explain that without IAM, Lobby calls fail. Confirm IAM is at least minimally wired before continuing.
- **Module the user names doesn't exist** (e.g. "wire AccelByte Voice") — say so; name the closest fit; route to Extend if applicable.
