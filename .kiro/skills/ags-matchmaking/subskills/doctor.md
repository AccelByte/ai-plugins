---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/matchmaking-rebalance/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/matchmaking-x-ray-guide/
see-also:
- '[overview.md](../references/overview.md)'
- '[faq.md](../references/faq.md)'
---

# AGS Matchmaking — Doctor

Read-only symptom-driven diagnosis for AGS Matchmaking problems. Ingests the developer's description, cross-references known failure patterns from the references, and names the most likely cause. Does not modify rulesets, pools, or client code. This subskill's job is to narrow the search space and hand the developer to the right subskill for the fix.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` and `references/faq.md` before diagnosing. Both are the authoritative sources for failure modes, ticket lifecycle stages, and known patterns.
- Do not invent failure modes or causes not in those files. If the symptom doesn't map to a documented pattern, say so and point to X-Ray (`/ags-matchmaking debug`) or AccelByte support.
- Do not recommend specific ruleset values, MMR reference numbers, or timeout durations unless they come directly from the reference files.

</grounding_rules>

<tool_usage_rules>

- `Read` only — read `references/overview.md` and `references/faq.md`. No other tools.
- **No `Bash`.** No `Write`. No `Edit`. Doctor never modifies files. Ever.
- If the developer asks for something that requires running a command, name the command and the subskill that owns it, and stop.

</tool_usage_rules>

<output_contract>

Three blocks, printed once:

1. **Symptoms** — one paragraph restating what the developer said in technical terms.
2. **Likely causes** — ordered list, each with:
   - Cause (one line)
   - Evidence (why this matches the symptoms — grounded in a reference)
   - What to check next (specific Admin Portal page, X-Ray search, or subskill)
   - Likelihood: high / medium / low
3. **Next step** — the single most promising investigation path, routed to the subskill that owns it.

End with a support fallback: "If this doesn't resolve it, contact AccelByte support with your namespace, pool name, ticket IDs, and the relevant X-Ray timeline output."

No fix actions in this subskill. No running commands.

</output_contract>

<completeness_contract>

Diagnosis is complete when:
- Every symptom the developer mentioned has at least one candidate cause.
- Every cause is backed by a citation from the reference (overview.md lifecycle stage, faq.md failure pattern).
- Next step names exactly one command or subskill.
- "The references don't cover this" is an acceptable verdict — combine it with a pointer to X-Ray and AccelByte support.

</completeness_contract>

<empty_result_recovery>

If the symptom doesn't map to any documented pattern:
1. Say plainly: "I can't match this to a documented pattern."
2. List the references consulted.
3. Suggest: `/ags-matchmaking debug` for X-Ray investigation, or AccelByte support if the symptom suggests platform-side issues.

Do not fabricate a cause.

</empty_result_recovery>

## Workflow

### Step 1 — Read the references

Read `references/overview.md` (ticket lifecycle, ruleset schema) and `references/faq.md` (known failure patterns).

### Step 2 — Classify the symptom

| Symptom cue | Reference entry point |
|---|---|
| "Matches not forming" / "no matches" / "tickets expiring" | overview.md Evaluation stage; faq.md |
| "Wait times too long" / "queue time spiked" | overview.md Flexing rules; faq.md wait-time patterns |
| "Lopsided matches" / "unfair matches" / "teams unbalanced" | overview.md Rebalance section |
| "Works in dev, broken in prod" | faq.md local-vs-prod section |
| "Only some players affected" | overview.md attribute hydration; match_options partitioning |
| "Backfill not working" | overview.md Backfill section |
| "Role-based match not forming" | overview.md Role-based section |
| "Custom match function failing" | This is Extend territory; overview.md Extend hook points |

If symptoms span multiple categories, pick the most specific and note the others.

### Step 3 — Rank likelihood

- **High:** symptom matches a reference entry verbatim AND a secondary signal is present (e.g. "no matches" + "after a client update" → likely attribute value change).
- **Medium:** symptom matches an entry but no secondary signal (developer hasn't checked X-Ray yet).
- **Low:** symptom is consistent with the cause but other causes fit equally well.

Don't invent secondary signals. If the developer hasn't said "I saw X", don't assume it.

### Step 4 — Write the diagnosis

Use the three-block template.

### Step 5 — Hand off

One next step. Not three. Examples:
- "Open X-Ray → Timeline → search by pool name. Run `/ags-matchmaking debug` for a guided walkthrough."
- "Compare the gameMode attribute value between a ticket that matched and one that didn't. Run `/ags-matchmaking integrate` to verify client-side attribute setting."
- "Check the matching_rule reference value against the actual MMR spread in your player base. Run `/ags-matchmaking ruleset` to adjust it."

## Symptom patterns

### No matches forming

| Likely cause | Evidence | Check | Likelihood |
|---|---|---|---|
| matching_rule too tight | Attribute gap between players exceeds reference | X-Ray Timeline: which criterion blocked | High (most common) |
| match_options partition mismatch | Clients send different values for a partition attribute (case, typo, version drift) | Compare ticket attributes in X-Ray | High |
| Player pool too thin | Not enough concurrent players to form alliances | X-Ray Overview: ticket count per minute < 2 | Medium |
| Ticket expiration too short | Tickets expire before flexing_rule has time to run | Check ticket_expiration_second vs flexing_rule durations | Medium |

### Wait times spiked

| Likely cause | Evidence | Check | Likelihood |
|---|---|---|---|
| matching_rule tightened (or new attribute added) | Recent ruleset change reduced match surface | Compare current vs previous ruleset | High |
| Player population dropped in a region | Fewer tickets → fewer pairings | X-Ray Overview: ticket count over time by region | High |
| AMS fleet offline in the match region | Matches form but session creation stalls | Check AMS fleet status in Admin Portal | Medium |
| flexing_rule duration too long | Expansion happens too late; tickets expire first | Compare expiration_second vs flexing durations | Medium |

### Lopsided matches

| Likely cause | Evidence | Check | Likelihood |
|---|---|---|---|
| isForBalancing not set on key attributes | Rebalance can't optimize MMR spread | Check ruleset for isForBalancing on MMR field | High |
| Wrong rebalance method for player count | Combination used for ≥12 players (not supported) | Check rebalance_enable and method; Combination is for < 12 players total; use Greedy for ≥ 12 | Medium |
| MMR attribute not hydrated (EnrichTicket not running) | If using custom EnrichTicket Override, it may not be setting MMR | Check Extend app status via `/ags-extend observe` | Medium |

### Backfill not working

| Likely cause | Evidence | Check | Likelihood |
|---|---|---|---|
| new_session_only: true on pool | Backfill disabled in pool config | Check pool settings in Admin Portal | High |
| Game server not creating backfill ticket | Server doesn't call the backfill endpoint on player leave | Review server-side player-leave handler | High |
| Backfill ticket criteria blocked | Same matching_rule applies to backfill; current session players don't match any waiting player | X-Ray Timeline: search backfill ticket IDs | Medium |

## Examples

### No matches after client update

```
User: /ags-matchmaking doctor
  Matchmaking was working fine. After we shipped a patch yesterday, no matches are
  forming. Players are all getting "no match found" after waiting 3 minutes.

