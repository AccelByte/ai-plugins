---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-match-pools/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-match-rulesets/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrate-matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/matchmaking-x-ray-guide/
---

# AGS Matchmaking — Glossary

Terms in encounter order: concepts first, then configuration objects, then runtime objects.

---

## Concepts

**Matchmaking**
The process of grouping players into a match by evaluating their tickets against a ruleset's constraints.

**Ticket**
A player's or party's matchmaking request. Contains the target pool name, a latency map, custom attributes, and optional party attributes. Lives in the pool queue until matched or expired.

**Match**
The result of a successful evaluation — a set of tickets grouped into alliances that satisfies all ruleset constraints. After a match is formed, a game session is created.

**Alliance**
A team within a match. A ruleset defines how many alliances a match has and how many players each alliance requires. "Alliance" is the AGS term for what most games call a "team."

**Ticket expiration**
The maximum time a ticket stays in the queue before being discarded. Controlled by `ticket_expiration_second` on the pool.

**Backfill**
The process of filling empty slots in a running game session. A backfill ticket is submitted for the session; when matched, new players join the existing session rather than a new one.

---

## Ruleset fields

**`alliance`**
JSON block defining the match format: min/max number of alliances, min/max players per alliance.

**`matching_rule`**
Array of attribute criteria that all candidate ticket pairs must satisfy. Each entry specifies an attribute, criteria type (`distance` or `exact`), and reference value.

**`flexing_rule`**
Array of rule relaxations. After `duration` seconds of waiting, the matching criterion expands to a wider `reference` value, allowing more players to be paired.

**`alliance_flexing_rule`**
Array of alliance-shape relaxations. After `duration` seconds, the alliance size constraints (min/max teams and players) are relaxed to allow asymmetric or smaller matches.

**`match_options`**
Defines partition attributes — attributes that must (or must not) be equal across all tickets in a match, regardless of matching_rule criteria.

**`has_combination`**
Flag on an alliance entry that enables role-based matching. Requires a nested `combination` block defining named roles.

**`rebalance_enable`**
Whether the rebalance step runs after initial grouping. Rebalance picks the best combination of tickets among available candidates to optimize team quality.

**Permutation** / **Combination** / **Greedy**
Three rebalance algorithms. Permutation is for flexible/backfill matches. Combination is for strict composition with fewer than 12 total players (< 12). Greedy is for strict composition with 12 or more total players (≥ 12).

**`isForBalancing`**
Flag on a `matching_rule` entry. If true, the attribute is included in the rebalance score calculation — it influences which grouping is chosen among valid candidates.

**`normalizationMax`**
Normalizes a numeric attribute to a [0, normalizationMax] range for balanced rebalance score comparison across multiple attributes with different scales.

**`role_flexing_enable`** / **`role_flexing_second`** / **`role_flexing_player`**
After `role_flexing_second` seconds, allow `role_flexing_player` players to fill any role, relaxing strict role requirements in a role-based ruleset.

---

## Pool fields

**Match Pool**
Configuration object linking a ruleset, session template, match function, and timing parameters. Players submit tickets targeting a pool by name.

**`session_template`**
The AGS Session template used to create a game session when a match is formed.

**`match_function`**
`"default"` for native matchmaking, or the name of a deployed Extend Override app for custom logic.

**`ticket_expiration_second`**
How long a regular ticket lives in the pool queue. Max 3600 s.

**`backfill_ticket_expiration_second`**
How long a backfill ticket lives. Typically shorter than regular ticket expiration.

**`new_session_only`**
If `true`, backfill is disabled — every match creates a fresh session, and no existing sessions are joined.

**`latency_method`**
How the pool selects a region for the match:
- `PING_RESULTS_AVERAGE` — lowest average latency across all players.
- `PING_RESULTS_CLOSEST_TO_REGION` — lowest maximum latency (P95 behavior).

**`auto_accept_backfill_proposal`**
If `true`, backfill proposals are auto-accepted. If `false`, the game server must explicitly accept or reject each proposal.

**`cross_platform_no_native_matching`**
If `true`, cross-platform tickets only match other cross-platform tickets.

---

## Region routing

**Latency map**
JSON object in a ticket or session attribute mapping region codes to round-trip times in milliseconds: `{"us-west-2": 44, "ap-southeast-1": 120}`.

**QoS (Quality of Service) API**
AGS API for measuring latency to all available regions. Returns a latency map that clients submit with their tickets. Unreal: `QueryServerRegions()`. Unity: `QosManager.GetServerLatencies()`.

**`preferred_game_mode_region`**
Party attribute that restricts a ticket to a specific region. Tickets with different preferred regions don't match each other.

---

## Extend hook points

**`GetStatCodes`**
Override method: returns the list of stat attributes to fetch during Attribute Hydration (Stage 4 of the ticket lifecycle).

**`EnrichTicket`**
Override method: adds computed attributes to a ticket (e.g. computed MMR from raw stats) before evaluation.

**`ValidateTicket`**
Override method: accepts or rejects a ticket (e.g. block banned players, enforce minimum level).

**`MakeMatches`**
Override method: replaces the entire match-formation algorithm with custom logic.

**`BackfillMatches`**
Override method: replaces the backfill algorithm with custom logic.

---

## Debugging

**X-Ray**
Admin Portal → Matchmaking → X-Ray. A debugging tool with two views (Overview and Timeline) for inspecting ticket lifecycle events, blocking criteria, and match quality.

**Overview view**
X-Ray tab showing pool-level aggregate metrics over a time window: match formation rate, average wait time, expired ticket count.

**Timeline view**
X-Ray tab showing per-ticket event traces: each lifecycle stage, each candidate pairing attempted, and which criterion blocked or allowed the pairing.
