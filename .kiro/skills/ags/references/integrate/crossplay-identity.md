---
last-verified: 2026-05-09
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
        → AGS auto-creates a headless PSN account.
        Player must separately initiate account-link via IAM API or Admin Portal
        to bind the PSN account to the existing Steam account.
     7. After account-link, PSN identity binds to the existing AGS account.
     8. Player carries wallet / inventory / friends across platforms.
```

The specific verification UX in step 7 is implemented by the studio using IAM linking APIs; typical patterns include showing a one-time code on the PC client for the player to enter on the PS5 client.

## Implementation pattern

- **At first login on each platform:** check whether the platform identity is already linked to an AGS account.
- **If yes:** log in as that AGS account.
- **If no:** prompt for link-to-existing or create-new.
- **After link:** future logins via that platform credential resolve to the linked AGS account directly.

## Crossplay friction points (and how AGS handles them)

| Friction | AGS behavior |
|---|---|
| Two players started independently on PC and PS5 with different progress | AGS has no built-in merge flow; the two accounts remain separate. The player must manually re-link credentials, accepting that one account's progression won't carry over. |
| Player wants to unlink a platform identity | Supported via IAM API; if the last credential is unlinked from a headless account, the account becomes permanently unreachable — promote to a full account (add email/password) before unlinking the last IdP |
| Player's PSN account is a child account / family-linked | Platform-policy constraints may apply; check IAM platform-binding docs at https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/authentication/account-integration/ |
| Crossplay disabled at platform level (e.g. Sony policy on a particular title) | AGS doesn't override platform crossplay rules; matchmaking respects platform constraints (platform-level constraint, not AGS-documented — verify with platform requirements) |

## Where this hands off

- **Per-platform IdP setup** — AGS-side platform identity provider config in the Admin Portal. See `references/platforms/`.
- **EOS coexistence** — a specific case of crossplay-identity bridging where AGS overlays on EOS. See `references/cookbook/eos-coexistence.md` and `references/cookbook/headless-account-linking.md`.
- **Custom verification logic** during link (e.g. studio-specific rules about who can link which identities) — often an Extend Override conversation. Route to `/ags-extend ask`.
