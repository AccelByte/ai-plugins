---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/matchmaking-x-ray-guide/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
see-also:
- '[overview.md](references/overview.md)'
- '[faq.md](references/faq.md)'
---

# AGS Matchmaking — Debugger

Debug AGS Matchmaking problems using the X-Ray tool and known diagnostic patterns. Helps developers trace why tickets aren't matching, why wait times are spiking, and why matches are lopsided. Read-only guidance — this subskill directs to the Admin Portal and does not modify rulesets or pools.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before explaining any diagnostic pattern. X-Ray views, ticket lifecycle stages, and known failure modes are defined there.
- X-Ray has exactly two views: Overview and Timeline. Do not describe views or filters that aren't in the reference.
- Search dimensions for X-Ray: Match ID, Match Pool, Ticket ID, User ID. Do not describe others.
- Do not recommend modifying rulesets or pool configuration from this subskill — point to `/ags matchmaking ruleset` or `/ags matchmaking pool` for changes.
- If the symptom is DS matchmaking with a local DS that is not claimable, first distinguish matchmaking-rule failures from local DS readiness failures. If `amssim` has not shown DS connected, ready received, and heartbeat, route to `/ags ams debug` before analyzing X-Ray rule criteria.

</grounding_rules>

<tool_usage_rules>

