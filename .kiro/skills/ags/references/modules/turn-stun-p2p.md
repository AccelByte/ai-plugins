---
last-verified: 2026-07-01
sources:
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/configure-turn-server-autoscale/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/configure-P2P-matchmaking-oss/
- https://docs.accelbyte.io/gaming-services/knowledge-base/glossary/
see-also:
- '[session.md](session.md)'
- '[matchmaking.md](matchmaking.md)'
- '[lobby.md](lobby.md)'
- '[webrtc-p2p.md](../sdks/web/webrtc-p2p.md)'
- '[unreal-p2p.md](../sdks/game-engine/unreal-p2p.md)'
---

# Module - TURN, STUN, And P2P Connectivity

Use this reference whenever a request mentions AGS P2P, peer-to-peer networking, STUN, TURN, ICE, NAT traversal, relay servers, WebRTC, `libjuice`, or "connect players directly."

AGS P2P is based on WebRTC-style connectivity concepts: ICE, STUN, and TURN. The AGS P2P docs describe AGS as handling handshake negotiation, secure address exchange through STUN, NAT traversal, and fallback to TURN relay when a direct peer connection is not possible.

## What STUN Does

STUN helps a client discover the public-facing address and port that other peers may be able to use to reach it. This is part of NAT traversal. STUN does not relay gameplay traffic by itself.

If STUN succeeds and the NAT/firewall path allows it, peers can communicate directly.

## What TURN Does

TURN is the relay fallback. When peers cannot establish a direct path because of NAT, carrier-grade NAT, firewall policy, or other network restrictions, traffic can be relayed through a TURN server.

In AGS P2P, TURN is not a separate gameplay server model like AMS. TURN exists to keep peer connectivity working when direct peer-to-peer traffic fails.

## How AGS Fits

AGS can provide the P2P backend pieces around NAT traversal and TURN fallback, but the game still needs a client-side networking implementation. Session and Matchmaking decide who should be connected. Lobby, Session, or a custom backend path may carry signaling or coordination depending on the integration. STUN/TURN/ICE establish the network path between the peers.

For AGS Session, P2P is represented as a game session with server type `P2P`. Do not assume AMS allocation for P2P sessions. AMS is for dedicated-server outcomes.

## Platform Responsibilities

- **Unreal** - use the Unreal OSS P2P path and AccelByte Network Utilities. Read `../sdks/game-engine/unreal-p2p.md`.
- **Unity** - use the AGS P2P networking library path documented for Unity, then verify the exact package and API against the current Unity SDK docs.
- **Browser / web game** - use native WebRTC APIs. Read `../sdks/web/webrtc-p2p.md`.
- **Custom engine without AGS P2P library support** - identify what transport library will consume ICE/STUN/TURN details. Do not assume Unreal, Unity, or `libjuice` APIs exist.

## WebRTC, ICE, STUN, And TURN Vocabulary

- **WebRTC** is the browser-native real-time networking stack commonly used for peer-to-peer data and media.
- **ICE** is the process that gathers candidate network paths and chooses a working one.
- **STUN** helps discover direct connection candidates.
- **TURN** relays traffic when no direct candidate pair works.

For browser games, the relevant APIs are usually `RTCPeerConnection`, `RTCDataChannel`, `RTCIceCandidate`, and `RTCSessionDescription`.

## Design Checklist

Before implementing an AGS P2P flow, capture:

- How players are grouped: party, Session, Matchmaking, custom invite, or another flow.
- Which session template uses server type `P2P`.
- Which peer is host, or whether peers are symmetric.
- How signaling data is exchanged between peers.
- How the client obtains ICE server configuration or TURN credentials.
- What happens when direct ICE fails and TURN relay is selected.
- What evidence proves the connection path worked: direct candidate, relay candidate, data channel open, in-game state sync, or engine-specific travel success.

## Common Mistakes

- **Assuming P2P means no backend** - AGS still coordinates auth, sessions, matchmaking, and P2P negotiation support.
- **Assuming TURN is a dedicated server** - TURN relays packets for peer connectivity; it does not run the gameplay simulation.
- **Assuming Unreal/Unity guidance applies to web games** - browser games use WebRTC APIs, not AccelByte Network Utilities or Unity P2P packages.
- **Skipping signaling** - WebRTC peers still need a way to exchange offers, answers, and ICE candidates unless the platform integration abstracts that away.
- **Treating STUN as enough** - STUN can fail in restrictive networks. TURN fallback is the reason the relay path exists.

## Where to look in the docs

- AGS Peer-to-Peer overview: `https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/`
- TURN server autoscaling: `https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/configure-turn-server-autoscale/`
- P2P matchmaking with TURN Server QoS: `https://docs.accelbyte.io/gaming-services/modules/multiplayer/peer-to-peer/configure-P2P-matchmaking-oss/`
