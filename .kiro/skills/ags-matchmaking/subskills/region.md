---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/
see-also:
- '[overview.md](../references/overview.md)'
---

# AGS Matchmaking — Region Router

Configure region routing for AGS Matchmaking — how latency maps are measured, submitted with tickets, and used by the pool's latency method to select the best region for a match.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before making any recommendation about region routing. Latency method values, latency map format, QoS API calls, and ruleset region expansion fields are defined there.
- `latency_method` values are `"PING_RESULTS_AVERAGE"` and `"PING_RESULTS_CLOSEST_TO_REGION"` — these are the enum strings referenced in SDK/portal configuration. Current docs describe the methods as "Average" and "P95" semantically; verify enum strings against the Admin Portal or SDK source before using.
- Region expansion fields (`region_latency_initial_range_ms`, `region_expansion_range_ms`, `region_expansion_rate_ms`, `region_latency_max_ms`, `region_latency_rule_weight`, `disable_bidirectional_latency_after_ms`) live on the **ruleset**, not the pool. Do not claim they are pool fields.
- Region codes come from the user's actual AGS namespace configuration — do not fabricate region names. Examples in this file use `us-west-2`, `ap-southeast-1`, `eu-west-1` as illustrations only.
- Do not describe AMS fleet region configuration — that belongs in `/ags-ams`. This subskill covers only the matchmaking-side latency measurement and selection.

</grounding_rules>

<tool_usage_rules>

- Use `Read` to read `.env` or project files if the user points to them.
- Use `Bash` to check for existing QoS integration in Unreal or Unity projects: `grep -r "QueryServerRegions\|GetServerLatencies" --include="*.cpp" --include="*.cs" . 2>/dev/null | head -20`.
- Do not write Admin Portal config files — region routing is configured in the pool settings (latency method) and via the SDK at runtime.

</tool_usage_rules>

<output_contract>

Produce:
1. **Latency method recommendation** with rationale.
2. **QoS integration code** (Unreal and/or Unity) — how to measure region latencies and pass the map to the ticket.
3. **Latency map format** — the JSON structure that goes in the ticket.
4. **Region expansion configuration** (if the user asks or if the default 200 ms initial range is likely wrong for their game).
5. **Preferred-region restriction pattern** (if the user wants it).
6. **Next step** — "Run `/ags-matchmaking pool` to set the latency method on the pool" or "Run `/ags-matchmaking integrate` to wire QoS into the ticket submission flow."

</output_contract>

## Workflow

### Step 1 — Read the reference

Read `references/overview.md`, specifically the Region routing section.

### Step 2 — Recommend the latency method

Ask (or infer from context):
- Is the game competitive or casual?
- Is worst-case latency more damaging than average latency?

**Recommendation rule:**
- Competitive / latency-sensitive → `PING_RESULTS_CLOSEST_TO_REGION` / P95 (minimizes worst-case latency per match).
- Casual / large player pool → `PING_RESULTS_AVERAGE` (minimizes average latency across the match).

### Step 3 — QoS measurement

#### Unreal

```cpp
// 1. Call before StartMatchmaking. The SDK pings all available regions.
IOnlineSubsystem* Subsystem = IOnlineSubsystem::Get(ACCELBYTE_SUBSYSTEM);
IOnlineSessionPtr SessionInterface = Subsystem->GetSessionInterface();

// Retrieve cached region latencies measured by the SDK.
// StartMatchmaking() auto-populates tickets with QoS region data; call GetCachedLatencies()
// first if you need to inspect or override the latency map before submitting.
TMap<FString, int32> CachedLatencies;
SessionInterface->GetCachedLatencies(CachedLatencies);
// CachedLatencies: map of region code → round-trip ms (populated by the SDK's background QoS pings).
// If empty, StartMatchmaking() will still submit the ticket without region preference.
```

#### Unity

