---
description: Install the AccelByteUITools Unreal editor plugin supplied by the AccelByte
  Unreal SDK MCP server into an Unreal project. Use when the user wants to generate
  or patch UMG Widget Blueprints deterministically from JSON specs and needs the generator
  package copied from the installed Unreal SDK MCP server data directory.
last-verified: 2026-05-05
sources:
- https://github.com/AccelByte/unreal-sdk-mcp-server
see-also:
- '[generate-ui.md](../../../../../subskills/generate-ui.md)'
- '[unreal-install.md](../install.md)'
---

# Unreal UI - AccelByte UI Tools Installer

Install the reusable Unreal plugin that generates and patches Widget Blueprints through the Unreal SDK MCP bridge tools, an editor localhost bridge, a commandlet, and the bundled Python CLI. The package is supplied by the installed AccelByte Unreal SDK MCP server, not by this skill repository.

The expected package location is:

`<unreal-sdk-mcp-server>/data/AccelByteUITools`

The plugin folder is the complete reusable package: `AccelByteUITools.uplugin`, `Source/`, `Content/`, and `Tools/` travel together. The latest package sets `CanContainContent: true` and includes neutral AGS UI fallback Widget Blueprints under `Content/AGSUI`.

## Behavior Constraints

<grounding_rules>

- The AccelByte UI Tools package comes from the AccelByte Unreal SDK MCP server declared in `content/mcps/unreal-sdk.yaml`.
- Do not assume a user-specific MCP install path. Discover the MCP server checkout/cache location, then use its `data/AccelByteUITools` directory.
- For Codex, first check the preferred local clone path from `/ags init`: `.codex/mcp/unreal-sdk-mcp-server/data/AccelByteUITools`.
- For non-Codex IDEs where the server is managed by the published MCP declaration, discover the checkout/cache location through the IDE's MCP status, the configured command, or a targeted cache search. The published declaration may run `uvx --from git+https://github.com/AccelByte/unreal-sdk-mcp-server@main accelbyte-unreal-sdk-mcp-server`, but Codex should prefer the local clone path unless the user explicitly chose the `uvx` fallback.
- If the Unreal SDK MCP server or `data/AccelByteUITools` package is missing, route the user to the plugin MCP install/setup flow first (`/ags install-mcp` or the plugin `INSTALL.md`) so the `AccelByte Unreal SDK MCP Server` entry is installed and started. Do not invent a download source.
- Read the discovered package `README.md` and `Tools/README.md` before installing if present.
- Install by copying the package into an Unreal project as `Plugins/AccelByteUITools`.
- Enable the plugin in the `.uproject` `Plugins` array with `Enabled: true` and `TargetAllowList: ["Editor"]`.
- Rebuild the editor target after enabling the plugin.
- The plugin's `.uplugin` enables `CommonUI` and `EditorScriptingUtilities`; if the project disables plugin dependencies explicitly, surface those dependencies instead of removing them.
- Prefer the Unreal SDK MCP tools for post-install operation when available: `accelbyte_ui_bridge_health`, `accelbyte_ui_validate`, `accelbyte_ui_verify_backing_class`, `accelbyte_ui_generate`, and `accelbyte_ui_patch`.
- Use MCP generation `mode: "bridge"` when Unreal Editor is already running with the plugin loaded; use `mode: "auto"` to try the bridge first and fall back to the commandlet.
- Prefer the plugin's Python CLI for validation, generate, patch, dry-run, and smoke flows.
- Do not claim the install works until a validation, dry-run, smoke wrapper, or commandlet report has been run or the exact blocker is reported.

</grounding_rules>

<tool_usage_rules>

- `Glob` to find `.uproject` files and detect whether `Plugins/AccelByteUITools` already exists.
- `Read` for MCP config, discovered generator README files, `.uproject`, and existing project build files.
- `Write` / `Edit` for copying the plugin package and editing `.uproject`.
- `Bash` for copy commands, rebuild commands, CLI validation, dry-runs, and smoke checks after confirmation when they mutate project state or launch Unreal.
- Do not read other subskills except `install-sdk.md` when the Unreal engine/project setup itself is missing or unclear.

</tool_usage_rules>

<dependency_checks>

Before installing:

1. Confirm exactly one Unreal project root, or ask which `.uproject` to target.
2. Confirm the Unreal SDK MCP server is installed or available through the user's AI IDE MCP configuration. For Codex, check `.codex/mcp/unreal-sdk-mcp-server` first. For non-Codex IDEs, the published MCP declaration is `content/mcps/unreal-sdk.yaml` and may run `uvx --from git+https://github.com/AccelByte/unreal-sdk-mcp-server@main accelbyte-unreal-sdk-mcp-server`.
3. Discover the MCP server package directory and confirm `data/AccelByteUITools` exists and contains:
   - `AccelByteUITools.uplugin`
   - `Source/`
   - `Content/AGSUI`
   - `Tools/accelbyte_ui_tools.py`
