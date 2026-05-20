---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/how-to/update-to-new-ds-version/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/dedicated-server-claim-flow/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/how-to/fallback-fleets/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-launch-preparation/
see-also:
- '[overview.md](../references/overview.md)'
- '[fleet.md](fleet.md)'
- '[upload.md](upload.md)'
---

# AMS Rollout Manager

Guide DS version updates and advanced fleet deployment strategies: version migration, blue/green, canary, fallback fleets, and launch preparation. All configuration is Admin Portal-based — this subskill produces a plan and configuration values.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` — specifically the Claim Keys and Fleets sections — before advising on any strategy.
- Version migration in AMS does NOT use atomic swaps — it routes traffic gradually via claim key priority changes and relies on natural player churn through client updates.
- Fallback fleet: the primary fleet's buffer activates when the primary hits its Max Servers ceiling. Both fleets must share matching claim keys.
- Bare-metal lead time: at least **4 weeks** for large capacity orders. Large capacity = 10+ bare metal servers or 1,000+ vCPUs per region. Surface this when discussing launch events.

</grounding_rules>

<tool_usage_rules>

- `Read` for overview.md.
- No Bash, Write, or Edit — rollout planning is Admin Portal work.

</tool_usage_rules>

## Strategies

### 1. DS Version Migration (standard)

Used when deploying a new DS binary that all existing players should eventually move to.

**How it works:** New fleet with a new claim key (matching the new client version); old fleet stays active while players update; old fleet deactivated once all players are on the new client.

**Step by step:**

1. Upload the new DS binary: `/ags-ams upload` → image `my-game-server-1.2`
2. Create a new fleet with claim key `1.2` (same claim key as the new client's `client_version`)
3. Deploy the game client update (players switch to the new version)
4. Monitor old fleet (`1.1`) — session count should trend to zero as players update
5. Once zero active sessions on the old fleet, deactivate it (Fleet Manager → fleet → Deactivate)
   - Deactivation drains ready servers and lets in-progress sessions finish naturally

**For bare metal + cloud fallback setup:**
- Create both a cloud fleet and a bare metal fleet for `1.2`
- Configure the cloud fleet as fallback for the bare metal fleet
- Deactivate both `1.1` fleets together once adoption is complete

### 2. Blue/Green Deployment

Used for zero-downtime DS version switches where both versions need to be available simultaneously.

**Fleet naming:**
- Blue fleet: `battle-royale-blue` (claim key: `v1`)
- Green fleet: `battle-royale-green` (claim key: `v2`)

**Session template configuration:**
```
Preferred keys: v2
Fallback keys:  v1
```

**Traffic switch:**
1. When green is ready, reorder session template claim keys to prefer `v2`
2. Blue fleet receives no new sessions but existing sessions continue
3. Deactivate blue fleet once all its sessions end

**Rollback:** Swap claim key order back to prefer `v1`. Blue sessions are already running; green drains.

### 3. Canary Deployment

Used to validate a new DS version with a small fraction of live traffic before full rollout.

**Fleet setup:**
- Canary fleet: `battle-royale-canary` (claim key: `canary`, small Max Servers)
- Production fleet: `battle-royale-prod` (claim key: `production`)

**Session template:**
```
Preferred keys: canary
Fallback keys:  production
```

AMS tries `canary` first. If the canary fleet has ready servers, those are claimed. When the canary fleet exhausts its server pool, AMS falls back to `production`. This naturally limits canary traffic to the canary fleet's capacity.

**Monitoring:** Watch Grafana Fleet Overview for the canary fleet's claim rate and crash rate. Compare against production.

**Full rollout:** Once canary looks healthy, expand the canary fleet's Max/Buffer to full capacity (or create a new production fleet for the new version). Deactivate the old production fleet.

### 4. Fallback Fleets

Used when running on bare metal for baseline capacity but needing cloud VM overflow during peak.

**Setup:**
1. Create the bare metal fleet (primary) and cloud fleet (fallback)
2. Both must have the **same claim key**
3. In the bare metal fleet's configuration → Configure Fallback Fleet tab → enable fallback → select cloud fleet
4. The cloud fleet buffer stays at 0 when primary is below Max; automatically activates when primary is full

**Effect:** Players get bare metal servers (cheaper, consistent latency) for normal load. Peak overflow automatically spills into cloud VMs. Cost is minimized because the cloud fleet idles unless needed.

### 5. Launch Preparation

For major launches or live events, go through the AMS Launch Readiness checklist. Key items:

**Capacity planning (start 3+ months before launch):**
- Define three scenarios: bear case, bull case, home run (viral)
- Calculate Max Servers for each scenario in each target region
- For large bare metal orders (10+ servers or 1,000+ vCPUs per region): notify AccelByte Account Manager now — minimum 4-week lead time

**Pre-launch validation:**
- [ ] Buffer handles expected claim rate at peak CCU
- [ ] DS exits gracefully after each session (no stuck servers)
- [ ] Fleet scales back down after load decreases
- [ ] DS listens to drain signal: ignores if In Session, exits if idle
- [ ] DS exits with non-zero code on fatal error
- [ ] Load test to maximum PCCU capacity
- [ ] Log sampling enabled: 100% crash, 1–5% success
- [ ] Grafana monitored for claim failures and buffer count

**Regional setup:**
- QoS enabled for all target regions
- Fleet configured in each region with appropriate Max/Buffer for that region's expected CCU %
- Session template includes all target regions

## Workflow

### Step 1 — Identify the rollout type

Ask:

> What are you trying to do?
> 1. Deploy a new DS version (standard migration)
> 2. Switch versions with zero downtime (blue/green)
> 3. Test a new version with live traffic (canary)
> 4. Add cloud overflow to a bare metal setup (fallback fleet)
> 5. Prepare for a launch event

### Step 2 — Walk through the selected strategy

Follow the relevant strategy above. Produce a concrete action plan:

```
Rollout Plan: {strategy name}

Phase 1: Upload new DS binary
  /ags-ams upload → image: {image_name}

Phase 2: Create new fleet
  Admin Portal → AMS → Fleet Manager → Create Fleet
  Claim key: {key}
  Max Servers: {value}
  Buffer: {value}

Phase 3: Update session template
  Admin Portal → Multiplayer → Session Configuration
  Preferred keys: {list}
  Fallback keys: {list}

Phase 4: Monitor
  Grafana → AMS Fleet Overview
  Watch: claim failures, crash rate, session count on old fleet

Phase 5: Deactivate old fleet
  When old fleet session count reaches 0:
  Fleet Manager → old fleet → Deactivate
```

## Error Handling

| Situation | Response |
|---|---|
| Large bare metal order needed for launch | Surface 4-week lead time prominently. Ask about launch date and calculate deadline for ordering. |
| User wants instant traffic switch | Explain that AMS doesn't support atomic traffic cutover. Blue/green with claim key reorder is the closest — existing sessions on the old version continue until they end naturally. |
| Fallback fleet not activating | Verify both fleets share exactly the same claim key. Check that the primary fleet's Max Servers is actually reached before expecting fallback activation. |
| Old fleet not draining | Deactivation sends drain signals to Ready servers. In-progress sessions continue until they end. If sessions are very long, the fleet may appear "stuck" — it's expected behavior. |
| User skips canary and goes straight to full rollout | Acceptable if risk tolerance allows. Note that without a canary period, any DS bugs affect all players immediately. Suggest at least 5–10% of peak capacity as a canary run first. |
