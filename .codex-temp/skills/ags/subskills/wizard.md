---
name: ags-wizard
description: 'Checklist-driven AGS feature planner: verifies init prerequisites, reads
  the project, confirms game context with the user, suggests the next AGS-backed feature
  slice, iterates on an implementation plan, and writes an approved plan document.'
allowed-tools: Read Write Glob Bash
model: sonnet
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[modules-checklist.md](../references/init/modules-checklist.md)'
- '[marketing-to-service.md](../references/catalogs/marketing-to-service.md)'
- '[sdk-quickstart.md](../references/init/sdk-quickstart.md)'
- '[_index.md](../references/sdks/_index.md)'
- '[init.md](init.md)'
- '[integrate.md](integrate.md)'
---

# AGS Project Wizard

Checklist-driven planner for choosing the next useful AGS-backed feature slice in an already initialized project. The wizard reads the codebase, confirms what it inferred with the user, suggests a small set of next features, iterates on an implementation plan, and writes the approved plan to disk.

This subskill is mostly read-only, but it may write the final approved plan document. It does not install SDKs, configure portal values, call AccelByte APIs, or edit game/runtime code.

## Checklist

- [ ] Verify init prerequisites
- [ ] Read project context
- [ ] Confirm game context
- [ ] Suggest first features
- [ ] Draft implementation plan
- [ ] Revise until approved
- [ ] Write plan document

## Behavior Constraints

<grounding_rules>

- Start from the actual project, not a generic AGS module tour.
- Recommendations must trace to:
  - `references/init/modules-checklist.md` for module selection.
  - `references/catalogs/marketing-to-service.md` for purpose-built service selection when a feature could otherwise be modeled as generic storage.
  - `references/sdks/_index.md` for SDK/project type fit.
  - `references/init/sdk-quickstart.md` for verification expectations.
- Do not fabricate module behavior, SDK calls, or code architecture. If project code is unclear, state the uncertainty and ask.
- Suggest one or two small implementation slices first. Do not present a full product roadmap unless the user asks for roadmap planning.
- If a request belongs to a peer skill, flag it instead of pretending this wizard owns it:
  - Deep matchmaking rules/MMR -> `/ags matchmaking`.
  - Matchmaking player-count relaxation, such as "4 players, then loosen to 1" -> `/ags matchmaking ruleset`; this is `alliance_flexing_rule`, not a session-template-only or pool-only setting.
  - Dedicated server fleet work (AMS / Multiplayer Servers / Dedicated Server Hub) -> `/ags ams`.
  - Custom backend behavior or service override -> `/ags-extend`.
  - Build distribution/crash/playtest -> `/adt`.

</grounding_rules>

<tool_usage_rules>

- `Glob` and `Bash` are allowed for inspection only: project files, Git status, directory layout, config existence, package/project metadata, and lightweight searches.
- `Read` project files and AGS references needed to understand the project and ground suggestions.
- `Write` only for the final approved plan document under `docs/ags-plans/`.
- Do not edit source code, engine config, `.env`, MCP config, plugin files, or portal resources.
- Do not read other subskills except `init.md` when explaining the prerequisite gate and `integrate.md` when pointing to the next implementation phase.

</tool_usage_rules>

<dependency_checks>

Wizard requires the project to have completed `/ags init` or equivalent setup first. Before planning features, verify required setup artifacts for the detected project type.

For all project types, check:

- AGS project config values exist somewhere appropriate for the project: base URL, namespace, and client ID.
- AGS SDK/plugin is installed or the project has equivalent SDK dependencies.
- AGS CLI status is known, or the user has explicitly chosen manual portal management.

For Unreal, check:

- A `.uproject` exists.
- `Plugins/AccelByte/OnlineSubsystemAccelByte`, `Plugins/AccelByte/AccelByteUe4Sdk`, or equivalent `.uproject` plugin references exist.
- `Config/DefaultEngine.ini` has real AccelByte config values, including quoted URL-like fields such as `RedirectURI="..."` and `BaseUrl="..."`.

For Unity, Godot, Roblox, Web, or custom engines, check for their expected SDK/config markers from the install subskills or project convention.

If required plugins, SDKs, tools, or AGS config are not present and the user asked to plan only, offer two paths:

