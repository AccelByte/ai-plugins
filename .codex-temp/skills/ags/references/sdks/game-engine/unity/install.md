---
description: Install or scaffold the AGS Unity SDK packages in a Unity project. Uses
  Unity Package Manager Git URLs for accelbyte-unity-sdk and, when needed, accelbyte-unity-networking.
last-verified: 2026-07-14
sources:
- https://github.com/AccelByte/accelbyte-unity-sdk
- https://github.com/AccelByte/accelbyte-unity-networking
- https://docs.accelbyte.io/
see-also:
- '[install-sdk.md](../../../../subskills/install-sdk.md)'
- '[unity.md](../unity.md)'
- '[sdk-quickstart.md](../../../init/sdk-quickstart.md)'
- '[connect-portal.md](../../../../subskills/connect-portal.md)'
---

# AGS Unity SDK Install Reference

Detailed install flow for `/ags install-sdk` when the detected target is a Unity project. Install the AGS Unity SDK packages and verify that the project can authenticate against AGS.

Default to Unity Package Manager Git URL dependencies. Add `accelbyte-unity-networking` when the project needs AGS networking, multiplayer transport, or server/session networking support; it depends on the Unity SDK package.

## Behavior Constraints

<grounding_rules>

Read `references/sdks/game-engine/unity.md` before installing. Do not fabricate Unity compatibility or package tags.

Do not use generic web search for version discovery. Resolve the version from the official repo only — `git ls-remote` for the available tags and the repo's `package.json` (`version` and `unity` fields) for the current release and its minimum Unity version. Step 2 gives the exact procedure. If the resolved tag is still ambiguous, ask the user to choose it before installing.

</grounding_rules>

<dependency_checks>

Before installing:

1. `Assets/` and `ProjectSettings/ProjectVersion.txt` exist and the user confirms this is the target Unity project.
2. AGS config values are useful for config and verification, but they are not required to install Unity SDK packages. If base URL, namespace, or client ID are missing from the project's chosen config source, still install the packages, then stop before AGS config/login verification and route to `/ags connect-portal`.
3. Unity Package Manager is available through the Unity project manifest workflow.

</dependency_checks>

<action_safety>

- Confirm package versions or tags before editing `Packages/manifest.json`.
- Prefer UPM Git URL dependencies from official AccelByte repos.
- If Unity Package Manager fails to resolve a Git URL because the repo is private or invite-only, authenticate rather than copy locally. UPM resolves through the system `git`, so authenticating with `gh` (which configures git's credential helper) or adding an SSH key and using the SSH-form URL lets the same manifest entry resolve. The AccelByte preflight's git-acquisition guidance covers the full ladder.
- Do not copy package directories from arbitrary local checkouts or another workspace.
- Show the manifest/config diff before applying edits.

</action_safety>

## Workflow

### Step 1: Confirm Unity

Read `ProjectSettings/ProjectVersion.txt`, detect `Packages/manifest.json`, and confirm with the user if multiple Unity projects are present.

### Step 2: Pick Packages And Resolve The Latest Compatible Tag

Install the official package set:

- Required: `com.accelbyte.unitysdk` from `https://github.com/AccelByte/accelbyte-unity-sdk.git`
- Optional when networking is needed: `com.accelbyte.networking` from `https://github.com/AccelByte/accelbyte-unity-networking.git`

Do not pin a tag from memory — that is how stale versions get installed. Resolve the newest tag the project's Unity version supports, for each package you will install:

1. **Detect the project's Unity version** from `ProjectSettings/ProjectVersion.txt` (the `m_EditorVersion` line).

2. **List the available tags, newest-first**, straight from the official repo:

   ```bash
   git ls-remote --tags --sort=-v:refname https://github.com/AccelByte/accelbyte-unity-sdk.git \
     | grep -v '\^{}' | awk '{print $2}' | sed 's#refs/tags/##'
   ```

   Ignore pre-release tags (`-beta`, `-rc`, `-alpha`) unless the user explicitly asks for one.

3. **Cross-check `package.json` — do not trust raw tag order.** Tag schemes can be mixed (for example a legacy `v2.x` line can sort above the current `17.x` release), so confirm the real current release against the repo's manifest:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/AccelByte/accelbyte-unity-sdk/master/package.json \
     | grep -E '"version"|"unity"'
   ```

   The `version` field is the authoritative current release; the matching git tag is the intended latest. The `unity` field is the package's **minimum** supported Unity version. (The networking repo's default branch is `main`, not `master`.)

4. **Apply the compatibility gate.** Install the newest release only when the project's Unity version ≥ the package's `unity` minimum. If the newest release requires a newer Unity than the project has, step back to the newest tag that still satisfies the project's Unity version.

5. **If `package.json` can't be read** (fetch fails, or it lacks `version`/`unity`): do not fall back to raw tag order. Pin the newest clean-scheme tag (skip `v*` / pre-release lines), **state that the current release and minimum Unity version could not be auto-verified from the repo**, and confirm against the AccelByte docs compatibility matrix (`https://docs.accelbyte.io/`) or explicit user confirmation before pinning.

6. **When it's ambiguous, ask — don't guess.** If tag schemes conflict (a stray `v2.x` line vs the `17.x` line) or nothing clearly matches the project's Unity version, present the top candidate tags plus the detected Unity version and let the user choose.

Propose the resolved tag as the default, show it to the user alongside the detected Unity version, and pin it only after they confirm. Prefer tags over branches/commits for reproducibility.

If a private-repo fetch fails to authenticate, follow the `<action_safety>` git-acquisition guidance below — it is an access problem, not a wrong URL.

### Step 3: Install

Edit `Packages/manifest.json` using UPM Git URLs, pinning each package to the tag resolved in Step 2 (shown here as `<resolved-tag>`):

```json
{
  "dependencies": {
    "com.accelbyte.unitysdk": "https://github.com/AccelByte/accelbyte-unity-sdk.git#<resolved-tag>",
    "com.accelbyte.networking": "https://github.com/AccelByte/accelbyte-unity-networking.git#<resolved-tag>"
  }
}
```

Only add `com.accelbyte.networking` when the project needs it or the user requests the full Unity multiplayer/networking setup.

### Step 4: Configure

Create `Assets/Resources/AccelByteSDKConfig.json` (client config) and `Assets/Resources/AccelByteSDKOAuthConfig.json` (OAuth config) as expected by the current SDK docs, placing both under `Assets/Resources/`. Wire them to the project's chosen config source when AGS values are available. Keep secrets out of client builds; Unity game clients use a public IAM client.

If AGS values are missing, do not create placeholder config values. Stop after package installation and route to `/ags connect-portal`.

### Step 5: Verify

Run the Unity SDK test login from `references/init/sdk-quickstart.md`. Confirm a token comes back and a profile call works. If verification fails, route to `/ags debug` or `references/debug/auth-failures.md`.

### Step 6: Output

End with:

```text
SDK installed

  Engine:           Unity <version>
  SDK version:      <pinned Unity SDK tag> (+ networking tag if installed)
  Install path:     Packages/manifest.json
  AGS config:       present / missing - <reason>
  Verification:     test login OK

Next step: /ags integrate (start with IAM)
```
