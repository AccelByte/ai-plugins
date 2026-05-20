---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-match-rulesets/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-match-pools/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/integrate-matchmaking/
---

# AGS Matchmaking — Architecture Reference

Authoritative reference for the `ags-matchmaking` skill. Subskills read this file rather than recalling facts from training.

---

## Mental model

AGS Matchmaking is a rule-based matching service. Players (or parties) submit **tickets** describing what they want — game mode, MMR range, preferred region, party size. The service evaluates tickets against **rulesets**, groups compatible tickets into a **match**, and delivers the match result for session creation. AMS then allocates a dedicated server if the session template requires one.

Three configured objects drive every match:

| Object | What it is | Where configured |
|---|---|---|
| **Ruleset** | JSON document describing alliance shape, matching criteria, flexing, and rebalance | Admin Portal → Matchmaking → Rulesets |
| **Match Pool** | Links a ruleset, session template, match function, and timing parameters | Admin Portal → Matchmaking → Match Pools |
| **Match Ticket** | Player/party's request; carries attributes, latency map, and session preference | Submitted at runtime via AGS API or game engine SDK |

---

## Ticket lifecycle

Six stages from submission to match delivery:

| Stage | Name | Description |
|---|---|---|
| 1 | **Selection** | Matchmaking service selects a match pool for the ticket based on pool name supplied by the client |
| 2 | **Creation** | Ticket is created in the system; a ticket ID is returned to the client |
| 3 | **Pool Assignment** | Ticket is placed in the match pool's queue |
| 4 | **Attribute Hydration** | Service fetches stat codes (GetStatCodes) and enriches the ticket (EnrichTicket); these are the Extend Override hook points |
| 5 | **Evaluation** | Matchmaking engine evaluates tickets against the ruleset; applies flexing rules if thresholds aren't met; runs rebalance if needed |
| 6 | **Results Delivery** | Match is emitted; clients are notified; game session creation is triggered |

Tickets expire at `ticket_expiration_second`. Expired tickets are removed from the queue and their owners notified.

---

## Ruleset

Full ruleset JSON schema:

```json
{
  "alliance": {
    "min_number": 2,
    "max_number": 2,
    "player_min_number": 1,
    "player_max_number": 5
  },
  "alliance_flexing_rule": [
    {
      "min_number": 1,
      "max_number": 2,
      "player_min_number": 1,
      "player_max_number": 5,
      "duration": 10
    }
  ],
  "matching_rule": [
    {
      "attribute": "mmr",
      "criteria": "distance",
      "reference": 100,
      "weight": 1.0,
      "useLatestTicketData": false,
      "isForBalancing": true,
      "normalizationMax": 3000
    }
  ],
  "flexing_rule": [
    {
      "attribute": "mmr",
      "criteria": "distance",
      "reference": 200,
      "duration": 30
    }
  ],
  "match_options": {
    "options": [
      {
        "name": "gameMode",
        "type": "all"
      }
    ]
  },
  "sub_game_modes": {},
  "rebalance_enable": true
}
```

### `alliance`

| Field | Type | Description |
|---|---|---|
| `min_number` | int | Minimum number of alliances (teams) in a match |
| `max_number` | int | Maximum number of alliances |
| `player_min_number` | int | Minimum players per alliance |
| `player_max_number` | int | Maximum players per alliance |

### `alliance_flexing_rule`

Each entry relaxes alliance size constraints after `duration` seconds of waiting. Entries are applied in order; first one whose `duration` has elapsed wins. Used when the player pool is thin and you'd rather form a slightly asymmetric match than wait forever.

### `matching_rule`

Each entry is one attribute criterion that tickets must satisfy to be grouped together.

| Field | Type | Description |
|---|---|---|
| `attribute` | string | Ticket attribute key (e.g. `"mmr"`, `"rankTier"`, `"customScore"`) |
| `criteria` | string | `"distance"` (numeric range around reference) or `"exact"` (exact string match) |
| `reference` | number/string | Tolerance for `distance`; exact value for `exact` |
| `max` | int | Maximum stat value cap; attribute values above this are capped to `max` before comparison |
| `weight` | int (0–1000) | Relative weight in match score calculation |
| `useLatestTicketData` | bool | Re-read attribute at match time (not at submission time) |
| `isForBalancing` | bool | Include this attribute in the rebalance phase score |
| `normalizationMax` | number | Normalize the attribute to [0, normalizationMax] for balanced score comparison |

