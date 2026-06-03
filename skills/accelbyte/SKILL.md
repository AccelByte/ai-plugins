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
- If a live AGS namespace, CLI, MCP server, or project file is required, inspect it directly or state the blocker.

## Host-Native Progress Tracking

Mirror the ordered steps into the host-native progress tracker when the harness provides one. If the harness has no native tracker, maintain a visible checklist in the response.

Known tracker names:

- Codex: `update_plan`
- Claude Code: `TodoWrite`
- OpenCode: `todowrite`
- Cursor, Kiro, or unknown harness: use the native task/progress UI if present; otherwise use a visible checklist.
