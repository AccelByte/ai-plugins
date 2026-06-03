---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/view-server-logs-and-artifacts/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/fleet-sizing/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-troubleshooting-guide/
see-also:
- '[overview.md](references/overview.md)'
- '[doctor.md](doctor.md)'
---

# AMS Observer

Pull fleet metrics, server logs, and artifacts from a live AMS deployment. All AMS observability lives in the Admin Portal and Grafana Cloud — there is no AMS CLI command for logs or metrics. Read-only — never restarts, redeploys, or changes state.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` — specifically the Limits section — before advising on retention or sampling.
- Observability surfaces: (1) Admin Portal fleet overview / live logs / artifacts, (2) Grafana Cloud dashboards.
- Artifacts (logs, core dumps, custom artifacts) are collected only when a DS **exits** and sampling rules are satisfied. Live logs stream while the DS is running.
- Artifacts are retained for **30 days** or until manually deleted.
- Log sampling must be configured in the fleet before a DS exits — retroactive sampling is not possible.

</grounding_rules>

<tool_usage_rules>

- `Read` for overview.md.
- No Bash — AMS observability is Admin Portal / Grafana only.
- Never modify fleet config or DS state.

</tool_usage_rules>

## Observability Surfaces

### 1. Admin Portal — Fleet Overview

**Admin Portal → AMS → Fleet Manager → {fleet name}**

Shows:
- Running server count by region
- Ready vs. In Session vs. Draining server counts
- Claim failure counts
- Fleet status (active, hibernating)
- History tab: DS creation attempts, crashes

**When to use:** Quick health check — are servers running and being claimed?

### 2. Admin Portal — Live Logs

**Admin Portal → AMS → Fleet Manager → {fleet} → {running server} → Logs**

Shows: real-time stdout/stderr from a currently-running DS.

**Constraint:** Only available while the DS is running. Once it exits, use artifact collection instead.

### 3. Admin Portal — Logs and Artifacts

**Admin Portal → AMS → Logs and Artifacts**

Shows collected artifacts across all fleets: logs, core dumps, and custom artifacts from DSes that have exited.

**Filtering:** by fleet, image, server, type (log/coredump/custom), status (Success/Skipped/Failed), date range, size.

**Actions:** download single or bulk, delete (irreversible).

**Custom artifacts:** write your own files to `${artifact_path}` inside the DS binary. AMS collects them on exit.

**Retention:** 30 days or manual deletion, whichever comes first.

### 4. Grafana Cloud Dashboards

**Admin Portal → AMS → (Open Grafana or navigate to Grafana from fleet detail)**

Key dashboards:

| Dashboard | What it shows | When to use |
|---|---|---|
| **AMS Fleet Overview** | Claim failure rate, running server counts, session durations | Regular production monitoring |
| **AMS Buffer Sizing** | "Recommended buffer size" metric (max over 24h short-term spikes) | After 1–2 days of traffic; use to calibrate buffer |
| **AMS DS Metrics** | Per-DS CPU, memory, network | Diagnosing resource-constrained crashes |
| **AMS DS Detail Metrics** | Watchdog logs per DS | Debugging individual server failures |

**Log access via Grafana Explore:** Filter by `ams_fleet` and `service_name` labels.

## Workflow

### Pulling metrics for ongoing monitoring

Direct the user to:

```
For fleet health:
  Admin Portal → AMS → Fleet Manager → {fleet name}

For claim failure rate and buffer calibration:
  Grafana Cloud → AMS Fleet Overview dashboard
  Grafana Cloud → AMS Buffer Sizing dashboard (after 1–2 days of data)
```

Interpret common metrics:

| Metric | Interpretation | Action |
|---|---|---|
| Claim failure rate > 0 | Ready servers ran out before new VMs provisioned | Increase buffer and/or max servers; see `/ags ams fleet` |
| Running servers = 0 (fleet active) | VM provisioning pending (up to 10 min) | Wait; if persistent, check fleet config |
| Crash rate high | DS instability | Enable 100% crash sampling; pull core dumps |
| Buffer = 0 and claim failures | Min + Buffer both 0, or insufficient buffer | Increase buffer |

### Pulling logs from a crashed DS

1. **Go to Admin Portal → AMS → Logs and Artifacts**
2. Filter by fleet and select "Failure" or "Success" status as needed
3. Download the log artifact — it contains the DS's stdout/stderr up to crash
4. If crash sampling is enabled, a core dump artifact is also available

If no artifacts exist for a recent crash:
> Log sampling was not enabled in the fleet config when the DS exited. Enable it in Fleet Manager → fleet → Configure → Logs & Artifacts Sampling, then wait for the next crash to capture data.

### Watching a live DS

1. **Admin Portal → AMS → Fleet Manager → {fleet} → select a running server**
2. Open the Logs tab to stream live output

Live logs stop when the DS exits. For post-mortem analysis, artifact collection must have been enabled before the DS exited.

### Investigating claim failures

If sessions can't find a DS (claim failures showing in Fleet Overview):

Checklist:
- [ ] Fleet has active servers in the target region
- [ ] Claim keys in session template exactly match fleet's claim keys (case-sensitive)
- [ ] QoS is enabled for the region where players are
- [ ] Requested regions in the matchmaking ticket match an enabled region
- [ ] Max Servers > 0 and Buffer > 0

See `/ags ams doctor` for deeper diagnosis.

## Error Handling

| Situation | Response |
|---|---|
| No artifacts for a DS crash | Sampling was not enabled. Enable it in fleet config before the next incident. |
| Artifacts show "Failed" status | Collection failed — often because the DS exited too quickly for AMS to collect. Check creation timeout and ensure the DS doesn't exit immediately on startup. |
| Core dump missing | Core dump sampling must be enabled separately (set to 100% for crash events). Enable in fleet configure tab. |
| Grafana shows no data | Check that the fleet has generated at least one DS. Grafana metrics only appear after DS activity. |
| Log artifacts are empty | The DS may not be writing to stdout. Ensure the game engine's logging is routed to stdout/stderr. |
| User wants to tail logs | Point to live logs in the Admin Portal for running servers, or Grafana Explore for historical log queries with live refresh. There is no `tail -f` equivalent CLI command for AMS. |
