---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[unreal.md](game-engine/unreal.md)'
- '[unity.md](game-engine/unity.md)'
- '[godot.md](game-engine/godot.md)'
- '[roblox.md](game-engine/roblox.md)'
- '[typescript.md](web/typescript.md)'
- '[webrtc-p2p.md](web/webrtc-p2p.md)'
---

# SDKs — Index

AGS has **three SDK families**. Don't conflate them — they target different runtimes and different jobs.

| Family | Members | Used for | Owned by |
|---|---|---|---|
| **Game Engine SDKs** | Unreal, Unity, Godot, Roblox (note: Godot and Roblox are not yet surfaced in the main docs portal — confirm GitHub status before recommending) | Game clients and dedicated game servers | `/ags` (this skill) |
| **TypeScript Web SDK** | TypeScript (npm) | Web apps talking to AGS — admin / live-ops dashboards, web companions, browser-based Extend App UIs (verify Extend App UI toolchain against internal docs) | `/ags` (this skill) |
| **Extend SDKs** | Go, Python, C#, Java | Extend apps talking back to AGS from inside AccelByte's infrastructure | `/ags-extend` (peer skill) |

All three families wrap the same underlying **AGS REST + OpenAPI surface**. Custom engines (anything outside Unreal / Unity / Godot / Roblox) integrate via REST directly.

---

## Picking the right SDK

| You're building… | Use |
|---|---|
| The game client itself, in Unreal | Unreal SDK |
| The game client itself, in Unity | Unity SDK |
| The game client itself, in Godot | Godot SDK |
| A Roblox experience | Roblox SDK |
| An admin / live-ops web dashboard | TypeScript Web SDK |
| A web companion app to a game already on AGS | TypeScript Web SDK |
| A browser-based Extend App UI | TypeScript Web SDK |
| A browser game that needs P2P transport | TypeScript SDK for AGS APIs plus browser WebRTC APIs for transport; read `web/webrtc-p2p.md` |
| A custom backend service running inside AGS infra (Override / Service Extension / Event Handler) | An **Extend SDK** (Go / Python / C# / Java) — owned by `/ags-extend` |
| A backend service running *outside* AGS | REST + OpenAPI directly |
| A game on a custom (non-Unreal/Unity/Godot/Roblox) engine | REST + OpenAPI directly; most studios wrap a thin C++ layer over it |

## Common confusion points

- **"Should I use the Go SDK?"** — In the AGS context, the Go SDK is an **Extend SDK**, not a Game Engine SDK. Game servers in Go would integrate via REST directly (or use the Go Extend SDK if the game server is itself an Extend app, which is unusual). For most studios the question is "use the Unreal / Unity / Godot / Roblox SDK in the game, and use an Extend SDK in any custom backend service that lives in AGS infra."
- **"Can I use the TypeScript SDK in my game?"** — Only if the game runs in a browser context. For native games on Unreal / Unity / Godot / Roblox, use the engine SDK. For browser P2P, the TypeScript SDK can help with AGS APIs, but WebRTC owns the peer transport.
- **"What about Native C++ / non-engine projects?"** — REST + OpenAPI. There isn't a separate "Native C++ Game SDK" — the four supported game engines are the only Game Engine SDKs.

## See also

- `references/sdks/game-engine/unreal.md`, `unity.md`, `godot.md`, `roblox.md`
- `references/sdks/web/typescript.md`
- `references/sdks/web/webrtc-p2p.md`
- `/ags-extend` for Extend SDK conversations
