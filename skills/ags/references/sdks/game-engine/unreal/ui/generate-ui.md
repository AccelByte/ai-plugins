---
description: Generate or patch an Unreal Engine Widget Blueprint from a JSON spec
  using the AccelByteUITools plugin. Use when the user asks to create a widget blueprint,
  generate UMG UI, create a leaderboard widget, create a tab view, or build any AGS
  UI screen. Use select-ags-recipe in UMG mode to find the closest structural recipe
  before building from scratch; project style remains authoritative.
last-verified: 2026-05-11
sources:
- https://github.com/AccelByte/unreal-sdk-mcp-server
see-also:
- '[generate-ui.md](../../../../../subskills/generate-ui.md)'
- '[install-ui-tools.md](install-ui-tools.md)'
---

# Unreal UI - Generate Widget Blueprint

Build Unreal Engine Widget Blueprints from JSON specs. Always use the live editor bridge for Blueprint generation, patching, and asset inspection — never use commandlet or auto mode. The commandlet mode launches Unreal Editor headlessly which takes several minutes; the bridge completes in seconds.

## Unreal Editor lifecycle

Do not require Unreal Editor inspection before every UI task. Use the least disruptive path that still gives enough project truth:

- **Code/spec-first:** For a new widget with clear requirements, or when the requested work is C++ backing class/config/API wiring, resolve the UI system and implementation depth, then prepare the JSON spec and any C++ files before requiring the editor bridge.
- **Editor-inspection first:** If the task patches an existing Widget Blueprint, follows project UI style, depends on current widget hierarchy/animations/bindings, or has an unknown target container, inspect the existing assets through the live editor bridge before patching.
- **Editor bridge required:** `accelbyte_ui_generate`, `accelbyte_ui_patch`, existing Blueprint inspection, and bridge-only asset validation require Unreal Editor to be open and fully loaded.
- **Build hygiene:** If normal Unreal C++ build verification is needed and Live Coding is not being used, close Unreal Editor before the build, then reopen it only for Blueprint generation, patching, inspection, or saving.

When the bridge is required but unavailable, tell the user to open the Unreal project in the editor and wait for it to finish loading. If the runtime can launch the editor with approval, launch it for the inspection/generation phase rather than blocking immediately. Do not launch Unreal Editor only to make Live Coding available; use the normal Unreal build path for C++ verification instead.

Before creating or patching UI, run the AccelByteUITools project style discovery gate. The generator must inspect the project's existing UMG/Common UI conventions, print its findings, and use the approved style context as the source of truth for generation and validation.

## Plugin Script Safety

NEVER modify, patch, or edit any file under `Plugins/AccelByteUITools/` during a widget generation session. The plugin is stable infrastructure maintained by developers, not modified during user sessions. Allowed write targets are:

- `Saved/Generated/Spec/*.json` and `Saved/Generated/Spec/Components/*.json` — widget specs
- `Saved/AccelByteUITools/generated_project_components.json` — component registry (written by `generate-core-widgets` / `generate_project_core_widgets`, not by Claude directly)
- `Source/<Module>/AGS/UI/Generated/**` — C++ backing class files (Script backed mode only)

If `accelbyte_ui_validate` or `accelbyte_ui_generate` returns an error that cannot be resolved by editing the widget spec JSON, report the exact error to the user and stop. Do not attempt to fix validator or generator bugs by editing plugin Python files.

## Workflow

**0. Discover and approve project style** — before doing anything else, discover the project's UI system and style conventions.

Run the generator's style discovery command from the Unreal project root:

```powershell
python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py style-discover --project <Project.uproject>
```

Show the findings to the user: detected UI backend, reusable widget/style candidates, enforced validation rules, warnings, and unresolved ambiguities. Do not generate or patch UI until the user confirms the findings. After confirmation, approve the exact discovered fingerprint:

```powershell
python Plugins/AccelByteUITools/Tools/accelbyte_ui_tools.py style-discover --project <Project.uproject> --approve
```

Continue with the mode-specific workflow based on the approved `ui_backend`, `enforced_roles`, and semantic role mappings. Approval is not just permission to continue: approved findings become mandatory defaults for generated project widgets until the source fingerprint changes. If the user explicitly asks to override the discovered style, update the spec intent and rerun discovery/approval before generation.

After approval, resolve the widget spec's `style_mode`:
- If the user explicitly asks for AGS defaults, set `"style_mode": "agsui"`.
- If the user explicitly asks for project style, set `"style_mode": "project"`.
- Otherwise use `"style_mode": "auto"`: `confidence: "low"` means AGSUI defaults, while `confidence: "medium"` or `"high"` means project style.

In AGSUI mode, AGSUI component fallbacks are valid, AGS white panel backgrounds are preserved, and `generate_project_core_widgets` should not be called unless the user explicitly requests project-owned state panels.

**Style context must be fresh before every generate call.** The fingerprint goes stale after any `Build.bat` rebuild or after any successful `accelbyte_ui_generate` call (which creates a new `.uasset`). `accelbyte_ui_generate` auto-approves by default (`auto_approve_style: true`). Do not skip style discovery even if it was run earlier in the session.

The Python/MCP validator is authoritative. Treat prompt guidance as secondary: if `accelbyte_ui_validate` or `accelbyte_ui_generate` reports a style-context error, surface that error to the user and fix the spec to satisfy it. Do not try to bypass validation by removing typed style fields, switching project rows to AGSUI rows, replacing `ListView`/`TileView` with `ScrollBox`, or swapping Common UI buttons for UMG AGS button variants.

Manual mode prompt, retained only if style discovery is unavailable:

> Which UI system should I use?
> 1. **UMG (default)** — AGS UI kit with `AGSPanelBase`, pre-built AGSUI component widgets
> 2. **Common UI** — Unreal's Common UI plugin (`CommonActivatableWidget` base, `CommonButtonBase` buttons)
> 3. **Follow Project UI System** — I'll explore your project's existing widgets and adapt to match

Use this manual prompt only if style discovery is unavailable.

**0.5. Resolve project core component candidates** — immediately after style approval, check the `core_component_roles` key in the approved style context (written by `style-discover`). For each core role the upcoming widget will use, determine which resolution tier applies:

- **Tier 1 (project-discovered)**: `project_candidate` is set → use that `class_path` directly in the spec.
- **Tier 2 (project-generated)**: `generated_candidate` is set → use that `class_path` (the widget was previously generated at `/Game/AGS/UI/Components/`).
- **Tier 3 (AGS fallback)**: neither is set → use the `agsui_fallback` path.

For every core role that resolves to Tier 3 and has a `template` defined, call `generate_project_core_widgets` **only when `style_mode` resolves to project style**. Do not proceed to spec composition in project style until either:
(a) `generate_project_core_widgets` has been called for all Tier 3 state-panel roles, or
(b) the user explicitly says to skip generation and use AGS fallbacks.

When `style_mode` resolves to AGSUI, keep the AGSUI fallback paths and continue. They are valid in blank or AGS-default projects.

Prefer one call that includes all unresolved state panel roles, especially `state_idle`:
```
generate_project_core_widgets(roles=["state_loading", "state_empty", "state_error", "state_idle"], ...)
```

Wait for `ok: true` and `style_context_refreshed: true` before continuing; the refreshed style context is what makes `AGSStatusMessage` resolve to `/Game/AGS/UI/Components/WBP_AGS_ProjectStatusPanel...` instead of the AGSUI idle fallback. If the bridge is unavailable, list the unresolved Tier 3 roles to the user and ask: "Wait for the bridge to come up, or continue with AGS fallbacks?"

`generate_project_core_widgets` owns its templates and recovery behavior. Do not hand-edit the generated component spec to fix template output; rerun the tool. In mixed UMG+CommonUI projects the tool must not inject Common UI `button_style_class` values into AGSBaseButton-derived template buttons; it should use a discovered project button widget when one exists, otherwise leave the template button unstyled rather than producing an invalid bridge payload. If a previous bridge rejection partially created `/Game/AGS/UI/Components/WBP_AGS_Project*` but did not register it, rerun `generate_project_core_widgets`; the tool retries asset-exists failures once with force for generated core components.

**Pre-spec gate (before step 4):** in project style, confirm that `state_idle`, `state_loading`, `state_empty`, and `state_error` are each resolved to Tier 1, Tier 2, or a freshly generated Tier 2 path. If any remain at Tier 3 and the user has not explicitly approved fallbacks, stop and resolve them first. In AGSUI style, Tier 3 AGSUI fallbacks are accepted.

**0.6. Choose implementation depth** — ask once, right after the UI system choice. If the user's message already implies a preference (e.g. "just the widget", "script backed", "with a C++ class"), skip the question.

> Should I also generate a C++ backing class?
> 1. **Widget only** (default) — blueprint structure only, no C++ file
> 2. **Script backed** — generate the widget **and** a C++ backing class using standard Unreal patterns (BindWidget properties, NativeOnActivated/NativeOnDeactivated lifecycle), no SDK-specific calls

1. Call `accelbyte_ui_bridge_health` first. If it returns `ok: false` or throws, stop and tell the user: "The Unreal Editor bridge is not running. Open your Unreal project in the editor and wait for it to finish loading, then try again." Do not proceed.
   The approved style context from step 0 is mandatory; if approval is missing or stale, rerun `style-discover` and stop for user confirmation.
