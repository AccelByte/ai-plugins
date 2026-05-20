---
name: ags-install-unity-sdk
description: Install or scaffold the AGS Unity SDK packages in a Unity project. Uses
  Unity Package Manager Git URLs for accelbyte-unity-sdk and, when needed, accelbyte-unity-networking.
allowed-tools: Read Write Edit Bash Glob
model: sonnet
last-verified: 2026-05-09
sources:
- https://github.com/AccelByte/accelbyte-unity-sdk
- https://github.com/AccelByte/accelbyte-unity-networking
- https://docs.accelbyte.io/
see-also:
- '[unity.md](../references/sdks/game-engine/unity.md)'
- '[sdk-quickstart.md](../references/init/sdk-quickstart.md)'
- '[connect-portal.md](connect-portal.md)'
---

# AGS Unity SDK Installer

Install the AGS Unity SDK packages into a Unity project and verify that the project can authenticate against AGS.

Default to Unity Package Manager Git URL dependencies. Add `accelbyte-unity-networking` when the project needs AGS networking, multiplayer transport, or server/session networking support; it depends on the Unity SDK package.

## Behavior Constraints

<grounding_rules>

Read `references/sdks/game-engine/unity.md` before installing. Do not fabricate Unity compatibility or package tags. Check the current docs or GitHub release notes; if the compatible tag is unclear, ask the user to choose it before installing.

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
- Do not copy package directories from arbitrary local checkouts or another workspace.
- Show the manifest/config diff before applying edits.

</action_safety>

## Workflow

### Step 1: Confirm Unity

Read `ProjectSettings/ProjectVersion.txt`, detect `Packages/manifest.json`, and confirm with the user if multiple Unity projects are present.

### Step 2: Pick Packages

Install the official package set:

- Required: `com.accelbyte.unitysdk` from `https://github.com/AccelByte/accelbyte-unity-sdk.git`
- Optional when networking is needed: `com.accelbyte.networking` from `https://github.com/AccelByte/accelbyte-unity-networking.git`

Pin each package to a tag, branch, or commit compatible with the project's Unity version. Prefer tags for reproducibility.

### Step 3: Install

Edit `Packages/manifest.json` using UPM Git URLs shaped like:

```json
{
  "dependencies": {
    "com.accelbyte.unitysdk": "https://github.com/AccelByte/accelbyte-unity-sdk.git#<tag>",
    "com.accelbyte.networking": "https://github.com/AccelByte/accelbyte-unity-networking.git#<tag>"
  }
}
```

Only add `com.accelbyte.unitynetworking` when the project needs it or the user requests the full Unity multiplayer/networking setup.

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

