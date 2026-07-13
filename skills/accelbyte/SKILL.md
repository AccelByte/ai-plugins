---
name: accelbyte
description: "Use before working with AccelByte skills or when a request mentions AccelByte, AGS, AMS, Extend, Matchmaking, ADT, IAM, namespaces, SDKs, AccelByte CLI, or AccelByte MCP servers. Establishes AccelByte skill routing, grounding rules, and host-native progress tracking across harnesses."
---

# Using AccelByte Skills

Use this as the AccelByte skill-family preflight. Keep it small: route to the right product skill, keep claims grounded, and translate ordered workflow tracking to the current harness.

## Skill Routing

- Player-facing AGS game flows, including login -> matchmaking -> session/DS travel, route to `/ags`.
- General AGS, IAM, namespace, SDK, store, lobby, statistics, leaderboards, achievements, social, analytics, or "what should I use?" questions -> `/ags`.
- Matchmaking rulesets, pools, MMR, tickets, region routing, backfill, and X-Ray debugging route to `/ags matchmaking`.
- AMS, dedicated server fleet, server binary upload, watchdog, warmed pool, claim keys, or local DS lifecycle route to `/ags ams`.
- Extend, Override, Event Handler, Service Extension, Extend App UI, or Extend SDK work -> `/ags-extend`.

## Grounding

- Read the selected AccelByte skill and its selected subskill before acting.
- Prefer bundled references over memory for product facts, CLI commands, SDK behavior, and setup contracts.
- When a step fetches a git repository (clone, submodule, or a package manager resolving a git URL) and the naive command fails, follow `references/git.md` — try the command, then authenticate via `gh` or SSH, then a user-provided local copy — before falling back to manual steps.
- If a live AGS namespace, CLI, MCP server, or project file is required, inspect it directly or state the blocker.

## Live Auth Preflight

Before starting work that will depend on a live AccelByte environment, perform the cheapest read-only auth freshness check for the tool you intend to use. Do this before long codebase scans, generated plans, or multi-step edits so expired credentials do not waste the user's time.

- If using an AccelByte MCP server, make one lightweight read-only MCP call first, such as a tool/capability discovery call or a harmless describe/search/read operation relevant to the task. If it returns an unauthenticated, expired token, login required, consent required, or re-auth needed response, stop immediately and ask the user to re-authenticate or reload/restart the MCP server before continuing.
- If using the AGS CLI, run `ags auth status` before other AGS CLI work. If it is unauthenticated, expired, pointed at the wrong portal/profile, or otherwise cannot prove a valid session, stop and ask the user to run `ags auth login` or select the correct profile before continuing.
- If both MCP and CLI are available, check the one you plan to rely on for live data or mutations. Do not burn time gathering deep local context first when the next required live call would be blocked by auth.
- For conceptual answers or local-only source edits that do not need live AGS data, skip this preflight and say when live verification was not required.

## Host-Native Progress Tracking

Mirror the ordered steps into the host-native progress tracker when the harness provides one. If the harness has no native tracker, maintain a visible checklist in the response.

Known tracker names:

- Codex: `update_plan`
- Claude Code: `TodoWrite`
- OpenCode: `todowrite`
- Cursor, Kiro, or unknown harness: use the native task/progress UI if present; otherwise use a visible checklist.
