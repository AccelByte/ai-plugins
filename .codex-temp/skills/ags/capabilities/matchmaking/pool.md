---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
see-also:
- '[overview.md](references/overview.md)'
- '[faq.md](references/faq.md)'
---

# AGS Matchmaking — Match Pool Configurator

Configure AGS Match Pools — the objects that link a ruleset to a session template, set timing parameters, choose a latency method, and control backfill and cross-play behavior. Produces a Pool Summary the user can use to configure the pool in the Admin Portal.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before recommending any pool field value. Field names, allowed values, and defaults are authoritative there.
- Field names are exact. `ruleset`, `session_template`, `match_function`, `ticket_expiration_second`, `backfill_ticket_expiration_second`, `new_session_only`, `latency_method`, `cross_platform_no_native_matching`, `auto_accept_backfill_proposal`, `match_options_referred_for_backfill` — copy verbatim.
- `latency_method` values: `"PING_RESULTS_AVERAGE"` and `"PING_RESULTS_CLOSEST_TO_REGION"` only. Do not invent others.
- `match_function` is `"default"` for native matchmaking or the Extend Override app name. Do not claim other values are valid.
- Ticket expiration max is 3600 s. Do not recommend values above this.

</grounding_rules>

<tool_usage_rules>

- Read `references/overview.md` at the start of every pool configuration session.
- Do not run any CLI commands — pools are configured in the Admin Portal UI.
- Do not read ruleset or other subskill files. If the user hasn't run `ruleset` yet, tell them to do so first.

</tool_usage_rules>

<output_contract>

Produce a **Pool Summary** block:

```
Pool: {pool-name}

  Ruleset:                  {ruleset-name}
  Session template:         {template-name}
  Match function:           default / {override-name}
  Ticket expiration:        {n} s
  Backfill expiration:      {n} s
  New session only:         true / false
  Latency method:           PING_RESULTS_AVERAGE / PING_RESULTS_CLOSEST_TO_REGION
  Cross-platform (no native matching): true / false
  Auto-accept backfill:     true / false
```

After the summary:
1. **Reasoning block** — one bullet per non-default field explaining why that value was chosen.
2. **Tuning notes** — when the user should revisit each value (e.g. "if average wait time exceeds 120 s, consider lowering ticket_expiration_second to create more urgency in the flexing rules").
3. **Next step** — one line:
   - If region routing is involved: "Run `/ags matchmaking region` to configure the latency method and QoS integration."
   - If backfill is involved: "Run `/ags matchmaking backfill` to configure the backfill strategy."
   - Otherwise: "Run `/ags matchmaking integrate` to wire up the SDK."

</output_contract>

<completeness_contract>

Pool configuration is complete when:
- `ruleset` name is specified (or user is explicitly told to run `/ags matchmaking ruleset` first).
- `session_template` name is specified.
- `match_function` is set (default or override name).
- All timing parameters are set with justification.
- Latency method is chosen.
- Backfill and cross-play flags are set.

</completeness_contract>

<empty_result_recovery>

If the user hasn't given enough information, ask for:
1. **Ruleset name** — which ruleset will this pool use?
2. **Session template name** — what session template should the match create?
3. **Match function** — native (`"default"`) or a custom Extend Override?
4. **Expected player pool size** — helps size ticket_expiration_second.
5. **Latency sensitivity** — does the game need consistent worst-case latency (P95) or average?

Ask all in one message.

</empty_result_recovery>

## Workflow

### Step 1 — Read the reference

Read `references/overview.md`, specifically the Match Pool section.

### Step 2 — Interview (if needed)

Gather the five fields in `empty_result_recovery` in one message.

### Step 3 — Design

Key design decisions:

**Ticket expiration:** how long to wait before giving up on a ticket. Trade-off:
- Too short → players get "no match found" quickly during low-population windows.
- Too long → players wait too long with false hope.
- Start at 120–180 s for medium-population games; lower to 60 s for high-population. Never exceed the ruleset's flexing_rule duration sum + 30 s — tickets should expand their criteria before expiring.

**Backfill expiration:** typically equal to ticket expiration. Can be shorter if you want backfill to give up faster than regular matching.

