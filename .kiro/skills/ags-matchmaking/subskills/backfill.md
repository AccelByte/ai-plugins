---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/managing-backfill-ticket/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/understanding-backfill-ticket-lifecycle/
see-also:
- '[overview.md](../references/overview.md)'
---

# AGS Matchmaking — Backfill Designer

Design and configure AGS Matchmaking backfill — the mechanism that fills empty slots in a running game session when a player leaves or the initial match was short. Covers auto vs manual mode, proposal lifecycle, `new_session_only` opt-out, and the server-side integration.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before making any backfill recommendation. Backfill mode, proposal lifecycle, pool fields, and proposal data structure are defined there.
- `auto_accept_backfill_proposal` is a pool-level field only. `new_session_only` is a pool-level default but **can also be set per ticket** in the ticket's `attributes` map to override the pool setting for that ticket.
- The game server must create backfill tickets explicitly — a player leaving a session does not trigger automatic backfill ticket creation.
- Do not describe BackfillMatches Extend Override lifecycle — that's `/ags-extend`. Native backfill configuration is owned here.

</grounding_rules>

<tool_usage_rules>

- Read `references/overview.md` at the start of every backfill session.
- Do not run CLI commands — backfill is configured in pool settings and in the game server code.
- Use `Read` to read game server source files the user points to.
- Use `Edit` or `Write` to produce server-side backfill handling code snippets.

</tool_usage_rules>

<output_contract>

Produce:
1. **Backfill mode recommendation** (auto vs manual) with rationale.
2. **Pool fields** — which pool fields to set (`auto_accept_backfill_proposal`, `new_session_only`, `backfill_ticket_expiration_second`).
3. **Server-side integration** — how the game server creates a backfill ticket and handles proposals.
4. **Backfill lifecycle summary** — one-paragraph explanation of what happens step by step.
5. **Next step** — "Run `/ags-matchmaking pool` to apply these settings to the pool" or "Run `/ags-matchmaking debug` to test the backfill flow."

</output_contract>

## Workflow

### Step 1 — Read the reference

Read `references/overview.md`, specifically the Backfill section.

### Step 2 — Determine mode

Ask (or infer from context):
- Does the game server need to control when new players join? (e.g. between rounds, not mid-fight)
- Is this a casual or competitive game?

**Decision:**
- **Auto** (`auto_accept_backfill_proposal: true`): service auto-accepts the proposal; game server receives `OnBackfillProposalReceived` and handles the join. Best for casual modes (battle royale, team deathmatch, co-op PvE) where any time is fine for new players.
- **Manual** (`auto_accept_backfill_proposal: false`): service sends a proposal; server reviews and explicitly accepts or rejects. Best for round-based games, tournament brackets, or when the server needs to gate late joins.

### Step 3 — `new_session_only` decision

| Scenario | Setting |
|---|---|
| Game supports mid-session joins (battle royale, open-world co-op, team modes) | `new_session_only: false` (pool default) — backfill is active |
| Game cannot support mid-session joins (elimination, narrative missions, single-attempt challenges) | `new_session_only: true` (pool) — backfill disabled; every match is a fresh session |
| Per-player opt-out (player preference or specific game mode ticket) | `new_session_only: true` in the ticket's `attributes` map — overrides the pool default for that ticket only |

### Step 4 — Pool configuration

```
Pool backfill settings:
  auto_accept_backfill_proposal:      true / false
  new_session_only:                   false / true
  backfill_ticket_expiration_second:  {n} s
  match_options_referred_for_backfill: true / false  (optional)
```

`backfill_ticket_expiration_second`: how long the backfill ticket lives before giving up. Typically 60–120 s. Set shorter than `ticket_expiration_second` — a running session shouldn't wait as long as a fresh matchmaking request.

`match_options_referred_for_backfill`: if true, backfill matching only evaluates `match_options` attributes and ignores session attributes. Useful when you want backfill to be less strict than initial matching.

### Step 5 — Server-side integration

The game server is responsible for:
1. Detecting when a player slot opens (the service does **not** auto-detect player departures).
2. Creating a backfill ticket when a slot opens.
3. Handling the backfill proposal event.
4. Accepting or rejecting (and optionally partially accepting) the proposal.
5. Canceling the backfill ticket if the session ends.

Required OAuth client permission: `NAMESPACE:{namespace}:MATCHMAKING:BACKFILL` (CREATE, READ, UPDATE, DELETE).

**Auto mode — server creates a backfill ticket (REST API)**

