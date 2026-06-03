---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-watchdog-protocol/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/fleet-sizing/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/ams-launch-preparation/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/integrate-dedicated-servers-with-the-sdk/#listening-to-the-drain-signal
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/create-ams-fleet/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/using-build-configs/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/upload-a-dedicated-server-build/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/download-cli-tools-from-admin-portal/
see-also:
- '[glossary.md](glossary.md)'
- '[faq.md](faq.md)'
---

# AMS Overview

AccelByte Multiplayer Servers (AMS) is a dynamic dedicated game-server manager. It runs your dedicated server (DS) binary across cloud regions, scales fleet size automatically based on demand, integrates natively with AGS Matchmaking and Session Management, and eliminates the operational overhead of running your own fleet.

AMS is architecturally part of AGS — not a separate product. It gets its own skill because the DS lifecycle (binary upload, fleet configuration, watchdog integration, regional rollout) is deep enough to warrant one.

---

## Architecture

```
game client ──→ AGS Matchmaking ──→ match confirmed ──→ AMS allocates server
                                                               │
                                                               ▼
                                                    AGS Session ←→ allocated DS
                                                               │
                                                               ▼
                                                         game client connects
```

**Key components:**

| Component | Role |
|---|---|
| **Fleet Commander** | Deployed per environment; makes VM requests on behalf of namespaces |
| **AMS Core** | Multi-regional orchestrator; processes allocation requests, assigns VMs |
| **Watchdog** | Per-DS lightweight process; manages health monitoring, heartbeats, graceful shutdown |
| **QoS Servers** | Verify regional network performance; players measure latency to pick best region |

---

## Dedicated Server Lifecycle

A DS passes through five states:

| State | Meaning |
|---|---|
| **Creating** | Server launched; loading resources; watchdog not yet connected |
| **Ready** | DS sent the ready signal; available to be claimed by a session |
| **In Session** | DS has been claimed; serving active players |
| **Drain** | AMS signaled the DS to finish and exit; no new sessions accepted |
| **Unresponsive** | DS missed the watchdog heartbeat deadline; AMS will replace it |

The DS is responsible for:
1. Sending the **ready message** (transitions Creating → Ready)
2. Sending a **heartbeat every 15 seconds** (stays Ready / In Session; prevents Unresponsive)
3. Handling the **drain signal** (stop accepting new sessions; exit cleanly when the current session ends)

---

## Watchdog Protocol

The watchdog is a local process on each VM. The DS communicates with it over WebSocket at `ws://localhost:5555/watchdog` using the `ams-dsid` HTTP header (value: `DS_ID` env var).

**DS → Watchdog messages:**

```json
{ "ready": { "dsid": "<ds-id>" } }
{ "heartbeat": {} }
{ "claim": { "sessionId": "<session-id>" } }
{ "reset_session_timeout": { "new_timeout": <nanoseconds> } }
```

**Watchdog → DS messages:**

```json
{ "drain": {} }
```

Rules:
- Heartbeat interval: every 15 seconds
- Ready message: sent once when the server finishes loading
- Drain: gracefully handled — if In Session, finish the session then exit; if Ready (idle), exit immediately
- Self-claim: the DS can claim itself (useful when the DS creates the game session, not AGS matchmaking)

The AGS Game SDK wraps this protocol. Use the SDK instead of raw WebSocket unless your engine doesn't have SDK support.

---

## Fleets

A fleet is a named pool of AMS-managed VMs running your DS binary.

**Fleet types:**

| Type | Use case | Key behavior |
|---|---|---|
| **Production** | Live game | Maintains ready-server buffers; immutable command-line args; dedicated instance types |
| **Development** | Testing during dev | Multiple DS versions on same VMs; supports hibernation; late-binding config via build configs |

**Scaling parameters (per region):**

| Parameter | What it controls |
|---|---|
| **Max Servers** | Hard ceiling; cost safeguard. Minimum: `Peak CCU / players per DS` |
| **Min Servers** | Always-running baseline. `0` for most; higher for launch events |
| **Buffer Servers** | "Ready" reserve. Formula: `demand change per minute × max DS startup duration (up to ~10 min)`. Typical: 10–20% of peak claimed DS count |

Setting both buffer and min to 0 prevents automatic DS creation. Claim requests will always fail.

**Instance types:**

| Category | Code | Best for |
|---|---|---|
| Memory-Optimized | MEX | Memory-heavy DS workloads |
| Compute-Optimized | CPX | CPU-heavy DS workloads |
| General-Purpose | GLX | Balanced CPU/memory |

Recommendation: prefer larger instance types with more DS per VM over many small VMs — cost-efficiency is better.

---

## Claim Keys

Claim keys are string identifiers that link session templates to fleets. When AGS Session requests a DS, it passes claim keys in priority order; AMS searches matching fleets for a ready server.

Common patterns:
- **Version routing** — fleet gets claim key `1.2`; game client submits `client_version: 1.2` in matchmaking → automatically routes to the right fleet per DS version
- **Blue/green** — two fleets (`v1`, `v2`) with the same game mode; session template specifies both, in preferred order
- **Canary** — canary fleet with its own claim key listed first; production fleet as fallback

---

## Build Configurations (Development)

Build configs are dev-fleet-only constructs that let you test a specific DS image without a dedicated fleet. When a session claims from a dev fleet with a matching build config:
- If a DS started with that build config exists → it gets claimed
- If not → AMS starts one on demand (first request typically fails unless the DS starts within 8 seconds; AGS Session retries after 60 seconds)

Naming convention: match the build config name to your game client's `client_version` attribute (e.g. `240506.2.main`).

---

## AMS CLI

The AMS CLI (`ams`) is used to upload DS binaries. Downloaded from the Admin Portal (AMS → Download Resource).

**Upload command:**

```
ams upload \
  -H <host-url-without-https>  \
  -c <iam_client_id>           \
  -s <iam_client_secret>       \
  -n <image_name>              \
  -p <path_to_server_folder>   \
  -e <relative_exec_path>
```

See `references/cli-commands.md` for full flag reference and IAM permission requirements.

**AMS Simulator** (`amssim`) is used for local testing. Run `amssim run` to emulate watchdog behavior without connecting to cloud infrastructure.

---

## Limits to Know Before Designing

| Limit | Value | Impact |
|---|---|---|
| VM provisioning time | Up to 10 minutes | First DS after cold-start takes time; buffer covers this |
| DS startup timeout | Configurable per fleet | DS must send ready before timeout or AMS replaces it |
| Artifacts retention | 30 days | Logs/core dumps deleted after 30 days or manually |
| Log sampling | Configurable | Disabled by default — enable before launch |
| Bare-metal lead time | 4+ weeks | Large capacity requests need advance notice |
| Local DS registrations | 10 per namespace | AMS Simulator limit |

---

## How AMS Fits the Rest of AGS

- **Matchmaking** → creates sessions → sessions claim DS from AMS. Matchmaking is the demand side; AMS is the supply side.
- **Session Management** → tracks which DS each session is using; feeds DS IP/port back to game clients.
- **Extend** → can automate fleet creation and DS uploads via CI/CD (Service Extension or Automation scripts).
- **AGS SDK** → wraps the watchdog protocol for Unreal and Unity; provides `SendServerReady()` / `SendReadyMessage()`.
