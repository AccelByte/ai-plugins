---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[_index.md](../sdks/_index.md)'
- '[unreal.md](../sdks/game-engine/unreal.md)'
- '[unity.md](../sdks/game-engine/unity.md)'
- '[godot.md](../sdks/game-engine/godot.md)'
- '[roblox.md](../sdks/game-engine/roblox.md)'
- '[typescript.md](../sdks/web/typescript.md)'
---

# Catalog — SDKs (Quick Lookup)

Three SDK families, what they target, where they live. Don't conflate them.

---

| Family | Member | Targets | Owned by | Full reference |
|---|---|---|---|---|
| **Game Engine** | Unreal | Unreal Engine 4.27 – 5.x | `/ags` | `references/sdks/game-engine/unreal.md` |
| **Game Engine** | Unity | Current Unity LTS | `/ags` | `references/sdks/game-engine/unity.md` |
| **Game Engine** | Godot | Godot Engine | `/ags` | `references/sdks/game-engine/godot.md` |
| **Game Engine** | Roblox | Roblox runtime | `/ags` | `references/sdks/game-engine/roblox.md` |
| **TypeScript Web** | TypeScript | Browser / Node web apps | `/ags` | `references/sdks/web/typescript.md` |
| **Extend** | Go | Extend apps | `/ags-extend` | (peer skill) |
| **Extend** | Python | Extend apps | `/ags-extend` | (peer skill) |
| **Extend** | C# | Extend apps | `/ags-extend` | (peer skill) |
| **Extend** | Java | Extend apps | `/ags-extend` | (peer skill) |

For the "which one do I need?" decision, see `references/sdks/_index.md`.

## Versions move

This catalog lists the SDK *families*, not specific versions. Pin a version against your engine version (Unreal 5.4 ↔ AGS Unreal SDK X.Y.Z) by checking each SDK's GitHub release notes. Don't quote in-repo version numbers as authoritative.

## When the user says "the AGS SDK"

Ambiguous. Disambiguate by context:

- **Game-side context** (Unreal, Unity, Godot, Roblox) → engine SDK.
- **Web app / admin tool context** → TypeScript Web SDK.
- **Extend / backend service context** → Extend SDK (and the conversation belongs in `/ags-extend`).

## Cross-reference

- For Extend SDK details (Go / Python / C# / Java install, idioms, versions), invoke `/ags-extend ask` or read `content/skills/ags-extend/`.