### `flexing_rule`

Same structure as `matching_rule` but with a `duration` field. After `duration` seconds, the matching criterion relaxes to this rule's `reference` value. Multiple entries create a staircase of expanding tolerance over wait time.

### `match_options`

Defines partition keys — attributes that must be identical across all tickets in a match (regardless of criteria). Option types:

| Type | Behavior |
|---|---|
| `"all"` | All tickets must share the same value |
| `"any"` | At least one ticket in each alliance must share the value |
| `"unique"` | Each alliance must have a distinct value |

### Role-based matchmaking

Enable with `has_combination: true` inside the alliance block and define roles:

```json
{
  "alliance": {
    "min_number": 2,
    "max_number": 2,
    "player_min_number": 5,
    "player_max_number": 5,
    "has_combination": true,
    "combination": {
      "alliances": [
        {
          "name": "team",
          "min_number": 1,
          "max_number": 1,
          "has_combination": true,
          "combination": {
            "alliances": [
              { "name": "tank", "min_number": 1, "max_number": 1 },
              { "name": "healer", "min_number": 1, "max_number": 1 },
              { "name": "dps", "min_number": 3, "max_number": 3 }
            ]
          }
        }
      ]
    }
  },
  "role_flexing_enable": true,
  "role_flexing_second": 60,
  "role_flexing_player": 1
}
```

`role_flexing_enable` + `role_flexing_second` + `role_flexing_player`: after `role_flexing_second` seconds, allow `role_flexing_player` players to fill any role, relaxing strict role requirements.

### Rebalance methods

When a match has more than the minimum number of tickets/players, rebalance picks the best combination:

| Method | When to use | Constraint |
|---|---|---|
| **Permutation** | Flexible/backfill matches; maximizes match quality | No hard player limit |
| **Combination** | Strict team composition; maximizes quality | ≤ 12 players total |
| **Greedy** | Strict team composition; fastest algorithm | > 12 players total |

Rebalance is **enabled by default** — if `rebalance_enable` is omitted from the ruleset, the service enables it automatically. Set `"rebalance_enable": false` explicitly to disable it.

---

## Match Pool

Key configuration fields:

| Field | Description |
|---|---|
| `ruleset` | Name of the ruleset to apply |
| `session_template` | Session template to create when a match is formed |
| `match_function` | `"default"` for native matchmaking; custom Extend function name for Override |
| `ticket_expiration_second` | How long before an unmatched ticket expires (default 300 s) |
| `backfill_ticket_expiration_second` | How long a backfill ticket lives (default 300 s) |
| `new_session_only` | If true, backfill never joins existing sessions (pool-level default; can be overridden per ticket — see Reserved ticket attributes) |
| `latency_method` | `"PING_RESULTS_AVERAGE"` or `"PING_RESULTS_CLOSEST_TO_REGION"` (P95) |
| `cross_platform_no_native_matching` | If true, cross-platform tickets only match each other |
| `auto_accept_backfill_proposal` | Auto-accept backfill proposals (true = auto, false = manual) |
| `match_options_referred_for_backfill` | If true, backfill matching only evaluates `match_options` attributes (ignores session attributes) |

---

## Region routing

Tickets carry a latency map — a JSON object with region codes and measured round-trip times (ms):

```json
{
  "latencies": {
    "us-west-2": 44,
    "ap-southeast-1": 120,
    "eu-west-1": 200
  }
}
```

The matchmaking service uses these values to select the region that satisfies all tickets in a candidate match. Selection strategy is set per-pool via `latency_method`:

- `PING_RESULTS_AVERAGE` — picks the region with the lowest average latency across all players in the candidate match.
- `PING_RESULTS_CLOSEST_TO_REGION` — picks the region that minimizes the maximum latency (P95 behavior — prioritizes worst-case player experience).

Players submit latency maps via the QoS API before submitting their ticket. The AGS SDK provides a QoS helper that pings all available regions and returns the map.

### Ruleset region expansion fields

