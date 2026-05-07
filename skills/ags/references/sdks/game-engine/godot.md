---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[unreal.md](unreal.md)'
- '[unity.md](unity.md)'
- '[roblox.md](roblox.md)'
- '[typescript.md](../web/typescript.md)'
- '[install-sdk.md](../../../subskills/install-sdk.md)'
---

# SDK — Godot

The AGS **Godot SDK** for game clients and dedicated game servers built on Godot Engine. Wraps the same AGS REST + OpenAPI surface as the Unreal, Unity, and Roblox SDKs.

> **Versions move.** Confirm the supported Godot engine version range against `https://docs.accelbyte.io/` and the SDK's GitHub release notes.

---

## What's in scope here

- Installation paths: addon install via Godot Asset Library / GitHub release, or a manual copy of the SDK addon directory into the project.
- Module shape: services exposed per AGS module (IAM, Lobby, Matchmaking, …) — same logical layout as the other Game Engine SDKs.
- Convention: signal-based async, fitting Godot's idioms.
- Build target shape: client builds use a public IAM client; dedicated server builds use a confidential IAM client with a server secret.

`subskills/install-sdk.md` is the operational guide for installing and scaffolding into a project. This file is the conceptual "what is the Godot SDK?" reference.

## Notes

- Godot 4.x and Godot 3.x have meaningful differences in scripting and signal APIs; the SDK release notes specify which Godot major version is supported.
- The Godot SDK is the newest Game Engine SDK in the AGS family — feature parity with Unreal / Unity may lag for new AGS capabilities; check release notes for any module-specific gaps.

## Where this SDK ends

- **Non-Godot engines** — integrate via REST + OpenAPI, not the Godot SDK.
- **Extend SDKs** (Go / Python / C# / Java) — unrelated; for Extend apps. Owned by `/ags-extend`.

## Where to look in the docs

- AccelByte Godot SDK docs: `https://docs.accelbyte.io/`
- SDK source / releases: AccelByte's GitHub.
