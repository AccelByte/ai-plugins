---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/create-ams-fleet/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/fleet-sizing/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/choosing-instance-types/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/using-build-configs/
- https://accelbyte.io/pricing?multiplayer-servers
see-also:
- '[overview.md](references/overview.md)'
- '[session.md](session.md)'
- '[rollout.md](rollout.md)'
- '[ams-fleet-ags-cli.md](references/synthetic/ams-fleet-ags-cli.md)'
---

# AMS Fleet Manager

Guide a developer through creating and configuring AMS fleets — fleet type selection, instance type, scaling parameters, timeouts, regions, and claim keys. Prefer Admin Portal guidance for interactive configuration. When the user explicitly asks for terminal-driven fleet operations, read `references/synthetic/ams-fleet-ags-cli.md` and discover the exact `ags ams ...` command surface before proposing any mutation.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` — specifically the Fleets, Claim Keys, and Limits sections — before advising on any parameter.
- For Admin Portal workflows, produce configuration guidance and values the developer enters manually.
- For CLI workflows, read `references/synthetic/ams-fleet-ags-cli.md`, run discovery first, and ask for explicit confirmation before any create/update/delete command.
- The buffer sizing formula from overview.md: `buffer = demand change per unit time × maximum DS startup duration (1–10 min)`. Present this when sizing questions come up.
- Setting both Min Servers and Buffer to 0 prevents automatic DS creation. Claim requests will always fail. Surface this as a hard warning when those values are discussed.

</grounding_rules>

<tool_usage_rules>

- `Read` for overview.md and the user's existing fleet config notes if they share them.
- `Bash` is allowed only for read-only CLI discovery unless the user explicitly confirms a create/update/delete operation.
- No `Write` or `Edit` — no config files to write for fleet setup.

</tool_usage_rules>

<output_contract>

At the end of the workflow, produce a fleet configuration summary the developer can use as a reference while filling in the Admin Portal:

```
Fleet Summary
  Name:          {name}
  Type:          Production / Development
  Image:         {image_name}
  Instance type: {type_code} ({category})
  Regions:       {region list}

  Per-region scaling:
    Max Servers:    {value}  (≥ Peak CCU / players-per-DS)
    Min Servers:    {value}  (0 recommended unless launch-day surge)
    Buffer Servers: {value}  (~{pct}% of expected peak claimed)

  Timeouts:
    Creation:      {value}s  (time to boot + ready signal)
    Session:       {value}s  (max game session length)
    Unresponsive:  {value}s  (missed heartbeat → replace)

  Claim keys:    {list}

  Logs sampling:  {pct}% success, 100% crash
```

</output_contract>

## Workflow

### Step 1 — Fleet type

Ask:

> Is this fleet for a live game (Production) or for development/testing (Development)?

**Production fleet:**
- Maintains a buffer of ready servers at all times
- Uses immutable DS images and command-line args after creation
- Best for live traffic

**Development fleet:**
- Supports multiple DS versions on the same VMs
- Can hibernate (reduce to zero) when not in use
- Use build configurations instead of fixed images
- Best for QA, integration testing, and continuous dev builds

If the user isn't sure, default to Production for any fleet serving real players.

### Step 2 — Image and name

For a **Production fleet**: ask for the uploaded image name (from `/ags ams upload`).

For a **Development fleet**: the fleet itself doesn't need a specific image — images are associated via Build Configurations. Ask for a fleet name.

Fleet naming convention: include game mode and version to distinguish fleets (e.g. `battle-royale-prod-v1`, `capture-flag-dev`).

### Step 3 — Instance type

Ask about DS resource profile:

> What is your DS more demanding on — CPU, memory, or roughly balanced?

| Answer | Instance type | Code |
|---|---|---|
| CPU-heavy (physics, AI, large player counts) | Compute-Optimized | CPX |
| Memory-heavy (large maps, many game objects, streaming) | Memory-Optimized | MEX |
| Balanced | General-Purpose | GLX |

Additional guidance: "Choose the largest possible instance type that doesn't waste resources — it's cheaper to run 4 DS on one large VM than 4 small VMs."

To confirm the right choice, ask the user to profile their DS with engine profiling tools first if they haven't already.

See the Admin Portal pricing page at `https://accelbyte.io/pricing?multiplayer-servers` for specific machine specs.

