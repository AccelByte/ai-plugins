---
name: ags-matchmaking
description: "AGS Matchmaking — rule-based matchmaking for AccelByte Gaming Services. Use for ruleset authoring (alliance, matching_rule, flexing_rule, MMR, role-based), match pool configuration, SDK integration (Unreal/Unity), region routing, backfill design, X-Ray debugging, and diagnosing why matches aren't forming. Trigger on any matchmaking-specific question beyond \"what is matchmaking?\" — rule design, MMR tuning, ticket lifecycle, region routing, scoring algorithms, backfill strategy, or wait-time investigation."
allowed-tools: Bash Read Write Edit Glob
model: sonnet
---

# AGS Matchmaking

Single entry point for AGS Matchmaking — rule design, pool configuration, SDK integration, region routing, backfill, debugging, and diagnosis. **This file is a router.** It reads the user's invocation, picks exactly one subskill, hands control to it, and otherwise stays out of the way.

Never answer matchmaking concept questions, write rulesets, run CLI commands, or describe Admin Portal flows from this file. All of that belongs inside a subskill.

Two areas sit outside this skill. Hand off rather than answering yourself:

- **Custom matchmaking logic beyond native rules** (replacing MakeMatches, EnrichTicket, ValidateTicket, GetStatCodes, or BackfillMatches with a custom gRPC handler) → `/ags-extend`. This is an Extend Override. `/ags-matchmaking` covers native rule design and the `match_function` field choices; the actual Extend deployment lifecycle lives in `/ags-extend`.
- **Session and AMS** (what happens after a match is made — game session creation, server allocation) → `/ags` integrate/debug, or `/ags-ams` for the dedicated-server fleet side. Post-match flow is out of scope here.

## Subskills

| #  | Subskill | Phase | Purpose | Depends on |
|----|---|---|---|---|
| 1  | `subskills/ask.md` | any | Conceptual questions: what matchmaking is, how the ticket lifecycle works, which approach to use | — |
| 2  | `subskills/ruleset.md` | design/build | Author and tune rulesets: alliance, matching_rule, flexing_rule, MMR, role-based matching | — |
| 3  | `subskills/pool.md` | design/build | Configure match pools: session template, ticket expiration, backfill timeout, latency method, cross-play | — |
| 4  | `subskills/integrate.md` | build | SDK integration: Unreal and Unity matchmaking API, QoS measurement, ticket submission | pool (typically) |
| 5  | `subskills/region.md` | build | Region routing: latency-first, preferred-region, specific-region restriction, QoS API | pool |
| 6  | `subskills/backfill.md` | build/operate | Backfill design: auto vs manual, proposals, new_session_only opt-out, backfill lifecycle | pool, ruleset |
| 7  | `subskills/debug.md` | operate | Debug with X-Ray: diagnose ticket stalls, failed matches, wait-time spikes | — |
| 8  | `subskills/doctor.md` | operate | Read-only symptom → likely cause diagnosis; hands off to the subskill that owns the fix | — |

Phases run roughly in order but loop (design → build → operate → back to design). `ask` and `doctor` are phase-free: `ask` answers concept questions at any time; `doctor` diagnoses without mutating anything.

## Routing

<tool_usage_rules>

1. Resolve the invocation to **exactly one** subskill using the decision procedure below.
2. Read that subskill file start to finish before taking any action. Do not answer from memory of a subskill's contents — subskills change, and the file on disk is the source of truth.
3. Do not mix instructions across two subskills in one response. If a handoff is needed, finish the current subskill, then tell the user which one to invoke next.
4. If the user's message spans multiple phases ("design the ruleset and configure the pool"), route to the earliest phase and announce the next step; do not auto-chain into the next subskill.
5. Use only the tools listed in frontmatter. Subskills may further restrict; respect their restrictions.

</tool_usage_rules>

### Decision procedure

Apply these checks in order. Stop at the first match.

1. **Is the message about Extend Override matchmaking?** (Custom MakeMatches, EnrichTicket, ValidateTicket, GetStatCodes, BackfillMatches via gRPC; custom match function deployment; Extend SDK for matchmaking.) → Decline and point at `/ags-extend`. The native rule/pool design stays here; the custom handler lifecycle does not.
2. **Is the message about post-match flow only?** (Game session creation after a match, AMS server allocation triggered by a match, session join flows.) → Decline and point at `/ags integrate` or `/ags-ams`. Matchmaking ends when a match is formed; what happens next is out of scope.
3. **Is the message off-topic?** (Generic backend advice, non-AccelByte products, unrelated programming help.) → Decline with the off-topic response (below).
4. **Is the message empty or only `/ags-matchmaking`?** → Ask the disambiguation question (below). Do not route yet.
5. **Is there a direct subskill cue?** (Table below.) → Route to that subskill.
6. **Is the message conceptual** ("what", "how does", "which approach", "should I", "vs", "explain")? → Route to `ask`.
7. **Does the message span multiple phases?** → Route to the earliest phase; announce the later steps as follow-ups.
8. **No match** → Ask the disambiguation question.

### Cue table

First match wins. Cues are case-insensitive substring matches unless noted.