4. Check whether `Plugins/AccelByteUITools` already exists.
5. Check that Unreal editor build tooling is available or already documented in the repo.

</dependency_checks>

<action_safety>

This install copies a plugin directory, edits `.uproject`, rebuilds the editor target, and may launch Unreal commandlets.

- Show the target project and destination path before copying.
- If `Plugins/AccelByteUITools` already exists, do not overwrite it silently. Compare or ask whether to replace/update it.
- Show the `.uproject` plugin-entry diff before editing.
- Ask before running a rebuild or any command that launches Unreal.
- Do not delete existing project assets or generated Widget Blueprints unless the user explicitly asks.
- Use `--dry-run` before generate/patch when the target spec or engine path is uncertain.

</action_safety>

<output_contract>

End with an "installed" block:

```
AccelByte UI Tools installed

  Project:        <path to .uproject>
  Source path:    <discovered MCP package>/data/AccelByteUITools
  Install path:   <project-root>/Plugins/AccelByteUITools
  Enabled:        yes / no
  Rebuilt:        yes / no - <reason>
  Verification:   <validate / dry-run / smoke / commandlet report result>

Next step:
  Discover and approve the project style context before generation or patching:
  Style:    python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py style-discover --project <Project.uproject>
  Approve:  python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py style-discover --project <Project.uproject> --approve
  Then use the generator or patcher from the installed plugin:
  Generate: python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py generate <spec.json> --project <Project.uproject>
  Patch:    python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py patch <patch.json> --project <Project.uproject>
```

</output_contract>

<completeness_contract>

The install is complete when:

1. The plugin package is present at `Plugins/AccelByteUITools`.
2. The `.uproject` has a single enabled `AccelByteUITools` editor plugin entry.
3. The editor target has been rebuilt, or the user has the exact rebuild command and reason it was not run.
4. At least one verification command has been attempted and its result is reported.
5. The "installed" block is printed.

</completeness_contract>

## Workflow

### Step 1: Inspect inputs

Find Unreal projects:

```powershell
Get-ChildItem -Recurse -Filter *.uproject
```

Discover the Unreal SDK MCP package. For Codex, check the project-local clone first:

```powershell
Test-Path .codex/mcp/unreal-sdk-mcp-server/data/AccelByteUITools/AccelByteUITools.uplugin
```

For non-Codex IDEs, prefer explicit configured paths if the IDE exposes them; otherwise search common MCP/cache locations for `data/AccelByteUITools`:

```powershell
Get-ChildItem $HOME -Recurse -Directory -Filter AccelByteUITools -ErrorAction SilentlyContinue |
  Where-Object {
    Test-Path (Join-Path $_.FullName "AccelByteUITools.uplugin") -and
    Test-Path (Join-Path $_.FullName "Tools/accelbyte_ui_tools.py")
  } |
  Select-Object -First 10 -ExpandProperty FullName
```

On macOS/Linux, use the same logic with `find`:

```bash
find "$HOME" -type f -path "*/data/AccelByteUITools/AccelByteUITools.uplugin" 2>/dev/null
```

If no package is found, stop and tell the user to install/start the AccelByte Unreal SDK MCP server from the plugin's MCP configuration first. For Codex, route them through `/ags init` so the local clone is created. For non-Codex IDEs, the server is declared as `AccelByte Unreal SDK MCP Server` and is sourced from `git+https://github.com/AccelByte/unreal-sdk-mcp-server@main`.

Read the discovered package `README.md` and `Tools/README.md` if present.

### Step 2: Copy plugin package

Destination:

`<project-root>\Plugins\AccelByteUITools`

Create `Plugins` if needed. Copy the complete source package, excluding transient build output only if the source contains it and the project should rebuild cleanly:

- Safe to exclude: `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`, `__pycache__/`
- Keep: `AccelByteUITools.uplugin`, `Source/`, `Content/`, `Tools/`

If the user wants an exact copy of the staged package, copy all files.

### Step 3: Enable the plugin

Edit the `.uproject` JSON. Add or update this entry in `Plugins`:

```json
{
  "Name": "AccelByteUITools",
  "Enabled": true,
  "TargetAllowList": ["Editor"]
}
```

Do not add a duplicate if the plugin entry already exists.

### Step 4: Rebuild the editor target

Use the repo's established Unreal build command. On Windows this is commonly:

```powershell
& "<UE_ROOT>\Engine\Build\BatchFiles\Build.bat" <ProjectName>Editor Win64 Development -Project="<path-to-uproject>" -WaitMutex
```

If no engine path is known, stop and report the missing engine/build path instead of guessing.

### Step 5: Verify

Prefer MCP validation after the project plugin is installed if the active IDE exposes the Unreal SDK MCP tools:

