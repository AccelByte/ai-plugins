---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[install-sdk.md](../../subskills/install-sdk.md)'
- '[_index.md](../sdks/_index.md)'
---

# Init — SDK Quickstart

Per-engine starter snippets for the **first call** after an SDK is installed. Used by `subskills/install-sdk.md` to verify the SDK is wired correctly before moving on to module integration.

The "first call" is always: log a player in via the chosen platform identity provider, get an AGS token back. If that works, the rest of the integration is plumbing.

---

## Pattern

```
1. Configure the SDK with: client ID (public IAM client), namespace, base URL.
2. Trigger Login* with the platform credential (Steam ticket / PSN auth code / etc.).
3. On success delegate / callback / Promise resolution: confirm a non-empty user_id and access token.
```

If step 3 succeeds, the SDK is configured correctly. Everything else (Lobby / Matchmaking / Store / …) builds on the same token.

## Engine-specific notes

The first-call shape varies per engine and follows that engine's idioms:

| Engine | Conventional async style |
|---|---|
| **Unreal** | Delegate-based — success / error delegates passed into the User-API login call. |
| **Unity** | Callback-based — a callback that yields a result holding the token data. |
| **Godot** | Signal-based — connect to login-succeeded / login-failed signals on the AGS singleton. |
| **Roblox** | Coroutine / Promise-style — yields a token object. |
| **TypeScript Web** | Promise-based — `await` returns a token object. |

> **Don't quote specific SDK symbols here.** Method names and namespaces vary by SDK version and may change. **Point users at the SDK's own docs and GitHub repo for the current API:**
>
> - Unreal SDK: `https://github.com/AccelByte/accelbyte-unreal-sdk-plugin` (and `accelbyte-unreal-oss` for the OSS variant)
> - Unity SDK: `https://github.com/AccelByte/accelbyte-unity-sdk`
> - Godot SDK: `https://github.com/AccelByte/accelbyte-godot-sdk`
> - Roblox SDK: `https://github.com/AccelByte/accelbyte-roblox-sdk`
> - TypeScript Web SDK: `https://github.com/AccelByte/accelbyte-typescript-sdk`

For the operational install steps, see `subskills/install-sdk.md`.

## Verification step

After the first successful login, confirm:

- The token decodes (it's a JWT — base64-decode the middle segment) and contains the expected `namespace` claim.
- A second call works (e.g. `GetMyProfile` / equivalent) — proves the token is being attached to subsequent requests.

Both checks done = SDK is wired. Move on to the module-by-module wiring (`/ags integrate`).

## Where this hands off

- `subskills/install-sdk.md` runs this verification at the end of installation.
- `subskills/integrate.md` assumes this verification has passed.
- If the verification fails, route the user to `subskills/debug.md` and the relevant `references/debug/auth-failures.md` material.