1. Proceed with planning only, with missing setup called out as prerequisites in the plan.
2. Run `/ags init` first, then rerun `/ags wizard` for an implementation-ready plan.

Only produce a planning-only document if the user explicitly chooses that path. Do not present planning-only output as implementation-ready.

</dependency_checks>

<action_safety>

The wizard is a planning tool.

- Do not modify implementation files.
- Do not install anything.
- Do not call AGS APIs.
- Do not write the final plan document until the user explicitly approves the plan.
- If the user asks to implement immediately, stop and point at the approved plan plus `/ags integrate` as the execution phase.

</action_safety>

<output_contract>

During the workflow, produce:

1. A project-context confirmation prompt.
2. A short feature suggestion list.
3. A draft implementation plan.
4. After final approval, a written plan document path.

Final response after writing the approved plan:

```text
AGS wizard plan written.

  Plan:       docs/ags-plans/<yyyy-mm-dd>-<slug>.md
  Project:    <detected project type and name>
  Feature:    <approved feature slice>
  Next step:  /ags integrate
```

Do not print the final response if prerequisites are missing or the user has not approved the plan.

</output_contract>

<completeness_contract>

The wizard is complete when:

1. The checklist has been mirrored into the host-native progress tracker or a visible checklist fallback.
2. Init prerequisites are verified, or the wizard has recorded the user's explicit choice to continue with planning-only caveats.
3. The project has been inspected enough to infer game type, engine/runtime, existing AGS-related code/config, and likely next integration points.
4. The user has confirmed or corrected the inferred game context.
5. The user has approved one feature slice to plan.
6. The user has approved the implementation plan, or requested revisions that were incorporated and re-approved.
7. The final plan document has been written under `docs/ags-plans/`.

</completeness_contract>

## Workflow

### Step 0: Mirror The Checklist Into The Host-Native Progress Tracker

Before Step 1, mirror these exact plan steps into the host-native progress tracker. If the harness has no native tracker, keep the same steps as a visible checklist in the response:

1. Verify init prerequisites
2. Read project context
3. Confirm game context
4. Suggest first features
5. Draft implementation plan
6. Revise until approved
7. Write plan document

Set only `Verify init prerequisites` to `in_progress`; all other steps start as `pending`.

### Step 1: Verify init prerequisites

Detect project type and AGS setup artifacts.

Project-shape checks:

```powershell
Get-ChildItem -Recurse -Filter *.uproject
Get-ChildItem -Recurse -Filter ProjectSettings -Directory
Get-ChildItem -Recurse -Filter Assets -Directory
Get-ChildItem -Recurse -Filter project.godot
Get-ChildItem -Recurse -Include *.rbxlx,*.rbxl -File
Get-ChildItem -Recurse -Filter package.json
```

AGS setup checks should be scoped to the detected project. Examples:

- Unreal: `.uproject`, `Plugins/AccelByte/`, `Config/DefaultEngine.ini`, project `Source/` build files.
- Unity: `Packages/manifest.json`, `Assets/`, `ProjectSettings/`, AGS package references.
- Web: `package.json`, AGS SDK dependency, `.env` or app config.
- Generic/custom: `.env`, SDK dependency, and code references to AccelByte/AGS.

If init prerequisites are missing, ask:

```text
Stopped at checklist item: Verify init prerequisites

This project is not ready for AGS feature planning yet. Required AGS SDK/plugin/tools/config are missing or not verified.

Choose one:
1. Planning only - I will continue and list missing setup as prerequisites.
2. Run `/ags init` first - after it installs SDK/plugins/tools and writes project config, rerun `/ags wizard`.
```

If the user chooses planning only, mark `Verify init prerequisites` completed and carry the missing setup list into the plan's Risks And Open Questions and Next Step sections. If the user chooses `/ags init`, stop without producing a plan.

When verified or when planning-only mode is explicitly chosen, mark `Verify init prerequisites` completed and `Read project context` in progress.

### Step 2: Read project context

Read enough codebase context to understand the game and likely integration points.

Inspect:

- Project metadata: `.uproject`, `package.json`, Unity package manifest, Godot project file, or equivalent.
- Existing source layout: `Source/`, `Assets/Scripts/`, `src/`, `Scripts/`, UI/menu/login folders.
- Existing gameplay words in class/file names: player, match, lobby, session, score, stats, leaderboard, achievement, inventory, store, save, profile.
- Existing AGS/AccelByte references and config.
- Git status to avoid planning against uncommitted or generated noise without awareness.

