---
name: ags-install-widget-blueprint-generator
description: Install the WidgetBlueprintGenerator Unreal editor plugin supplied by
  the AccelByte Unreal SDK MCP server into an Unreal project. Use when the user wants
  to generate or patch UMG Widget Blueprints deterministically from JSON specs and
  needs the generator package copied from the installed Unreal SDK MCP server data
  directory.
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-05-09
sources:
- https://github.com/AccelByte/unreal-sdk-mcp-server
see-also:
- '[install-unreal-sdk.md](install-unreal-sdk.md)'
---

# Widget Blueprint Generator Installer

Install the reusable editor-only Unreal plugin that generates and patches Widget Blueprints through a commandlet and Python CLI. The package is supplied by the installed AccelByte Unreal SDK MCP server, not by this skill repository.

The expected package location is:

`<unreal-sdk-mcp-server>/data/WidgetBlueprintGenerator`

The plugin folder is the complete reusable package: `WidgetBlueprintGenerator.uplugin`, `Source/`, and `Tools/` travel together.

## Behavior Constraints

<grounding_rules>

- The Widget Blueprint Generator package comes from the AccelByte Unreal SDK MCP server declared in `content/mcps/unreal-sdk.yaml`.
- Do not assume a user-specific MCP install path. Discover the MCP server checkout/cache location, then use its `data/WidgetBlueprintGenerator` directory.
- For Codex, first check the preferred local clone path from `/ags init`: `.codex/mcp/unreal-sdk-mcp-server/data/WidgetBlueprintGenerator`. (This path is an internal convention established by `/ags init` — not documented in the upstream repo. The convention is valid only when the user cloned via `/ags init` or followed the same `.codex/mcp/` layout manually.)
- For non-Codex IDEs where the server is managed by the published MCP declaration, discover the checkout/cache location through the IDE's MCP status, the configured command, or a targeted cache search. The published declaration may run `uvx --from git+https://github.com/AccelByte/unreal-sdk-mcp-server@main accelbyte-unreal-sdk-mcp-server` (uvx entrypoint not confirmed against repo — verify a `[project.scripts]` entry exists before relying on this; if absent, use the pip+python startup path instead), but Codex should prefer the local clone path unless the user explicitly chose the `uvx` fallback.
- If the Unreal SDK MCP server or `data/WidgetBlueprintGenerator` package is missing, route the user to the plugin MCP install/setup flow first (`/ags install-mcp` or the plugin `INSTALL.md`) so the `AccelByte Unreal SDK MCP Server` entry is installed and started. Do not invent a download source.
- Read the discovered package `README.md` and `Tools/README.md` before installing if present.
- Install by copying the package into an Unreal project as `Plugins/WidgetBlueprintGenerator`.
- Enable the plugin in the `.uproject` `Plugins` array with `Enabled: true` and `TargetAllowList: ["Editor"]`.
- Rebuild the editor target after enabling the plugin.
- Prefer the plugin's Python CLI for validation, generate, patch, dry-run, and smoke flows.
- Do not claim the install works until a validation, dry-run, smoke wrapper, or commandlet report has been run or the exact blocker is reported.

</grounding_rules>

<tool_usage_rules>

- `Glob` to find `.uproject` files and detect whether `Plugins/WidgetBlueprintGenerator` already exists.
- `Read` for MCP config, discovered generator README files, `.uproject`, and existing project build files.
- `Write` / `Edit` for copying the plugin package and editing `.uproject`.
- `Bash` for copy commands, rebuild commands, CLI validation, dry-runs, and smoke checks after confirmation when they mutate project state or launch Unreal.
- Do not read other subskills except `install-unreal-sdk.md` when the Unreal engine/project setup itself is missing or unclear.

</tool_usage_rules>

<dependency_checks>

Before installing:

1. Confirm exactly one Unreal project root, or ask which `.uproject` to target.
2. Confirm the Unreal SDK MCP server is installed or available through the user's AI IDE MCP configuration. For Codex, check `.codex/mcp/unreal-sdk-mcp-server` first. For non-Codex IDEs, the published MCP declaration is `content/mcps/unreal-sdk.yaml` and may run `uvx --from git+https://github.com/AccelByte/unreal-sdk-mcp-server@main accelbyte-unreal-sdk-mcp-server`.
3. Discover the MCP server package directory and confirm `data/WidgetBlueprintGenerator` exists and contains:
   - `WidgetBlueprintGenerator.uplugin`
   - `Source/`
   - `Tools/widget_blueprint_generator.py`
4. Check whether `Plugins/WidgetBlueprintGenerator` already exists.
5. Check that Unreal editor build tooling is available or already documented in the repo.

</dependency_checks>

<action_safety>

This install copies a plugin directory, edits `.uproject`, rebuilds the editor target, and may launch Unreal commandlets.

- Show the target project and destination path before copying.
- If `Plugins/WidgetBlueprintGenerator` already exists, do not overwrite it silently. Compare or ask whether to replace/update it.
- Show the `.uproject` plugin-entry diff before editing.
- Ask before running a rebuild or any command that launches Unreal.
- Do not delete existing project assets or generated Widget Blueprints unless the user explicitly asks.
- Use `--dry-run` before generate/patch when the target spec or engine path is uncertain.

</action_safety>

<output_contract>

End with an "installed" block:

