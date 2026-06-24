---
last-verified: 2026-06-09
sources:
- https://docs.unity3d.com/6000.0/Documentation/Manual/UI-system-compare.html
- https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html
see-also:
- '[unity.md](../../unity.md)'
- '[generate-ui.md](../../../../../subskills/generate-ui.md)'
---

# Unity UI Generation

Generate project-owned TMP/uGUI prefabs with optional C# backing classes through the
AccelByte Unity MCP server and its embedded `com.accelbyte.ui-tools` package.

## Plugin Safety

NEVER modify, patch, or edit any of the following during a UI generation session:

- `Packages/com.accelbyte.ui-tools/` â€” the Unity UI Tools package (C# Editor and Runtime source)
- Any Python file in the accelbyte-unity-mcp server (e.g. `unity_ui_tools.py`, `server.py`)
- Any skill or reference markdown in `ab-external-marketplace/content/`

These are stable infrastructure files owned by the AccelByte SDK team. They are not edited during user sessions. Allowed write targets are:

- `Assets/AGS/Spec/*.recipe.json` â€” widget specs
- `Assets/AGS/Scripts/<Feature>/*.cs` â€” C# backing class files
- `ProjectSettings/AccelByteUITools/` â€” style context and approval files (written by MCP tools only, not directly by Claude)

If `unity_ui_validate`, `unity_ui_resolve`, or `unity_ui_generate` returns an error that cannot be resolved by editing the widget spec JSON or the C# backing class, report the exact error message and error code to the user and stop. Do not attempt to fix MCP tool bugs or validation logic by editing plugin Python or C# files.

## Workflow

### Step 0 â€” Confirm project and editor

1. Verify `Assets/` and `ProjectSettings/ProjectVersion.txt` exist. Check `Packages/manifest.json` for a `com.accelbyte.ui-tools` key in `dependencies`. If absent, follow the install step in `references/sdks/game-engine/unity/mcp.md` before continuing — Unity Package Manager resolves the package automatically after the manifest is updated.
2. Call `unity_editor_status`. If the matching Unity editor is missing, stop and report the required version. If the editor is open, confirm the bridge health response includes `"ok": true`.

### Step 1 â€” Style discovery and approval

Call `unity_ui_style_discover` with `approve: true` directly.

If the response has `style_mode: “ags”` and `confidence: “low”` (no project UI prefabs found), approval is complete — proceed immediately to Step 1.5. There is nothing for the user to review in AGS mode.

If the response has `style_mode: “project”` or `confidence` is `”medium”` or `”high”`, present the full result to the user before proceeding:

- **`confidence`**: `high` (panel + primary_button + list_row found), `medium` (partial), `low` (no project prefabs â€” AGS kit fallback will be used).
- **`enforced_roles`**: Per semantic role, shows `resolved` prefab path and `resolution_tier` (`project` or `fallback`). Show which roles resolved to project prefabs and which fell back to the AGS kit.
- **`theme_tokens`**: Extracted project colors, spacing, and typography. When present they override AGS defaults in the spec's `style` block.
- **`warnings`** and **`unresolved_ambiguities`**: Flag roles with multiple candidates or missing prefabs.

The single `approve: true` call both discovers and approves. Do not call `unity_ui_style_discover` twice in sequence.

### Step 1.5 â€” Resolve project component candidates

Immediately after style approval, read `enforced_roles` from the returned style context. For each role the upcoming widget will use, determine the resolution tier:

- **Tier 1 (project-discovered)**: `resolution_tier: "project"` is set â†’ use that prefab path directly in the spec.
- **Tier 2 (project-generated)**: a previously generated prefab exists under `Assets/AGS/UI/Components/` â†’ use that path.
- **Tier 3 (kit fallback)**: `resolution_tier: "fallback"` â†’ use the AGS kit prefab from `Packages/com.accelbyte.ui-tools/`.

For every required generated role (`state_container`, `tab_button`, semantic buttons, or semantic inputs used by the upcoming widget) that resolves to Tier 3 and the resolved `style_mode` is `project`, call `unity_ui_project_components_generate` for all unresolved roles in a single call before recipe selection:

```
unity_ui_project_components_generate(projectPath, roles=["state_container", "tab_button", "text_input", "password_input", "primary_button"])
```

Wait for `ok: true` before proceeding, then call `unity_ui_style_discover(projectPath, approve=true)` to refresh `enforced_roles`, `prefab_role_tiers`, and `prefab_role_sources`. If the bridge is unavailable, list the unresolved Tier 3 roles and ask: "Wait for the bridge to come up, or continue with AGS kit fallbacks?" Do not proceed to Step 2 in project style until all required generated roles are Tier 1, Tier 2, or the user explicitly approves kit fallbacks.

In `ags` style mode, Tier 3 kit fallbacks are valid â€” do not call `unity_ui_project_components_generate`.

### Step 2 â€” Select recipe

Call `unity_ui_select_recipe(feature, projectPath)`.

The tool returns:
- **`recipe_spec`** â€” the full bundled recipe for reference
- **`spec_stub`** â€” a partial `ags-ui-recipe` JSON ready to be written to disk
- **`spec_write_path`** â€” where to write it (e.g. `Assets/AGS/Spec/PF_AGS_LoginPanel.recipe.json`)

Write `spec_stub` to `spec_write_path` using the Write tool.

### Step 3 â€” Author the recipe spec

Customize the written `ags-ui-recipe` JSON for the feature:

- Edit the `root` node tree to match what the screen actually needs â€” add, remove, or rename nodes.
- Do **not** add a `style` key unless the user has specified custom font assets â€” `unity_ui_resolve` fills in the resolved style automatically. **Exception:** if the user requested specific font paths (e.g. `"Assets/UI/Font/Orbitron/Orbitron SDF.asset"`), add a `style.typography` block to **every** spec in the session, including entry and row specs. Omitting it from any spec causes that prefab to silently fall back to the project theme font rather than the user's requested font. See the Font override section for the exact block format.
- Keep `schema: "ags-ui-recipe"` unchanged.

**Panel title text:** Do not add a `TitleText` node to panel recipe specs. The panel template (`PF_AB_Panel.prefab`) already provides a `LabelText` node that the generator populates at build time with the panel title. To control the title font, add `"title_font_asset": "<path>"` to the spec's `style.typography` block â€” the generator applies it to `LabelText` during generation. Entry specs (individual list rows, cards) are unaffected by this rule.

**Entry-first rule:** whenever the main widget contains one or more collections, all required entry prefabs must be fully generated **before** composing or validating the main widget spec. Freshly-generated entry prefabs in `Assets/AGS/UI/Generated/` are automatically discoverable as `compatible_candidates` when resolving the parent panel spec â€” no extra `unity_ui_style_discover` call is needed between generation steps. Generate and compile all required entry prefabs together if the main widget needs multiple collections with different entry types.

**Before authoring any collection:** call `unity_ui_list_entry_candidates(projectPath)` first to confirm what is available.

- Check whether any `compatible_candidates` match the recipe's content contract for the feature. A generic `PF_AB_ListRow` is invalid for a feature-specific collection (leaderboard, store, friends, achievements, etc.).
- If a recipe-compatible entry exists in `compatible_candidates` â†’ use it; skip the Generate entry prefab sub-workflow below.
- If no compatible entry exists â†’ run the **Generate entry prefab** sub-workflow:

  **a.** Call `unity_ui_kit_inspect(projectPath, role="<recipe_role>")` to find the closest AGS kit entry for the feature (e.g. `PF_AB_LeaderboardRow` for leaderboard). Use it as a style and component reference â€” do not copy it verbatim; adapt field names and layout to project theme tokens.

  **b.** Author a minimal entry recipe spec (`ags-ui-recipe`) for the row or card. Entries are compact prefabs with a simple `root` containing the bindings the entry needs. Write to `Assets/AGS/UI/Generated/Specs/<Feature>Entry.recipe.json`.

  Feature-specific content contracts:
  | Feature | Required `fields` |
  |---|---|
  | leaderboard row | `rank`, `player_name`, `score` |
  | friends row | `display_name`, `status` |
  | party member row | `display_name`, `status`, `is_leader` |
  | store card | `item_name`, `price`, `currency_icon` |
  | achievement card | `title`, `progress_text` |
  | notification row | `title`, `timestamp` |
  | session row | `session_name`, `player_count`, `region` |
  | cloud save slot row | `slot_name`, `saved_at` |
  | entitlement row | `item_name`, `type` |

  **c.** Call `unity_ui_validate(projectPath, entrySpecPath)` â€” fix all errors.

  **d.** Call `unity_ui_resolve(projectPath, entrySpecPath)` to get `cs_bindings` for the entry.

  **e.** Write a C# backing class for the entry using the same rules as Step 6:
  - Class name: `AGS<Feature>EntryView` (e.g. `AGSLeaderboardEntryView`)
  - Base class: `AGSViewBase`
  - One `[SerializeField]` per `cs_bindings` entry
  - Output path: `Assets/AGS/Scripts/<Feature>/AGS<Feature>EntryView.cs`

  **f.** Call `unity_ui_verify_backing_class(projectPath, entrySpecPath, entryClassPath)`. Fix any mismatches before continuing.

  **g.** Call `unity_trigger_recompile`. Poll `unity_ui_bridge_health` until `isCompiling: false`. Fix any `compileErrors` in the generated entry class (follow Step 7a rules). Do not proceed until errors are empty.

  **h.** Call `unity_ui_generate(projectPath, entrySpecPath)` to create the entry prefab.

  **i.** Call `unity_ui_style_discover` with `approve: true` to refresh the style context.

  **j.** Call `unity_ui_list_entry_candidates(projectPath, screen="<feature>")` again and confirm the new entry appears in `compatible_candidates`. If the feature-specific entry does not appear, stop and report â€” do not fall back to a generic entry.

**After entry is confirmed:** populate `preview_items` on each collection entry in the main recipe spec. These become visible as sample rows in the Unity Editor's prefab view at generation time â€” the Editor shows them in the ScrollRect at design time, not only at runtime. Use 2â€“3 realistic sample items per collection:

```json
{
  "id": "leaderboard_rows",
  "role": "list_row",
  "item_view": "AGSLeaderboardEntryView",
  "preview_items": [
    { "label": "Player1", "value": "9500", "detail": "#1" },
    { "label": "Player2", "value": "8200", "detail": "#2" },
    { "label": "Player3", "value": "7100", "detail": "#3" }
  ]
}
```

The `preview_items` fields (`label`, `value`, `detail`, `status`) map to the entry prefab's text binding names at generation time. Always include `preview_items` on every collection â€” a list with no preview items appears empty in the Editor even when the prefab and entry are otherwise correct.

**Important — preview items persist at runtime:** `preview_items` are baked as real child GameObjects inside the collection's content `RectTransform`. They are visible in the Editor at design time, but they also exist when the scene enters play mode. Any C# backing class that loads data into a collection **must destroy all existing children of the content container before instantiating new rows**, not just tracked rows. See the mandatory `ClearRows` pattern in Step 6.

**Complex widget prerequisites:** if the requested widget contains category tabs, collections, or state containers, confirm all of the following before calling `unity_ui_validate`:

- **Tabs**: a project-owned tab button prefab exists in `enforced_roles.tab_button`. If not, call `unity_ui_project_components_generate` for the `tab_button` role (or stop and ask the user to supply one). Do **not** use `PF_AB_SecondaryButton` as a tab button for generated project widgets â€” validation will reject it.
- **Collections**: compatible entry prefabs exist for every collection (verified via `unity_ui_list_entry_candidates` above).
- **State containers**: `state_container` is Tier 1 or Tier 2 (verified in Step 1.5).
- **Button roles**: scan every `Button` node in the authored spec tree for its `prefab_role` value (e.g. `secondary_button`, `danger_button`). For any `prefab_role` that resolves to Tier 3 in `enforced_roles`, collect all such roles and call `unity_ui_project_components_generate` once with all of them in a single call, then re-approve style. Do this sweep after finalising the spec tree, before calling `unity_ui_validate`.

Do not call `unity_ui_validate` until all prerequisites are satisfied.

### Step 4 â€” Validate

Call `unity_ui_validate(projectPath, specPath)`. Fix all errors before proceeding. Check and surface any `style_warnings`.

- The tool rejects path-like `backing_class` values with `invalid_backing_class_reference`; use the fully-qualified compiled C# type name, not the `.cs` file path.
- The tool warns with `missing_typography_override` when text nodes are present, custom TMP fonts were detected in the approved style context, and the recipe does not pin `style.typography`.
- The tool warns with `collection_binding_should_use_content` when a `Collection` binding uses the collection name instead of the generated `<CollectionName>Content` root.
- The tool marks known bad generation paths as `severity: "generate_blocker"` and `unity_ui_generate` refuses to run until they are fixed. This includes missing binding nodes, collection bindings that should use content roots, unfilled collections, missing collection preview items, unresolved project roles, and missing/invalid list-entry roles.
- The tool returns `missing_project_roles` grouped across project role, tab button, and recipe entry requirements so all missing project components can be generated in one call before re-approving style.
- `unity_ui_validate` requires an approved style context. If it returns `style_context_required`, call `unity_ui_style_discover(projectPath, approve=true)` and retry validation.
- In project style, validation is a hard gate for unresolved role fallbacks. `project_role_required`, `project_tab_button_required`, and `recipe_list_entry_required` mean the generated prefab would mix project and AGS kit styles; generate the missing project component or explicitly switch the recipe to AGS style before retrying.
- **If validation returns one or more `project_role_required` errors:** collect every `role` value from those errors â€” the response also includes a `missing_project_roles` list for convenience. Call `unity_ui_project_components_generate` **once** with all roles in a single call (not one role per call), re-approve style with `unity_ui_style_discover(approve=true)`, then retry validation.
- If validation returns `no_compatible_list_entry` or `recipe_list_entry_required` â†’ stop. Do not proceed to generate. Explain to the user which entry prefab must be created or updated to satisfy the recipe's content contract before retrying.
- If validation/resolve auto-adds an `entry_prefab` to a collection node â†’ keep the normalized/resolved spec flow and generate from it. Do not re-author the spec from the pre-validation draft; that loses the automatic collection wiring.
- If validation returns `project_tab_button_required` â†’ stop. Call `unity_ui_project_components_generate` for the `tab_button` role, re-approve style, then retry validation.

### Step 5 â€” Resolve (get `cs_bindings`)

Call `unity_ui_resolve(projectPath, specPath)`.

The response now includes:
- **`resolved_spec`** â€” the full `ags-unity-prefab` spec used for generation (do not re-edit it)
- **`cs_bindings`** â€” one entry per binding: `widget_name`, `cs_type`, `using_namespace`, `field_prefix`, `field_name`, `role`, `is_button`

Review `cs_bindings` before writing the C# class â€” correct any obviously wrong type inferences (e.g. a `RectTransform` that should be a `TMP_Text`).

### Step 5a â€” SDK lookup (before writing C#)

Call `get_accelbyte_unity_how_to(“<feature>”)` to get SDK best practices and C# code templates for the feature (login, leaderboard, friends, user profile, etc.). Use the returned `code_template` as the implementation reference when writing the C# class body.

### Step 5b â€” Decide on C# backing class

Ask once: **"Should I also generate a C# backing class that wires up SDK calls?"**
- If **no**: skip to Step 8.
- If **yes**: continue with steps 6â€“7.

### Step 6 â€” Write C# backing class

Derive the following from the resolved spec and `cs_bindings`:

| Item | Rule |
|---|---|
| Feature name | Strip `PF_AGS_` prefix from `asset_name` (e.g. `LoginPanel`) — `PF_AGS_` is the AccelByte UI Kit asset convention and is retained in all builds |
| Class name | `AGS<Feature>View` (e.g. `AGSLoginPanelView`) |
| Output path | `Assets/AGS/Scripts/<Feature>/AGS<Feature>View.cs` |
| Namespace | `<ProjectName>.AGS.Scripts.<Feature>` |
| Base class | `AGSViewBase` (`AccelByte.UITools`) |

Field naming: `btn_` (buttons), `inp_` (inputs), `txt_` (text labels), `state_` (AGSStateView), `list_` (collection containers), `rect_` / `img_` (other RectTransforms).

**Template:**

```csharp
using System;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using AccelByte.Core;
using AccelByte.Api;
using AccelByte.UITools;

namespace <Namespace>.AGS.Scripts.<Feature>
{
    public class AGS<Feature>View : AGSViewBase
    {
        // --- Bindings (one [SerializeField] per cs_bindings entry) ---
        [SerializeField] private AGSStateView state_StateContainer;
        [SerializeField] private Button btn_SubmitButton;
        [SerializeField] private TMP_InputField inp_UsernameInput;
        [SerializeField] private TMP_Text txt_StatusText;

        private void Awake()
        {
            btn_SubmitButton.onClick.AddListener(OnSubmitClicked);
        }

        private void OnDestroy()
        {
            btn_SubmitButton.onClick.RemoveListener(OnSubmitClicked);
        }

        private void OnSubmitClicked()
        {
            state_StateContainer.SetState(AGSViewState.Loading);
            // Use SDK pattern from get_accelbyte_unity_how_to
        }
    }
}
```

Rules:
- One `[SerializeField]` per entry in `cs_bindings` â€” use `field_name` and `cs_type` exactly as returned.
- Wire all `is_button: true` bindings with `onClick.AddListener` in `Awake` and `onClick.RemoveListener` in `OnDestroy`.
- Fill method bodies from the SDK code templates returned by `get_accelbyte_unity_how_to`.
- **Collections — always destroy all children before loading data.** Preview items are baked as real GameObjects and survive into play mode. Any method that populates a collection must call a `ClearRows` helper that destroys every child of the content `RectTransform`, not just tracked row references:
  ```csharp
  private void ClearRows(List<TEntryView> rows, RectTransform container)
  {
      foreach (Transform child in container)
          Destroy(child.gameObject);
      rows.Clear();
  }
  ```
  Call `ClearRows` at the start of every load method (`OnEnable`, `LoadLeaderboard`, tab-switch handlers, etc.) before instantiating new rows. A `List<TEntryView>` field tracks the live rows for type-safe access; the destroy loop handles the preview items that are not in that list.
- **Never store AccelByte API objects as class fields.** The `code_template` from `get_accelbyte_unity_how_to` always uses local variables (e.g. `User user = AccelByteSDK.GetClientRegistry().GetApi().GetUser();`). Keep them local â€” do NOT promote them to `private User _user` or `private Leaderboard _leaderboardApi` fields. Getting the object fresh is cheap and avoids stale-reference bugs.
- **Namespace is `AccelByte.UITools`, not `AccelByte.UITools.Runtime`.** The assembly is named `AccelByte.UITools.Runtime` but the C# namespace is `AccelByte.UITools`. Always write `using AccelByte.UITools;`.

### Step 7 â€” Verify backing class

Call `unity_ui_verify_backing_class(projectPath, specPath, classPath)`.

- If `ok: false`, fix reported `missing_serialize_field` or `wrong_cs_type` errors and call again.
- Do not proceed until `ok: true`.

### Step 7a â€” Compile gate

After writing the C# file, drive compilation and confirm it is error-free before generating:

1. Call `unity_trigger_recompile` to start compilation immediately (no need to switch focus to the editor window).
2. Poll `unity_ui_bridge_health` until `response.isCompiling` is `false`.
3. Check `response.compileErrors` in the result:
   - **Empty or absent** â€” compilation succeeded. Proceed to Step 8.
   - **Non-empty** â€” compilation has errors. For each entry (`file`, `line`, `column`, `message`):
     a. Fix **only** the generated C# files written in this task. Do not touch other files.
        - Wrong method name (e.g. `ShowLoading`) â†’ re-run `get_accelbyte_unity_how_to` to get the correct API, then fix.
        - Wrong property casing (e.g. `rank` â†’ `Rank`) â†’ fix the casing in the generated file.
        - Missing `using` directive â†’ add it at the top of the file.
     b. Call `unity_trigger_recompile` again.
     c. Poll `unity_ui_bridge_health` until `response.isCompiling` is `false`.
     d. Return to step 3. If the same `file:line` still has errors after two fix attempts, stop and report â€” do not call `unity_ui_generate`.
4. Do not call `unity_ui_generate` until `compileErrors` is empty.

### Step 8 â€” Generate

Call `unity_ui_generate(projectPath, specPath)`. The tool uses the live editor bridge when Unity is open and falls back to batch mode when it is closed. If validation returns `generate_blockers`, fix them before retrying; pass `allowWarnings: true` only for an intentional exception after checking the blockers.

The response includes `verification`, `layout_report`, and `style_context_refreshed`. Treat the prefab as complete when `verification.backing_class_attached: true` and all required `verification.required_binding_fields` / `verification.serialized_fields` have `assigned: true`. MCP verification is spec-tree-aware: a `StateContainer` node requires `AGSStateView`, a `TabView` node requires `AGSTabView`, and text/button/input/collection nodes drive their own required component checks.

**`entryPrefab` auto-assignment:** When `entry_prefab` is set in a collection node (filled in by `unity_ui_resolve`), the generator automatically wires the `entryPrefab` serialized field on the backing class. It appears under `verification.extra_serialized_fields` with `assigned: true` — NOT under `manual_assignments`. Do not report it as a manual step. Only treat `entryPrefab` as requiring manual assignment if it explicitly appears in `verification.manual_assignments` (which only happens when `entry_prefab` was never resolved in the spec).

Other non-binding serialized Unity references are reported under `verification.extra_serialized_fields` instead of blocking `verification.ok`. `layout_report.ok: true` is ideal; standalone path-only layout inspection downgrades broad assumptions to warnings when the original spec is unavailable.

The style context is refreshed automatically whenever a prefab is produced (check `style_context_refreshed` in the response). Manual re-approval via `unity_ui_style_discover` is only needed if `style_context_refreshed: false` (rare â€” occurs when generation fails before any file is written). If a layout report needs to be rerun later, call `unity_ui_inspect_generated_layout(projectPath, assetPath)`.

Report the result:

```text
AGS Unity UI generated

  Engine:         Unity <version>
  Backend:        uGUI + TMP
  Transport:      bridge / batch
  Style:          ags / project
  Theme:          project (extracted) / ags (no project tokens found)
  Prefab:         <generated prefab path>
  Backing class:  <C# file path>  â† omit if no C# class was generated
  SDK behavior:   SDK-neutral AGSViewBase; wire SDK calls in the backing class
```

When `Style: project`, also list key enforced roles that resolved to project prefabs (e.g. `primary_button â†’ Assets/Prefabs/UI/MenuButton.prefab`) and note any `incompatible_reason` values.

---

## Recipe Schema Extensions

### Button and input default width

Buttons and text inputs fill the width of their parent by default — no `slot.size` is needed for full-width controls. Only add `slot.size` when you want to override that:

- **Omit `slot.size`** (or set `slot.size.fill: 1`) — control fills parent width. Use for main-action buttons, login buttons, nav-menu buttons, and all form inputs.
- **`slot.size.auto: true`** — control shrinks to its content width. Use only for secondary inline controls (e.g. a small icon button alongside other elements in an `HorizontalBox`).

### Action layout

When a panel has multiple action buttons (e.g. Cancel + Confirm) that should be right-aligned as a row, put them in a `HorizontalBox` child with `slot.h_align: "right"` and `slot.size.auto: true`. The list/content above it uses `slot.size.fill: 1`.

**Do not use `HorizontalBox` + `h_align` for a single main-action button** (e.g. "Login with Device ID", "Submit", "Play"). Place it directly in the parent `VerticalBox` without `slot.size` so it fills the full panel width.

### Vertical alignment rule

All `VerticalBox` and `StateContainer` content stacks children **top-to-bottom** (`TextAnchor.UpperLeft`). This is the generator default — do not add `v_align` to a vertical container unless the feature explicitly requires centering (rare).

- `size: { fill: 1 }` on a vertical container makes it take remaining height; children still start from the **top**, not the middle of the space.
- The only standard alignment override across all recipes is `h_align: "right"` on an `ActionRow` `HorizontalBox` — this right-aligns button rows within a vertical stack.
- `HorizontalBox` children default to `TextAnchor.MiddleLeft` (vertically centered in the row height), which is correct for icon + label rows.

### Font override

The generator auto-detects the project font from theme tokens. To pin a specific font regardless of auto-detection, add a `style.typography` block to the recipe:

```json
{
  "schema": "ags-ui-recipe",
  "screen": "generic_async",
  "style": {
    "typography": {
      "body_font_asset": "Assets/UI/Font/Orbitron/Orbitron SDF.asset"
    }
  },
  ...
}
```

This font is applied to all TMP_Text elements in the generated prefab: panel title, button labels, and status text.

### Compilation gate

`unity_ui_generate` returns a `unity_compiling` error when the bridge reports `isCompiling: true`. When you see this error, poll `unity_ui_bridge_health` until `isCompiling` is `false`, then retry. Do not call `unity_ui_generate` while Unity is compiling. If `backing_class` is set, generation must fail with `generation_failed` until that class can be resolved and attached to the prefab root.

After compilation finishes (`isCompiling: false`), also check `compileErrors` in the bridge health response. If any errors are present, fix the generated C# files and recompile (see Step 7a) before calling `unity_ui_generate`.

## Node-Tree Composition

All recipes use a **node tree** (`schema: "ags-ui-recipe"`) â€” a literal widget hierarchy under `root` that the generator walks verbatim. The structure you author is the structure you get. This gives you precise control for any layout:

- **Tab menus** â€” a tab bar that switches between content panels at runtime.
- **Action buttons attached to their content** â€” e.g. an "Add Friend" button that sits at the bottom-right of the friends list, or a Confirm/Cancel row under a modal body.
- **Buttons as the main content** â€” a main menu / nav menu where the buttons *are* the screen.

### Node vocabulary

Containers: `StateContainer` (the idle/loading/success/empty/error switcher â€” use as the root for stateful screens), `TabView`, `VerticalLayout` (alias: `VerticalBox`), `HorizontalLayout` (alias: `HorizontalBox`), `ScrollView` (alias: `ScrollBox`), `Panel` (alias: `Border`), `LayeredLayout` (alias: `Overlay`), `LayoutElement` (alias: `SizeBox`). Canonical names and aliases are both accepted by the generator.
Data list: `Collection` (a scrolling list; set `item_view` and `preview_items`).
Leaves: `Button` (set `prefab_role`: `primary_button` | `secondary_button` | `danger_button`), `Text`, `TextInput`/`EditableTextBox`, `Image`.

Every node may carry:
- `name` â€” GameObject name; **must equal the binding string** for any node you list in `bindings` (also set `"is_variable": true`).
- `slot.size` â€” `{“fill”: 1.0}` to take remaining space (collections, main content); `{“auto”: true}` to shrink-wrap to content width (multi-button action rows, status text, inline icons). Omit entirely on buttons and inputs to get the default full-width fill.
- `slot.h_align` â€” `"right"` / `"center"` to align an auto-sized child (e.g. an action-button row) within a vertical stack.
- `padding` / `slot.padding` â€” `[left, top, right, bottom]`.

### TabView

`TabView` builds a tab bar (one button per `tabs` entry, named `<tab.name>TabButton`) above a content area, and wires an `AGSTabView` component that switches panels at runtime. `tabs` and `children` are parallel and **must be the same length** â€” `children[i]` is the panel for `tabs[i]`.

```json
{
  "type": "TabView",
  "name": "SocialTabs",
  "slot": { "size": { "fill": 1.0 } },
  "tabs": [
    { "name": "Friends", "label": "Friends" },
    { "name": "Party",   "label": "Party" }
  ],
  "children": [
    { "type": "VerticalBox", "name": "FriendsPanel", "slot": { "size": { "fill": 1.0 } },
      "children": [
        { "type": "Collection", "name": "Friends", "item_view": "FriendRow",
          "slot": { "size": { "fill": 1.0 } }, "preview_items": [ { "label": "Alex", "value": "Online" } ] },
        { "type": "HorizontalBox", "name": "FriendsActions",
          "slot": { "h_align": "right", "size": { "auto": true } },
          "children": [ { "type": "Button", "name": "AddFriendButton", "text": "Add Friend", "prefab_role": "primary_button" } ] }
      ] },
    { "type": "VerticalBox", "name": "PartyPanel", "slot": { "size": { "fill": 1.0 } },
      "children": [ { "type": "Collection", "name": "Party", "item_view": "PlayerRow", "slot": { "size": { "fill": 1.0 } } } ] }
  ]
}
```

A `Collection` named `Friends` produces a `FriendsContent` GameObject â€” bind to `FriendsContent`, and a tab named `Friends` binds to `FriendsTabButton`.

### Attached action row

Put the action buttons in a `HorizontalBox` with `slot.h_align: "right"` and `size.auto`, as the last child of the content `VerticalBox`. The list above it uses `size.fill`. The row stays attached to the bottom of the panel and hugs the right edge â€” it is never detached into a separate region.

### Buttons as the main content (nav / main menu)

Make the root a `VerticalBox` of `Button` nodes â€” no `StateContainer`, no separate action region:

```json
{ "type": "VerticalBox", "name": "NavMenu", "slot": { "size": { "fill": 1.0 } },
  "children": [
    { "type": "Button", "name": "PlayButton",     "text": "Play",     "prefab_role": "primary_button" },
    { "type": "Button", "name": "SettingsButton", "text": "Settings", "prefab_role": "secondary_button" },
    { "type": "Button", "name": "QuitButton",      "text": "Quit",     "prefab_role": "danger_button" }
  ] }
```

The bundled `tabbed_social`, `leaderboard_tabbed`, `nav_menu`, and `action_modal` recipes are authored this way â€” read them as references. Do **not** add a `style` key; `unity_ui_resolve` fills it. Then call `unity_ui_validate`.

### State wrapper pattern

Every stateful screen prefab uses a `StateContainer` root node, which the generator maps to the `AGSStateView` component (idle/loading/success/empty/error). Author screen content as children of `StateContainer`:

```
StateContainer  â†’  AGSStateView kit prefab
  VerticalBox (fill)  â€” the success content
    Collection (fill) â€” scrollable list
    HorizontalBox (auto, h_align:right)  â€” action buttons
    Text (auto)  â€” status text
```

### Collection naming convention

A `Collection` node named `Friends` produces two GameObjects: `FriendsScroll` (outer ScrollRect) and `FriendsContent` (inner content root). Bind to `FriendsContent` in `bindings`. A `TabView` tab named `Friends` produces a tab button named `FriendsTabButton`.

### Game UI pattern selection

For common game-screen requests, choose the appropriate archetype before composing:

| User intent | Preferred structure |
|---|---|
| Season pass / battle pass | Horizontal reward track with progress header; use collection role `reward_card` grid, not a vertical list |
| Guild / clan management | Tabbed panel (roster, requests, roles, activity); use a `TabView` node with a `Collection` per tab |
| News feed / announcements | Featured announcement above a `list_row` collection |
| Tournament bracket | Horizontal round columns with match cards; do not render as a flat vertical list |
| Lobby / server browser | Filter input + action above a `list_row` collection |
| Squad loadout / cosmetics | Grid collection with role `store_card` or `achievement_card` |
| Social hub | Tabbed panel with channel/member `list_row` collections |
| Match summary / scoreboard | Score header + ranked `list_row` collection |
| Player profile | Summary header + stats section (key-value `fields`) |

Use `screen: "generic_async"` only for true one-shot async operations (export, delete, sync, submit). The `unity_ui_select_recipe` tool reports `selection_confidence`, `fallback_reason`, and `generic_async_fallback_requires_opt_in` when it cannot match a feature-specific recipe. Do not use it for complete game screens; pass `allowGenericAsync: true` only for an intentional async/status panel.

## Current Scope

- Unity runtime UI backend: uGUI prefabs with TextMesh Pro controls.
- Style modes: `ags` (kit defaults) and `project` (extracted from project prefabs).
- All recipes use `schema: "ags-ui-recipe"` (node tree). `unity_ui_resolve` returns the resolved `ags-unity-prefab` spec in-memory; it does not need to be written separately.
- Package-owned AGS kit prefabs live under `Packages/com.accelbyte.ui-tools/Prefabs/Core/`; generated screen prefabs are project-owned under `Assets/AGS/UI/Generated/`.
- C# backing classes extend `AGSViewBase` and are project-owned under `Assets/AGS/Scripts/`.
- SDK lookup: `get_accelbyte_unity_how_to` covers SDK init, authentication, leaderboard, friends, and user profile. For other features, use code templates from the guide as the starting pattern.

## Editor Bridge

```text
GET  http://127.0.0.1:48758/accelbyte-ui-tools/health
POST http://127.0.0.1:48758/accelbyte-ui-tools/generate
```

The health endpoint now returns `"isCompiling": true/false`. Check this after writing C# files to confirm Unity has finished recompiling before calling `unity_ui_generate`.

If `unity_editor_status` reports the editor is running but the bridge health is false, ask the user to wait for scripts to compile or restart Unity. Do not ask the user to close Unity just to generate UI.

---

## Validation Layers Reference

The Unity UI generator has four distinct validation stages that can produce errors. Each has different error codes and different fix strategies.

| Layer | When it runs | What it checks | Error codes |
|---|---|---|---|
| `unity_ui_validate` | Pre-generation (Python) | Recipe schema, screen type, root tree, collection entries, style context, generate blockers | `invalid_schema`, `unsupported_screen`, `missing_asset_name`, `missing_root`, `invalid_backing_class_reference`, `binding_node_missing`, `collection_binding_should_use_content`, `collection_not_filled`, `collection_missing_preview_items`, `no_compatible_list_entry`, `recipe_list_entry_required`, `project_tab_button_required`, `style_context_required` |
| `unity_ui_verify_backing_class` | Pre-compile (Python) | C# field names, types, base class vs cs_bindings | `missing_serialize_field`, `wrong_cs_type`, `base_class_mismatch` |
| Bridge C# (during generate) | During generation | Prefab slot matching, component availability, backing class type resolution | `bridge_unavailable`, `unity_compiling`, `generation_failed` |
| Unity compiler | After generate | Compilation of newly written C# backing classes | via `unity_ui_bridge_health` â†’ `compileErrors` array |

---

## Error Code Reference

| Code | Layer | Cause | Fix |
|---|---|---|---|
| `invalid_schema` | Python validate | `schema` field is not `"ags-ui-recipe"` | Set `"schema": "ags-ui-recipe"` |
| `unsupported_screen` | Python validate | `screen` value is not in the supported list | Use a supported screen name (e.g. `leaderboard`, `login`, `friends`) |
| `missing_asset_name` | Python validate | `asset_name` is missing or empty | Add a non-empty `asset_name` string (e.g. `"PF_AGS_LeaderboardPanel"`) |
| `missing_root` | Python validate | `root` node tree is absent | Add a `"root"` object with a `type` and `name` |
| `invalid_backing_class_reference` | Python validate / Generate verification | `backing_class` looks like a file path instead of a C# type | Use the fully-qualified compiled type name, not a `.cs` path |
| `binding_node_missing` | Python validate (`generate_blocker`) | A binding has no matching named node in the spec tree | Add a node with that exact `name`, or remove the binding |
| `collection_binding_should_use_content` | Python validate (`generate_blocker`) | A collection binding targets `Entries` instead of generated `EntriesContent` | Bind `<CollectionName>Content` and use the returned `cs_bindings` field name |
| `no_compatible_list_entry` | Python validate | No prefab in `compatible_candidates` matches the feature's content contract | Generate a feature-specific entry prefab (Step 3 sub-workflow) |
| `recipe_list_entry_required` | Python validate | Recipe requires a feature-specific entry (leaderboard, store, etc.) but a generic one was supplied | Replace the generic entry with a recipe-matching entry containing the required `fields` |
| `project_tab_button_required` | Python validate | Tab layout used but `tab_button` role has no Tier 1 or Tier 2 candidate | Call `unity_ui_project_components_generate` for `tab_button`, re-approve style |
| `style_context_required` | Python validate | Style context fingerprint is missing or stale | Call `unity_ui_style_discover` with `approve: true` |
| `collection_not_filled` | Python validate (`generate_blocker`) | A collection lacks fill sizing | Add `"slot": {"size": {"fill": 1.0}}` or `sizing: "fill_parent"` |
| `collection_missing_preview_items` | Python validate (`generate_blocker`) | A collection has no `preview_items` | Add 2-3 realistic `preview_items` so the prefab is inspectable |
| `missing_typography_override` | Python validate (warning) | Custom TMP font assets were detected but a text-bearing spec lacks `style.typography` | Add `style.typography` with the intended font asset paths |
| `candidate_prefab_non_stretch_visual_child` | Style discover (warning) | Selected project prefab has visual children with fixed corner anchors where stretch is expected | Fix the candidate prefab anchors or override the role |
| `generic_async_fallback_requires_opt_in` | Recipe select | No feature-specific recipe matched and `generic_async` would be used | Use a feature-specific/custom spec, or pass `allowGenericAsync: true` for a true async/status panel |
| `validation_generate_blocked` | Python generate | Validation found `generate_blocker` findings | Fix `generate_blockers` before generation; use `allowWarnings: true` only intentionally |
| `missing_serialize_field` | Python verify | C# backing class is missing a `[SerializeField]` required by cs_bindings | Add the field with the exact `field_name` and `cs_type` from cs_bindings |
| `wrong_cs_type` | Python verify | A `[SerializeField]` field has the wrong C# type | Change the type to match `cs_type` from cs_bindings exactly |
| `base_class_mismatch` | Python verify | C# class does not extend `AGSViewBase` | Change the base class to `AGSViewBase` (namespace `AccelByte.UITools`) |
| `bridge_unavailable` | Bridge | Unity Editor is not running or bridge has not started | Ask the user to open the Unity project in the editor and wait for scripts to compile |
| `unity_compiling` | Bridge | Bridge reports `isCompiling: true` | Poll `unity_ui_bridge_health` until `isCompiling: false`, then retry `unity_ui_generate` |
| `generation_failed` | Bridge | C# type resolution failed â€” backing class not yet compiled | Check `unity_ui_bridge_health` â†’ `compileErrors`; fix and recompile (Step 7a) before retrying |
| `manual_assignments` | Generate verification output | Known prefab-asset references such as `entryPrefab` cannot be wired from the generated scene graph | Assign them in the Unity Inspector |
| `extra_serialized_fields` | Generate verification output | Serialized Unity object fields not derived from `bindings` | Review manually; they do not block generation |
| `backing_class_not_attached` / `serialized_field_unassigned` | Generate verification | Saved prefab is missing the backing component or a required binding reference | Fix class/binding names, recompile, regenerate |
| `layout_*` | Generate layout inspection | Saved prefab fails generated layout health checks | Inspect `layout_report.errors`, fix the recipe/component layout, regenerate |

---

## Stable Binding Names

These binding names appear in AGS kit recipes and are used verbatim as C# field names in generated backing classes. The generator resolves their C# types by exact name lookup â€” using these names avoids the heuristic fallback and guarantees correct types. Non-standard names are supported but may require manual correction of `cs_bindings` returned by `unity_ui_resolve`.

| Binding name | C# type | Role |
|---|---|---|
| `StateContainer` | `AGSStateView` | State machine (idle / loading / success / empty / error) |
| `SubmitButton` | `Button` | Primary single-action button |
| `ConfirmButton` | `Button` | Confirm in dialogs |
| `CancelButton` | `Button` | Cancel in dialogs |
| `RetryButton` | `Button` | Retry after error |
| `StatusText` | `TMP_Text` | Status / feedback label |
| `TitleText` | `TMP_Text` | Panel title |
| `ErrorText` | `TMP_Text` | Inline error message |
| `UsernameInput` | `TMP_InputField` | Username text field |
| `PasswordInput` | `TMP_InputField` | Password field |
| `SearchInput` | `TMP_InputField` | Search / filter field |
| `EntriesContent` | `RectTransform` | Collection scroll content root |
| `TabBar` | `RectTransform` | Tab button row container |
| `TabContent` | `RectTransform` | Tab content switcher |

---

## Concrete Recipe JSON Examples

### Login screen (form with inputs + submit)

```json
{
  "schema": "ags-ui-recipe",
  "screen": "login",
  "asset_name": "PF_AGS_LoginPanel",
  "bindings": ["StateContainer", "UsernameInput", "PasswordInput", "StatusText", "SubmitButton"],
  "root": {
    "type": "StateContainer", "name": "StateContainer", "is_variable": true,
    "children": [{
      "type": "VerticalBox", "name": "LoginContent", "slot": {"size": {"fill": 1}},
      "children": [
        {"type": "TextInput", "name": "UsernameInput", "is_variable": true, "prefab_role": "text_input",     "text": "Username"},
        {"type": "TextInput", "name": "PasswordInput", "is_variable": true, "prefab_role": "password_input", "text": "Password"},
        {"type": "Text",      "name": "StatusText",    "is_variable": true, "text": ""},
        {"type": "Button",    "name": "SubmitButton",  "is_variable": true, "text": "Sign in", "prefab_role": "primary_button"}
      ]
    }]
  }
}
```

> **Note:** `SubmitButton` is a direct child of `VerticalBox` with no `slot.size` — this makes it fill the full panel width. Only wrap buttons in `HorizontalBox` + `h_align` when you need a right-aligned multi-button row (e.g. Cancel + Confirm).

### Screen with a scrollable collection (leaderboard)

```json
{
  "schema": "ags-ui-recipe",
  "screen": "leaderboard",
  "asset_name": "PF_AGS_LeaderboardPanel",
  "bindings": ["StateContainer", "EntriesContent", "StatusText"],
  "root": {
    "type": "StateContainer", "name": "StateContainer", "is_variable": true,
    "children": [{
      "type": "VerticalBox", "name": "BodySlot", "slot": {"size": {"fill": 1}},
      "children": [
        {"type": "Collection", "name": "Entries", "is_variable": true,
          "item_view": "LeaderboardRow", "slot": {"size": {"fill": 1}},
          "preview_items": [
            {"label": "1. Player1", "value": "9500"},
            {"label": "2. Player2", "value": "8200"}
          ]},
        {"type": "Text", "name": "StatusText", "is_variable": true, "text": "", "slot": {"size": {"auto": true}}}
      ]
    }]
  }
}
```

---

## Pre-Generation Visual Checklist

Before calling `unity_ui_validate`, verify:

- [ ] Style context is approved (`unity_ui_style_discover` with `approve: true` completed)
- [ ] `state_container` is Tier 1 or Tier 2 â€” or the user has explicitly approved AGS kit fallbacks
- [ ] Every `Collection` node has `"slot": {"size": {"fill": 1}}` â€” without it the ScrollRect auto-expands and scroll never appears
- [ ] Every `Collection` node has `preview_items` with 2â€“3 realistic entries â€” without them the list appears empty in the Editor at design time
- [ ] All entry prefabs referenced by collections appear in `compatible_candidates` from `unity_ui_list_entry_candidates`
- [ ] Tab layouts have `tab_button` role at Tier 1 or Tier 2; if not, call `unity_ui_project_components_generate` for `tab_button` first
- [ ] Binding names in `bindings` use names from the Stable Binding Names table when applicable â€” this avoids heuristic type inference errors
- [ ] `asset_name` follows the `PF_AGS_<FeatureName>` convention
- [ ] No `v_align` or `h_align` was added to a `VerticalBox` or `StateContainer` content node â€” vertical stacks default to top-left; never add `v_align: center` to form or panel layouts. The only standard override is `h_align: “right”` on an `ActionRow` `HorizontalBox`.
- [ ] If custom TMP font assets are detected and a text-bearing spec lacks `style.typography`, `unity_ui_validate` reports `missing_typography_override`; add the intended font paths for every panel, entry, and row spec that must use them

If `unity_ui_validate` returns `collection_warnings`, fix them before calling `unity_ui_generate` â€” they indicate silent layout bugs (non-scrolling lists, empty Editor previews) that will not block generation but will produce incorrect results.



