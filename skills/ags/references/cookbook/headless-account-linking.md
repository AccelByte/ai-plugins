---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
- https://accelbyte.io/ags-eos
see-also:
- '[eos-coexistence.md](eos-coexistence.md)'
- '[auth-flow.md](../integrate/auth-flow.md)'
- '[crossplay-identity.md](../integrate/crossplay-identity.md)'
- '[iam.md](../modules/iam.md)'
---

# Cookbook — Headless Account Linking

How AGS bridges to a third-party identity provider (most notably **EOS**, but the same pattern applies to Steam, PSN, Xbox, etc.) by auto-creating a "headless" AGS account when a player first authenticates via that provider.

---

## What "headless" means

A **headless account** is an AGS player account that has no AccelByte-native credentials of its own (no email/password) and exists solely as a binding between AGS internals (player ID, namespace scope, entitlements, etc.) and a third-party platform identity. The player authenticates via the third-party identity; AGS attaches its own player ID and state to that identity transparently.

The player can **upgrade** a headless account later by adding an AccelByte-native credential (email + password), or by linking additional platform identities (e.g. a Steam-headless account links PSN as well, becoming crossplay-ready).

## Reference flow for EOS overlay

```
   1. Player authenticates via EOS Auth (Epic-side flow)
   2. Game client receives EOS auth ticket
   3. Game client passes the EOS ticket to AGS IAM
   4. AGS IAM:
        a. Checks: is this EOS identity already linked to an AGS player?
        b. If yes: log in as that AGS player. Mint AGS access + refresh tokens.
        c. If no: auto-create a headless AGS account linked to the EOS
           identity. Mint AGS access + refresh tokens. Return.
   5. Game client now has both an EOS auth state AND an AGS auth state.
      Player sees only the EOS login UX; AGS state is invisible.
   6. Subsequent calls to AGS modules attach the AGS access token. EOS
      calls (friends, lobbies, sessions, P2P) continue to use the EOS state.
```

## Why this pattern is good

- **No second login UX.** Players don't see an AGS sign-up flow on top of their EOS sign-in.
- **No data migration.** Existing EOS players get headless AGS accounts when they first hit AGS-backed code paths; no batch migration required.
- **Reversible.** If a studio walks away from AGS, EOS auth keeps working; the headless AGS layer is dormant rather than blocking.
- **Linkable.** A headless AGS account can later be upgraded with AGS-native credentials or linked to additional platform identities for crossplay.

## When to use it (other than EOS)

The same pattern applies to any platform identity provider AGS supports:

- **Steam** — first Steam login auto-creates a headless AGS account linked to the Steam identity.
- **PSN, Xbox, Nintendo Switch** — same.
- **Apple Sign-In, Google Sign-In, Facebook** — same on mobile.

In practice, "headless account linking" is the *default* AGS auth pattern for platform-mediated logins — it just got a name because the EOS coexistence story made it explicit.

## Configuration knobs

- **Auto-create vs. require explicit opt-in** — some namespaces require the player to consent to AGS account creation. Default is auto-create; check Admin Portal IAM config for the namespace's policy.
- **Default permissions / role** for headless accounts — configurable per namespace.
- **Upgrade path** — whether players can later add email/password, link other platforms, etc., is controlled by namespace policy.

## Where to look in the docs

- AGS + EOS positioning: `https://accelbyte.io/ags-eos`.
- AccelByte IAM headless-account documentation: `https://docs.accelbyte.io/`.
- Glossary: `references/glossary.md` — headless account, headless account linking, account linking.
