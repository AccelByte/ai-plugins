---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[glossary.md](../glossary.md)'
- '[headless-account-linking.md](../cookbook/headless-account-linking.md)'
- '[auth-flow.md](../integrate/auth-flow.md)'
- '[access.md](../ecosystem/access.md)'
---

# Module — IAM (Identity & Access Management)

Player accounts, authentication, OAuth 2.0, SSO, ban management, and role-based access control. The foundation every other AGS module sits on top of — every API call needs an OAuth token, and tokens come from IAM.

---

## What it covers

- **Player accounts** — creation, login, account linking across platforms, ban / suspension management.
- **Platform identity providers** — Steam, PlayStation, Xbox, Epic Games, Google Play, Apple, Facebook, and more (16 providers total — see the authentication overview for the full list).
- **Enterprise identity providers** — Azure AD, Google Workspace, AWS Cognito, OpenID Connect.
- **OAuth 2.0** — full implementation. Three IAM client kinds: Public (game clients, player-facing login flows), Confidential (game servers, trusted backend services), and AccelByte (admin tooling and internal services). See `references/integrate/auth-flow.md` for the full breakdown.
- **Crossplay identity** — single persistent player identity across PC, console, mobile via account linking.
- **Headless accounts** — auto-created accounts when a player first logs in via a third-party identity provider without explicitly registering.
- **Roles & permissions** — granular permission strings controlling resource access; roles bundle permissions assigned to users or services.

## How it shows up in code

Game clients call `Login*` methods on the SDK with platform credentials (Steam ticket, PSN auth code, etc.). The SDK exchanges those for AGS tokens via IAM and stores them. Subsequent calls to other AGS modules attach the token automatically.

Game servers use **confidential** IAM clients with a client secret to obtain server tokens — a different scope than player tokens.

Admin tools and web portals use AccelByte IAM clients (higher-trust admin operations).

For end-to-end auth flow patterns, see `references/integrate/auth-flow.md`. For crossplay identity bridging (including the EOS coexistence story), see `references/cookbook/headless-account-linking.md`.

## Standalone packaging

When sold standalone, IAM is **AccelByte Access** — see `references/ecosystem/access.md`. Same identity engine; just sold without the rest of AGS.

## Where to look in the docs

- AccelByte IAM docs: `https://docs.accelbyte.io/`
- Glossary entries: `references/glossary.md` — IAM, namespace, IAM client, OAuth 2.0, token, refresh token, headless account, account linking, permission, role.

## Where this module ends

- **Custom auth logic** that goes beyond IAM's defaults (e.g. custom role assignment based on game state) is an Extend conversation. Route to `/ags-extend ask`.
- **Lobby chat / friends / parties** are not IAM — they live in the Lobby module. See `references/modules/lobby.md`.
- **Player-purchased entitlements** are tracked in the Store / Entitlements module, not IAM. See `references/modules/store-entitlements.md`.
