---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configuring-match-rulesets/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/matchmaking-rebalance/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/role-based-matchmaking/
see-also:
- '[overview.md](references/overview.md)'
- '[faq.md](references/faq.md)'
---

# AGS Matchmaking — Ruleset Author

Write and tune AGS Matchmaking rulesets — the JSON documents that describe alliance shape, matching criteria, flexing, role composition, and rebalance strategy. Produces a complete ruleset JSON the user can paste into the Admin Portal.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before writing or reviewing any ruleset. The schema, field names, and allowed values are authoritative there. Do not invent fields.
- Field names are exact. `matching_rule`, `flexing_rule`, `alliance`, `alliance_flexing_rule`, `match_options`, `has_combination`, `combination`, `rebalance_enable`, `role_flexing_enable`, `role_flexing_second`, `role_flexing_player` — copy verbatim.
- Criteria values: `"distance"` is the **only currently supported criterion** in the live service. `"exact"` is planned but not yet live — do not use it in generated rulesets. Do not invent other criteria.
- Rebalance methods: Permutation (no player limit), Combination (< 12 players total, i.e. 11 or fewer), Greedy (≥ 12 players). Do not mix up which is which.
- Do not recommend a limit not in the reference (e.g. "max 50 matching rules") — cite the actual limit from the reference.

</grounding_rules>

<tool_usage_rules>

- Read `references/overview.md` at the start of every ruleset authoring session.
- Use `Read` to read any existing ruleset JSON the user provides (usually in a local file they point you to).
- Use `Write` to save a produced ruleset to a file if the user asks.
- Do not run any CLI commands — rulesets are configured in the Admin Portal, not via CLI.
- Do not read other subskill files.

</tool_usage_rules>

<output_contract>

Produce a single complete ruleset JSON block that the user can copy into Admin Portal → Matchmaking → Rulesets → Create/Edit.

After the JSON:
1. **Explanation block** — one bullet per non-trivial design decision:
   - Why this alliance shape (not just "2 teams of 5 — that's what you asked")
   - Why each matching_rule criterion (attribute choice, criteria type, reference value, weight rationale)
   - Why each flexing_rule and its duration
   - If role-based: why the combination structure
   - Rebalance method choice and why

2. **Tuning notes** — when the user should revisit each parameter:
   - "If wait times exceed 90 s on average, lower the matching_rule reference for MMR from 100 to 150."
   - "If match quality is poor (players complaining about lopsided games), tighten the reference back."

3. **Next step** — one line pointing to the pool subskill:
   - "Run `/ags matchmaking pool` to attach this ruleset to a match pool."

</output_contract>

<completeness_contract>

The ruleset is complete when:
- `alliance` block is present with min/max teams and players.
- At least one `matching_rule` (or explicit acknowledgment that the user wants no attribute-based matching).
- `flexing_rule` present if the user mentioned wait-time tolerance, or explicitly noted as omitted.
- `match_options` present if any partition attributes were mentioned.
- `rebalance_enable` field is set with the appropriate method explained.
- For role-based: `has_combination` is true and all required roles are named.
- The JSON is syntactically valid (no trailing commas, correct nesting).

</completeness_contract>

<empty_result_recovery>

If the user hasn't given enough information to produce a ruleset, ask for:
1. **Match format:** How many teams? How many players per team?
2. **Matching criteria:** What should determine who plays with/against whom? (MMR, rank tier, game mode, custom stat?)
3. **Wait-time tolerance:** How long should players wait before matching tolerance expands? (seconds)
4. **Role-based?** Does the match have roles (tank/healer/dps)?

Ask all four in one message. Do not write a partial ruleset until the answers are in.

</empty_result_recovery>

## Workflow

### Step 1 — Read the reference

Read `references/overview.md`, specifically the Ruleset section (all field definitions, schema, rebalance methods, role-based pattern).

### Step 2 — Interview (if needed)

If the user's request is missing any of the four fields in `empty_result_recovery`, ask for them in one block. Do not proceed until you have:
- Match format (teams × players)
- Matching criteria (attributes and acceptable ranges)
- Flexing/wait-time tolerance
- Role requirements (if any)

Do not ask one question at a time — gather everything in a single message.

### Step 3 — Design

Before writing JSON, note the design decisions:
- Alliance shape: `min_number`, `max_number` = team count; `player_min_number`, `player_max_number` = per-team player count.
- Matching rules: one `matching_rule` entry per attribute criterion. Use `"distance"` for all attribute-matching criteria (the only supported criterion). For discrete category partitioning (game mode, region), use `match_options` — not `matching_rule`. Set `isForBalancing: true` for any attribute that should influence rebalance.
- Flexing rules: one entry per expansion phase. Duration is cumulative wait seconds. Start tight; relax over time.
- Alliance flexing rules: if the user wants a match to start with a full player requirement but later allow fewer players (for example, "4 players, then loosen to 1 for dev testing"), keep the opening `alliance.player_min_number`/`player_max_number` strict and add `alliance_flexing_rule` entries that relax `player_min_number` after the wait duration. Do not represent player-count relaxation with `flexing_rule`; `flexing_rule` is for relaxing attribute criteria such as MMR.
- Rebalance: **on by default** — omitting `rebalance_enable` keeps it enabled. Set `"rebalance_enable": false` only to explicitly disable it. Choose Combination (< 12 players total) or Greedy (≥ 12 players) for strict composition; Permutation for flexible/backfill.
- Roles: if the game has roles, use `has_combination` + nested `combination` structure.

