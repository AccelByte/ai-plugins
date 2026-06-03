---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
- https://accelbyte.io/ags-eos
see-also:
- '[iam.md](../modules/iam.md)'
- '[eos-coexistence.md](../cookbook/eos-coexistence.md)'
- '[headless-account-linking.md](../cookbook/headless-account-linking.md)'
---

# Platform — PC (Steam, Epic Games Store)

Reference notes for AGS integrations targeting **Steam** and **Epic Games Store** on PC. Covers identity bindings, gotchas, and the EOS coexistence story.

---

## Steam

- **Identity binding** — Steam is one of the AGS-supported platform identity providers. Players auth via Steam ticket; AGS exchanges the Steam ticket for an AGS token.
- **Steam DLC** — DLC purchased through Steam can be reconciled into the AGS entitlement model via the Third-party IAP component — verify Steam is listed among supported platforms in the Store & Catalog module docs.
- **Workshop / UGC** — out of AGS scope; live in the Steam ecosystem. Studios bridge via Extend Service Extensions if they need cross-system coordination.
- **Common gotcha** — Steam Session Tickets have short validity windows (see Valve developer docs for current limits); ensure token refresh logic is in place before the ticket expires.

## Epic Games Store

- **Identity binding** — Epic Games Store is one of the AGS-supported platform identity providers (listed as "Epic" in AGS auth docs — not the same thing as Epic Online Services (EOS), which is a separate Epic product; they often appear together in studio stacks).
- **DLC reconciliation** — verify Epic Games Store is listed among Third-party IAP supported platforms in the Store & Catalog module docs.

## EOS (Epic Online Services) coexistence

EOS is Epic's free game-services platform. Many studios start on EOS and outgrow it. AccelByte has a documented coexistence story (`https://accelbyte.io/ags-eos`):

- Players continue authenticating via EOS for friends, lobbies, sessions, P2P.
- AGS overlays via **headless account syncing** — this requires configuration; after setup, AGS automatically creates and links an AGS account to the EOS identity.
- No EOS data migration required.
- AGS adds custom backend logic (Extend), Multiplayer Servers (AMS), and Matchmaking on top of the EOS base.

For end-to-end details, see `references/cookbook/eos-coexistence.md` and `references/cookbook/headless-account-linking.md`. For the Extend side of the story, that conversation belongs in `/ags-extend ask`.

## Crossplay considerations

- AGS supports crossplay across PC platforms (Steam ↔ Epic Games Store) the same way it supports console crossplay — via account linking on a single AGS player identity.
- Per-platform Store / Entitlements differences are reconciled at the AGS Store layer; players see a unified ownership view.

## Where to look in the docs

- AccelByte IAM platform-provider docs: `https://docs.accelbyte.io/`
- AGS + EOS positioning: `https://accelbyte.io/ags-eos`