These ruleset fields control how the latency selection expands over time if no compatible region is found immediately:

| Field | Default | Description |
|---|---|---|
| `region_latency_initial_range_ms` | 200 ms | Initial max latency threshold for same-region grouping |
| `region_expansion_range_ms` | 50 ms | ms added to the threshold per expansion cycle |
| `region_expansion_rate_ms` | (unset) | Interval between expansion cycles; if unset, expands every evaluation tick |
| `region_latency_max_ms` | (unset) | Maximum allowed latency; unlimited if unset |
| `region_latency_rule_weight` | 1 | Weight of the latency rule relative to `matching_rule` entries (0–1000) |
| `disable_bidirectional_latency_after_ms` | 0 | After a ticket has waited this long, it skips bidirectional latency filtering — allows it to be the pivot ticket that relaxes region constraints |

These fields sit at the ruleset root (same level as `matching_rule`). Configure them when the default expansion is too slow (long waits due to latency filtering) or too aggressive (poor region quality).

### Specific region restriction

A ticket can restrict matching to a specific region by including `"preferred_game_mode_region"` in the ticket's `party_attributes`. Tickets with a preferred region only match others with the same preferred region or no preference. Use with caution — it shrinks the player pool.

---

## Backfill

Backfill fills empty slots in an existing game session after the session has started (a player left or the initial match was short). Two modes:

| Mode | How it works |
|---|---|
| **Auto** | Service generates a backfill proposal and auto-accepts it; host receives `OnBackfillProposalReceived` event |
| **Manual** | Service generates a proposal; host decides whether to accept or reject; gives the host control over when to let new players in |

Set via pool field `auto_accept_backfill_proposal`. Backfill takes precedence over new match creation in the evaluation queue.

`new_session_only: true` disables backfill at the pool level (every match is a fresh session). Individual tickets can also set `new_session_only: true` in their attributes to opt out of joining an existing session for that ticket only (see Reserved ticket attributes below).

**A player leaving a session does not trigger automatic backfill ticket creation.** The game server must detect the departure and create the backfill ticket explicitly via REST API.

### Backfill proposal data structure

When a match is found for a backfill ticket, the service sends a proposal containing:

| Field | Description |
|---|---|
| `BackfillTicketID` | ID of the backfill ticket |
| `ProposalID` | ID of this specific proposal |
| `MatchSessionID` | The session to backfill into |
| `AddedTickets` | Array of proposed players, each with `TicketID`, `PlayerID`, `Attributes`, `Latencies` |
| `ProposedTeams` | Proposed team assignment for the incoming players |

### Partial acceptance and StopBackfilling

In manual mode, the game server can accept only a subset of proposed players by passing `AcceptedTicketIDs` — an array of ticket IDs from `AddedTickets` to accept. Players not in the array are rejected.

After accepting a proposal, the server can set `StopBackfilling: true` to signal that no further backfill proposals should be sent for this session. Use this when the session is now full or the server has decided to stop accepting new players.

### Required server permissions

The game server's OAuth client needs `NAMESPACE:{namespace}:MATCHMAKING:BACKFILL` with `CREATE, READ, UPDATE, DELETE` to create and manage backfill tickets.

### Version conflict

If two game servers race to accept the same proposal, the second accept returns `ErrorCode.SessionVersionMismatch`. Handle this with `OnSessionUpdateConflictErrorDelegate` (Unreal) or equivalent — either retry or discard the proposal.

---

## Reserved ticket attributes

These attribute keys have special matchmaking behavior when included in the ticket's `attributes` map:

| Key | Type | Behavior |
|---|---|---|
| `client_version` | string | Routes the ticket to AMS fleets matching this version string |
| `server_name` | string | Targets a specific local/dev dedicated server (used in dev/testing) |
| `role` | string | Player's role preference for role-based matching |
| `cross_platform` | string | Player's current platform identifier (set automatically when `crossplayEnabled: true`) |
| `current_platform` | array | List of platforms this player will match with |
| `new_session_only` | boolean | Per-ticket opt-out from joining existing sessions; overrides the pool's `new_session_only` setting for this ticket only |

Valid platform identifier values for `cross_platform` / `current_platform`: `steam`, `xbl`, `ps5`, `ps4`, `xbox`, `epicgames`.