Summarize what was learned in plain language. Do not infer beyond evidence.

When complete, mark `Read project context` completed and `Confirm game context` in progress.

### Step 3: Confirm game context

Ask the user to confirm or correct the inferred context. Use this prompt shape:

```text
This is what I learned from the project:

- Project type: <Unreal / Unity / Godot / Roblox / Web / custom>
- Apparent game shape: <single-player / co-op / competitive / live-service / crossplay / unknown>
- Existing AGS setup: <SDK/config/tool markers found>
- Likely integration points: <login screen, player stats, leaderboard UI, etc.>

Can you confirm whether this project is single-player, co-op, competitive multiplayer, live-service, crossplay, or something else? Feel free to add more information so I can get better context.
```

If the user adds detail, incorporate it. Ask at most one follow-up question at a time when needed.

When the context is confirmed, mark `Confirm game context` completed and `Suggest first features` in progress.

### Step 4: Suggest first features

Use the project evidence and user confirmation to suggest one or two practical first AGS feature slices. Keep suggestions small and executable.

Prefer a purpose-built AGS service before Cloud Save. If the project evidence shows scores, XP, MMR, wins/losses, counters, milestones, rewards, inventory, entitlements, legal consent, analytics, friends/presence, sessions, or matchmaking inputs, suggest the matching native module first. Suggest Cloud Save only for save slots, opaque save blobs, preferences, drafts, or custom unstructured data that does not need Statistics, Leaderboards, Achievements, Store/Entitlements, Inventory, Rewards, Legal/GDPR, Analytics, Lobby, Session, Matchmaking, or another native AGS workflow.

Examples:

- Device ID login for an Unreal game client.
- Basic authenticated profile/current-user call after login.
- Simple Statistics write/read for a score or match result already visible in code.
- A simple leaderboard around an existing score value.
- Achievements only if the project already has clear milestones.
- Challenges if the project has quest-style milestones or daily/weekly goals.
- Cloud Save for single-player save slots or opaque save blobs only after native modules are ruled out.
- Lobby/session only if multiplayer flow exists or the user confirmed multiplayer.

Ask the user to approve one suggestion or name another feature they want instead.

When the user chooses a feature, mark `Suggest first features` completed and `Draft implementation plan` in progress.

### Step 5: Draft implementation plan

Draft a concrete plan for the chosen feature. The plan should include:

- Goal and non-goals.
- Files/areas likely to change.
- AGS module(s) involved.
- Data/config needed.
- Implementation steps.
- Verification steps.
- Risks/open questions.
- Follow-up command or subskill for execution, usually `/ags integrate`.

Do not write the plan document yet. Present the draft in chat and ask for approval or revisions.

When a draft is presented, mark `Draft implementation plan` completed and `Revise until approved` in progress.

### Step 6: Revise until approved

If the user asks for changes, revise the plan and ask for approval again. If the revision reveals missing context, return to a short interview and update the plan.

Do not proceed until the user clearly approves the plan.

When approved, mark `Revise until approved` completed and `Write plan document` in progress.

### Step 7: Write plan document

Write the approved plan under:

`docs/ags-plans/<yyyy-mm-dd>-<feature-slug>.md`

Create `docs/ags-plans/` if needed. The document must include:

```markdown
# <Feature Plan Title>

Date: <yyyy-mm-dd>
Project: <project name/type>
Approved feature: <feature slice>

## Confirmed Context

## Goal

## Non-Goals

## Affected Areas

## AGS Modules

## Implementation Steps

## Verification

## Risks And Open Questions

## Next Step
```

After writing the file, mark `Write plan document` completed and print the final response from `output_contract`.

## Error Handling

- **Init not run / missing AGS setup** - offer planning-only with caveats, or stop and ask the user to run `/ags init` first.
- **Multiple projects detected** - ask which project to plan for before reading deeply.
- **Codebase too large or ambiguous** - summarize what was inspected, then ask one clarifying question.
- **User wants a feature AGS does not own** - route to the appropriate peer skill or explain the boundary.
- **User asks to implement before approving a plan** - stop at planning and ask for explicit approval first.
