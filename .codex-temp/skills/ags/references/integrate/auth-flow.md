---
last-verified: 2026-06-08
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/accounts/how-account-works/
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authorization/manage-access-control-for-applications/
see-also:
- '[iam.md](../modules/iam.md)'
- '[headless-account-linking.md](../cookbook/headless-account-linking.md)'
- '[auth-provider-configuration.md](../platforms/auth-provider-configuration.md)'
- '[auth-failures.md](../debug/auth-failures.md)'
---

# Integrate — Auth Flow

End-to-end auth flow shape for an AGS integration. Same pattern across all Game Engine SDKs and the TypeScript Web SDK; differences are which OAuth grant type and which platform identity provider you use.

---

## The pattern

```
   1. Player triggers login (UI button / app start / cold launch)
   2. Game / app obtains a platform credential
        - Steam: Steam ticket
        - PSN:   PSN auth code / token
        - Xbox:  XSTS token
        - Epic:  EOS auth ticket
        - Apple / Google / Facebook: provider-specific token
        - Email/password: username + password (less common; usually for accounts that have been "upgraded" from headless)
   3. SDK calls AGS IAM with platform credential
        IAM exchanges platform credential → AGS access + refresh tokens
        If no AGS account exists yet for this platform identity:
          AGS auto-creates a HEADLESS ACCOUNT linked to the platform identity
   4. SDK stores tokens
        - Access token: in memory, attached to subsequent API calls
        - Refresh token: secure storage appropriate to the platform (follow SDK and platform-specific security recommendations)
   5. Subsequent calls
        - Access token attached automatically by SDK
        - When access token nears expiry: SDK swaps refresh token for a new pair
   6. Logout
        - SDK clears tokens
        - Refresh token revoked AGS-side
```


## Three IAM client kinds (recap)

| Client kind | Used by | Has client secret? | Notes |
|---|---|---|---|
| **Public** | Game clients (player-facing) | No | OAuth flows for end-user login |
| **Confidential** | Game servers, trusted backend | Yes | Server-to-server token exchange |
| **AccelByte** | Admin tooling, internal services | Yes | Higher-trust admin operations |

Game-client builds carry the public client ID. Dedicated-server builds carry a confidential client ID + secret. Mixing them up causes silent failures — see `references/debug/auth-failures.md`.

## Platform credential configuration checklist

Before adding login code, identify the user's requested platform login method and verify the AGS-side IAM setup for that method:

1. Namespace and environment match the game config.
2. Game-client builds use a public IAM client; server builds use a confidential IAM client.
3. The login method or identity provider is enabled for the namespace and IAM client.
4. Platform-specific values are configured using `references/platforms/auth-provider-configuration.md`: app IDs, publisher keys, OAuth client IDs/secrets, issuer/JWKS URLs, redirect URIs, bundle/package IDs, certificate/key material, organization IDs, claim mappings, or provider metadata as required by that platform.
5. Engine config values are real values, not placeholders copied from examples.

Use the AGS CLI binary `ags` for read-only discovery where available. If any AGS-side IAM setting is missing, unclear, or needs to be changed, route to `/ags connect-portal` rather than papering over the issue in game code. If any provider-owned value is missing, stop and ask the user for the exact values listed in `references/platforms/auth-provider-configuration.md`; do not invent placeholders or continue into login code.

## Crossplay account linking

When a player on one platform identity wants to bind another (e.g. Steam player wants to link their PSN account):

1. Player is currently logged in via Steam → has an AGS player ID.
2. Player triggers a "link PSN" flow.
3. App obtains a fresh PSN credential.
4. SDK calls IAM's link-platform-identity endpoint with both the current AGS token and the PSN credential.
5. AGS verifies and binds the PSN identity to the existing AGS player.
6. Player can now log in via either Steam or PSN; both resolve to the same AGS account.

For the headless-account-linking variant (which underpins the EOS coexistence story), see `references/cookbook/headless-account-linking.md`.

## Common gotchas

- **Token refresh races** — don't fire two API calls during a refresh; the SDK handles serialization but custom code that bypasses the SDK can break this.
- **Login method not enabled backend-side** — if the Unreal/Unity code compiles, the SDK login call reaches AGS, and login returns HTTP 400 `invalid_request`, the attempted login method may be disabled, unimplemented, or misconfigured in IAM. Diagnose with `references/debug/auth-failures.md` and route to `/ags connect-portal` to enable the login method via AGS CLI or Admin Portal.
- **Public client used by a server build** — the server-side calls fail to mint the token type they need.
- **Confidential client secret leaked to a game client** — the secret is leaked publicly; rotate it immediately and switch the build to a public client.
- **Wrong namespace claim** — using a dev token against a prod namespace fails; the JWT carries the namespace claim.
- **Platform-credential expiry** — Steam tickets etc. have short windows; if your refresh logic outlives the platform credential, you can't re-auth without re-prompting the player.

For diagnosis when auth fails in practice, see `references/debug/auth-failures.md`.
