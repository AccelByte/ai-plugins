---
name: ags-generate-ui
description: Detect the game engine and route AGS UI generation to the engine-specific
  UI workflow. Supports Unreal through AccelByteUITools and Unity through the AccelByte
  Unity MCP server; Godot UI generation is not supported yet.
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-06-17
sources:
- https://github.com/AccelByte/unreal-sdk-mcp-server
see-also:
- '[unreal.md](../references/sdks/game-engine/unreal.md)'
- '[generate-ui.md](../references/sdks/game-engine/unreal/ui/generate-ui.md)'
- '[install-ui-tools.md](../references/sdks/game-engine/unreal/ui/install-ui-tools.md)'
- '[unity-ui.md](../references/sdks/game-engine/unity/ui/generate-ui.md)'
- '[godot-ui.md](../references/sdks/game-engine/godot/ui/generate-ui.md)'
---

# Generate UI

Engine-neutral AGS UI generation gate. Detect the user's game engine, then read exactly one engine-specific UI reference before taking action.

## Engine Detection

Use `Glob` or `Bash` from the current workspace:

```powershell
Get-ChildItem -Recurse -Filter *.uproject
Get-ChildItem -Recurse -Filter ProjectSettings -Directory
Get-ChildItem -Recurse -Filter Assets -Directory
Get-ChildItem -Recurse -Filter project.godot
```

Interpretation:

- `.uproject` -> Unreal.
- `Assets/` plus `ProjectSettings/` -> Unity.
- `project.godot` -> Godot.
- Multiple matches or no match -> ask the user which engine to target: Unreal, Unity, or Godot.

Do not infer an engine from a requested UI feature alone. A "leaderboard widget" could exist in any engine.

## Routing

- **Unreal**: read `references/sdks/game-engine/unreal/ui/generate-ui.md` start to finish, then follow that workflow. If the Unreal AccelByteUITools project plugin is missing or stale, read `references/sdks/game-engine/unreal/ui/install-ui-tools.md` and complete or report that install step before generation.
- **Unity**: read `references/sdks/game-engine/unity/ui/generate-ui.md` start to finish, then follow that workflow. If the embedded `com.accelbyte.ui-tools` package is missing, read `references/sdks/game-engine/unity/mcp.md` and complete or report that install step before generation.
- **Godot**: read `references/sdks/game-engine/godot/ui/generate-ui.md`, report that Godot UI generation is not supported yet, and stop.

## Behavior Constraints

- `/ags generate-ui` is the only public AGS UI generation command.
- Do not route to removed legacy UI subskills; `/ags generate-ui` is the only public AGS UI generation command.
- Keep engine-specific implementation details inside the engine-specific UI reference docs.
- For Unreal, the AccelByte UI Tools docs remain authoritative for style discovery, editor lifecycle, spec authoring, validation, generation, and plugin install.
- For script-backed Unreal UI, use `mcp__accelbyte-unreal-sdk__unreal_live_coding_compile` when available. Ask once for user approval to run the current task's Live Coding verification and in-scope repair loop, then call `unreal_live_coding_compile` with `waitForCompletion: true` after writing C++. Continue automatically after `success` or `no_changes`; fix and retry only when diagnostics point to current task files, otherwise stop and report the blocker.
- For script-backed Unreal UI that requires a full rebuild, use `unreal_editor_status`, `unreal_close_editor`, `unreal_build_editor`, and `unreal_launch_editor` when available. Ask for explicit user approval before closing Unreal Editor, rebuilding/recompiling, force-closing the editor, or launching the editor. If `unreal_build_editor` reports compile errors, fix only the current generated UI files from this task; stop and report errors outside those files.
- Do NOT suggest `Build.bat` as the first/default path while Unreal Editor Live Coding is active.
- Do not tell the user to reparent the Blueprint or edit ListView/TileView/TreeView Entry Widget Class manually; fix the spec/generation flow instead.

## Output Contract

When routing succeeds, state the detected engine and the engine-specific reference being used.

When Godot is selected, end with:

```text
AGS UI generation is not supported for Godot yet.

  Engine:      Godot
  Status:      unsupported
  Reference:   references/sdks/game-engine/godot/ui/generate-ui.md
  Supported:   Unreal via AccelByte UI Tools; Unity via AccelByte Unity MCP
```
