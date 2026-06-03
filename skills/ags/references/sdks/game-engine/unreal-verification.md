---
last-verified: 2026-05-18
sources:
- https://docs.accelbyte.io/gaming-services/getting-started/setup-game-sdk/unreal-sdk/
- https://docs.unrealengine.com/
see-also:
- '[unreal.md](unreal.md)'
- '[unreal-install.md](unreal/install.md)'
---

# Unreal Verification

Use this reference only when the detected project is Unreal and the task edits or verifies Unreal C++.

## Live Coding First

When the AccelByte Unreal SDK MCP tools are available:

1. Check Unreal Editor state with the MCP health/status tool first.
2. If Unreal Editor is running and healthy, ask once for user approval to run the current task's Live Coding verification and in-scope repair loop, then call `unreal_live_coding_compile` with `waitForCompletion: true`.
3. If Unreal Editor is not running, unavailable, or unhealthy, use the project's normal Unreal build command when verification is required.
4. Do not claim compile success unless live coding compile or the normal Unreal build succeeds.

When Live Coding returns `success` or `no_changes`, continue automatically. If it returns actionable compile diagnostics for files owned by the current task, fix those files and retry under the existing approval. Stop and report diagnostics outside the current task, cancellation, unavailable Live Coding, or an unresolved timeout.

## When Not To Use It

- Do not use live coding compile for non-Unreal projects.
- Do not use it for documentation-only changes.
- Do not use it for AGS backend-only JSON/config edits unless Unreal C++ was also changed.
- Do not start Unreal Editor only to make live coding available; fall back to the normal build path or report that verification was not run.

## Blueprint Editor Bridge Work

This live-coding restriction does not apply to Blueprint asset inspection or AccelByteUITools work. If a task needs existing Widget Blueprint hierarchy/style inspection, `accelbyte_ui_generate`, or `accelbyte_ui_patch`, Unreal Editor must be open with the editor bridge healthy. If the editor is not running, open or ask the user to open the project for that Blueprint phase, then close it before a normal C++ build when Live Coding is not being used.

## Reporting

In the final verification summary, say which path was used:

- `unreal_live_coding_compile` while the editor was running.
- Normal Unreal build command because the editor was not running.
- Not run, with the reason.
