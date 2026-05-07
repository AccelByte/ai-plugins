---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[auth-flow.md](auth-flow.md)'
- '[headless-account-linking.md](../cookbook/headless-account-linking.md)'
- '[iam.md](../modules/iam.md)'
- '[console.md](../platforms/console.md)'
---

# Integrate — Crossplay Identity

How to build a single AGS player identity that spans Steam + PSN + Xbox + Epic + Apple + Google + … so that a player who started on PC carries their account onto console, mobile, and back, with one set of friends, one wallet, one progression, one inventory.

---

## The two foundations

1. **Headless account linking** — the first time a player auths via any platform identity provider, AGS auto-creates a headless account linked to that platform identity.
2. **Account linking flow** — a logged-in player can subsequently link additional platform identities to the same AGS account.

Together: a player can start on Steam (auto-creates an AGS account), later link PSN (binds to the same AGS account), and use either credential going forward.

## Reference flow

```
   Player on PC (Steam):
     1. Plays the game on Steam
     2. SDK auto-creates AGS account linked to Steam identity
     3. Player progresses, accumulates wallet / inventory / friends

   Player buys console (PS5):
     4. Plays the same game on PS5
     5. PSN credential → AGS attempts auth
     6. PSN identity is NOT yet linked to any AGS account
        → Player is prompted to either:
          (a) Link to existing AGS account (proves Steam ownership), or
          (b) Create a new AGS account on PSN
     7. Player picks (a). After verification, PSN identity binds to the
        existing AGS account.
     8. Player carries wallet / inventory / friends across platforms.
```

The verification in step 7 is studio-configurable — typically a one-time-code flow shown on the PC client and entered on the PS5 client, or an email-based confirmation, depending on the studio's UX preferences.

## Implementation pattern

- **At first login on each platform:** check whether the platform identity is already linked to an AGS account.
- **If yes:** log in as that AGS account.
- **If no:** prompt for link-to-existing or create-new.
- **After link:** future logins via that platform credential resolve to the linked AGS account directly.

## Crossplay friction points (and how AGS handles them)

| Friction | AGS behavior |
|---|---|
| Two players started independently on PC and PS5 with different progress | Player must pick which AGS account to keep; the other becomes orphaned |
| Player wants to unlink a platform identity | Supported via IAM API; rules around "you can't unlink your last credential" apply |
| Player's PSN account is a child account / family-linked | Some platform-policy constraints flow through to AGS; check IAM platform-binding docs |
| Crossplay disabled at platform level (e.g. Sony policy on a particular title) | AGS doesn't override platform crossplay rules; matchmaking respects platform constraints |

## Where this hands off

- **Per-platform IdP setup** — AGS-side platform identity provider config in the Admin Portal. See `references/platforms/`.
- **EOS coexistence** — a specific case of crossplay-identity bridging where AGS overlays on EOS. See `references/cookbook/eos-coexistence.md` and `references/cookbook/headless-account-linking.md`.
- **Custom verification logic** during link (e.g. studio-specific rules about who can link which identities) — often an Extend Override conversation. Route to `/ags-extend ask`.
