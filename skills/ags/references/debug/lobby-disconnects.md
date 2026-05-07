---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[lobby.md](../modules/lobby.md)'
- '[debug.md](../../subskills/debug.md)'
- '[doctor.md](../../subskills/doctor.md)'
---

# Debug — Lobby Disconnects

Common Lobby disconnect symptoms and their usual root causes. Used by `subskills/debug.md` and `subskills/doctor.md` when players are dropping out of party / lobby unexpectedly.

---

## Symptom: WebSocket disconnects after ~N minutes consistently

**Likely cause:** server-side or client-side idle timeout.

Check:

1. Lobby ping/heartbeat — most SDKs ping the WebSocket on a fixed interval. Confirm the SDK is sending heartbeats and not blocked on the main thread.
2. NAT / firewall idle timeouts — corporate networks and some mobile carriers reap idle TCP connections aggressively. Increase heartbeat frequency or accept brief reconnects.
3. The token's `exp` claim — when the access token expires, some Lobby implementations drop the connection. Refresh proactively.

## Symptom: Disconnects only on poor-network clients

**Likely cause:** packet loss interacting with WebSocket keep-alive.

Check:

1. Player's network conditions — mobile / hotel WiFi / congested home networks.
2. SDK retry logic — does it auto-reconnect with backoff?

Fix: ensure the SDK's reconnect logic is enabled, log the reconnect events, and surface a UX state ("Reconnecting…") to the player rather than appearing frozen.

## Symptom: Disconnects after token refresh

**Likely cause:** Lobby connection isn't re-authenticated after token refresh.

Check:

1. Does the Lobby connection re-bind the new access token? Some SDK versions do this automatically, others require an explicit call.
2. Test: trigger a token refresh manually mid-Lobby-session and watch for disconnect.

Fix: ensure post-refresh, the Lobby connection's auth header is updated. SDK version may have a known fix.

## Symptom: Disconnects when the player goes to background (mobile)

**Likely cause:** OS-level WebSocket suspension on mobile background.

Check:

1. Expected behavior on iOS / Android — the OS suspends background sockets.
2. SDK reconnect on foreground.

Fix: implement clean foreground/background lifecycle hooks. Don't fight the OS — disconnect cleanly on background, reconnect on foreground.

## Symptom: Server-side reset / kicked

**Likely cause:** AGS-side incident, ban, or namespace-level disruption.

Check:

1. Player's account status (banned / suspended).
2. Namespace-level events / maintenance windows.
3. AccelByte status page.

Fix: depends on cause. If the player is banned, that's a Trust & Safety conversation. If the namespace is in maintenance, communicate via in-game UI; reconnect after maintenance ends.

## Symptom: Random disconnects, no pattern

**Likely cause:** something in the studio's stack between the game client and AGS — load balancer, CDN, custom proxy.

Check:

1. Are players going through any studio-side proxy / CDN?
2. Logs on the proxy showing WebSocket reset events.

Fix: usually proxy configuration. AGS WebSocket connections want stable end-to-end paths.

## When to escalate

- Multiple players reporting disconnects within a short window → check AccelByte status and namespace events.
- Disconnects only in production after a recent SDK update → SDK version regression; pin to last-known-good and open a support ticket.
- Performance issues at scale (thousands of disconnects/min) → AccelByte support; bring traces, timestamps, and namespace identifier.