```
Widget Blueprint Generator installed

  Project:        <path to .uproject>
  Source path:    <discovered MCP package>/data/WidgetBlueprintGenerator
  Install path:   <project-root>/Plugins/WidgetBlueprintGenerator
  Enabled:        yes / no
  Rebuilt:        yes / no - <reason>
  Verification:   <validate / dry-run / smoke / commandlet report result>

Next step:
  Use the generator or patcher from the installed plugin:
  Generate: python Plugins/WidgetBlueprintGenerator/Tools/widget_blueprint_generator.py generate <spec.json> --project <Project.uproject>
  Patch:    python Plugins/WidgetBlueprintGenerator/Tools/widget_blueprint_generator.py patch <patch.json> --project <Project.uproject>
```

</output_contract>

<completeness_contract>

The install is complete when:

1. The plugin package is present at `Plugins/WidgetBlueprintGenerator`.
2. The `.uproject` has a single enabled `WidgetBlueprintGenerator` editor plugin entry.
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
Test-Path .codex/mcp/unreal-sdk-mcp-server/data/WidgetBlueprintGenerator/WidgetBlueprintGenerator.uplugin
```

For non-Codex IDEs, prefer explicit configured paths if the IDE exposes them; otherwise search common MCP/cache locations for `data/WidgetBlueprintGenerator`:

```powershell
Get-ChildItem $HOME -Recurse -Directory -Filter WidgetBlueprintGenerator -ErrorAction SilentlyContinue |
  Where-Object {
    Test-Path (Join-Path $_.FullName "WidgetBlueprintGenerator.uplugin") -and
    Test-Path (Join-Path $_.FullName "Tools/widget_blueprint_generator.py")
  } |
  Select-Object -First 10 -ExpandProperty FullName
```

On macOS/Linux, use the same logic with `find`:

```bash
find "$HOME" -type f -path "*/data/WidgetBlueprintGenerator/WidgetBlueprintGenerator.uplugin" 2>/dev/null
```

If no package is found, stop and tell the user to install/start the AccelByte Unreal SDK MCP server from the plugin's MCP configuration first. For Codex, route them through `/ags init` so the local clone is created. For non-Codex IDEs, the server is declared as `AccelByte Unreal SDK MCP Server` and is sourced from `git+https://github.com/AccelByte/unreal-sdk-mcp-server@main`.

Read the discovered package `README.md` and `Tools/README.md` if present.

### Step 2: Copy plugin package

Destination:

`<project-root>\Plugins\WidgetBlueprintGenerator`

Create `Plugins` if needed. Copy the complete source package, excluding transient build output only if the source contains it and the project should rebuild cleanly:

- Safe to exclude: `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`, `__pycache__/`
- Keep: `WidgetBlueprintGenerator.uplugin`, `Source/`, `Tools/`

If the user wants an exact copy of the staged package, copy all files.

### Step 3: Enable the plugin

Edit the `.uproject` JSON. Add or update this entry in `Plugins`:

```json
{
  "Name": "WidgetBlueprintGenerator",
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

Validate a sample spec:

```powershell
python Plugins/WidgetBlueprintGenerator/Tools/widget_blueprint_generator.py validate Plugins/WidgetBlueprintGenerator/Tools/specs/sample_menu.json
```

For a non-launching command check:

```powershell
python Plugins/WidgetBlueprintGenerator/Tools/widget_blueprint_generator.py generate Plugins/WidgetBlueprintGenerator/Tools/specs/sample_menu.json --project <Project.uproject> --dry-run
```

For a quick local smoke run from the project root:

```powershell
Plugins\WidgetBlueprintGenerator\Tools\run_widget_generator.bat
```

The CLI writes request/report files under `Saved/WidgetBlueprintGenerator/` and does not trust Unreal's process exit code by itself. Treat success as a report JSON with `ok: true`.

### Step 6: Print the "installed" block

Per `output_contract`.

## Usage Notes

Direct commandlet form:

```powershell
UnrealEditor-Cmd.exe MyProject.uproject -run=WidgetBlueprintGenerator -Request=D:\path\to\request.json -unattended -nop4 -stdout -FullStdOutLogOutput
```

Generate requests include `mode: "generate"`, `force`, `spec`, and `report_path`.

Patch requests include `mode: "patch"`, `asset_path`, `parent_widget_name`, `widget`, and `report_path`.

The MVP supports `CanvasPanel`, `Overlay`, `VerticalBox`, `HorizontalBox`, `SizeBox`, `Border`, `TextBlock`, `Button`, `EditableTextBox`, `Image`, `Spacer`, `AccelByteWarsButtonBase`, and arbitrary Widget Blueprint classes loaded through `class_path`.

The generator only writes generated assets under `/Game/ByteWars/UI/Generated`.

## Error handling

- **No `.uproject` found** - ask for the Unreal project root.
- **Multiple `.uproject` files found** - ask which project to target.
- **Source package missing** - report the exact missing path; do not invent a download source.
- **Destination already exists** - ask whether to replace, merge, or leave it untouched.
- **`.uproject` malformed JSON** - stop and report the parse error; do not edit with string replacement.
- **Build command missing** - report the plugin is copied/enabled but not rebuilt; provide the expected build command shape.
- **Validation fails** - surface the CLI error and do not print the "installed" block.
- **Unreal launches but no report is written** - report failure; inspect crash context if the CLI emitted one.
