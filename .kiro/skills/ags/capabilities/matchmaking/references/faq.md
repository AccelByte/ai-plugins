---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
---

# AGS Matchmaking — FAQ

Common questions and decisions that come up when designing, building, or operating AGS Matchmaking. Subskills read this alongside `overview.md` for scope, trade-off, and "should I?" questions.

---

## Scope and suitability

**Q: Can native matchmaking rules handle all use cases?**
Native rules cover: numeric distance matching (MMR, score), exact attribute partitioning (game mode, region, version), role-based composition, time-based flexing, rebalancing, and region-latency-first selection. If the matching algorithm itself needs to be replaced — custom team-formation logic, external ELO service calls, proprietary grouping algorithms — that requires an Extend Override. Start with native rules; only move to Extend Override if native rules can't express what's needed.

**Q: Does AGS Matchmaking work for games without persistent skill ratings?**
Yes. Matchmaking doesn't require an MMR attribute. You can match purely by game mode, party size, or region. Add MMR (or a proxy like "matches played") once you have enough data. Start simple.

**Q: How many concurrent players does matchmaking scale to?**
AGS Matchmaking scales with your player base on Public Cloud. There are no documented per-pool concurrency limits in the public documentation. For very large-scale launches (>10,000 concurrent), contact AccelByte support to discuss capacity planning.

**Q: Can I have multiple pools for the same game mode?**
Yes. Multiple pools can use the same ruleset. Common patterns: a pool for each region, a pool for different skill bands (new-player pool, veteran pool), a ranked vs casual split.

---

## Ruleset design

**Q: What MMR reference value should I use?**
The reference docs don't prescribe a value — it's game-specific. A starting point: choose a range that would feel "same skill level" to players. For a 0–3000 MMR scale, 100–200 is a reasonable start. Use X-Ray data post-launch to tune: if most tickets expire, widen the reference; if players complain about unfair matches, tighten it.

**Q: When should I use a tight vs wide `distance` criterion?**
`distance` is the documented criterion type for ruleset matching. For discrete categorical attributes (game mode, region lock, version), set a `reference` of 0 — only tickets with the identical value will group. For continuous numeric attributes (MMR, score, level), set a tolerance that reflects acceptable skill spread: a player at 1000 MMR matches someone at 1100 if `reference` is 150.

**Q: Should I put region in matching_rule or use the latency_method on the pool?**
Use the latency_method on the pool (latency-based region selection) rather than putting region in matching_rule as an exact match. Latency-based selection finds the best common region across all tickets in a candidate match — exact region matching would prevent players in overlapping regions from grouping. For hard region locks (e.g. regional tournaments), use a region-restriction attribute in `party_attributes` — verify the exact attribute name against current AGS docs.

**Q: How many flexing_rule entries is too many?**
There's no documented limit below 20, but more than 3–4 phases is unusual. Each phase should represent a meaningful wait-time milestone (30 s, 60 s, 120 s). More phases than players notice wait milestones just adds complexity.

**Q: Can I use a matching_rule for custom attributes my game defines?**
Yes. Any attribute in the ticket's `attributes` map can be used as a matching_rule attribute. The attribute must be present on all tickets in the pool for the criterion to apply. Tickets missing the attribute may behave unexpectedly — validate that all clients always set required attributes.

---

## Wait times and match quality

**Q: Wait times spiked — where do I look first?**
1. X-Ray Overview tab — did the ticket count drop? (thin population)
2. X-Ray Timeline — what's the blocking criterion on expired tickets?
3. Did a client update ship? (attribute value drift)
4. Did a ruleset or pool change ship? (tighter criteria)
5. Did an AMS fleet go offline in a region? (matches form but session creation stalls)

**Q: Matches are forming but teams are unbalanced — how do I fix it?**
Check two things: (1) Is `isForBalancing: true` on the MMR matching_rule? If not, rebalance can't optimize MMR spread. (2) Is `normalizationMax` set? Without it, raw MMR values dominate the rebalance score. Also verify `rebalance_enable` is set in the ruleset and the rebalance algorithm is appropriate for your player count.

**Q: How do I handle thin player populations without degrading match quality?**
Staircase flexing rules: start tight, relax at 30 s, relax more at 60 s, relax maximally at 90 s. Combine with `alliance_flexing_rule` to allow asymmetric teams as a last resort. Set ticket expiration beyond the last flexing step (e.g. 120 s if the last flexing step is at 90 s).

---

## Backfill

**Q: When should I use auto vs manual backfill?**
- Auto: casual games where the server doesn't need to gate late joins (battle royale, co-op PvE, open-world).
- Manual: round-based games where new players should only join between rounds; competitive modes where the server needs to decide.

**Q: Can I disable backfill entirely?**
Yes. Set `new_session_only: true` on the pool to disable backfill for all sessions in that pool — every match creates a fresh session. Individual tickets can also set `new_session_only: true` in their `attributes` map to opt out of joining existing sessions on a per-ticket basis.

**Q: Why are backfill tickets not matching any players?**
The same ruleset applies to backfill tickets. If the running session's players have high MMR and no waiting player is within the matching_rule reference, the backfill ticket will never match. Consider a more permissive backfill-specific pool (same pool, wider matching_rule reference) or shorten the backfill expiration so the server accepts the shortfall faster.

---

## Custom match functions (Extend Override)

**Q: When should I use an Extend Override match function instead of native rules?**
Only when native rules provably can't express the logic you need: external service calls during match formation, proprietary team-balance algorithms, rule expressions beyond attribute distance/exact, or stateful match history checks. Before building an Override, confirm with `/ags matchmaking ask` that native rules can't handle it.

**Q: What happens if the custom match function (Extend Override) crashes?**
The pool falls back to... no match — tickets stall and eventually expire. There is no automatic fallback to native matchmaking. Monitor the Extend app's Grafana logs (`/ags-extend observe`) and set up alerts on `appStatus` dropping from `running`.

---

## Local vs production

**Q: Matchmaking works in my dev namespace but not in prod — where do I look?**
1. Are the ruleset and pool configuration identical between environments? Check Admin Portal in both namespaces.
2. Are clients setting the same attribute values in prod that they set in dev? Log ticket attributes on submission.
3. Does prod have AMS fleets configured for the same regions the dev namespace uses? Check Admin Portal → AMS.
4. Is the prod player population large enough for the ruleset's requirements? A ruleset tuned for dev (small team tests) may be too strict for early production.

**Q: How do I test matchmaking without real players?**
Use the AGS Admin Portal "Create Ticket" tool (Admin Portal → Matchmaking → Tickets → Create) to submit test tickets manually. Create multiple tickets with known attributes to verify rules are working as expected. Use X-Ray to trace the results.