2. Call `select_ags_recipe` with the user's request text in UMG mode and treat the result as reference only. *(Skip for Common UI and Follow Project modes; see sections below.)*
3. If a matching recipe exists, use it as **structural reference only** — understand what states and content areas it defines, but do NOT copy its FeatureBlock `class_path` references into your spec. All three UI modes (UMG, Common UI, Follow Project) must build flat specs using the approved project style context for buttons, text, inputs, state panels, and list rows before any fallback element (see [Flat Spec Composition Guide](#flat-spec-composition-guide)).
4. Build or adapt the JSON spec following the structure rules below and any mode-specific rules. Write generated/temp specs to `Saved/Generated/Spec/<AssetName>.json` by default, unless the user specified a different project-local path. If `select_ags_recipe` returns `ags_generic_async_panel.json` for a request that is not a true async/status operation, do not accept the generic async fallback; compose a custom spec from the closest game UI archetype instead.

   **Pre-generation visual checklist:** always use a `Border` root named `PanelBackground` wrapping a single `Overlay` named `ContentContainer` (padding 20, fill slot) — every content widget goes inside ContentContainer with a fill slot; keep `StateSwitcher` children ordered `Idle`, `Loading`, `Success`, `Empty`, `Error`; expect the generated preview/default state to be `Success`; let validation/generation apply `theme_tokens.json`; choose native `ListView`/`TileView` for runtime collections; place primary actions consistently; and preserve stable bind names. These names are enforced contracts, not style suggestions. Use the validated/normalized spec returned by `accelbyte_ui_validate` or `accelbyte_ui_generate`, not raw recipe JSON. In project style, the normalizer defaults `PanelBackground.style.background_color` to black with 0.1 opacity when the color is missing or still equals the legacy AGS white preset. In AGSUI style, preserve the AGS white panel preset unless the user asks for the project look.

   **Flat spec rules (apply to all UI modes):**
   - **Never use `class_path` references to AGS FeatureBlock composites** (`/AccelByteUITools/AGSUI/FeatureBlocks/`). These are separate UserWidget blueprints — C++ `BindWidget` cannot reach inside them, and Blueprint cannot directly access their children either. Inline their content as flat native UMG elements instead.
   - **For all interactive and data-bearing content, use approved project roles first**: discovered project button widgets/styles, text styles, input wrappers/styles, and list entry widgets are mandatory when present in `project_style_context.json`. Native controls and AGSUI/Core are fallback only when the relevant role has no project candidate. Mark every data-bound or interactive element `is_variable: true`.
   - **Project/generated class references are validated from style context**: `accelbyte_ui_validate` reads the approved `project_style_context.json`, including discovered `/Script/<Module>.<Class>` source classes, discovered project widget assets, and the generated-component registry. Newly generated project UI component references under `/Game/.../UI/Generated/...` or `/Game/.../UI/Components/...` are accepted before the registry refreshes. If a different `/Game/...` class path is rejected as `unknown_class_reference`, rerun style discovery/approval or use a discovered/generated project UI class path instead of inventing an arbitrary asset path.
   - **Generated CommonUI C++ subclasses are valid parents after discovery**: style discovery follows project inheritance, so a generated `ULeaderboardWidget : public UAccelByteWarsActivatableWidget` is accepted for `ui_mode: "common_ui"` once the header exists and discovery/approval has been rerun. Do not bypass validation and jump straight to generation for this case.
   - **Generated entry/card specs are compact widgets, not full panels**: asset paths may use generated subfolders such as `/Game/AGS/UI/Generated/Leaderboard/WBP_AGS_LeaderboardEntry`. Entry/card widgets for `ListView`/`TileView` should use `ui_mode: "umg"` even when the host panel is CommonUI; the validator normalizes accidental `common_ui` entry specs to UMG. Compact entry padding and centered row content are valid. Do not swap a real generated entry out for a generic placeholder entry just to get the main panel through validation; generic entries such as `W_AccelByteWarsWidgetEntry` are invalid for store, leaderboard, achievement, and other recipe-specific collections when a recipe-specific entry/card is required.
   - **Complex composed widgets require project-style prerequisites before the main spec**: if the request contains category tabs, `ListView`/`TileView`/`TreeView`, or `StateSwitcher` states (for example, "store catalogue widget with tab menus for categories"), first ensure project-owned tab buttons, compatible project entry/card widgets, and project/generated state panels exist. Do not use `AGSSecondaryButton` as a tab fallback, AGSUI row/card `entry_widget_class`, or AGSUI state atoms in the main generated project widget when these prerequisites are missing; validation rejects these with `project_tab_button_required`, `project_list_entry_required`, `no_compatible_project_list_entry`, or `project_core_widget_required`.
   - **Use typed style fields in specs**: Common UI buttons should use `button_style_class`; Common UI text should use `text_style_class`. `style_asset` is only a generic reporting/validation alias. Do not replace discovered styles with literal color/style values unless no project style exists.
   - **TextBlock + `text_style_class` in mixed/CommonUI projects**: the C++ bridge's `ApplyCommonTextStyle()` requires the widget to be a `UCommonTextBlock` — a native `TextBlock` class will be rejected with "not a Common UI text block". The validator auto-injects `"class_path": "/Script/CommonUI.CommonTextBlock"` for any TextBlock that has `text_style_class` in a mixed/CommonUI project. Do not remove this `class_path` or the bridge will error.
   - **State panels (loading, idle, empty, error) — class_path is resolved by role**: the Python validator's normalization pass (`_normalize_spec_nodes`) auto-applies `core_component_roles.<role>.resolved` as the `class_path` for state panel nodes. Use AGS state aliases (`AGSStatusMessage`, `AGSLoadingIndicator`, `AGSEmptyState`, `AGSErrorState`) for AGSUI fallback panels. Use `UserWidget` with explicit `core_role` and a `/Game/...` `class_path` only for project/generated state panels. Do NOT copy AGSUI fallback `class_path` values manually when a project/generated core component exists. Keep WidgetSwitcher state children `is_variable: true`; `core_role` is a schema/normalization hint, not a C++ binding-type override.

5. Call `accelbyte_ui_validate` to normalize theme defaults from `theme_tokens.json` and verify the spec before generating. Then call `accelbyte_ui_resolve` on the normalized/final spec before writing any script-backed C++ header or `.cpp`.
   For Script backed mode, the `bindings` array returned by `accelbyte_ui_resolve` is the only source of truth for C++ binding declarations; do not map binding types manually and do not use the table below as execution logic. `accelbyte_ui_generate(mode="verify-only")` is a legacy compatibility alias for `accelbyte_ui_resolve`; prefer the explicit resolve tool.
   If validation reports that no compatible project list entry exists, stop and tell the user which candidate must be verified or updated to implement `IUserObjectListEntry`; do not fall back to AGSUI rows or `ScrollBox`.
   If validation reports `recipe_list_entry_required`, generate or select a project-styled entry widget for the selected recipe before generating the main widget. A compatible generic entry is not enough: leaderboard entries need rank/player/score fields, store cards need item/price fields, achievements need title/progress or status fields, and so on.
   If validation auto-adds `entry_widget_class` to a `ListView`/`TileView`/`TreeView`, keep the normalized spec and generate from that normalized spec. Do not re-create the main spec from the pre-validation draft; that loses the automatic collection wiring.

**— If Script backed was requested, do 5a–5d before continuing to step 6 —**

5a. **Collect the information needed for the C++ backing class:**

   - **Feature name**: derive from `asset_path`. `/Game/AGS/UI/Generated/WBP_AGS_LeaderboardPanel` → `LeaderboardPanel` → class `ULeaderboardPanelWidget`.
   - **Module name and API macro**: read the project's `Build.cs` (e.g. `Source/<ModuleName>/<ModuleName>.Build.cs`) to find the module name, then derive the API macro as `<MODULENAME>_API`.
   - **Base class** (depends on the UI mode chosen in Step 0):
     - **Mode A (UMG):** `UUserWidget` — include `"Blueprint/UserWidget.h"`
     - **Mode B (Common UI):** use the project CommonUI activatable base discovered in the approved style context (`source_classes.common_activatable`) and set the generated spec `parent_class` to `/Script/<Module>.<ProjectActivatableClass>`. Also read that header and inherit the generated C++ class from the same project class. Only if no project CommonUI activatable base exists may you use `UCommonActivatableWidget` or `AGSCommonActivatableBase`.
     - **Mode C (Follow Project):** use the base class already discovered in the Mode C exploration phase.
     - **Entry widgets for `ListView`/`TileView`/`TreeView`:** use a project C++ class that implements `IUserObjectListEntry`; never use plain `UUserWidget` as the generated entry widget parent. A generated row/card spec whose asset name contains `Entry`, `Row`, or `Card` must set `parent_class` to `/Script/<Module>.<EntryClass>` before generation.
   - **BindWidget properties**: use the `bindings` array returned by `accelbyte_ui_resolve`. Generate a UPROPERTY for **every** binding without exception — do not skip any names and do not infer C++ types yourself.
   - **Delegate / event API — mandatory header or symbol read before writing any binding code:** For every widget node that has a project-specific `class_path` (i.e. starts with `/Game/`):
     1. Use `describe_example_components` or `Read` to locate the widget's C++ `.h` file.
     2. Read the `: public` chain to confirm the actual C++ parent class name.
     3. Use `describe_symbols`, `search_symbols`, or direct header reads on the resolved class to identify every delegate or event API available on that class (e.g. `OnClicked().AddUObject(...)`, `OnPressed.AddUObject(...)`, `OnButtonBaseClicked`, `OnHold`, `OnReleased`). **Do not rely on the verifier's inferred type or the spec `type` field to determine delegate names** — those reflect the generator's abstract role, not the project widget's C++ API.
     4. Use those exact delegate names and binding style in the backing class. If no public delegate is exposed, use `BlueprintCallable` stubs wired from the Blueprint event graph instead of `AddDynamic`.

     **Do not proceed to step 5b until this is complete for every project-specific widget in the spec.**
   - **Naming prefix conventions**: `Btn_` for buttons, `Tb_` for text blocks, `Ws_` for widget switchers, `Lv_` for list views, `Img_` for images.
   - **Output path**: if the user did not specify one, use `<project-root>/Source/<ModuleName>/AGS/UI/Generated/<Feature>/`, where `<ModuleName>` is the primary project module from `Source/<ModuleName>/<ModuleName>.Build.cs` and `<Feature>` comes from the generated asset name after stripping `WBP_AGS_`. If the user specified a path, honor it after confirming it is inside the project and compatible with the module's source layout.

5b. **Write the C++ backing class** (see [Script Backed Mode](#script-backed-mode) for mode-specific templates):
   - Write `<OutputPath>/<FeatureName>Widget.h` using the `Write` tool
   - Write `<OutputPath>/<FeatureName>Widget.cpp` using the `Write` tool
   - Update the widget spec's `parent_class` to `/Script/<ModuleName>.<FeatureName>Widget`
   - Every binding property must use `UPROPERTY(BlueprintReadOnly, meta = (BindWidget, BlueprintProtected = true, AllowPrivateAccess = true))`
   - Binding properties may be declared as raw pointers (`UTextBlock* TitleText;`) or UE5 object pointers (`TObjectPtr<UTextBlock> TitleText;`). Prefer raw pointers in generated examples for simplicity, but the verifier accepts both forms and normalizes `TObjectPtr<T>` to `T`.
   - Every binding property type, include, and property name must match the corresponding `bindings` entry exactly.

5c. **Verify the backing header before compiling:**
   - Call `accelbyte_ui_verify_backing_class` with the finalized spec path and generated header path. Keep the spec `parent_class` set to the final generated C++ class; do not temporarily switch to `AGSCommonActivatableBase`, `UCommonActivatableWidget`, or another fallback parent for verification.
   - The verifier auto-refreshes and approves style context by default (`autoApproveStyle: true`), matching `accelbyte_ui_generate`, so newly written generated headers can be discovered before compile.
   - If it returns `ok: false`, fix the C++ header from the reported `verified_backing_bindings` mismatches and call the verifier again.
   - Do not compile or generate the Blueprint until this verifier passes.

5d. **Compile gate - Live Coding or approved full rebuild:**
   - **If these C++ files were newly created this session (the class did not exist before):** do NOT use Live Coding. Live Coding cannot register new `UCLASS` types into Unreal's reflection system. If the flow needs multiple generated classes (for example an entry widget plus the host panel), write all required UCLASS headers before this first rebuild so Unreal can resolve them together. Ask for explicit user approval to run a full editor-target rebuild through `unreal_build_editor`.
     - Before rebuilding, call `unreal_editor_status`. If the target project editor is running, ask for explicit user approval before closing Unreal Editor, then call `unreal_close_editor` with `userApproved: true`.
     - Call `unreal_build_editor` with `userApproved: true`. If it returns compile errors, fix only the current generated UI files from this task. If an error points outside those generated files, stop and report it instead of editing unrelated project code.
     - Retry `unreal_build_editor` after generated-file fixes. After a successful rebuild, ask for explicit user approval before launching Unreal Editor, then call `unreal_launch_editor` with `userApproved: true`.
     - If graceful close is blocked, ask for separate explicit user approval before calling `unreal_close_editor` with `force: true`.
   - **If an existing `UPROPERTY` widget type changed:** before rebuilding, tell the user to delete the affected project/plugin `Intermediate` build artifacts. Unreal incremental/unity builds can keep stale reflected property types after a header-only `UPROPERTY` type change, which causes the bridge to keep reporting the old type.
   - **If modifying an already-compiled existing class (adding methods, updating logic):** Ask once for user approval to run the current task's Live Coding verification and in-scope repair loop, then call `unreal_live_coding_compile` with `waitForCompletion: true`. Continue automatically after `success` or `no_changes`. If the tool returns actionable compile diagnostics for current generated UI files from this task, fix those files and retry under the existing approval. Stop and report diagnostics outside those files, cancellation, unavailable Live Coding, or an unresolved timeout. Do NOT suggest `Build.bat` as the first/default path for existing classes; it is the fallback only when Live Coding is unavailable.
   - Do NOT proceed to step 6 until Live Coding succeeds or the approved full rebuild succeeds and the editor has been relaunched.
6. Call `accelbyte_ui_generate` with `mode: "bridge"` explicitly. Never pass `mode: "auto"` or `mode: "commandlet"`. The generator normalizes the spec again before posting it to Unreal, so do not bypass this tool by sending raw JSON directly to the bridge.
   The generator posts the canonicalized spec to Unreal, including resolved `class_path` values and typed `button_style_class` / `text_style_class` fields. Never remove those fields to make a raw bridge payload pass.

   **Interpreting `verify_failed` results:** If `accelbyte_ui_generate` returns `ok: false` with error code `verify_failed` but `verified_widget_count` equals the expected widget count, the blueprint **was generated** — all widgets are placed in the editor. `verify_failed` is a post-generation C++ class hierarchy check (each placed widget's class vs the expected AGS base class), not a placement failure. Do NOT switch project widgets back to AGSUI fallbacks in response to `verify_failed`. Report the asset path and widget count to the user and note that the class mismatch is expected when a project state widget doesn't extend the AGS C++ base class.
7. Report the generated `asset_path`, widget count, final `parent_class`, and any `verified_collection_entries` / `expected_collection_entries` returned by `accelbyte_ui_generate`. For script-backed widgets, the generated Blueprint must already use `/Script/<ModuleName>.<FeatureName>Widget`; for collection widgets, `EntryWidgetClass` must already match the normalized `entry_widget_class`. Do not tell the user to reparent the Blueprint or edit ListView/TileView/TreeView Entry Widget Class manually. If either parent class or collection entry assignment is not verified, treat generation as incomplete and fix the spec/generation flow instead of handing editor repair steps to the user.

**— If Script backed was requested, also report integration status —**

7a. **Report what remains outside widget wiring:**
   - Confirm the required `BindWidget` properties were verified against the final backing class before generation.
   - To push this widget onto the UI stack, call the project's UI management function from another widget or game code.
   - If the generated C++ contains AGS API stubs, report them as integration work still to implement; do not describe them as Blueprint/editor wiring.

If the user wants to add widgets to an existing blueprint instead of regenerating it, use `accelbyte_ui_patch` with the parent widget name and child node JSON — also bridge mode only. If the user wants to fix an existing widget's properties, such as a white `PanelBackground`, use a property patch instead of adding a child widget:

```json
{
  "asset_path": "/Game/AGS/UI/Generated/WBP_AGS_ExamplePanel",
  "op": "set_widget_properties",
  "widget_name": "PanelBackground",
  "properties": {
    "style": { "background_color": [0, 0, 0, 0.1] }
  }
}
```

For existing generated assets with legacy white panels, either apply this property patch or regenerate with `force` from a normalized spec. Do not tell the user that patching cannot change existing widget properties.

**Script-backed compile order:** Write the spec, call `accelbyte_ui_validate`, call `accelbyte_ui_resolve`, write C++ bindings from resolved `bindings`, update the spec `parent_class` to the final generated C++ class, call `accelbyte_ui_verify_backing_class` with default auto-refresh, then compile. For brand-new multi-class flows, write every required UCLASS header before the first approved `unreal_build_editor` rebuild; for an already compiled class, ask once for approval and call `unreal_live_coding_compile(waitForCompletion: true)`, fixing and retrying only when diagnostics point to current task files. If an existing `UPROPERTY` type changed, instruct the user to delete the relevant `Intermediate` build artifacts before rebuilding. After successful compile or approved rebuild, rerun style discovery/approval or `accelbyte_ui_verify_backing_class`, then run `accelbyte_ui_generate` with the final parent class still in the spec. Do not treat the C++ generation step as a substitute for spec normalization, and never verify or generate with a temporary fallback parent such as `AGSCommonActivatableBase`, `CommonActivatableWidget`, or `UUserWidget` when a final script-backed class is intended.

---

## Mode A — UMG (default)

No changes from the standard workflow above. Use `AGSPanelBase` as `parent_class` unless the approved style context or script-backed base-class discovery selects a project class. Reference AGSUI components via `class_path` only for roles with no project candidate.

---

## Mode B — Common UI

Targets Unreal's [Common UI plugin](https://docs.unrealengine.com/5.0/en-US/common-ui-plugin-for-advanced-user-interfaces-in-unreal-engine/).

**The spec structure is identical to Mode A (UMG).** Use the same state machine pattern, but apply discovered project Common UI button/text/list roles first. The only required top-level spec differences are:

```json
{
  "asset_path": "/Game/AGS/UI/Generated/WBP_AGS_<Name>",
  "parent_class": "/Script/<ProjectModule>.<ProjectActivatableClass>",
  "ui_mode": "common_ui",
  "root": { ... identical structure to Mode A ... }
}
```

**`ui_mode` in mixed CommonUI + UMG projects:** use `"ui_mode": "common_ui"` when the panel will be pushed onto a CommonUI widget stack (parent is `CommonActivatableWidget` or the widget stack system). Use `"ui_mode": "umg"` (default) when the panel is embedded in a UMG overlay or HUD. Setting `ui_mode` affects binding contract resolution: with `"common_ui"`, `AGSBaseButton` resolves to `UAGSCommonButtonBase` (not `UAGSButtonBase`), and `TextBlock` with `text_style_class` resolves to `UCommonTextBlock`. Always set `ui_mode` explicitly for CommonUI panels — do not leave it at the default in mixed projects.

**What validation does automatically when `ui_mode: "common_ui"` is set:**
- If no project button/text candidate exists, `AGSButton`, `AGSBaseButton`, `AGSSecondaryButton`, `AGSDangerButton`, `AGSIconButton` resolve to `WBP_AGS_Common*` blueprints backed by `UAGSCommonButtonBase : UCommonButtonBase` instead of the UMG `UAGSButtonBase` variants
- If no project text style exists, `TextBlock` resolves to `UCommonTextBlock` instead of native `UTextBlock`; when project text styles exist, set `text_style_class`
- Common UI button nodes may set `button_style_class` to the discovered project `UCommonButtonStyle` class
- `parent_class` must be the discovered project CommonUI activatable base when `source_classes.common_activatable` exists; otherwise it must be a Common UI class (`AGSCommonActivatableBase`, `CommonActivatableWidget`, or `CommonUserWidget`) — mismatch is a hard validation error
- All other AGS aliases (state atoms, inputs, panels, list rows) resolve to the same class_paths as UMG mode

**Parent class:**
- Interactive panels (respond to input, pushed/popped on a stack): the project CommonUI activatable base from `source_classes.common_activatable`, for example `/Script/AccelByteWars.AccelByteWarsActivatableWidget`.
  The validator normalizes `AGSCommonActivatableBase`/`CommonActivatableWidget` to the project parent when there is exactly one candidate, and rejects those fallbacks when project candidates exist but are ambiguous.
- Non-interactive or embedded widgets: `/Script/CommonUI.CommonUserWidget`

**Pre-flight check:**
Read the project's `.uproject` with `Read` or `Bash` and confirm `"CommonUI"` appears in the plugin list. Warn the user if absent or disabled.

`select_ags_recipe` can still be called as structural reference — structure is identical to Mode A, so recipes apply equally.

---

## Mode C — Follow Project UI System

Explore the project's existing UI before building the spec, then proceed with the normal UMG workflow using what you find.

**Exploration phase (insert before step 1):**

1. Find the project's widget header files using `Bash`:
   ```powershell
   Get-ChildItem -Path . -Recurse -Filter "*.h" | Select-String -Pattern "UUserWidget" -List | Select-Object -ExpandProperty Path
   ```
2. Find existing Blueprint widget assets to understand naming conventions:
   ```powershell
   Get-ChildItem -Path . -Recurse -Filter "WBP_*.uasset" | Select-Object -First 20 FullName
   ```
3. `Read` one representative widget header (`.h`) to extract:
   - The C++ base class name and module (e.g. `UCLASS() class MYGAME_API UMyPanelBase : public UUserWidget`)
   - Its script path: `/Script/<ModuleName>.<ClassName>` (e.g. `/Script/MyGame.MyPanelBase`)
   - Any component widget class paths already referenced
4. Optionally `Read` one or two existing widget `.cpp` files to understand the project's delegate binding style and lifecycle method conventions.
5. Summarize what you found to the user before building the spec:
   > "Your project uses `UMyPanelBase` as the root panel class (`/Script/MyGame.MyPanelBase`). I'll use that as `parent_class` and reference your existing button widget `WBP_MyButton`."

**If the project uses `CommonActivatableWidget` as its base**, keep using the discovered project base. Do not replace it with `/Script/AccelByteUITools.AGSCommonActivatableBase`; project inheritance and style-specific lifecycle behavior are authoritative. If focus behavior is missing, add it to the project base or generated subclass rather than switching parents.

**Then continue with steps 1–7** from the main workflow, substituting:
- `parent_class`: the discovered project base class (must start with `/Script/` for C++ types or use a Blueprint class path)
- `class_path` references: the project's own component widgets instead of AGSUI paths
- Naming conventions: match the project's widget naming style (e.g. if the project prefixes with `W_` instead of `WBP_AGS_`, follow that)

If the project uses vanilla UMG with no custom base class, default to `parent_class: "/Script/UMG.UserWidget"` and use standard UMG containers only.

## Script Backed Mode

Active when the user chose "Script backed" in Step 0.5. The C++ class pattern depends on the UI mode chosen in Step 0.

Because specs are flat by default (no FeatureBlock composites), every `is_variable: true` node in the spec maps directly to a scriptable native UMG type — `UListView*`, `UTextBlock*`, `UButton*` etc. This is what makes Script backed clean: the C++ class has direct, typed access to every element without casting through opaque `UUserWidget*` references.

### Common rules (all modes)

- **Class name:** `U<FeatureName>Widget` — e.g. `ULeaderboardPanelWidget`
- **API macro:** `<MODULENAME>_API` — derived from the project's `Build.cs`
- **`parent_class` in spec:** `/Script/<ModuleName>.<FeatureName>Widget` (no `U` prefix in the script path)
- Use required `BindWidget` for generated script-backed bindings. Do not use `BindWidgetOptional`.
- Generate a `UPROPERTY(... BindWidget ...)` for **every** entry returned in validation `bindings`, without exception. The old skip list (`StateSwitcher`, `IdlePanel`, etc.) only applied when the feature widget's base class was `UAGSStateWidgetBase` (which inherited those bindings). With `UUserWidget` or `UCommonActivatableWidget` as base, nothing is inherited — every variable node must be declared.

**Entry widget override parameter name:** when overriding `NativeOnListItemObjectSet`, name the parameter `InListItemObject` (not `ListItemObject`). `UAGSLabelValueWidgetBase` (transitive base of `UAGSListRowBase`) has a protected member `TObjectPtr<UObject> ListItemObject`; using the same name for the override parameter triggers C4458 and fails the build.

### Project-specific widgets — read C++ header before spec authoring

**For every spec node that will use a project-specific `class_path` (`/Game/...`), you must read the widget's C++ backing class header before choosing the spec `type`.** Use `search_source_files` or `Read` to find the `.h` file, check the `: public` chain, and record the actual C++ parent class. Do not rely on the style context `source_classes` hints alone — they list candidates, not confirmed types for a specific asset.

> **Why**: the `bindings` array from `accelbyte_ui_validate` and the bridge's `VerifyParentWidgetBindings` both derive the expected C++ type from the confirmed parent class. Guessing the wrong type generates a broken C++ header that fails bridge preflight.

**Choosing the spec `type` for project widgets:**

| Case | Spec `type` | C++ property type |
|---|---|---|
| Project button extends `UAGSButtonBase` | `AGSBaseButton` | `UAGSButtonBase*` (or subclass if desired) |
| Project button extends `UCommonButtonBase` (not `UAGSButtonBase`) | `AGSBaseButton` with explicit `class_path` | Project C++ parent (e.g. `UAccelByteWarsButtonBase*`) |
| Project/generated state panel under `/Game/...` | `UserWidget` with explicit `core_role` and `class_path` | Resolved project/native parent from `accelbyte_ui_resolve` |
| Project widget is a generic `UUserWidget` descendant | `UserWidget` with explicit `class_path` | `UUserWidget*` (or project C++ parent if more specific) |

**Bridge behavior with `class_path: "/Game/..."` (plugin v2+):** the bridge now resolves the expected C++ class by walking the Blueprint's native parent chain — it no longer hard-codes the AGS contract. If `W_MenuButton.W_MenuButton_C`'s native parent is `UAccelByteWarsButtonBase`, the bridge expects `UAccelByteWarsButtonBase*` in the C++ header, not `UAGSButtonBase*`. The `bindings` array returned by `accelbyte_ui_validate` reflects the same resolved type — use it as the source of truth for writing C++.

Example — `W_MenuButton` extends `UAccelByteWarsButtonBase : public UCommonButtonBase`:
- `"type": "AGSBaseButton", "class_path": "/Game/ByteWars/UI/W_MenuButton.W_MenuButton_C"` → bridge resolves `UAccelByteWarsButtonBase`, C++ header must use `UAccelByteWarsButtonBase*`. ✓
- `"type": "UserWidget", "class_path": "/Game/..."` → also valid; bridge resolves `UAccelByteWarsButtonBase` from parent chain. ✓

### BindWidget property type table — reference only

**Do not use this table to write C++ properties.** Use the `bindings` array returned by `accelbyte_ui_validate` as the authoritative source for every `UPROPERTY` — it gives the exact C++ type, include, and bind meta to use. This table is provided for understanding only.

**Native UMG types:**

| Spec type | C++ type | Include |
|---|---|---|
| `Button` | `UButton` | `"Components/Button.h"` |
| `TextBlock` | `UTextBlock` | `"Components/TextBlock.h"` |
| `EditableTextBox` | `UEditableTextBox` | `"Components/EditableTextBox.h"` |
| `WidgetSwitcher` | `UWidgetSwitcher` | `"Components/WidgetSwitcher.h"` |
| `ScrollBox` | `UScrollBox` | `"Components/ScrollBox.h"` |
| `ListView` | `UListView` | `"Components/ListView.h"` |
| `TileView` | `UTileView` | `"Components/TileView.h"` |
| `TreeView` | `UTreeView` | `"Components/TreeView.h"` |
| `VerticalBox` | `UVerticalBox` | `"Components/VerticalBox.h"` |
| `HorizontalBox` | `UHorizontalBox` | `"Components/HorizontalBox.h"` |
| `Image` | `UImage` | `"Components/Image.h"` |
| `Border` | `UBorder` | `"Components/Border.h"` |

**AGS Core component aliases** — all have C++ backing in the plugin. Use the typed pointer so callers can invoke the full public API:

| Spec alias | C++ type | Public API highlights |
|---|---|---|
| `AGSAvatar` | `UAGSAvatarBase` | `SetAvatarImage(UTexture2D*)`, `SetLabel()` |
| `AGSIconButton` | `UAGSIconButtonBase` | `SetIcon(UTexture2D*)`, `OnClicked` |
| `AGSBaseButton` / `AGSButton` / `AGSSecondaryButton` / `AGSDangerButton` | `UAGSButtonBase` | `OnClicked`, `SetLabel()`, `SetSelected(bool)` |
| `AGSTextInput` / `AGSPasswordInput` / `AGSSearchInput` | `UAGSTextInputBase` | `OnSubmit`, `SetLabel()`, `SetValue()` |
| `AGSStatusMessage` | `UAGSStatusMessageBase` | `SetStatus()`, `SetError()`, `SetLabel()` |
| `AGSLoadingIndicator` | `UAGSLoadingIndicatorBase` | `SetStatusText()`, `SetState()` |
| `AGSEmptyState` | `UAGSEmptyStateBase` | `SetLabel()`, `SetStatusText()`, `SetState()` |
| `AGSErrorState` | `UAGSErrorStateBase` | `SetLabel()`, `SetStatusText()`, `OnRetry`, `RetryButton` |
| `AGSModalPanel` | `UAGSActionPanelBase` | `OnConfirm`, `OnCancel`, `OnRetry` |
| `AGSBasePanel` | `UAGSBasePanelBase` | `SetLabel()`, `SetState()` |
| `AGSBadge` / `AGSCurrencyPill` / `AGSKeyValueRow` / `AGSSectionHeader` / `AGSToast` / `AGSDivider` | `UAGSLabelValueWidgetBase` | `SetLabel()`, `SetValue()` |

For all AGS Core types, add this single include (covers the entire AGS class hierarchy):
```cpp
#include "AGSUI/AGSWidgetBase.h"
```

For Mode B buttons, the `bindings` array returned by `accelbyte_ui_validate` will declare type `UAGSCommonButtonBase*` (include `"AGSUI/AGSCommonWidgetBase.h"`) and text bindings will declare `UCommonTextBlock*` (include `"CommonTextBlock.h"`). Always use the `bindings` array — do not infer types manually.

---

### Mode A (UMG) template

Header:

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
// Include headers only for types declared in UPROPERTY below
#include "<FeatureName>Widget.generated.h"

// Forward-declare only what this class adds
class UButton;
class UTextBlock;

UCLASS()
class <MODULENAME>_API U<FeatureName>Widget : public UUserWidget
{
    GENERATED_BODY()

protected:
    virtual void NativeConstruct() override;

private:
    UPROPERTY(BlueprintReadOnly, meta = (BindWidget, BlueprintProtected = true, AllowPrivateAccess = true))
    UButton* Btn_<Action>;

    UPROPERTY(BlueprintReadOnly, meta = (BindWidget, BlueprintProtected = true, AllowPrivateAccess = true))
    UTextBlock* Tb_<Label>;

    UFUNCTION()
    void On<Action>Clicked();
};
```

Source:

```cpp
#include "<FeatureName>Widget.h"
#include "Components/Button.h"
#include "Components/TextBlock.h"

void U<FeatureName>Widget::NativeConstruct()
{
    Super::NativeConstruct();

    if (Btn_<Action>)
    {
        Btn_<Action>->OnClicked.AddDynamic(this, &ThisClass::On<Action>Clicked);
    }
}

void U<FeatureName>Widget::On<Action>Clicked()
{
    // TODO: implement action logic
}
```

---

### Mode B (Common UI) template

Header:

```cpp
#pragma once

#include "CoreMinimal.h"
#include "<ProjectActivatableClass>.h"
#include "CommonTextBlock.h"
// Include headers only for types declared in UPROPERTY below
#include "<FeatureName>Widget.generated.h"

UCLASS(Abstract)
class <MODULENAME>_API U<FeatureName>Widget : public U<ProjectActivatableClass>
{
    GENERATED_BODY()

protected:
    virtual void NativeOnActivated() override;
    virtual void NativeOnDeactivated() override;

private:
    UPROPERTY(BlueprintReadOnly, meta = (BindWidget, BlueprintProtected = true, AllowPrivateAccess = true))
    UAGSCommonButtonBase* Btn_<Action>;

    UPROPERTY(BlueprintReadOnly, meta = (BindWidget, BlueprintProtected = true, AllowPrivateAccess = true))
    UCommonTextBlock* Tb_<Label>;

    UFUNCTION()
    void On<Action>Clicked();
};
```

Source:

```cpp
#include "<FeatureName>Widget.h"

void U<FeatureName>Widget::NativeOnActivated()
{
    Super::NativeOnActivated();

    if (Btn_<Action>)
    {
        Btn_<Action>->OnClicked.AddDynamic(this, &ThisClass::On<Action>Clicked);
    }
}

void U<FeatureName>Widget::NativeOnDeactivated()
{
    Super::NativeOnDeactivated();

    if (Btn_<Action>)
    {
        Btn_<Action>->OnClicked.RemoveDynamic(this, &ThisClass::On<Action>Clicked);
    }
}

void U<FeatureName>Widget::On<Action>Clicked()
{
    // TODO: implement action logic
}
```

**CommonUI button click wiring:** `UCommonButtonBase::OnButtonBaseClicked` is `protected`. Never use `AddDynamic` to bind directly to `OnButtonBaseClicked` from the panel class — it will not compile. Options:
1. Wire from the Blueprint event graph: `Btn_X` → On Clicked (BP event) → call the `BlueprintCallable` C++ stub.
2. If `UAGSCommonButtonBase` exposes a public `OnClicked` delegate, bind via `AddDynamic` on that. The `Btn_<Action>->OnClicked.AddDynamic(...)` pattern in the template above targets this delegate when available.

---

### Mode C (Follow Project) template

Use the Mode A or Mode B template that matches the base class discovered in the Mode C exploration phase. If the project's base class inherits from `UCommonActivatableWidget`, use Mode B patterns. Otherwise use Mode A patterns.

---

## Widget Spec Structure

```json
{
  "asset_path": "/Game/AGS/UI/Generated/WBP_AGS_<Name>",
  "parent_class": "/Script/AccelByteUITools.AGSPanelBase",
  "root": { ... }
}
```

- `asset_path` must be under `/Game/AGS/UI/Generated/` for generated project widgets, or `/AccelByteUITools/AGSUI/` for plugin content.
- `/Game/AGS/UI/Generated/` is Unreal's virtual content path. On disk, generated UI assets appear under `<project-root>/Content/AGS/UI/Generated/`.
- `parent_class` defaults to `AGSPanelBase` for widget-only UMG panel recipes. Script-backed widgets must use `/Script/<ModuleName>.<FeatureName>Widget`; Common UI / Follow Project widgets must use the approved project base class.

## Default placement

Use these defaults when the user does not specify placement:

- **C++ backing class:** `<project-root>/Source/<ModuleName>/AGS/UI/Generated/<Feature>/`
- **Generated UI asset:** `/Game/AGS/UI/Generated/WBP_AGS_<Name>` (Unreal virtual path; on disk this is `<project-root>/Content/AGS/UI/Generated/`)
- **Generated/temp spec:** `<project-root>/Saved/Generated/Spec/<AssetName>.json`

User-specified paths win over these defaults when they are inside the target project and compatible with Unreal content/module conventions. Existing committed recipe/spec fixtures under `Plugins/AccelByteUITools/Tools/specs/` are reusable generator inputs, not generated/temp request specs.

## Flat Spec Composition Guide

All interactive and data-bearing content must stay flat in the widget hierarchy and use approved project roles first. The table below shows how to compose common features; replace the generic `Button`, `TextBlock`, and row entries with discovered project class/style references from `enforced_roles` when available. The success state always contains flat content; loading/idle/empty/error states may use AGS Core presentational atoms when the project has no equivalent.

### State wrapper pattern (all modes)

Every generated panel must follow this exact root hierarchy — enforced by `accelbyte_ui_validate`:

```json
{
  "type": "Border",
  "name": "PanelBackground",
  "style": { "background_color": [1.0, 1.0, 1.0, 1.0], "corner_radius": 8, "border_color": [0.84, 0.87, 0.92, 1.0], "border_width": 1 },
  "children": [
    {
      "type": "Overlay",
      "name": "ContentContainer",
      "padding": [20, 20, 20, 20],
      "slot": { "h_align": "fill", "v_align": "fill" },
      "children": [
        {
          "type": "WidgetSwitcher",
          "name": "StateSwitcher",
          "is_variable": true,
          "slot": { "h_align": "fill", "v_align": "fill" },
          "children": [
            { "type": "AGSStatusMessage",    "name": "IdlePanel",    "is_variable": true, "class_path": "<core_component_roles.state_idle.resolved>" },
            { "type": "AGSLoadingIndicator", "name": "LoadingPanel", "is_variable": true, "class_path": "<core_component_roles.state_loading.resolved>" },
            { "type": "VerticalBox", "name": "SuccessPanel", "is_variable": true, "slot": { "h_align": "fill", "v_align": "fill" }, "children": [ /* flat native content — see feature table */ ] },
            { "type": "AGSEmptyState",       "name": "EmptyPanel",   "is_variable": true, "class_path": "<core_component_roles.state_empty.resolved>" },
            { "type": "AGSErrorState",       "name": "ErrorPanel",   "is_variable": true, "class_path": "<core_component_roles.state_error.resolved>" }
          ]
        }
      ]
    }
  ]
}
```

The `Border (PanelBackground)` is always the root — it provides the visual card background. The `Overlay (ContentContainer)` is its only child and holds all generated content with a fill slot and 20px padding on all sides. Every direct child of ContentContainer must also have `slot: { h_align: fill, v_align: fill }`. This structure is validated and cannot be bypassed; alternate names such as `WidgetBackground` or `WidgetContainer` are invalid for generated panels.

### Feature composition — success state content

Fill `SuccessPanel`'s children with flat elements. Treat `Button` and `TextBlock` below as semantic placeholders: use project button widgets/styles and `button_style_class` / `text_style_class` whenever discovery found them.

| Feature | Structure inside SuccessPanel | Key `is_variable: true` elements |
|---|---|---|
| **Leaderboard** | `TextBlock` (title) + `ListView` (rows) | `ListView` + `TextBlock` |
| **Friends list** | `TextBlock` (title) + `ListView` (rows) + `HorizontalBox` > `Button` (add) | `ListView`, `Button` |
| **Party** | `TextBlock` (party name) + `ListView` (members) + `HorizontalBox` > [`Button` (invite), `Button` (leave)] | `ListView`, `Button` × 2 |
| **Login** | `TextBlock` (title) + `EditableTextBox` (username) + `EditableTextBox` (password) + `Button` (submit) + `TextBlock` (error) | `EditableTextBox` × 2, `Button`, `TextBlock` (error) |
| **Store / item grid** | `TextBlock` (title) + `TileView` (items) | `TileView` |
| **Achievements** | `TextBlock` (title) + `TileView` (cards) | `TileView` |
| **Session browser** | `HorizontalBox` > [`EditableTextBox` (search), `Button` (filter)] + `ListView` (sessions) | `ListView`, `EditableTextBox`, `Button` |
| **Wallet / balance** | `TextBlock` (label) + `TextBlock` (amount) + `TextBlock` (currency) | `TextBlock` × 2–3 |
| **Matchmaking status** | `TextBlock` (status) + `TextBlock` (elapsed time) + `Button` (cancel) | `TextBlock` × 2, `Button` |
| **Notifications** | `TextBlock` (title) + `ListView` (rows) | `ListView` |
| **Cloud save slots** | `TextBlock` (title) + `ListView` (slots) + `HorizontalBox` > [`Button` (save), `Button` (load), `Button` (delete)] | `ListView`, `Button` × 3 |
| **Entitlements** | `TextBlock` (title) + `ListView` (rows) | `ListView` |
| **Generic async action** | `TextBlock` (title) + `TextBlock` (status) + `HorizontalBox` > [`Button` (confirm), `Button` (cancel)] | `TextBlock` × 2, `Button` × 2 |
| **Stats summary** | `TextBlock` (title) + repeated `HorizontalBox` > [`TextBlock` (stat label), `TextBlock` (value)] | `TextBlock` × N |

### ListView / TileView slot — required fill

Every ListView, TileView, or TreeView node placed inside a VerticalBox or HorizontalBox **must** include a fill slot so the list takes up the remaining bounded space rather than auto-expanding to fit all items (which prevents scrolling):

```json
{
  "type": "ListView",
  "name": "Lv_MyList",
  "is_variable": true,
  "slot": {
    "size": { "fill": 1.0 },
    "h_align": "fill"
  },
  "entry_widget_class": "..."
}
```

Without `"size": {"fill": 1.0}`, the slot defaults to `Auto` and the list grows infinitely — items overflow the panel and the scrollbar never appears. Always include this slot on collection nodes.

### ListView / TileView entry_widget_class

Before setting `entry_widget_class` for any ListView, TileView, or TreeView node, call `accelbyte_ui_list_entry_candidates` to get project-compatible row widgets from the approved style context. For generated project widgets under any `/Game/.../UI/Generated/` path, use the first recipe-compatible entry in `compatible_candidates`; AGSUI fallback rows/cards are not valid for generated project widgets and will be rejected by `accelbyte_ui_validate`.

If `compatible_candidates` is empty, stop and tell the user which project entry widget must be created or updated to implement `IUserObjectListEntry` before proceeding. Do not substitute a `ScrollBox` or AGSUI row/card.

**Plugin base classes and `list_entry_compatible` detection:** `style-discover` flags a C++ class as `list_entry_compatible` by scanning for the literal text `IUserObjectListEntry` in the project's `.h` files. Plugin base classes (`UAGSListRowBase`, `UAGSLabelValueWidgetBase`) are pre-seeded automatically. If a project entry class is not flagged (shows `collection_entry_parent_required`), add `#include "Blueprint/IUserObjectListEntry.h"` to its header, then rerun `style-discover --approve`. The literal include string in the project header is what triggers the scanner.

Do not use a random compatible project entry for a feature-specific recipe. If the request is "leaderboard", generate or choose a leaderboard entry containing bindable rank, player/name, and score widgets. If the request is "store catalogue", generate or choose a store item card containing item/name and price/cost widgets. For achievements, include title/name plus progress/status. The entry should adapt the approved project style, but its content contract comes from the selected AGS recipe.

When generating a new entry/card widget, create or reuse the `IUserObjectListEntry` C++ parent first, set the entry spec's `parent_class` to that class, generate the entry Blueprint, then refresh/approve style context so the entry appears in `compatible_candidates`. The main widget's collection node must use the normalized `entry_widget_class`; this is what lets the bridge set Unreal's `EntryWidgetClass` property automatically. Manual editor wiring is a failure of the flow, not an expected step.

Project list row widgets from `enforced_roles.list_row.project_candidates` are mandatory when present. The AGS list row widgets below are legacy/non-generated references only; do not use them in `/Game/AGS/UI/Generated/` specs:

| Use case | entry_widget_class |
|---|---|
| Generic / players | `/AccelByteUITools/AGSUI/Lists/WBP_AGS_PlayerRow.WBP_AGS_PlayerRow_C` |
| Leaderboard | `/AccelByteUITools/AGSUI/Lists/WBP_AGS_LeaderboardRow.WBP_AGS_LeaderboardRow_C` |
| Friends | `/AccelByteUITools/AGSUI/Lists/WBP_AGS_FriendRow.WBP_AGS_FriendRow_C` |
| Sessions | `/AccelByteUITools/AGSUI/Lists/WBP_AGS_SessionRow.WBP_AGS_SessionRow_C` |
| Entitlements | `/AccelByteUITools/AGSUI/Lists/WBP_AGS_EntitlementRow.WBP_AGS_EntitlementRow_C` |
| Notifications | `/AccelByteUITools/AGSUI/Lists/WBP_AGS_ListRow.WBP_AGS_ListRow_C` |
| Cloud save | `/AccelByteUITools/AGSUI/Lists/WBP_AGS_CloudSaveSlotRow.WBP_AGS_CloudSaveSlotRow_C` |
| Store items | `/AccelByteUITools/AGSUI/FeatureBlocks/WBP_AGS_StoreItemCard.WBP_AGS_StoreItemCard_C` |
| Achievements | `/AccelByteUITools/AGSUI/FeatureBlocks/WBP_AGS_AchievementCard.WBP_AGS_AchievementCard_C` |

## Widget Node Format

Each node in the `root` tree:

```json
{
  "type": "VerticalBox",
  "name": "MyStack",
  "is_variable": true,
  "slot": { "position": [64, 64], "size": [720, 360] },
  "text": "Label text",
  "class_path": "/AccelByteUITools/AGSUI/Core/WBP_AGS_BaseButton.WBP_AGS_BaseButton_C",
  "button_style_class": "/Game/UI/Styles/B_PrimaryButtonStyle.B_PrimaryButtonStyle_C",
  "text_style_class": "/Game/UI/Styles/B_BodyTextStyle.B_BodyTextStyle_C",
  "children": []
}
```

## UX Pattern Rules

### Game UI pattern selection

For generic multiplayer/game UI requests, choose the closest known game UI archetype before composing raw containers:

| User intent | Preferred structure |
|---|---|
| Season pass / battle pass | Progress header + horizontal reward track. Use free/premium lanes and `TileView` reward cards instead of a vertical list. |
| Guild / clan management | Tabbed management panel with roster, requests, roles, activity, and a member detail area. Use `ListView` for roster/request data. |
| News feed / announcements / patch notes | Featured announcement block above a `ListView` of article rows/cards. |
| Tournament / bracket | Horizontal round columns with match cards. Do not render brackets as one flat vertical list. |
| Lobby browser / server browser / custom rooms | Filter/search controls above a `ListView` of joinable sessions. |
| Party finder / invite inbox | `ListView` rows with player/avatar/status/action affordances. |
| Squad loadout / cosmetics / inventory cards | `TileView` or `WrapBox` card grid; use `TileView` when runtime data-backed. |
| Quest / challenge / mission board | Card grid or grouped `ListView`; highlight active/claimable state. |
| Social hub / voice channels | Tabbed panel; channel/member lists use `ListView` or `TreeView` when hierarchical. |
| Match summary / battle report / team scoreboard | Split score summary + ranked/stat rows; use `ListView` for player rows. |
| Player profile | Summary header + stats/recent activity/detail sections. |
| Report player / moderation | Modal or split form with reason selection and confirm/cancel actions. |

Only use `ags_generic_async_panel.json` for true async/status operations such as export, delete, sync, refresh, upload, submit, or one-shot service calls. Do not use it for complete game screens.

### Native collection widgets

Use Unreal-native collection widgets for runtime data-backed lists:

- Use `ListView` for rosters, feeds, inboxes, servers, friends, guild members, reports, match result rows, and row-based inventories.
- Use `TileView` for reward cards, store items, achievements, cosmetics, loadouts, season pass tiers, and selectable card grids.
- Use `TreeView` only for hierarchical data such as voice channels, nested guild roles, category trees, or settings groups.
- Use `ScrollBox` only for small fixed content, static mockups, or non-data-backed content.
- Use `WrapBox`/`UniformGridPanel` for static card previews or when the widget does not need runtime item virtualization.

Collection widget nodes must include:

```json
{
  "type": "ListView",
  "name": "RosterListView",
  "is_variable": true,
  "entry_widget_class": "/Game/UI/Lists/WBP_ProjectPlayerEntry.WBP_ProjectPlayerEntry_C",
  "selection_mode": "single",
  "preview_entries": [{ "name": "Player 1" }]
}
```

`entry_widget_class` is required and must use `/Root/Path/Asset.Asset_C` form. `selection_mode` can be `none`, `single`, or `multi`. `orientation` can be `horizontal` or `vertical` for card/tile collections. `preview_entries` is design-time metadata only; populate real items from the backing widget class at runtime.

### Text — theme-normalized color

Generated AGS specs are normalized through `theme_tokens.json`. You may omit `TextBlock.style.color`; validation/generation will fill `colors.text.primary`. If you provide a color manually, it must match the token exactly.

```json
{ "type": "TextBlock", "name": "TitleText", "text": "Leaderboard" }
```

### Input fields ? readable light surface

AGS text, password, and search inputs use a white input background, black typed text, and gray placeholder text:

```json
{
  "type": "EditableTextBox",
  "name": "ValueInput",
  "hint_text": "Search"
}
```

The validate/generate tools apply the full `input` preset and control padding before the spec reaches Unreal.

### Static scrollable list (leaderboard, friends, sessions, party, cloud save)

Use `ScrollBox` as the list container with row children via `class_path` only for fixed/static preview content. Never use a plain `VerticalBox` as a list body — it has no scroll behavior. Prefer `ListView` for runtime data-backed rows.

```json
{
  "type": "ScrollBox",
  "name": "ListBody",
  "is_variable": true,
  "children": [
    { "type": "LeaderboardRow", "name": "LeaderboardRow_1", "class_path": "/AccelByteUITools/AGSUI/Lists/WBP_AGS_LeaderboardRow.WBP_AGS_LeaderboardRow_C" },
    { "type": "LeaderboardRow", "name": "LeaderboardRow_2", "class_path": "/AccelByteUITools/AGSUI/Lists/WBP_AGS_LeaderboardRow.WBP_AGS_LeaderboardRow_C" },
    { "type": "LeaderboardRow", "name": "LeaderboardRow_3", "class_path": "/AccelByteUITools/AGSUI/Lists/WBP_AGS_LeaderboardRow.WBP_AGS_LeaderboardRow_C" }
  ]
}
```

### Grid (achievements, store items)

Use `TileView` for runtime data-backed grids. The `entry_widget_class` must be a compatible project-owned entry/card widget; C++ sets items via `SetListItems()`. Vertical `TileView` collections are clipped by the generator so overflow items remain inside the TileView bounds; do not replace them with `WrapBox`/`ScrollBox` to hide overflow.

```json
{
  "type": "TileView",
  "name": "AchievementGrid",
  "is_variable": true,
  "entry_widget_class": "/Game/UI/Cards/WBP_ProjectAchievementCard.WBP_ProjectAchievementCard_C",
  "orientation": "horizontal",
  "entry_width": 200,
  "entry_height": 200,
  "preview_entries": [{ "name": "Achievement 1" }, { "name": "Achievement 2" }]
}
```

### Tab view

Inside the required `Border (PanelBackground)` → `Overlay (ContentContainer)` root, use a `VerticalBox` success/content panel with a `HorizontalBox` tab bar and a `WidgetSwitcher` content area. Use an approved project tab button widget or project tab button style. If none exists, stop and create/generate that project-style tab button component before the main tabbed widget; do not fall back to `AGSSecondaryButton` for generated project widgets. Call `SetSelected(true/false)` only when the resolved button class exposes that API; otherwise use the project button's confirmed C++/Blueprint selection API. Wire tab button activation to `WidgetSwitcher.SetActiveWidgetIndex()` in C++/Blueprint.

```json
{
  "type": "Border",
  "name": "PanelBackground",
  "children": [
    {
      "type": "Overlay",
      "name": "ContentContainer",
      "padding": [20, 20, 20, 20],
      "slot": { "h_align": "fill", "v_align": "fill" },
      "children": [
        {
          "type": "VerticalBox",
          "name": "SuccessPanel",
          "is_variable": true,
          "slot": { "h_align": "fill", "v_align": "fill" },
          "children": [
            { "type": "HorizontalBox", "name": "TabBar", "is_variable": true, "children": [] },
            { "type": "WidgetSwitcher", "name": "TabContent", "is_variable": true, "children": [] }
          ]
        }
      ]
    }
  ]
}
```

### Tab view (pre-built social panel)

For a social tab view with Friends, Party, and Notifications tabs, use `select_ags_recipe('tab view')` which returns `ags_tabbed_social_panel.json` — a real `WidgetSwitcher` recipe with `AGSSecondaryButton` tab buttons. Wire `Btn_FriendsTab->OnClicked` / `Btn_PartyTab->OnClicked` / `Btn_NotificationsTab->OnClicked` to `TabbedSocial_ContentSwitcher->SetActiveWidgetIndex()`. Call `SetSelected(true)` on the active tab button and `SetSelected(false)` on the others each time the tab changes.

### Async action panel (matchmaking, login, cloud save)

Use `select_ags_recipe` - it returns a recipe with a `Border` root (`PanelBackground`) containing an `Overlay` (`ContentContainer`, padding 20, fill) which holds a `WidgetSwitcher` named `StateSwitcher`. Its children are ordered `Idle`, `Loading`, `Success`, `Empty`, `Error` so `UAGSStateWidgetBase.SetState()` can switch states directly. `UAGSStateWidgetBase` defaults to `Success`, and `SetLoading(false)` returns to `Success`, so generated widgets preview usable content by default.

### Root layout — Border always first

`Border (PanelBackground)` is always the root for generated panels. Its only child is `Overlay (ContentContainer)` with `padding: [20, 20, 20, 20]` and a fill slot — this is where all generated content lives. Use `CanvasPanel` only when coordinate or anchor placement is truly needed (HUD overlays, minimap regions, precise floating widgets) and the spec does not go through `accelbyte_ui_validate` with AGS policy.

When you do use `CanvasPanel`, children should use anchor-based slots so the layout adapts to any panel size. When `offsets` is present, UE5 uses stretch-anchor geometry and ignores `position`/`size`.

**Common anchor patterns:**

Full-stretch (fills entire canvas):
```json
"slot": { "anchors": [0, 0, 1, 1], "offsets": [0, 0, 0, 0], "alignment": [0, 0] }
```

Content area (top 82% of panel):
```json
"slot": { "anchors": [0, 0, 1, 0.82], "offsets": [0, 0, 0, 0], "alignment": [0, 0] }
```

Status strip (bottom 18%):
```json
"slot": { "anchors": [0, 0.82, 1, 1], "offsets": [0, 0, 0, 0], "alignment": [0, 0] }
```

Centered self-sized widget (loading indicator, empty state):
```json
"slot": { "anchors": [0.5, 0.87, 0.5, 0.87], "offsets": [0, 0, 0, 0], "alignment": [0.5, 0.5], "auto_size": true }
```

Centered panel with horizontal margins (login, modal):
```json
"slot": { "anchors": [0.1, 0.05, 0.9, 0.82], "offsets": [0, 0, 0, 0], "alignment": [0, 0] }
```

Legacy fixed-position (still supported, but not responsive):
```json
"slot": { "position": [64, 64], "size": [720, 360] }
```

Note: `offsets` is required when anchors are stretched (min ≠ max on either axis). `position`+`size` still work for point-anchor widgets.

### Modals / confirmations

Use `WBP_AGS_ModalPanel` via `class_path`:
```
/AccelByteUITools/AGSUI/Core/WBP_AGS_ModalPanel.WBP_AGS_ModalPanel_C
```

## Stable widget names (do not rename)

These names are bound in C++ and Blueprint base classes. Always use them exactly:

| Widget | Purpose |
|--------|---------|
| `ButtonText` | Text label inside AGS button |
| `LabelText` | Primary label in rows and blocks |
| `ValueText` | Secondary value in key-value rows |
| `ValueInput` | EditableTextBox in input widgets |
| `SubmitButton` | Primary action button |
| `ConfirmButton` | Confirm action in dialogs |
| `CancelButton` | Cancel action in dialogs |
| `RetryButton` | Retry after error |
| `StateSwitcher` | Preferred top-level recipe state switcher |
| `IdlePanel` | Idle state container |
| `LoadingPanel` | Loading state container |
| `SuccessPanel` | Success/data state container |
| `EmptyPanel` | Empty state container |
| `ErrorPanel` | Error state container |

For AGS focused base classes, these stable binding names are required whenever that base class owns runtime behavior. For example, `UAGSButtonBase` requires `InteractiveButton` and `ButtonText`, `UAGSTextInputBase` requires `ValueInput`, and `UAGSActionPanelBase` requires an action binding such as `ConfirmButton`, `CancelButton`, or `RetryButton`.

## Supported widget types

**Containers**: `CanvasPanel`, `Overlay`, `VerticalBox`, `HorizontalBox`, `SizeBox`, `Border`, `Button`, `SafeZone`, `ScaleBox`, `ScrollBox`, `ListView`, `TileView`, `TreeView`, `WidgetSwitcher`, `UniformGridPanel`, `WrapBox`

**Leaves**: `TextBlock`, `EditableTextBox`, `Image`, `Spacer`

**Custom**: any `class_path` reference to a project or plugin widget

**AGS component aliases** — the generator resolves these type names to plugin assets automatically. Only Core state atoms and list rows are permitted; FeatureBlock aliases are prohibited (see Flat Spec Composition Guide):

| Category | Types |
|----------|-------|
| State / feedback | `AGSLoadingIndicator`, `AGSStatusMessage`, `AGSEmptyState`, `AGSErrorState`, `AGSToast` |
| Atoms | `AGSBadge`, `AGSAvatar`, `AGSDivider`, `AGSCurrencyPill`, `AGSSectionHeader`, `AGSKeyValueRow` |
| Buttons | `AGSBaseButton`, `AGSButton`, `AGSSecondaryButton`, `AGSDangerButton`, `AGSIconButton` |
| Inputs | `AGSTextInput`, `AGSPasswordInput`, `AGSSearchInput` |
| Panels | `AGSBasePanel`, `AGSModalPanel` |
| List rows | `AGSListRow`, `AGSPlayerRow`, `AGSLeaderboardRow`, `AGSEntitlementRow`, `AGSFriendRow`, `AGSPartyMemberRow`, `AGSBlockUserRow`, `AGSCloudSaveSlotRow`, `AGSSessionRow`, `AGSIncomingFriendRow` |
| Cards | `AGSAchievementCard`, `AGSStoreItemCard` |
| ~~Feature blocks~~ | ~~`AGSLoginBlock`, `AGSAccountLinkBlock`, `AGSSessionExpiredBlock`, `AGSMatchmakingStatusBlock`, `AGSWalletBalanceBlock`, `AGSGenericAsyncActionBlock`, `AGSFriendsListBlock`, `AGSPartyBlock`, `AGSSessionBrowserBlock`, `AGSLeaderboardBlock`, `AGSNotificationListBlock`, `AGSEntitlementsBlock`, `AGSCloudSaveSlotsBlock`, `AGSStatsSummaryBlock`, `AGSAchievementGridBlock`, `AGSStoreGridBlock`~~ — **do not use** |

## Generated asset paths

- Project-generated UI: `/Game/AGS/UI/Generated/WBP_AGS_<Name>`
- Project-generated UI on disk: `<project-root>/Content/AGS/UI/Generated/`
- Generated/temp specs: `<project-root>/Saved/Generated/Spec/<AssetName>.json`
- Script backed C++ default: `<project-root>/Source/<ModuleName>/AGS/UI/Generated/<Feature>/`
- Plugin content references: `/AccelByteUITools/AGSUI/Core/WBP_AGS_<Name>`
- Plugin FeatureBlocks: `/AccelByteUITools/AGSUI/FeatureBlocks/WBP_AGS_<Name>`
- Plugin list rows: `/AccelByteUITools/AGSUI/Lists/WBP_AGS_<Name>`

Mark all data-bound and interactive widgets `is_variable: true` so they are accessible from Blueprint code.

---

## Validation Layers Reference

The widget generator has four distinct validation layers that run in sequence. Each has different error codes and different fix strategies.

| Layer | When it runs | What it checks | Error codes |
|---|---|---|---|
| `accelbyte_ui_validate` | Pre-generation (Python) | Spec schema, style context, binding metadata, state contract | `schema_error`, `text_style_requires_common_text_block`, `state_contract_error`, `style_context_approval_required` |
| `accelbyte_ui_verify_backing_class` | Pre-compile (Python) | C++ header property names, types, and bind meta vs spec bindings | `backing_binding_mismatch` |
| Bridge backing check (C++) | During generation | C++ class reflection vs spec's `expected_property_class` and `bind_meta` | `backing_binding_mismatch`, `project_button_required`, `verify_failed` |
| Blueprint compiler | After generation | Placed widget type vs C++ `BindWidget` property type | Unreal compile errors in editor |

**When layers 3 and 4 contradict:** the root cause is always a spec `type` whose binding contract maps to an AGS class that the placed project widget does not extend. Resolution: change spec `type` to `UserWidget` — see [Project button widgets — spec type vs class_path](#project-specific-widgets--read-c-header-before-spec-authoring).

---

## Error Code Reference

| Code | Layer | Cause | Fix |
|---|---|---|---|
| `style_context_approval_required` | Python pre-gen | Style context fingerprint stale (after Build.bat or after a new asset was generated) | `accelbyte_ui_generate` auto-approves by default. If calling `accelbyte_ui_validate` directly via CLI, run `style-discover --approve` first. |
| `populate_failed: not a Common UI text block` | Bridge | `TextBlock` has `text_style_class` but missing `class_path: /Script/CommonUI.CommonTextBlock` | Python validator auto-injects this. If it still occurs, add `"class_path": "/Script/CommonUI.CommonTextBlock"` to the node |
| `backing_binding_mismatch` (bind meta) | Bridge | C++ has `BindWidgetOptional`, spec contract expects `BindWidget` | Change C++ to `BindWidget`, or add `"optional_binding": true` to the spec node |
| `backing_binding_mismatch` (class) | Bridge | C++ property type doesn't match spec's expected class | Read the project widget's C++ header — use the confirmed native parent class as the C++ property type. See [Project-specific widgets](#project-specific-widgets--read-c-header-before-spec-authoring). |
| `verify_failed` | Bridge post-gen | Placed widget class not in expected AGS C++ hierarchy | Expected for project widgets. If `verified_widget_count` matches expected widget count, the blueprint was generated successfully. Do not switch project widgets to AGSUI fallbacks in response to this. |
| `project_button_required` | Bridge | `AGSBaseButton` node has no `class_path` in a project requiring project buttons | Add `"class_path"` pointing to the project button asset, or change spec `type` to `UserWidget` |
| `stale_live_coding` | Bridge | New `UCLASS` compiled via Live Coding instead of Build.bat | Run a full `Build.bat` rebuild — Live Coding cannot register new `UCLASS` types |
| `text_style_requires_common_text_block` | Python validate | `TextBlock` with `text_style_class` missing CommonTextBlock `class_path` | Python validator auto-injects `"class_path": "/Script/CommonUI.CommonTextBlock"`. If this surfaces, do not remove `text_style_class` — add the `class_path` |

