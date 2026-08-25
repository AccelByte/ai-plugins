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
- Reviewing an AccelByte integration that already exists — "check my integration", "any deprecated APIs", "what breaks if we upgrade the SDK", "is this AMS fleet or Extend app sized right" — routes to `/teammate`. It scans and reports; it does not teach a module or wire one up, so a "how do I add X" question stays with `/ags`.
- Handing over a document to keep — a technical design, a milestone plan, meeting notes, a postmortem — "remember this technical design", "add these notes to memory" — also routes to `/teammate`. It files the text as given and never summarises it, and it needs the teammate memory server.

## Tool Selection and Fallback

Route to the product skill before choosing a tool. Within that product skill:

- Prefer MCP for remote operations that both MCP and the selected product's CLI support.
- Prefer the selected product's own CLI for local work and product-lifecycle operations.
- Fall back to the other supported tool only when the preferred tool is unavailable or lacks the required capability.
- Never use fallback to bypass an authentication or authorization failure, missing consent, or a required confirmation. Stop and resolve that gate on the selected path.

## Grounding

- Read the selected AccelByte skill and its selected subskill before acting.
- Prefer bundled references over memory for product facts, CLI commands, SDK behavior, and setup contracts.
- When a step fetches a git repository (clone, submodule, or a package manager resolving a git URL) and the naive command fails, follow `references/git.md` — try the command, then authenticate via `gh` or SSH, then a user-provided local copy — before falling back to manual steps.
- If a live AGS namespace, CLI, MCP server, or project file is required, inspect it directly or state the blocker.

## Terminology

**Shared Cloud is now called Public Cloud.** Same deployment tier, renamed — the AccelByte-managed multi-tenant offering, as distinct from Private Cloud and BYOC.

- Write **Public Cloud** in every answer, even when the user says "Shared Cloud".
- Treat "Shared Cloud" in a user's message, an older AccelByte doc, a screenshot, or a support thread as meaning Public Cloud. Don't ask which they mean, and don't treat it as an unknown tier.
- Say the old name once, in passing, only when the user used it — enough to confirm you understood them ("Public Cloud, formerly Shared Cloud"). Don't correct them, and don't repeat it after the first mention.
- The rename does not apply to `:::sharedCloud…` admonition markers in AccelByte documentation source. Those are markup, not the product name; leave them as they are.

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
- Claude Code: `TaskCreate` / `TaskUpdate` (named `TodoWrite` before 2.1)
- OpenCode: `todowrite`
- Cursor, Kiro, or unknown harness: use the native task/progress UI if present; otherwise use a visible checklist.

These names are a starting point, not a check. Harnesses rename their trackers between versions, so bind whichever one this harness exposes; a name from this list being absent means look for the current one, not that there is no tracker. Fall back to a visible checklist only when the harness genuinely offers none.

**Not in the tool list is not the same as not available.** Some harnesses defer tools: they are usable but appear nowhere until fetched by name, so a tracker that is fully working reads as missing to anything that only scans the visible list. Establish absence with an **exact-name** lookup — on Claude Code that is one `ToolSearch` call, `select:TaskCreate,TaskUpdate,TodoWrite` — before concluding anything. A keyword or fuzzy search does not settle it: it ranks by wording, so a bad query returns unrelated tools whether the tracker exists or not, and reading that noise as proof of absence is how a run falls back to a checklist on a harness that had the tracker all along. Fuzzy sweeps are a reasonable second probe for a renamed tracker, never the first.

**And absent is not always broken.** A harness may hold the task tools back by default and hand them over only when the session asks for them, so a lookup that comes back empty can be reporting a switch nobody flipped rather than a harness with no tracker. Claude Code does this from v2.1.233 on its newer model families: `TodoWrite`, `TaskCreate`, `TaskGet`, `TaskUpdate` and `TaskList` are left out unless the session opted in — `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` in the environment, or the names passed to `--allowedTools` / `--tools` at startup — and are provided on every model in background and web sessions. That is the one case where the lookup is right, the fallback is right, and the user can still have the real tracker for the asking. It is also why the same skill tracks properly in one session and falls back in the next: what changed was the session, not the skill.

When the fallback does fire, say which exact names were looked up and came back empty, and — where the harness documents a way to switch the tracker on — the one line that does it. A checklist offered with no names behind it is indistinguishable from one offered because nobody checked; a checklist offered with no way out of it makes a setting look like a defect.
