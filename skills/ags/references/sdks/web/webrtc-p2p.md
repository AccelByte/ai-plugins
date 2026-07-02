---
last-verified: 2026-07-01
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/configure-turn-server-autoscale/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/session/
- https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API
see-also:
- '[turn-stun-p2p.md](../../modules/turn-stun-p2p.md)'
- '[session.md](../../modules/session.md)'
- '[lobby.md](../../modules/lobby.md)'
- '[typescript.md](typescript.md)'
---

# Web - WebRTC P2P With AGS TURN/STUN

Use this reference when a browser game needs peer-to-peer networking with AGS and the project cannot use engine-specific P2P libraries such as AccelByte Network Utilities for Unreal or the Unity P2P networking library.

AGS supports the STUN/TURN side of P2P connectivity, but a browser game still needs a WebRTC transport. Treat AGS as the backend for auth, Session, Matchmaking, and TURN/STUN support. Treat the browser as the owner of `RTCPeerConnection`, ICE candidate handling, and any `RTCDataChannel` used for gameplay messages.

## Recommended Architecture

```text
AGS IAM login
 -> connect to Lobby or another signaling channel
 -> create/join P2P Session or receive Matchmaking result
 -> determine host/peer membership
 -> exchange WebRTC offer/answer/ICE candidates
 -> create RTCPeerConnection with AGS STUN/TURN ICE servers
 -> open RTCDataChannel or media/data streams
 -> verify direct or TURN-relayed connectivity
```

## What AGS Provides

- Player identity and access tokens through IAM.
- Session or Matchmaking context that decides which players should connect.
- P2P support based on ICE, STUN, and TURN concepts.
- TURN relay fallback when direct peer connectivity is not possible.

## What The Web Client Must Provide

- WebRTC peer connection lifecycle with `RTCPeerConnection`.
- Data transport, usually `RTCDataChannel` for browser-game state or input messages.
- Signaling message exchange for SDP offers, SDP answers, and ICE candidates.
- Reconnect, timeout, relay-fallback visibility, and error handling.

## Signaling Options

WebRTC signaling is not optional. Peers must exchange offer, answer, and ICE candidate data somehow.

Use the project's AGS integration and security model to choose one:

- **Lobby signaling** - useful when both players are online in an AGS Lobby-connected flow and the integration has a safe way to send peer messages.
- **Session-backed signaling** - useful when the game already creates or joins a P2P game session and can attach or retrieve connection metadata safely.
- **Custom backend or Extend service** - useful when signaling needs validation, persistence, moderation, or protection from exposing unsafe peer-controlled data.

Do not assume the TypeScript SDK alone creates WebRTC connections. The TypeScript SDK can call AGS APIs; the browser WebRTC APIs create the peer transport.

## ICE Server Configuration

The browser needs ICE server configuration in the shape expected by `RTCPeerConnection`, for example:

```js
const peer = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:..." },
    {
      urls: "turn:...",
      username: "...",
      credential: "..."
    }
  ]
});
```

The exact AGS endpoint or SDK call used to obtain TURN/STUN server details and credentials must be verified against the current AGS environment and SDK/API surface. Do not invent hardcoded TURN URLs, usernames, credentials, or token formats.

## Implementation Shape

1. Authenticate the player with AGS IAM.
2. Join the online coordination path: Lobby, Session, Matchmaking, or a project backend.
3. Create or join a Session V2 game session with server type `P2P`, or consume a matchmaking result that points to one.
4. Fetch or receive the ICE server configuration and TURN credentials through the approved AGS path.
5. Create an `RTCPeerConnection` with those ICE servers.
6. Open an `RTCDataChannel` if the game needs browser-to-browser data messages.
7. Exchange SDP offer/answer and ICE candidates through the chosen signaling path.
8. Wait for `connectionState` / `iceConnectionState` and data channel open events.
9. Report whether the selected candidate pair is direct or relayed when the browser exposes enough stats to determine it.

## Verification

For service evidence:

- Player is authenticated.
- Session or Matchmaking produced the expected P2P group.
- The client obtained ICE server configuration or TURN credentials through a verified AGS path.
- Signaling messages are exchanged between the matched peers.

For game-flow evidence:

- `RTCPeerConnection` reaches a connected state.
- `RTCDataChannel` opens if used.
- A test message or game input travels between peers.
- A restrictive-network test or forced-relay test confirms TURN relay behavior when direct ICE is unavailable.

## Common Mistakes

- **Looking for `libjuice` in the browser** - browser games use WebRTC APIs instead.
- **Assuming AGS Session automatically performs WebRTC signaling for custom web code** - verify the available API/SDK path and implement signaling if the platform does not abstract it.
- **Hardcoding TURN credentials** - TURN credentials are sensitive and may expire. Fetch them through the approved AGS flow.
- **Skipping relay testing** - a LAN or permissive NAT test can pass without proving TURN works.
- **Using TURN for authoritative gameplay** - TURN relays traffic. It does not make a P2P game server-authoritative.