**new_session_only:** set `true` only if your game mode can't tolerate mid-game joins (e.g. single-elimination tournaments, narrative missions). Set `false` for battle royale, squad shooters, or any mode where joining a running session is acceptable.

**Latency method:**
- `PING_RESULTS_AVERAGE` — minimizes average latency. Best for large player pools where a few high-latency players are acceptable.
- `PING_RESULTS_CLOSEST_TO_REGION` — minimizes worst-case latency (P95). Best for competitive games where one player with 300 ms ruins the match.

**auto_accept_backfill_proposal:** set `true` for casual modes (game host doesn't need to vet incoming players). Set `false` when the game server needs to decide whether to accept new players (e.g. late-join restrictions, match-specific conditions).

**Cross-play configuration:** three modes available:
- **Cross-Play** (default, `cross_platform_no_native_matching: false`) — all platform players match together.
- **Platform Group** — admin-defined groupings (Admin Portal → Matchmaking → Match Pools → [pool] → Platform Groups); players match within their group. Example groups: desktop (steam + epicgames), console (ps5 + xbox). Platform IDs: `steam`, `xbl`, `ps5`, `ps4`, `xbox`, `epicgames`.
- **Platform Exclusive** — per-ticket, via the player setting `crossplayEnabled: false` which restricts the ticket's `current_platform` to their own platform only.

Set `cross_platform_no_native_matching: true` only if you need to partition cross-platform tickets to only match each other — this is the bluntest setting. Platform Groups are more nuanced.

**match_options_referred_for_backfill:** set `true` if backfill should use only `match_options` partitions (not session attributes) to find replacement players. Useful when you want backfill to be more permissive than initial matching.

**match_function:** leave `"default"` unless an Extend Override app is deployed and named. Don't set this to the override app name until the app is deployed and the name is confirmed.

### Step 4 — Produce the Pool Summary

Write the summary block and reasoning.

### Step 5 — Hand off

Write the next-step line based on what comes next for the user.

## Examples

### Competitive 5v5 pool

```
Pool: competitive-5v5

  Ruleset:                  competitive-5v5-ruleset
  Session template:         ranked-session
  Match function:           default
  Ticket expiration:        120 s
  Backfill expiration:      120 s
  New session only:         false
  Latency method:           PING_RESULTS_CLOSEST_TO_REGION
  Cross-platform:           false
  Auto-accept backfill:     false

Reasoning:
- P95 latency method: competitive games punish high-latency outliers more than casual games do.
- Cross-platform off: controller vs keyboard parity concerns.
- Auto-accept backfill false: server should decide whether to let new players join mid-game.
- 120 s expiration: medium-population ranked queue; flexing_rule is set to expand at 45 s and 90 s.

Tuning:
- If wait times exceed 150 s on average, tighten the flexing_rule references rather than lowering expiration.
- If backfill proposals are rare, confirm the session template has backfill enabled.

Next: Run /ags matchmaking region to set up the latency map and QoS integration.
```

### Casual battle royale pool

```
Pool: br-casual

  Ruleset:                  br-casual-ruleset
  Session template:         br-session-100
  Match function:           default
  Ticket expiration:        180 s
  Backfill expiration:      60 s
  New session only:         false
  Latency method:           PING_RESULTS_AVERAGE
  Cross-platform:           false
  Auto-accept backfill:     true

Reasoning:
- Average latency method: large player pool, occasional high-latency player acceptable.
- Longer ticket expiration (180 s): BR lobbies take time to fill; players expect a wait.
- Short backfill expiration (60 s): once a game is running, late joins should resolve quickly or not at all.
- Auto-accept backfill: casual mode, no reason to gate new player joins.
```

## Error Handling

| Situation | Response |
|---|---|
| User hasn't created a ruleset yet | "You need a ruleset before configuring a pool. Run `/ags matchmaking ruleset` first, then come back here." |
| User sets `ticket_expiration_second` > 3600 | "The max is 3600 s. Use 3600 s and pair it with long flexing_rule durations to handle thin populations." |
| User asks for a `match_function` value other than "default" or an Extend app name | "The only values are `"default"` (native) and the name of a deployed Extend Override app. Anything else is invalid." |
| User asks which latency method to use without context | Ask: "Is this a competitive or casual game? High-sensitivity games (FPS, fighting) benefit from P95; casual games do fine with average." |