### Step 4 — Write the ruleset JSON

Produce the complete JSON. Validate mentally: correct field names, no invented fields, all required blocks present.

### Step 5 — Explain and hand off

Write the explanation block and tuning notes, then the next-step line.

## Patterns

### 1-vs-1 ranked (MMR distance)

```json
{
  "alliance": {
    "min_number": 2,
    "max_number": 2,
    "player_min_number": 1,
    "player_max_number": 1
  },
  "matching_rule": [
    {
      "attribute": "mmr",
      "criteria": "distance",
      "reference": 100,
      "weight": 1,
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
    },
    {
      "attribute": "mmr",
      "criteria": "distance",
      "reference": 400,
      "duration": 60
    }
  ],
  "match_options": {
    "options": [
      { "name": "gameMode", "type": "all" }
    ]
  },
  "rebalance_enable": false
}
```

**Notes:**
- Two alliances of exactly 1 player → 1v1.
- MMR must be within 100 at submission; expands to 200 after 30 s, 400 after 60 s.
- `gameMode` is an exact partition: tickets in different modes never match.
- Rebalance disabled — no need, there's exactly 1 player per team.

### 5-vs-5 team deathmatch (MMR + game mode)

```json
{
  "alliance": {
    "min_number": 2,
    "max_number": 2,
    "player_min_number": 5,
    "player_max_number": 5
  },
  "matching_rule": [
    {
      "attribute": "mmr",
      "criteria": "distance",
      "reference": 150,
      "weight": 1,
      "isForBalancing": true,
      "normalizationMax": 3000
    }
  ],
  "flexing_rule": [
    {
      "attribute": "mmr",
      "criteria": "distance",
      "reference": 300,
      "duration": 45
    }
  ],
  "match_options": {
    "options": [
      { "name": "gameMode", "type": "all" }
    ]
  },
  "rebalance_enable": true
}
```

**Notes:**
- Alliance player min = max = 5, so exactly 10 players needed. With Combination rebalance (≤12), use default.
- MMR expands from 150 to 300 after 45 s.

### 4-player free-for-all with solo dev fallback

```json
{
  "alliance": {
    "min_number": 1,
    "max_number": 1,
    "player_min_number": 4,
    "player_max_number": 4
  },
  "alliance_flexing_rule": [
    {
      "min_number": 1,
      "max_number": 1,
      "player_min_number": 1,
      "player_max_number": 4,
      "duration": 10
    }
  ],
  "matching_rule": [
    {
      "attribute": "mmr",
      "criteria": "distance",
      "reference": 300,
      "weight": 1,
      "isForBalancing": true,
      "normalizationMax": 3000
    }
  ],
  "match_options": {
    "options": [
      { "name": "gameMode", "type": "all" }
    ]
  },
  "rebalance_enable": true
}
```

**Notes:**
- One alliance of exactly 4 players at first -> a 4-player free-for-all.
- After 10 s, `alliance_flexing_rule` relaxes the per-alliance player count to 1-4 so a dev queue can form a solo match.
- MMR still uses `matching_rule` / `flexing_rule`; player-count relaxation belongs in `alliance_flexing_rule`.

### Role-based (5-vs-5 with tank/healer/dps)

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
              { "name": "tank", "min": 1, "max": 1 },
              { "name": "healer", "min": 1, "max": 1 },
              { "name": "dps", "min": 3, "max": 3 }
            ]
          }
        }
      ]
    }
  },
  "role_flexing_enable": true,
  "role_flexing_second": 60,
  "role_flexing_player": 1,
  "matching_rule": [
    {
      "attribute": "mmr",
      "criteria": "distance",
      "reference": 200,
      "weight": 1,
      "isForBalancing": true,
      "normalizationMax": 3000
    }
  ],
  "rebalance_enable": true
}
```

**Notes:**
- Each team needs 1 tank, 1 healer, 3 dps.
- After 60 s, 1 player per team may fill any role (role flexing).

## Error Handling

| Situation | Response |
|---|---|
| User provides a ruleset with unknown fields | Flag the unknown fields by name; they'll be silently ignored by the service but indicate a mistake. |
| User asks for >20 matching_rule entries | Note the limit (20 as listed in `references/overview.md` Limits table — not confirmed in live docs); suggest consolidating criteria. |
| Combination rebalance with >12 players | Recommend Greedy instead; explain why Combination doesn't scale past 12. |
| User asks "what MMR range should I use?" | The reference doesn't prescribe this — it's game-design specific. Suggest starting at 100–200 and using X-Ray data to tune after launch. |
| User provides a local JSON file path | Use `Read` to load it, then review against the reference schema. |