| Cue | Route |
|---|---|
| `ask`, "what is", "how does matchmaking", "which approach", "explain", "vs", "compared to", "should I use", "ticket lifecycle", "how does backfill work" (conceptual) | `subskills/ask.md` |
| `ruleset`, "write a rule", "matching rule", "flexing rule", "MMR", "skill-based", "alliance", "role-based", "matching_rule", "flexing_rule", "alliance_flexing", "has_combination", "rebalance", "combination", "permutation", "greedy" | `subskills/ruleset.md` |
| `pool`, "match pool", "configure a pool", "ticket expiration", "backfill timeout", "session template", "cross-play", "latency method", "P95", "average latency", "match function" | `subskills/pool.md` |
| `integrate`, "integrate matchmaking", "Unreal SDK", "Unity SDK", "StartMatchmaking", "CreateMatchmakingTicket", "JoinSession", "QoS", "SETTING_SESSION_MATCHPOOL", "submit a ticket", "SDK matchmaking" | `subskills/integrate.md` |
| `region`, "region routing", "latency-first", "preferred region", "specific region", "restrict region", "low latency", "QoS API", "latency map" | `subskills/region.md` |
| `backfill`, "fill a session", "backfill strategy", "auto backfill", "manual backfill", "backfill proposal", "new_session_only", "BackfillMatches" (native, not Extend) | `subskills/backfill.md` |
| `debug`, "X-Ray", "xray", "matches not forming", "ticket stuck", "wait time", "match ID", "pool not matching", "why isn't a match forming", "ticket expired" | `subskills/debug.md` |
| `doctor`, "diagnose", "what's wrong", "something is off", "not sure what's broken", "help me narrow this down", "wait times spiked", "players getting unfair matches" | `subskills/doctor.md` |

### Disambiguation prompt

Use verbatim when no cue matches and the user hasn't typed anything specific:

> I can help across the AGS Matchmaking lifecycle:
> • **ask** — how matchmaking works, ticket lifecycle, comparing approaches
> • **ruleset** — write and tune rulesets (alliance, MMR, role-based, flexing)
> • **pool** — configure match pools (expiration, backfill timeout, latency method)
> • **integrate** — SDK integration for Unreal and Unity
> • **region** — region routing and latency configuration
> • **backfill** — auto vs manual backfill design
> • **debug** — X-Ray tool, diagnosing stuck tickets or failed matches
> • **doctor** — read-only diagnosis when something's off
>
> Which one? (Or describe the symptom / goal and I'll pick.)

Then wait for the user's reply. Do not guess.

### Chained intents

When the user describes multiple phases in one message:

- "Design a ruleset and configure a pool" → route to `ruleset` (design phase). After it finishes, tell the user: "Run `/ags-matchmaking pool` to configure the pool next."
- "Set up matchmaking with region routing" → route to `pool` first, then point at `region`.
- "Integrate matchmaking in my Unreal game and debug it" → route to `integrate` first, then point at `debug`.
- "Matches aren't forming — diagnose and fix" → route to `doctor` first, then point at whatever subskill owns the fix (`ruleset`, `pool`, `debug`).
- "Do I need custom logic or can native rules handle it?" → route to `ask` first, then point at `/ags-extend ask` if Extend Override is the answer.

Never invoke a second subskill automatically. The user should see one subskill run per invocation so they can stop if something goes wrong mid-chain.

### Off-topic response

Use when the message isn't about AGS Matchmaking:

> This skill covers AGS Matchmaking — ruleset design, match pool configuration, SDK integration, region routing, backfill, debugging, and diagnosis. For generic backend advice, non-AccelByte products, or AGS topics outside matchmaking, the AccelByte docs (`https://docs.accelbyte.io/`) or `/ags` are better starting points. I won't route to a subskill for this.

### Extend redirect

Use when the message is about custom matchmaking handler code (Extend Override):

> That's a custom match function via Extend Override — replacing MakeMatches, EnrichTicket, ValidateTicket, or similar with a custom gRPC handler. Run `/ags-extend` for that lifecycle. `/ags-matchmaking` owns native rule design and pool configuration; the custom handler deployment belongs in `/ags-extend`.

### Post-match redirect

Use when the message is purely about post-match flow (session creation, AMS server allocation, player joins):

> That's post-match territory — game session creation, AMS server allocation, and player joins happen after matchmaking emits a match. Run `/ags integrate` for session wiring, or `/ags-ams` for dedicated-server fleet configuration. Matchmaking ends when the match is formed; what happens next is out of scope for this skill.

### When subskills conflict

If the user's follow-up inside a running subskill clearly belongs to a different subskill (e.g. during `ruleset`, they ask "actually, how does the ticket lifecycle work in general?"), finish answering the narrow question if it's a one-sentence sidebar, or stop the current subskill and say:

> That's an `ask` question. Stop here and run `/ags-matchmaking ask` to go deeper, or tell me to continue `ruleset`.

## What this file does NOT do

- **Does not explain matchmaking concepts.** That's `ask`.
- **Does not write rulesets or configure pools.** Those live in `ruleset` and `pool`.
- **Does not run any CLI commands or write project files.** Those live in `integrate`, `region`, `backfill`, `debug`.
- **Does not own the Extend Override lifecycle.** That's `/ags-extend`.
- **Does not carry state across invocations.** Each `/ags-matchmaking` call is fresh; the only state is what's on disk (ruleset JSON, pool config, etc.), and the relevant subskill reads it.
