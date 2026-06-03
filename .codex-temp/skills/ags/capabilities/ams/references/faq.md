---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-launch-preparation/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/fleet-sizing/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/register-local-dedicated-servers/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/view-server-logs-and-artifacts/
see-also:
- '[overview.md](overview.md)'
- '[glossary.md](glossary.md)'
---

# AMS FAQ

---

## When should I use AMS vs. running my own dedicated servers?

**AMS is the right choice when:**
- You're already using AGS Matchmaking and Sessions — AMS integrates with zero glue code
- Fleet operations (scaling, crash handling, regional capacity) are a burden you'd rather not own
- You have cold-start latency issues — warmed server pools directly address this
- You're launching in multiple regions and don't want to manage per-region capacity manually

**Running your own servers may make more sense when:**
- You have a multi-year cloud commitment you need to consume
- You need direct access to the underlying cloud infrastructure (specific instance families, networking config, compliance requirements)
- Your game uses a non-standard server topology that doesn't map to DS-per-session

---

## Does AMS work without AGS Matchmaking?

Yes. AMS can be used in a non-AGS matchmaking flow:
- The DS self-claims via the watchdog's `claim` message after a player joins
- Or an external matchmaking service triggers an AGS Session creation that claims from AMS

The `DS - AMS` session type is required regardless. The difference is who triggers the session creation (AGS Matchmaking vs. your own backend).

---

## What game engines does AMS support?

AMS works with any game engine that can run a Linux x86/x64 binary. The AGS Game SDK (with built-in watchdog support) is available for:
- Unreal Engine (via AccelByteUe4Sdk / AccelByteNetworkUtilities)
- Unity

For other engines (Godot, custom C++ servers, Python-based servers), you implement the watchdog protocol directly over WebSocket. See `references/overview.md#watchdog-protocol` for the message shapes.

---

## How long does DS startup take?

VM provisioning: up to 10 minutes for the first VM. Subsequent VMs on an already-provisioned machine start much faster. The buffer (warmed server pool) exists specifically to hide this latency — pre-warmed servers are already in Ready state and are claimed instantly.

The creation timeout (fleet setting) controls how long AMS waits for the DS to send the ready signal. Set this to exceed your DS load time. If the DS doesn't send ready within the timeout, AMS replaces it.

---

## What happens if a DS crashes?

AMS detects the crash via missed heartbeat (Unresponsive state) or process exit. It:
1. Marks the DS as Unresponsive or exits the DS
2. Removes the server from the ready pool
3. If log sampling is enabled, collects a core dump and logs
4. Starts a replacement DS from the fleet pool

Players connected at crash time are disconnected — AMS does not automatically migrate sessions. Implement reconnection logic on the client side.

---

## My buffer keeps running out. What do I do?

Increase the buffer value in the fleet config. The buffer formula:

```
buffer = demand change per minute × max DS startup time (1–10 min)
```

Use the Grafana Buffer Sizing dashboard (after 1–2 days of traffic) to see the "recommended buffer size" metric — the dashboard calculates the maximum short-term demand spike over 24 hours and recommends a buffer accordingly.

Also check Max Servers — if Max Servers is too low, the fleet can't grow to meet demand regardless of buffer.

---

## Can I use AMS with bare metal servers?

Yes. AMS supports bare metal alongside cloud VMs. Bare metal has static IPs and predictable performance but requires advance ordering (minimum 4-week lead time for large orders). 

Typical setup: bare metal fleet for baseline load + cloud fleet as fallback for peak overflow. See `subskills/rollout.md` for the fallback fleet configuration.

---

## How do I update to a new DS version without downtime?

**If the new server version requires a matching client update** (incompatible with existing clients): create a new fleet with a different claim key, then update the game client to submit the new claim key via the `client_version` attribute in matchmaking. Old clients keep hitting the old fleet. Once all players update, deactivate the old fleet.

**If the new server version is backwards-compatible** (no client update needed): create the new fleet with the same claim key as the old fleet. The session template will route new sessions to either fleet; drain the old fleet once the new one is healthy.

For zero-downtime hot switches (not version-keyed): use the blue/green pattern — two fleets with different claim keys, swap preference order in the session template.

See `subskills/rollout.md` for detailed step-by-step guidance.

---

## Do I need Extend to use AMS?

No. AMS and Extend are independent. Extend is useful for automating AMS operations (CI/CD fleet creation, automated DS uploads), but it's not required for basic AMS setup.

---

## What are the IP implications for third-party integrations?

- **Bare metal**: static IPs — allow-list friendly
- **Cloud VMs**: dynamic IPs from AWS/GCP/Azure — not allow-list friendly

If your DS needs to call a third-party service that requires IP allow-listing and you're on cloud VMs, consider routing those requests from the DS through an AGS Extend Service Extension — the Extend service has a stable IP and can proxy requests to the third-party service.

---

## How do I monitor AMS in production?

Key Grafana dashboards (access via Admin Portal → AMS):
- **AMS Fleet Overview** — claim failures, server counts, session durations
- **AMS Buffer Sizing** — recommended buffer based on historical demand
- **AMS DS Metrics** — per-DS CPU and memory
- **AMS DS Detail Metrics** — watchdog logs per server

For DS logs: Admin Portal → AMS → Logs and Artifacts (collected artifacts from exited DSes), or Admin Portal → Fleet Manager → {fleet} → {running server} → Logs (live streaming).

---

## What's the artifact retention period?

Artifacts (logs, core dumps, custom files) are retained for **30 days** or until manually deleted. There is no automatic export — if you need longer retention, download artifacts before the 30-day window expires.

---

## How many local DS registrations can I have?

**10 per namespace.** The AMS Simulator (for local testing) can register up to 10 local DSes per namespace. Remove old registrations in the Admin Portal when you hit the limit.