```json
{
  "tool": "accelbyte_ui_validate",
  "arguments": {
    "projectPath": "<project-root-or-uproject>",
    "specPath": "Plugins/AccelByteUITools/Tools/specs/sample_menu.json"
  }
}
```

If Unreal Editor is already running with the plugin loaded, check the bridge:

```json
{
  "tool": "accelbyte_ui_bridge_health",
  "arguments": {
    "bridgeUrl": "http://127.0.0.1:48757"
  }
}
```

For generation through the MCP, use `mode: "bridge"` when the editor is running or `mode: "auto"` to fall back to the commandlet:

```json
{
  "tool": "accelbyte_ui_generate",
  "arguments": {
    "projectPath": "<project-root-or-uproject>",
    "specPath": "Plugins/AccelByteUITools/Tools/specs/login_widget.json",
    "mode": "auto",
    "force": true
  }
}
```

For CLI-only validation, validate a sample spec:

```powershell
python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py validate Plugins/AccelByteUITools/Tools/specs/sample_menu.json
```

Before any generation or patching, run and review style discovery:

```powershell
python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py style-discover --project <Project.uproject>
```

After the user confirms the findings, approve the exact fingerprint:

```powershell
python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py style-discover --project <Project.uproject> --approve
```

For a non-launching command check:

```powershell
python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py generate Plugins/AccelByteUITools/Tools/specs/sample_menu.json --project <Project.uproject> --dry-run
```

For a quick local smoke run from the project root:

```powershell
Plugins\AccelByteUITools\Tools\run_widget_generator.bat
```

The CLI writes command reports under `Saved/AccelByteUITools/` and does not trust Unreal's process exit code by itself. Generated/temp request specs default to `Saved/Generated/Spec/`. Treat success as a report JSON with `ok: true`.

### Step 6: Print the "installed" block

Per `output_contract`.

## Usage Notes

Direct commandlet form:

```powershell
UnrealEditor-Cmd.exe MyProject.uproject -run=AccelByteUITools -Request=D:\path\to\request.json -unattended -nop4 -stdout -FullStdOutLogOutput
```

Generate requests include `mode: "generate"`, `force`, `spec`, and `report_path`.

Patch requests include `mode: "patch"`, `asset_path`, `parent_widget_name`, `widget`, and `report_path`.

The MVP supports `CanvasPanel`, `Overlay`, `VerticalBox`, `HorizontalBox`, `SizeBox`, `Border`, `Button`, `SafeZone`, `ScaleBox`, `ScrollBox`, `WidgetSwitcher`, `UniformGridPanel`, `WrapBox`, `TextBlock`, `EditableTextBox`, `Image`, `Spacer`, and arbitrary Widget Blueprint classes loaded through `class_path`. The latest package also ships a native-UMG neutral AGS UI kit under plugin content.

Generated project widgets default to Unreal virtual content paths such as `/Game/AGS/UI/Generated/WBP_AGS_LoginPanel`, which correspond to on-disk assets under `<project-root>/Content/AGS/UI/Generated/`. Generated/temp request specs default to `<project-root>/Saved/Generated/Spec/<AssetName>.json`; bundled sample specs and recipes remain under `Plugins/AccelByteUITools/Tools/specs/`. Bundled AGS kit widgets live under plugin content paths such as `/AccelByteUITools/AGSUI/Core/WBP_AGS_BaseButton`.

The bundled AGS UI kit includes reusable Core, Lists, and FeatureBlocks widgets under `Content/AGSUI`, with source specs in `Tools/specs/components/agsui` and fallback recipes in `Tools/specs/recipes`. Use the CLI recipe selector when choosing a fallback layout:

```powershell
python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py select-ags-recipe "friends list panel"
```

When restyling or replacing bundled AGS widgets, preserve stable `class_path` references and bound widget names used by the focused parent classes, such as `StateSwitcher`, `InteractiveButton`, `ButtonText`, `LabelText`, `ValueText`, `ValueInput`, `SubmitButton`, `ConfirmButton`, `CancelButton`, `RetryButton`, `IdlePanel`, `LoadingPanel`, `SuccessPanel`, `EmptyPanel`, and `ErrorPanel`.

## Error handling

- **No `.uproject` found** - ask for the Unreal project root.
- **Multiple `.uproject` files found** - ask which project to target.
- **Source package missing** - report the exact missing path; do not invent a download source.
- **Destination already exists** - ask whether to replace, merge, or leave it untouched.
- **`.uproject` malformed JSON** - stop and report the parse error; do not edit with string replacement.
- **Build command missing** - report the plugin is copied/enabled but not rebuilt; provide the expected build command shape.
- **Validation fails** - surface the MCP tool or CLI error and do not print the "installed" block.
- **Unreal launches but no report is written** - report failure; inspect crash context if the CLI emitted one.