```csharp
// 1. Measure latencies via QosManager
QosManager qosManager = AccelByteSDK.GetClientRegistry().GetApi().GetQosManager();
qosManager.GetAllActiveServerLatencies(result =>
{
    if (result.IsError)
    {
        // QoS failed — submit ticket without latency data or retry
        return;
    }

    // result.Value: Dictionary<string, int> e.g. {"us-west-2": 44, "ap-southeast-1": 120}
    var latencies = result.Value;

    // 2. Include latencies as optional params in ticket submission
    MatchmakingV2 matchmaking = AccelByteSDK.GetClientRegistry().GetApi().GetMatchmakingV2();
    var optionalParams = new MatchmakingV2CreateTicketRequestOptionalParams
    {
        latencies = latencies
    };
    matchmaking.CreateMatchmakingTicket("my-pool-name", optionalParams, ticketCallback);
});
```

### Step 4 — Latency map format

The latency map embedded in the ticket is a JSON object:

```json
{
  "latencies": {
    "us-west-2": 44,
    "ap-southeast-1": 120,
    "eu-west-1": 200
  }
}
```

Keys are AGS region codes (check Admin Portal → AMS or your namespace's available regions). Values are round-trip times in milliseconds.

### Step 5 — Region expansion configuration (optional)

The default latency range starts at 200 ms and expands by 50 ms per tick. If players are consistently waiting due to latency filtering (X-Ray shows "no common region found"), tune these ruleset fields:

```json
{
  "region_latency_initial_range_ms": 150,
  "region_expansion_range_ms": 25,
  "region_expansion_rate_ms": 5000,
  "region_latency_max_ms": 300,
  "region_latency_rule_weight": 500,
  "disable_bidirectional_latency_after_ms": 60000
}
```

- **Lower `region_latency_initial_range_ms`** → stricter initial region grouping (better quality, longer waits).
- **Increase `region_expansion_range_ms`** → expands faster (shorter waits, more region variance).
- **Set `region_latency_max_ms`** → hard cap; tickets with no region under this threshold won't match (useful for region-sensitive games).
- **`disable_bidirectional_latency_after_ms`** → after this wait time, a ticket becomes the "pivot" that relaxes bidirectional latency constraints, helping thin-population scenarios.

These fields go in the ruleset JSON (same level as `matching_rule`), not the pool. Run `/ags-matchmaking ruleset` to add them.

### Step 6 — Preferred-region restriction (optional)

To restrict a ticket to a specific region, use the Unreal `SETTING_GAMESESSION_REQUESTEDREGIONS` setting (documented in the AGS Unreal OSS) or verify the current Unity ticket attribute name against the AGS docs before shipping — the attribute name for party-level region preference may vary by SDK version.

> **Note:** `preferred_game_mode_region` in `party_attributes` is referenced in some community examples, but is not confirmed in current official documentation. Verify the supported field name against `https://docs.accelbyte.io/gaming-services/modules/multiplayer/matchmaking/configure-matchmaking-for-a-specific-region/` before using.

Use region restriction for:
- Region-locked competitive tournaments.
- Players explicitly choosing a datacenter.

Warn the user: region restriction shrinks the effective player pool. Combine with generous flexing rules or remove the restriction after timeout if the pool is small.

### Step 7 — Hand off

```
Region routing summary:
  Latency method:         PING_RESULTS_CLOSEST_TO_REGION / PING_RESULTS_AVERAGE
  QoS integration:        [wired / not yet wired]
  Preferred region:       enabled ({region}) / disabled

Next: Run /ags-matchmaking pool to set the latency_method field on the pool.
```

## Error Handling

| Situation | Response |
|---|---|
| QoS measurement fails at runtime | "If QoS fails, submit the ticket without a latency map. Matchmaking will use any available region — match quality may suffer. Log QoS failures and alert if they're frequent." |
| User asks which regions are available | "Region codes come from your namespace's AMS configuration. Check Admin Portal → AMS → Fleets to see available regions. This subskill doesn't know your specific region list." |
| User wants AMS fleet region configuration | "Fleet region configuration is an AMS topic. Run `/ags-ams fleet` for that. This subskill covers the matchmaking-side latency measurement and selection." |
| User wants to restrict to a region not in their fleet | "If a region appears in the latency map but has no AMS fleet, the match will form but server allocation will fail. Ensure the fleet covers any region you allow in tickets." |