```
POST /v1/public/namespaces/{namespace}/backfill
Body: {
  "matchPool": "my-pool-name",
  "sessionId": "{current-session-id}"
}
```

The service handles the rest. When a matching player is found, a proposal is generated, auto-accepted, and the player is joined to the session. The server receives a session update event.

**Manual mode — server creates ticket and handles proposals**

```
POST /v1/public/namespaces/{namespace}/backfill
Body: {
  "matchPool": "my-pool-name",
  "sessionId": "{current-session-id}"
}
Response: { "backfillTicketId": "{id}" }

// When a proposal arrives (via Lobby websocket or DS Hub):
// Accept all:
PUT /v1/public/namespaces/{namespace}/backfill/{backfillTicketId}/proposal/accept

// Partial accept — only accept specific tickets from AddedTickets:
PUT /v1/public/namespaces/{namespace}/backfill/{backfillTicketId}/proposal/accept
Body: {
  "proposalId": "{proposalId}",
  "acceptedTicketIDs": ["{ticketId1}", "{ticketId2}"]
  "stopBackfilling": true   // set true to stop receiving further proposals
}

// Reject:
PUT /v1/public/namespaces/{namespace}/backfill/{backfillTicketId}/proposal/reject
```

The proposal body contains: `BackfillTicketID`, `ProposalID`, `MatchSessionID`, `AddedTickets` (array of `{TicketID, PlayerID, Attributes, Latencies}`), `ProposedTeams`.

If two servers race to accept the same proposal, the second receives a version mismatch error — handle with retry or discard logic.

**Canceling a backfill ticket (session ending)**

```
DELETE /v1/public/namespaces/{namespace}/backfill/{backfillTicketId}
```

Always cancel the backfill ticket when the game session ends. Orphaned backfill tickets consume matching capacity.

### Step 6 — Backfill lifecycle summary

```
Backfill lifecycle:
  1. Player leaves (or session starts with fewer players than max)
  2. Game server creates a backfill ticket via REST API
  3. Ticket enters the match pool queue
  4. Matchmaking evaluates the ticket against waiting players
  5. If a match is found:
     - Auto mode: proposal auto-accepted; server receives session update
     - Manual mode: proposal sent to server; server accepts or rejects
  6. New player is joined to the session on acceptance
  7. Server cancels the backfill ticket when the session ends
```

## Examples

### Casual shooter — auto backfill

```
Mode: auto
Pool fields:
  auto_accept_backfill_proposal: true
  new_session_only:              false
  backfill_ticket_expiration_second: 90

Rationale:
  - Casual game; mid-game joins are fine.
  - Auto mode: server doesn't need to gate late joins.
  - 90 s expiration: if a replacement isn't found in 90 s, the server continues
    with fewer players rather than waiting indefinitely.
```

### Competitive ranked — manual backfill disabled

```
Mode: backfill disabled
Pool fields:
  new_session_only: true

Rationale:
  - Ranked matches are score-sensitive; a new player joining mid-match distorts results.
  - Disable backfill entirely. If a player leaves, the server handles it gracefully
    (forfeit, bot fill, or continue shorthanded).
```

### Round-based game — manual backfill

```
Mode: manual
Pool fields:
  auto_accept_backfill_proposal: false
  new_session_only:              false
  backfill_ticket_expiration_second: 60

Rationale:
  - Server only accepts the proposal between rounds.
  - 60 s expiration: fast turnaround — if no player joins within one round gap, give up.

Server logic:
  - Create backfill ticket at round end.
  - If proposal received AND current game state is "between rounds": accept.
  - If proposal received AND game is mid-round: reject (try again next round).
```

## Error Handling

| Situation | Response |
|---|---|
| User wants BackfillMatches Override (custom algorithm) | "Custom BackfillMatches is an Extend Override. Run `/ags-extend` to scaffold the handler. This subskill covers native backfill pool configuration and server integration." |
| User asks how to handle a backfill proposal in Unreal / Unity | "In Unreal, bind `AddOnBackfillProposalReceivedDelegate_Handle()` to handle a backfill proposal; in Unity, subscribe to `MatchmakingV2BackfillProposalReceived`. See `/ags-matchmaking integrate` for the SDK wiring." |
| Backfill ticket never finds a match | "Check X-Ray (`/ags-matchmaking debug`) to see whether backfill tickets are entering the pool and which criteria are blocking matches. Also verify the backfill pool has the same ruleset as the main pool." |
| Server not creating backfill tickets after player leaves | "The server must create the backfill ticket explicitly — the service doesn't auto-detect player departures. Wire the player-leave event handler to POST to the backfill endpoint." |