### Step 4 — Regions

Ask:

> Which regions do you need to deploy in? List your expected player regions in priority order.

AMS supports multi-region deployment. Each region gets its own scaling configuration (Max/Min/Buffer). Start with the user's primary player region; add secondary regions as needed.

QoS servers must be enabled for a region before matchmaking can route players there — remind the user to enable QoS in the Admin Portal for each region.

### Step 5 — Scaling parameters

For each region, calculate recommended values:

**Max Servers:**
- Minimum: `ceil(Peak CCU / players per DS)`
- Recommendation: set 20–30% higher to account for estimation error
- Example: 5,000 CCU, 10 players/DS → minimum 500, recommended 600–650

**Min Servers:**
- `0` for most scenarios — enables full dynamic scaling
- Set to 1–5 for regions expecting sudden launch-day surges

**Buffer Servers:**
- Formula: `demand change per minute × max DS startup time (1–10 min)`
- Practical range: 10–20% of expected peak claimed DS count (50% in rare surge cases)
- Example: 500 peak DS, 15% buffer → 75 buffer servers
- Recommendation: start at 10–15%, then calibrate using the Grafana Buffer Sizing dashboard after 1–2 days of traffic

Hard warning to include:
> If both Min Servers and Buffer are 0, AMS will not pre-create any servers. The first claim after any idle period will fail — AMS won't start DS until a claim is attempted.

### Step 6 — Timeout configuration

Walk through each timeout with a description:

| Timeout | What it controls | Recommended starting point |
|---|---|---|
| **Creation timeout** | How long AMS waits for the DS to send the ready signal | Should exceed your DS load time. Start at 60–90s for small DS, up to 5 min for large ones. |
| **Session timeout** | Maximum duration of a single game session | Set to your longest expected match duration + 20% buffer. AMS sends drain when this expires. |
| **Unresponsive timeout** | How long AMS waits after a missed heartbeat before replacing the DS | Keep at default (usually 30–60s). Lowering it can cause false replacements on slow heartbeats. |

### Step 7 — Claim keys

Ask:

> What claim key(s) should this fleet respond to? (e.g. `battle-royale-v1`, a game mode name, or a client version string)

Each fleet can have multiple claim keys. Common patterns:
- Single key per fleet: simple, one-to-one claim routing
- Version-based: key = `1.2` matches client version attribute `1.2` from matchmaking ticket
- Mode-based: key = `battle-royale` routes that game mode to this fleet

For development fleets, claim keys still apply — build configurations layer on top.

### Step 8 — Logs and artifacts sampling

For production fleets, strongly recommend:
- **Success sampling**: 1–5% (captures logs from a small fraction of normal sessions for baseline analysis)
- **Crash sampling**: 100% (always capture crash logs and core dumps)

Logs retention: 30 days. Configure sampling rules before activation — the fleet cannot capture artifacts from servers that have already exited without the rules in place.

### Step 9 — Summary and next step

Print the Fleet Summary from `output_contract`.

```
Next: Go to Admin Portal → AMS → Fleet Manager → Create Fleet and enter these values.
After the fleet is active, run /ags ams session to configure session templates to claim from it.
```

## Error Handling

| Situation | Response |
|---|---|
| User unsure of peak CCU | Walk through three scenarios: bear case (low estimate), bull case (expected), home run (viral spike). Use the highest for Max Servers. |
| User sets buffer and min to 0 | Hard warning: this will cause every first claim to fail. Require explicit acknowledgment before proceeding. |
| User wants to skip timeout config | Provide safe defaults (creation: 120s, session: based on game mode, unresponsive: 30s) and note they can be tuned later. |
| QoS not enabled for a region | The fleet will work but matchmaking won't route players there based on latency. Tell the user to enable QoS in the Admin Portal. |
| User doesn't know their DS load time | Suggest running the DS locally and timing the ready signal. If using the AMS Simulator (`amssim run`), it shows startup time in output. |
| Development fleet question about build configs | Explain: a build config is a named DS image + command-line args pair attached to a dev fleet. When a session claims from a dev fleet, AMS matches on the build config name against the session's claim key. The first claim for a new build config always fails (DS starts on demand) — AGS Session retries after 60 seconds. |