Skill: [reads overview.md, faq.md]

## Symptoms
Matchmaking ceased forming matches after a client update. Tickets are expiring
without pairing (3-minute wait = expiration threshold). Sudden onset suggests
a code change rather than a ruleset/pool change.

## Likely causes

1. **Partition attribute value change** (high)
   Evidence: "after a patch" → classic client-side attribute drift. If a
   `match_options` partition attribute (e.g. gameMode, version) changed its
   string value in the new client, old-string and new-string clients never match.
   Check: X-Ray → Timeline → expand Evaluation events for any expired ticket.
   Look for a "BLOCKED: {attribute} exact" line with different values on each side.

2. **New attribute added to matching_rule but clients not setting it** (high)
   Evidence: if the ruleset was updated alongside the patch to add a new criterion
   that clients don't send, every ticket fails that criterion.
   Check: confirm matching_rule in the ruleset matches what the new client sends.

3. **Ticket expiration shorter than time to observe** (low)
   Evidence: if expiration was reduced in the patch, tickets disappear before players
   notice. But 3 minutes is a long wait — expiration is probably not shorter than this.
   Check: confirm pool ticket_expiration_second in Admin Portal.

## Next step
Open X-Ray → Timeline → pool "your-pool-name" → any expired ticket from yesterday.
Expand the Evaluation events and look for the BLOCKED line. Run `/ags-matchmaking debug`
for a step-by-step X-Ray walkthrough.
```

### Lopsided teams

```
User: /ags-matchmaking doctor
  Teams are really unbalanced. One team always dominates. MMR matching is on.

Skill: ## Symptoms
Teams are winning/losing lopsidedly despite MMR-based matching being configured.
The issue is likely in how MMR influences rebalancing, not in initial grouping.

## Likely causes

1. **isForBalancing not set on MMR attribute** (high)
   Evidence: matching_rule pairs tickets by MMR distance but if isForBalancing is
   false, rebalance doesn't optimize team MMR spread — it may leave high-MMR players
   on the same team.
   Check: Admin Portal → Matchmaking → Rulesets → your ruleset → matching_rule entry
   for "mmr" → confirm isForBalancing: true.

2. **normalizationMax not set** (medium)
   Evidence: without normalizationMax, raw MMR values dominate the rebalance score
   calculation when multiple attributes are balanced simultaneously. Large MMR values
   swamp smaller attributes.
   Check: confirm normalizationMax is set in the MMR matching_rule entry.

3. **Wrong rebalance method** (medium)
   Evidence: if using Combination with >12 players, it silently falls back or produces
   suboptimal splits.
   Check: confirm player count and rebalance method — use Greedy if >12 players.

## Next step
Check the ruleset's MMR matching_rule: is isForBalancing true? Is normalizationMax set?
Run `/ags-matchmaking ruleset` to review and correct the ruleset.
```

## Error Handling

| Situation | Response |
|---|---|
| Developer asks doctor to fix something | "I diagnose, I don't mutate. Here's the likely cause and which subskill runs the fix." |
| Symptoms contradict each other | Note the contradiction: "app is matching players quickly but matches are lopsided — matching criteria work, but rebalance doesn't. Focus on isForBalancing and rebalance method." |
| No symptoms given (just "/ags-matchmaking doctor") | "What's the symptom? (user-visible behavior, X-Ray finding, error message, metric that changed)." One question. |
| Symptom is about the AGS platform itself (outage, quota) | "The references don't cover platform health. Check AccelByte's status page or contact support." |
| Custom match function behavior | "Custom match functions (Extend Override) are a black box to the matchmaking docs. Check the Extend app's Grafana logs via `/ags-extend observe`, then run `/ags-extend doctor` if the issue is in the handler." |
