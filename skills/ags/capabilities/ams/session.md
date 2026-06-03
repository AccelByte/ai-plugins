---
last-verified: 2026-05-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/using-ams-with-session/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/dedicated-server-claim-flow/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/multiplayer-servers/fleet-sizing/
see-also:
- '[overview.md](references/overview.md)'
- '[fleet.md](fleet.md)'
- '[rollout.md](rollout.md)'
---

# AMS Session Configurator

Configure AGS Session templates to claim dedicated servers from AMS. Session configuration is done in the Admin Portal (Multiplayer → Matchmaking → Session Configuration). This subskill walks the fields and claim key strategy.

## Behavior Constraints

<grounding_rules>

- Read `references/overview.md` — specifically the Claim Keys section — before advising on claim key strategy.
- Session template configuration is Admin Portal-only. This subskill produces configuration guidance, not automated commands.
- Claim key order matters: AMS tries claim keys in the order specified, finding the first fleet with a ready server in a matching region.
- When AGS matchmaking is used, client latency data typically overrides the template's Requested Regions — the region field is mostly a fallback.
- If the session template is intended to claim a local DS through `amssim` local server registration, session configuration is only a prerequisite. Local DS claimability is complete only after `/ags ams debug` verifies watchdog evidence (`amssim` logs show DS connected, ready received, and heartbeat) and a post-ready claim attempt or portal-session evidence, as applicable. If only the logs are verified, report `configured but unverified`.

</grounding_rules>

<tool_usage_rules>

- `Read` for overview.md.
- No Bash, Write, or Edit — this is guidance-only.

</tool_usage_rules>

## Workflow

### Step 1 — Prerequisites

Confirm the user has:
- At least one fleet created and active (via `/ags ams fleet`)
- Claim keys assigned to that fleet

### Step 2 — Session template type

In the Admin Portal under Multiplayer → Matchmaking → Session Configuration:

1. Create a new session template (or edit an existing one)
2. Set the **DS Type** to `DS - AMS`

This is the only field that connects the session to AMS. Without it, session creation will not allocate a DS from AMS.

### Step 3 — Claim keys

The session template has three claim key fields, tried in this priority order:

| Field | Priority | Use case |
|---|---|---|
| **Preferred claim keys** | 1st | Always try these first — e.g. a specific game mode or version |
| **Client version keys** | 2nd | Derived from the `client_version` attribute in the matchmaking ticket — enables automatic version routing without changing the session template |
| **Fallback claim keys** | 3rd | Last resort — e.g. a general-purpose fleet |

**Common patterns:**

**Single fleet (simple):**
- Preferred: `battle-royale`
- Fallback: (empty)

**Version routing via client_version attribute:**
- Preferred: (empty)
- Client version: enabled (matches `client_version` from the matchmaking ticket to a fleet's claim key)
- This lets the fleet claim key `1.2` automatically match clients that send `client_version: 1.2`

**Blue/green deployment:**
- Preferred: `v2` (new fleet)
- Fallback: `v1` (old fleet)
- When v2 fleet has ready servers, they're claimed first. If not, v1 serves.

**Canary + production:**
- Preferred: `canary` (small canary fleet)
- Fallback: `production`
- Canary gets traffic first; production absorbs overflow

### Step 4 — Requested regions

Add regions in the preferred order (e.g. `us-east-1`, `eu-west-1`). These are used when no client latency data is available — which is rare with AGS matchmaking because client latency data usually overrides this.

QoS must be enabled for each region in the Admin Portal before it's eligible for matching.

### Step 5 — Confirm and summarize

```
Session Template Configuration
  Template name:    {name}
  DS Type:          DS - AMS
  Preferred keys:   {list or "none"}
  Client version:   {enabled/disabled}
  Fallback keys:    {list or "none"}
  Regions:          {list}

Next: Create or update this template in Admin Portal ->
      Multiplayer -> Matchmaking -> Session Configuration.

      If this targets a local DS, run /ags ams debug and verify amssim logs show
      DS connected, ready received, and heartbeat before attempting the claim.
      After logs are verified but before a post-ready claim attempt or
      portal-session evidence, report the local DS flow as configured but
      unverified.

      For fleet-backed AMS, route to /ags ams observe to verify
      a session can successfully claim a ready DS.
```

## Error Handling

| Situation | Response |
|---|---|
| Sessions can't find a DS | Check: (1) fleet has ready servers; (2) claim keys in the session template match fleet's claim keys exactly (case-sensitive); (3) QoS is enabled for the requested regions; (4) fleet's Max and Buffer are both >0. See `/ags ams doctor`. |
| Ready servers exist but nothing is being claimed | Verify the claim keys match exactly. A single typo or case mismatch means no fleet is found. Check the Admin Portal Fleet Manager for the exact claim key string. |
| Local DS configured but not claimable | Do not stop at claim key/session template checks. Run `/ags ams debug`; verify `amssim` logs show DS connected, ready received, and heartbeat. Treat watchdog-only evidence as `configured but unverified` until a post-ready claim attempt or portal-session evidence confirms claimability. |
| DS sessions always go to the wrong region | Check whether client latency data is being submitted in the matchmaking ticket. If not, sessions fall back to the template's region order. |
| User wants multiple game modes on one fleet | Each game mode can share the same fleet if they use the same DS binary — they just need different session templates pointing to the same claim key. If they need separate binaries, they need separate fleets. |