### Cross-play modes

Three cross-play modes available on the pool:

| Mode | Setting | Behavior |
|---|---|---|
| **Cross-Play** (default) | `cross_platform_no_native_matching: false` | Full cross-platform; all platform players match together |
| **Platform Group** | Admin Portal → Pool → Platform Groups | Admin-defined groupings (e.g. desktop: steam+epicgames; console: ps5+xbox); players match within their group |
| **Platform Exclusive** | Per-ticket via `current_platform: [single-platform]` | Player only matches others on the same platform |

Player cross-play preference is set per-ticket:
- `crossplayEnabled: true` → populates `cross_platform` with all of the player's active login platforms
- `crossplayEnabled: false` → restricts to the player's current platform only

## Extend Override hook points

Five methods can be replaced with a custom Extend Override handler:

| Method | What it does |
|---|---|
| `GetStatCodes` | Returns the list of stat attributes to fetch during Attribute Hydration |
| `EnrichTicket` | Adds computed attributes to the ticket before evaluation (e.g. computed MMR from raw stats) |
| `ValidateTicket` | Accepts or rejects a ticket (e.g. block banned players, require minimum level) |
| `MakeMatches` | Replaces the entire match-formation algorithm (runs on a 10–30 second configurable interval, not per-tick) |
| `BackfillMatches` | Replaces the backfill algorithm |

Using these requires `/ags-extend` — scaffold an Override app, implement the gRPC interface, and deploy it. Set `match_function` in the pool to the Override app's name.

---

## X-Ray debugging tool

Admin Portal → Matchmaking → X-Ray.

Two views:

| View | Shows |
|---|---|
| **Overview** | Timeline of all match events in a pool over a time window; wait-time distribution; match formation rate |
| **Timeline** | Per-ticket event trace: when it was created, which candidates it was evaluated against, why it wasn't matched (attribute mismatch, wait time, rule failure), and when it expired or matched |

Search by:
- Match ID
- Pool name
- Ticket ID
- User ID

X-Ray is the primary debugging tool for "why aren't matches forming?" — it shows exactly which attribute criterion blocked each candidate pairing.

---

## Unreal SDK

Key types and methods:

| Call | Purpose |
|---|---|
| `IOnlineSessionPtr->StartMatchmaking(...)` | Submit a ticket; pass `SETTING_SESSION_MATCHPOOL` to specify the pool |
| `IOnlineSessionPtr->CancelMatchmaking(...)` | Cancel an active ticket |
| `IOnlineSessionPtr->JoinSession(...)` | Join the session after a match is found |
| `OnMatchmakingComplete` delegate | Fires when matchmaking succeeds or times out |
| `OnSessionUserInviteAccepted` delegate | Fires when a player joins a session from an invite |

Pool name is set via session settings:

```cpp
FOnlineSessionSettings SessionSettings;
SessionSettings.Set(SETTING_SESSION_MATCHPOOL, FString("my-pool"), EOnlineDataAdvertisementType::ViaOnlineService);
```

Latency measurement: call `IOnlineSessionPtr->QueryServerRegions()` before starting matchmaking to populate latency data automatically.

---

## Unity SDK

Key calls:

| Call | Purpose |
|---|---|
| `MatchmakingV2.CreateMatchmakingTicket(matchPool, attributes, callback)` | Submit a ticket |
| `MatchmakingV2.DeleteMatchmakingTicket(matchTicketId, callback)` | Cancel a ticket |
| `Session.JoinGameSession(sessionId, callback)` | Join the session after matchmaking |

Latency measurement: use `QosManager.GetServerLatencies(callback)` to get the latency map before submitting a ticket. Pass the result as `sessionAttributesJson` in `CreateMatchmakingTicket`.

---

## Limits

| Parameter | Limit |
|---|---|
| Ticket expiration max | 3600 s |
| Max alliances per ruleset | 16 |
| Max players per alliance | 100 |
| Max matching_rule entries | 20 |
| Max flexing_rule entries | 20 |
| Combination rebalance player limit | 12 |
| Latency method options | PING_RESULTS_AVERAGE, PING_RESULTS_CLOSEST_TO_REGION |
