---
last-verified: 2026-05-26
---

# AGS AMS Capability Router

This router owns AccelByte Multiplayer Servers work inside the canonical `/ags` skill.

## Route Order

1. If the user is starting from a blank namespace or wants end-to-end setup, route to `init.md`.
2. If the user asks about IAM clients, AMS account setup, or credentials for upload/runtime, route to `account.md`.
3. If the user asks to integrate a dedicated server with watchdog ready, heartbeat, drain, or runtime configuration, route to `sdk.md`.
4. If the user asks to upload a server binary or image, route to `upload.md`.
5. If the user asks about instance types, warmed pool, min servers, buffer, regions, claim keys, or scaling, route to `fleet.md`.
6. If the user asks how sessions or matchmaking claim AMS servers, route to `session.md`.
7. If the user asks to test locally, run AMS Simulator, inspect ready, or verify claimability, route to `debug.md`.
8. If the user asks for metrics, logs, crash artifacts, or production observation, route to `observe.md`.
9. If the user asks for rollout, canary, blue/green, fallback, or DS version migration, route to `rollout.md`.
10. If the symptom is unclear, route to `doctor.md`.
11. If the user asks conceptual questions, route to `ask.md`.

## Cross-Service Gates

- If an AMS request includes multiple player-facing game integration slices, stop and route to `../../workflows/online-game-flow.md` before reading deeper capability files.
- Do not inspect fleets, server runtime config, simulator config, SDK code, or AGS state for multi-slice game integration until the first slice is confirmed.
- Dedicated-server matchmaking and session travel must coordinate with `../matchmaking/router.md`, `../../references/modules/session.md`, and `../../workflows/online-game-flow.md` for player-facing flows.
- Session claim routing must coordinate with `../matchmaking/pool.md` and `../../references/modules/session.md`.
- Player-facing game flow verification must use `../../workflows/online-game-flow.md`.

## Safety Boundary

`debug.md` diagnoses and verifies runtime behavior. It must not edit DS source code, SDK plugin code, OSS plugin code, or vendor code. If the root cause requires implementation, hand off to `sdk.md`, `session.md`, `../matchmaking/integrate.md`, or explicit project code work after user approval.