- Read `references/overview.md` at the start of every debug session.
- Read `references/faq.md` for known failure patterns ("matches not forming", "wait times spiked", "lopsided matches").
- This subskill is **read-only** — no `Write`, no `Edit`, no `Bash` that modifies state.
- Use `Read` only to read local files the user points to (e.g. a ruleset JSON file they've saved locally).

</tool_usage_rules>

<output_contract>

Three output shapes:

**Local DS readiness failure (before X-Ray):**

Use this when the symptom is "Local DS not claimed" / "amssim local DS not used" and `amssim` has not proven DS connected, ready received, and heartbeat.

```
This looks like a local DS readiness failure, not an X-Ray-first matchmaking-rule investigation yet.

Run /ags ams debug first and verify amssim log evidence for:
  - DS connected
  - ready received
  - heartbeat

X-Ray comes only after local DS readiness is proven and the ticket/session still fails.
```

**No X-Ray data yet (user hasn't used X-Ray):**

```
To diagnose "{symptom}", start here in X-Ray:
  Admin Portal → Matchmaking → X-Ray

  Step 1 — Overview tab: select pool "{pool-name}", set time window to cover
           the affected period. Look for:
           • Drop in match formation rate
           • Spike in average wait time
           • Expired ticket count increase

  Step 2 — Timeline tab: search by {User ID / Ticket ID / Match Pool}. Look for:
           • Which lifecycle stage the ticket reached
           • Which matching_rule criterion blocked the pairing
           • Whether flexing rules were applied

Report what you find and I'll help interpret.
```

**With X-Ray data (user pasted timeline output or described what they saw):**

```
Diagnosis for "{symptom}":
  Stage reached:    {lifecycle stage}
  Blocking criterion: {attribute} {criteria} {reference} — {why it blocked}
  Likely cause:     {from reference}
  Suggested fix:    {specific change} — run /ags matchmaking {subskill} to apply it
```

</output_contract>

<completeness_contract>

Debug is complete when:
- The blocking stage or criterion is identified (or explicitly noted as "can't determine without more X-Ray data").
- A concrete next step is named (specific Admin Portal view, specific field to change, specific subskill to run).
- If the fix requires a ruleset or pool change, the appropriate subskill is named.

</completeness_contract>

## Workflow

### Step 1 — Read the reference

Read `references/overview.md` (ticket lifecycle, X-Ray views) and `references/faq.md` (known failure patterns).

### Step 2 — Classify the symptom

| Symptom | Primary X-Ray signal |
|---|---|
| "Matches not forming" | Timeline: tickets reaching Evaluation but no match emitted |
| "Wait times spiked" | Overview: average wait time chart; Timeline: tickets staying in Evaluation too long |
| "Ticket expired without a match" | Timeline: ticket reached expiration without a pairing event |
| "Match is lopsided / unfair" | Overview: match quality distribution; Timeline: check isForBalancing attributes and rebalance |
| "Backfill not working" | Timeline: backfill ticket IDs not entering pool, or pairing blocked by same criteria |
| "Local DS not claimed" / "amssim local DS not used" | First verify `/ags ams debug` log evidence: DS connected, ready received, heartbeat; then use X-Ray only if the local DS is ready but the ticket/session still fails |
| "Only some players are affected" | Timeline: search by User ID; compare attributes against matched players |
| "Works in dev, broken in prod" | Compare ruleset/pool config between environments; check attribute values in prod tickets |

### Step 3 — Guide X-Ray investigation

Tell the user exactly where to look:

**For "matches not forming":**

```
Open X-Ray → Timeline tab → search by pool name → filter to tickets from the
affected time window.

For each ticket that expired without matching:
  1. Note the last lifecycle stage logged.
  2. Expand the "Evaluation" events — they list each candidate pairing attempted
     and which matching_rule criterion blocked it.
  3. Note the blocking attribute name, the criterion (distance/exact), the
     reference value, and the actual attribute values of the two tickets.

Common findings:
  - MMR distance too tight: both tickets have valid MMR but the gap exceeds
    the matching_rule reference. Fix: loosen the reference, or add a flexing_rule
    with a shorter duration.
  - Partition mismatch: `match_options` attribute differs between tickets
    (e.g. different gameMode). Fix: confirm both clients set the same partition
    value, or widen the partition type from `"all"` to `"any"`.
  - No tickets in the pool: the pool has almost no concurrent players. Fix:
    examine the timeline for ticket counts; if < 2 per minute, the player pool
    is too thin for the current rules. Use alliance_flexing_rule to accept
    asymmetric teams, or widen flexing_rule tolerances faster.
```

**For "wait times spiked":**

```
X-Ray → Overview tab → set time window to 24 h → look at:
  1. "Avg wait time" chart — when did it spike?
  2. "Match formation rate" chart — did it drop simultaneously?
  3. "Expired tickets" count — are many tickets expiring without matching?

If expired count is high: see "matches not forming" flow above.
If expired count is low but wait time is high: the pool is matching but slowly.
  → Check if a new game update changed how clients set attribute values.
  → Check if a regional fleet went offline (no servers → matches stall at session creation).
```

**For "lopsided matches":**

```
X-Ray → Timeline → search by Match ID (if the user has one).
  1. Expand the Evaluation events for the match.
  2. Check which attributes were used for rebalance (isForBalancing: true).
  3. Verify the rebalance method was Combination or Greedy for strict teams,
     or Permutation for flexible.

If the MMR gap within a team is large:
  - The matching_rule distance is wide (or the flexing_rule expanded it).
  - Consider tightening the reference, or adding a "within-team balance" weight
    via normalizationMax.

If one team is consistently stronger:
  - The rebalance method may not be optimal for the player count.
  - Run /ags matchmaking ruleset to adjust the rebalance method and isForBalancing flags.
```

### Step 4 — Interpret pasted X-Ray data

If the user pastes X-Ray timeline output, scan for these signal types (exact format strings may differ from what appears in the Admin Portal — look for the concept, not the literal text):

| Signal to look for | Interpretation |
|---|---|
| Blocked criterion — attribute name + distance/exact + actual vs reference values | MMR or attribute gap exceeded tolerance. Loosen reference or shorten flexing_rule duration. |
| Partition/exact mismatch — two tickets with different values for a partition attribute | Both clients must set the same value for that attribute (check for case, typo, version drift). |
| Ticket expired — timestamp showing ticket reached expiration limit | No compatible ticket appeared within the expiration window. Check concurrent ticket count in Overview. |
| Zero candidates evaluated — ticket entered pool but no other tickets paired | Player population too thin for this pool; check ticket count in Overview tab. |
| Alliance flexing applied — flexing triggered at an early duration | Pool is thin or flexing duration is very short; consider whether looser initial criteria are appropriate. |
| Rebalance ran — candidates selected / dropped for quality | Rebalance is working; if results are still lopsided, check isForBalancing and normalizationMax settings. |

### Step 5 — Route to the fix

After identifying the cause, point to the right subskill:

| Cause | Subskill |
|---|---|
| Ruleset criterion too tight | `/ags matchmaking ruleset` |
| Pool ticket expiration too short | `/ags matchmaking pool` |
| Region latency filtering blocking matches | `/ags matchmaking region` |
| Backfill not working | `/ags matchmaking backfill` |
| Local DS never became ready in `amssim` | `/ags ams debug` |
| Client sending wrong attribute values | `/ags matchmaking integrate` |
| Custom match function (Extend Override) broken | `/ags-extend debug` |

## Examples

### Matches not forming — partition mismatch

```
User: Wait times are 3+ minutes for everyone. Matches used to form in 30 s.

Skill: [reads overview.md, faq.md]

Open X-Ray → Timeline → search by pool "competitive-5v5" → look at tickets from the last hour.

Expand the Evaluation events for any expired ticket. Look for:
  - Which matching_rule was blocking?
  - What values were the two tickets carrying?

If you see "criterion: gameMode exact — BLOCKED", paste both ticket attribute values here.

(Likely cause: a recent client update changed the gameMode string. If the client
now sends "Ranked" instead of "ranked", they won't match — case-sensitive exact match.)
```

### After user pastes X-Ray output

```
User: I see this in the timeline:
  10:04:15  Evaluation — candidate pairing attempted
  10:04:15  BLOCKED: gameMode exact — ticket="ranked", candidate="Ranked"

Skill: Found it. The `gameMode` partition attribute is case-sensitive ("ranked" vs "Ranked").
One side (probably after a recent update) changed the casing. Both clients must send
the same value — fix the mismatch on the client side.

Run /ags matchmaking integrate to verify which SDK call sets this attribute and
update the string constant.
```

## Error Handling

| Situation | Response |
|---|---|
| User asks this subskill to modify a ruleset | "This subskill is read-only. Run `/ags matchmaking ruleset` to change the ruleset." |
| User doesn't have an X-Ray ticket ID or match ID | "Start with the Overview tab in X-Ray, set the time window to the affected period, and look for the wait-time spike. Then drill into Timeline and search by pool name — you don't need a specific ticket ID to start." |
| Custom match function (Extend Override) is in use | "If the pool uses a custom match function, X-Ray still shows the ticket lifecycle up to Evaluation, but the matching logic inside the function is a black box to X-Ray. Check the Extend app's Grafana logs via `/ags-extend observe`." |
| User reports X-Ray shows 0 tickets in the pool | "Zero tickets means clients aren't reaching the pool. Check: (1) Are tickets being submitted at all? Add a log on ticket creation. (2) Is the pool name correct in the client? (3) Is the namespace correct? Run `/ags matchmaking integrate` to verify the client-side submission code." |
