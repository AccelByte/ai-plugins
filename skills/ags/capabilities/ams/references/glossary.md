---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/choosing-instance-types/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/using-build-configs/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/view-server-logs-and-artifacts/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/
see-also:
- '[overview.md](overview.md)'
- '[faq.md](faq.md)'
---

# AMS Glossary

AMS terms grouped by the order a developer usually encounters them.

---

## Product and architecture

**AMS** — AccelByte Multiplayer Servers. AGS's dedicated game-server fleet manager. Studios upload a DS binary; AMS handles fleet provisioning, scaling, health monitoring, and regional routing.

**AGS** — AccelByte Gaming Services. The platform AMS runs on top of. AMS integrates natively with AGS Matchmaking and Session Management.

**AMS account** — the billing and resource-sharing entity. One AMS account can be linked to multiple game namespaces. Linked namespaces share uploaded images, metrics, and billing.

**Namespace** — AGS tenancy boundary. AMS operates within a game namespace. Separate environments (dev, staging, prod) each have their own namespace.

**Admin Portal** — AccelByte's web UI. Most AMS configuration (fleets, sessions, artifacts) is done here.

---

## Dedicated server lifecycle

**Dedicated server (DS)** — the game server binary that AMS manages. A DS is disposable and session-specific: it's claimed for one session, then exits.

**Watchdog** — lightweight per-DS process. Manages health monitoring, heartbeats, drain signaling, and crash detection. The DS communicates with the watchdog over WebSocket at `ws://localhost:5555/watchdog`.

**Ready signal** — message from DS to watchdog (`{"ready": {"dsid": "..."}}`) that transitions the DS from Creating to Ready state. Sent once after initialization.

**Heartbeat** — message from DS to watchdog (`{"heartbeat": {}}`) sent every 15 seconds. Missing heartbeats → DS transitions to Unresponsive → AMS replaces it.

**Drain signal** — message from watchdog to DS (`{"drain": {}}`) telling the DS to finish and exit. DS should: ignore if In Session (finish session first), exit immediately if idle.

**Self-claim** — DS sends `{"claim": {"sessionId": "..."}}` to claim itself. Used when the DS creates sessions independently (not via AGS Matchmaking).

**DS states:** Creating → Ready → In Session → Drain → Unresponsive

---

## Fleet concepts

**Fleet** — a named pool of AMS-managed VMs running a DS binary. Fleets have a type (production / development), instance type, claim keys, and per-region scaling config.

**Production fleet** — for live games. Maintains ready-server buffers at all times. Images and command-line args are immutable after creation.

**Development fleet** — for testing. Supports multiple DS versions on the same VMs. Can hibernate. Uses build configurations instead of fixed images.

**Max Servers** — hard ceiling on server count per region. Cost safeguard. Minimum: `Peak CCU / players per DS`.

**Min Servers** — always-running baseline. `0` for most scenarios; higher for launch events expecting sudden surges.

**Buffer Servers** — count of "Ready" servers maintained proactively. Absorbs demand spikes while new VMs provision. Formula: `demand change per minute × max DS startup time`. Typical: 10–20% of peak claimed count.

**Warmed servers** — servers in Ready state waiting to be claimed. "Buffer" and "warmed servers" are synonymous in AMS terminology.

**DS per VM** — how many DS instances run on a single VM. Affects rounding of min/max values and cost calculations. Larger VMs hosting more DS per VM are typically more cost-efficient.

**Fleet hibernation** — development fleet feature. Reduces server count to zero when not in use to save costs. Not available for production fleets.

---

## Instance types

**MEX** — Memory-Optimized instance. More memory relative to CPU. Best for memory-heavy DS workloads.

**CPX** — Compute-Optimized instance. More CPU relative to memory. Best for CPU-heavy DS workloads.

**GLX** — General-Purpose instance. Balanced CPU and memory. Best for DS with roughly equal demands.

---

## Claim keys and routing

**Claim key** — a string identifier attached to a fleet. Session templates send claim keys in priority order; AMS finds the first fleet with a ready server matching a claim key.

**Preferred claim keys** — tried first by the session template.

**Client version keys** — derived from the `client_version` attribute in matchmaking tickets. Enables automatic version routing without changing the session template.

**Fallback claim keys** — last resort keys in the session template.

**Claim failure** — no ready server found matching the session's claim keys in any requested region. Visible in Grafana Fleet Overview.

---

## Build configurations (development)

**Build configuration (build config)** — dev-fleet construct: a named DS image + command-line args pair. When a dev fleet receives a claim request, it looks for running DS launched with a matching build config name. If none exist, starts one on demand.

**On-demand DS start** — dev fleet behavior: when a build config is claimed for the first time, AMS starts a DS on demand. The first claim typically fails unless the DS starts within 8 seconds; AGS Session retries after 60 seconds.

---

## CLI tools

**AMS CLI (`ams`)** — command-line tool for uploading DS binaries to AMS. Downloaded from the Admin Portal (AMS → Download Resource).

**AMS Simulator (`amssim`)** — command-line tool that emulates AMS watchdog behavior locally. Used to test DS integration without connecting to cloud infrastructure.

---

## Observability

**QoS (Quality of Service) servers** — AMS-deployed network probes per region. Game clients measure latency to QoS servers to pick the best region. Must be enabled per region in Admin Portal for matchmaking to route players there.

**Artifacts** — files collected from a DS after it exits: logs, core dumps, and custom files written to `${artifact_path}`. Retained 30 days.

**Log sampling** — fleet setting controlling what fraction of DS exits trigger artifact collection. Recommended: 100% for crashes, 1–5% for normal exits.

**Grafana Cloud** — observability UI. Access via Admin Portal → AMS or Extend. Key AMS dashboards: AMS Fleet Overview, AMS Buffer Sizing, AMS DS Metrics, AMS DS Detail Metrics.

---

## Deployment patterns

**Blue/green** — two parallel fleets (blue = old, green = new) with different claim keys. Session template prefers green; falls back to blue. Enables zero-downtime switches.

**Canary fleet** — small fleet with a unique claim key listed first in the session template. Receives a natural fraction of traffic (limited by its Max Servers). Used to validate a new DS version before full rollout.

**Fallback fleet** — secondary fleet (usually cloud) linked to a primary fleet (usually bare metal). The fallback fleet's buffer activates automatically when the primary hits its Max Servers ceiling. Both must share the same claim keys.

---

## Launch planning

**PCCU** — Peak Concurrent Users. Key input for fleet sizing. Drive Max Servers and buffer calculations from PCCU estimates.

**Bare metal** — physical server capacity within AMS. Fixed IP addresses, predictable performance, lower cost at scale. Lead time for large orders: minimum 4 weeks.

**Bear / bull / home run** — planning scenarios: bear = low expected peak, bull = expected peak, home run = viral spike. Size Max Servers for the home run case.
