---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-troubleshooting-guide/
see-also:
- '[overview.md](../references/overview.md)'
- '[observe.md](observe.md)'
- '[fleet.md](fleet.md)'
- '[session.md](session.md)'
---

# AMS Doctor

Read-only diagnosis for AMS problems. Ingests symptoms, maps them to likely causes from the AMS troubleshooting guide and architecture, and points to the specific subskill that owns the fix. Does not run commands. Does not change any configuration.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` before diagnosing — architecture and limits underpin most root causes.
- Root causes must trace to `references/overview.md` (architecture limits), the AMS troubleshooting guide content embedded below, or observable symptoms from the user. Do not invent causes.
- Common causes are documented below; if the symptom doesn't map to anything documented, say so and direct the user to AccelByte support.

</grounding_rules>

<tool_usage_rules>

- `Read` for overview.md only.
- No Bash, Write, or Edit. This subskill is strictly read-only diagnosis.
- If the user asks for a fix command, name the subskill that runs it — don't run it here.

</tool_usage_rules>

<output_contract>

Output is a three-block diagnosis:

1. **Symptoms** — one paragraph restating what the developer described in technical terms.
2. **Likely causes** — ordered list (highest likelihood first), each with:
   - Cause (one line)
   - Evidence (why it matches — grounded in architecture or troubleshooting guide)
   - What to check next
   - Likelihood: high / medium / low
3. **Next step** — exactly one action to take first. Always include a support fallback at the end.

</output_contract>

## Known Issue Patterns

### Fleet shows no VMs running

**Causes (in order):**
1. **Provisioning still in progress** (high) — AMS can take up to 10 minutes to provision VMs. Check History tab in the Admin Portal for provisioning events.
2. **Min Servers and Buffer both 0** (high) — no automatic DS creation. AMS won't start servers proactively. Fix: increase buffer or min servers via `/ags-ams fleet`.
3. **Fleet inactive / hibernating** (medium) — development fleets hibernate when not in use. Re-activate in Fleet Manager.

### Servers running but no dedicated servers on them

**Causes (in order):**
1. **DS startup command misconfigured** (high) — check the fleet's command-line configuration for typos or wrong executable path. Review History tab for DS creation failure events.
2. **DS binary failing on startup** (high) — DS crashes before sending the ready signal. Enable log sampling and pull crash logs via `/ags-ams observe`.
3. **DS not sending ready within creation timeout** (medium) — AMS removes a DS that doesn't send ready in time. Increase creation timeout in fleet config, or investigate why the DS loads slowly.

### Sessions can't claim a DS (claim failures)

**Causes (in order):**
1. **No ready-state servers available** (high) — buffer ran out. Check claim failure rate in Grafana Fleet Overview. Increase buffer; see `/ags-ams fleet`.
2. **Claim key mismatch** (high) — session template claim key doesn't exactly match the fleet's claim key (case-sensitive, no whitespace). Verify both in Admin Portal.
3. **QoS not enabled for the region** (medium) — AGS won't route players to a region without QoS. Enable QoS in Admin Portal for each target region.
4. **Requested regions don't match fleet regions** (medium) — session asks for a region the fleet doesn't cover. Check Session & Party History for `RequestedRegions` and compare to fleet region config.
5. **Max Servers at capacity** (low) — fleet hit its Max Servers ceiling. Monitor Grafana; increase Max Servers if needed.

### Ready servers exist but nothing claims them

**Causes (in order):**
1. **Claim key mismatch** (high) — session template lists a different claim key than the fleet. Fix in Admin Portal session config.
2. **DS instance type / region mismatch** (medium) — fleet is active in a different region than the player's matchmaking request. Verify in Grafana (confirm DS instances run in requested regions).
3. **Session template not set to DS - AMS** (medium) — session type isn't configured to use AMS. Check session template in Admin Portal.

### DS crashes mid-session (players disconnected)

**Causes (in order):**
1. **Insufficient resources (OOM or CPU starve)** (high) — monitor Grafana AMS DS Metrics for CPU and memory spikes. Switch to a larger instance type or fix memory leaks.
2. **DS not handling drain correctly** (medium) — AMS sends drain, DS crashes instead of exiting gracefully. Check drain handler implementation via `/ags-ams sdk`.
3. **External dependency failure** (medium) — if the DS calls AGS APIs or external services and those fail, it may crash. Check AGS API status and connection handling.

### DS not exiting after session ends

**Cause:** DS process is stuck — not calling `exit()` after the session cleanup. This leaks VM capacity. The DS must exit (any code) after session cleanup for AMS to reclaim the slot.

Check: look for blocking cleanup code (waiting on a network call, stuck in a loop, waiting for a non-existent event). Fix the exit path in the DS code.

### Logs missing from Artifacts

**Cause:** Log sampling was not enabled when the DS exited. Sampling is a fleet setting — it must be enabled before the DS runs. Enable in Fleet Manager → Configure → Logs & Artifacts Sampling. Set crash sampling to 100% and success sampling to 1–5%.

### IP whitelisting issues (third-party integrations)

Bare metal servers have static IPs; cloud instances have dynamic IPs from AWS/GCP/Azure. Third-party services that require IP whitelisting cannot whitelist cloud DS instances reliably. **Fix:** use an AGS Extend service as a proxy — it has a stable IP — to forward requests to third-party services. See `/ags-extend`.

## Workflow

### Step 1 — Classify the symptom

| Category | Cue |
|---|---|
| No VMs provisioning | "no servers", "fleet empty", "zero VMs" |
| VMs present but no DS | "VMs running but no game servers", "DS not starting", "servers crashing at startup" |
| Claim failures | "session can't find DS", "claim failing", "no server available", "matchmaking times out" |
| Ready servers unclaimed | "servers ready but no session gets one" |
| DS crashes mid-session | "players disconnecting", "DS crashed", "session dropped" |
| DS not exiting | "servers stuck", "capacity leaking", "DS won't stop" |
| Missing logs/artifacts | "can't find crash logs", "no artifacts" |

### Step 2 — Read `references/overview.md`

Focus on the Watchdog Protocol, Fleets, and Limits sections. These underpin most root causes.

### Step 3 — Write the diagnosis

Use the three-block format from `output_contract`. Be terse. Reference the Known Issue Patterns above.

### Step 4 — Hand off

Name exactly one next step. Support fallback to include:

> If this doesn't resolve it, contact AccelByte support with your namespace, fleet name, symptom description, and relevant log output from the Admin Portal or Grafana.

## Error Handling

| Situation | Response |
|---|---|
| Developer asks doctor to run a command | Stop. "This subskill is read-only. The relevant subskill is /ags-ams {fleet|observe|sdk|session}." |
| Developer asks doctor to change fleet config | Stop. "I diagnose, don't configure. Run /ags-ams fleet for configuration changes." |
| Symptoms don't map to any known pattern | Use empty result recovery: list what was checked, point to AccelByte support with namespace + fleet + symptom. |
| "Is AccelByte down?" | Direct to AccelByte support or status page. Not a diagnosable pattern. |
| No symptoms given | Ask: "What's the symptom? (fleet state, claim failure rate, specific error, player-visible behavior)" |
