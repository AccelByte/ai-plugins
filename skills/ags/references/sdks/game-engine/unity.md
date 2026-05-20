---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
- https://github.com/AccelByte/accelbyte-unity-sdk
- https://github.com/AccelByte/accelbyte-unity-networking
see-also:
- '[unreal.md](unreal.md)'
- '[godot.md](godot.md)'
- '[roblox.md](roblox.md)'
- '[typescript.md](../web/typescript.md)'
- '[install-sdk.md](../../../subskills/install-sdk.md)'
- '[install-unity-sdk.md](../../../subskills/install-unity-sdk.md)'
---

# SDK — Unity

The AGS **Unity SDK** for game clients and dedicated game servers. Supports Unity 2020, 2021, 2022, and Unity 6 (check release notes for current version matrix). Wraps the AGS REST + OpenAPI surface; same module shape as the Unreal, Godot, and Roblox SDKs.

> **Versions move.** Treat the LTS range as a starting point; check `https://docs.accelbyte.io/` and the SDK's GitHub release notes for the current Unity-version matrix.

---

## What's in scope here

- Installation paths: Unity Package Manager (UPM) via official Git URL by default; manual package import only when a team has an established offline package workflow.
- Default package set:
  - `com.accelbyte.UnitySDK` from `https://github.com/AccelByte/accelbyte-unity-sdk.git`
  - `com.accelbyte.unitynetworking` from `https://github.com/AccelByte/accelbyte-unity-networking.git` when the project needs peer-to-peer (P2P) multiplayer using WebRTC; not required for dedicated-server architectures.
- Module structure: the Unity SDK package exposes services per AGS module. The networking package builds on the Unity SDK package.
- Convention: callback-based async with optional `async/await` wrappers depending on SDK version. (Verify against SDK release notes.)
- Build target shape: client builds use a public IAM client; dedicated server builds use a confidential IAM client with a server secret.

`subskills/install-unity-sdk.md` is the operational guide for actually installing and scaffolding into a Unity project. This file is the conceptual "what is the Unity SDK?" reference.

## Install workflow

Default to pinned UPM Git URLs in `Packages/manifest.json`:

```json
{
  "dependencies": {
    "com.accelbyte.UnitySDK": "https://github.com/AccelByte/accelbyte-unity-sdk.git#<tag>",
    "com.accelbyte.unitynetworking": "https://github.com/AccelByte/accelbyte-unity-networking.git#<tag>"
  }
}
```

Only add `com.accelbyte.unitynetworking` when the project needs it or the user requests the full Unity networking setup. Pin tags, branches, or commits compatible with the project's Unity version. Do not copy package directories from arbitrary local checkouts.

## Common gotchas

- **iOS / Android build settings** — iOS and Android AGS SDK support lives in separate repositories (see AccelByte GitHub for iOS and Android Google packages); platform-specific OAuth flows also require their respective platform SDKs.
- **AOT-only platforms** (iOS, consoles) — Reflection-heavy patterns can hit IL2CPP edge cases; favor the SDK's typed call paths.
- **Domain reload between Editor sessions** — re-initialization of the SDK after a domain reload is a common source of "first call fails, second call succeeds" bugs.
- **Unpinned UPM URLs** — branch-only package URLs can drift. Prefer tags or commits for reproducible game builds.
- **Networking package assumption** — `accelbyte-unity-networking` is not always required for basic IAM/profile calls. Add it when the project needs the networking layer.

## Where this SDK ends

- **Custom (non-Unity) engine** — integrate via REST + OpenAPI, not the Unity SDK.
- **Extend SDKs** (Go / Python / C# / Java) — unrelated to the Unity SDK; for Extend apps. Owned by `/ags-extend`.

## Where to look in the docs

- AccelByte Unity SDK docs: `https://docs.accelbyte.io/`
- Unity SDK source / releases: `https://github.com/AccelByte/accelbyte-unity-sdk`
- Unity Networking source / releases: `https://github.com/AccelByte/accelbyte-unity-networking`
