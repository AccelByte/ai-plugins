---
last-verified: 2026-10-07
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/configure-turn-server-autoscale/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/session/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/session/lobby/lobby-websocket/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/configure-P2P/
- https://www.npmjs.com/package/@accelbyte/sdk-lobby
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/master/Source/AccelByteUe4Sdk/Private/Api/AccelByteLobbyApi.cpp
- https://github.com/AccelByte/accelbyte-unreal-network-utilities/blob/master/Source/AccelByteNetworkUtilities/Private/Networking/AccelByteSignaling.cpp
- https://github.com/AccelByte/accelbyte-unity-sdk/blob/master/Runtime/Models/LobbyModels.cs
- https://github.com/AccelByte/accelbyte-unity-networking/blob/main/Runtime/Implementation/AccelByteLobbySignaling.cs
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
 -> connect to the Lobby WebSocket (AGS's signaling channel)
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

## Signaling Through Lobby

WebRTC signaling is not optional. Peers must exchange offer, answer, and ICE candidate data somehow, and **AGS's signaling server is implemented in Lobby**: the AGS P2P docs say the P2P handshake is performed through it, and AccelByte's own P2P libraries signal through it. A browser game uses the same message, so it does not need its own signaling server.

The message is `signalingP2PNotif` on the Lobby WebSocket. It is sent and received with the same type, in Lobby's line-based `key: value` format:

```text
type: signalingP2PNotif
id: <client-generated message id>
destinationId: <recipient's AGS user ID>
message: <encoded signaling payload>
```

- **`destinationId` names the other peer in both directions.** It does not keep one value end to end: on a message you **send**, it is the recipient's user ID; on a message you **receive**, it is the *sender's* user ID. Lobby delivers the message to the user you named, with `destinationId` set to who sent it — so a received `destinationId` is the ID to reply to.
- **Addressing.** On send, set `destinationId` to the other player's AGS user ID. Take it from the P2P game session's members or the matchmaking result — the session leader is the P2P host, and the other members target it.
- **Receiving.** The recipient gets a `signalingP2PNotif` carrying `destinationId` (the sender) and `message`. This is stated in AccelByte's Unity SDK, whose `SignalingP2P` model documents `destinationId` as the targeted user ID when sending and the sender's user ID when receiving. AccelByte's Unreal and Unity P2P libraries reply to the received `destinationId`. The public Lobby WebSocket page does not spell this out, so confirm it once with two clients (see Verification).
- **Encode the payload.** Lobby messages are newline-delimited, and SDP contains line breaks. Serialize the offer, answer, or candidate (for example as JSON) and base64-encode it before it goes into `message` — AccelByte's own P2P library does exactly this — then decode on receipt. An unencoded SDP breaks the message at its first line break.
- **TypeScript SDK.** `@accelbyte/sdk-lobby`'s WebSocket helper parses an incoming `signalingP2PNotif` in `onMessage`, but has no dedicated sender for it. Send it with the helper's `sendRaw` and the text format above. Do not invent a `sendSignaling…` method; check the installed version's typings before assuming one exists.

```ts
// Sketch — verify names against the installed @accelbyte/sdk-lobby version.
const encode = (signal: object) => btoa(JSON.stringify(signal));
const decode = (message: string) => JSON.parse(atob(message));

function sendSignal(peerUserId: string, signal: object) {
  lobbyWs.sendRaw(
    `type: signalingP2PNotif\nid: ${crypto.randomUUID()}\n` +
    `destinationId: ${peerUserId}\nmessage: ${encode(signal)}`
  );
}

lobbyWs.onMessage((msg) => {
  if (typeof msg !== "string" && msg.type === "signalingP2PNotif") {
    handleSignal(msg.destinationId, decode(msg.message)); // on receipt, destinationId is the sender's user ID
  }
});
```

Do **not** use game session storage, session attributes, or polling the session as the signaling channel. Session tells the peers *who* to connect to; it does not deliver messages to the other peer, and a storage write the other side is not reading never arrives.

Use a custom backend or Extend service for signaling only when the game needs something Lobby signaling does not give it, such as server-side validation or persistence of signaling data.

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
2. Connect the Lobby WebSocket — it carries signaling.
3. Create or join a Session V2 game session with server type `P2P`, or consume a matchmaking result that points to one.
4. Fetch or receive the ICE server configuration and TURN credentials through the approved AGS path.
5. Create an `RTCPeerConnection` with those ICE servers.
6. Open an `RTCDataChannel` if the game needs browser-to-browser data messages.
7. Exchange SDP offer/answer and ICE candidates as base64-encoded `signalingP2PNotif` messages addressed to the peer's user ID.
8. Wait for `connectionState` / `iceConnectionState` and data channel open events.
9. Report whether the selected candidate pair is direct or relayed when the browser exposes enough stats to determine it.

## Verification

For service evidence:

- Player is authenticated.
- Session or Matchmaking produced the expected P2P group.
- The client obtained ICE server configuration or TURN credentials through a verified AGS path.
- `signalingP2PNotif` messages reach the other matched peer and decode to the offer, answer, and candidates that were sent.
- On a received `signalingP2PNotif`, `destinationId` is the *sending* peer's user ID, not the receiver's own — check it with two signed-in clients before relying on it for reply addressing.

For game-flow evidence:

- `RTCPeerConnection` reaches a connected state.
- `RTCDataChannel` opens if used.
- A test message or game input travels between peers.
- A restrictive-network test or forced-relay test confirms TURN relay behavior when direct ICE is unavailable.

## Common Mistakes

- **Looking for `libjuice` in the browser** - browser games use WebRTC APIs instead.
- **Assuming AGS Session automatically performs WebRTC signaling for custom web code** - Session decides who connects; the signaling messages go over Lobby's `signalingP2PNotif`.
- **Signaling through session storage** - a storage write is not delivered to the other peer, so the offer never arrives and the handshake times out.
- **Putting raw SDP in a Lobby message** - Lobby messages are newline-delimited; base64-encode the payload.
- **Hardcoding TURN credentials** - TURN credentials are sensitive and may expire. Fetch them through the approved AGS flow.
- **Skipping relay testing** - a LAN or permissive NAT test can pass without proving TURN works.
- **Using TURN for authoritative gameplay** - TURN relays traffic. It does not make a P2P game server-authoritative.
