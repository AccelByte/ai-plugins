---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[iam.md](../modules/iam.md)'
- '[pc-steam-epic.md](pc-steam-epic.md)'
- '[mobile.md](mobile.md)'
---

# Platform — Consoles (PlayStation, Xbox, Nintendo Switch)

Reference notes for AGS integrations targeting console platforms. The big variable on console is **certification**: each platform holder has its own requirements that interleave with the AGS integration but are mostly independent of it.

---

## PlayStation (PS4, PS5)

- **Identity binding** — PSN is one of the AGS-supported platform identity providers. Players auth via PSN ID; AGS issues an AGS token.
- **PSN DLC** — DLC reconciliation via the AGS Third-party IAP component. See the Store & Catalog module docs for current details.
- **Crossplay** — supported via account linking on a single AGS player. Sony's crossplay rules apply at the platform-policy level.
- **Cert-related AGS surface** — In practice, IAM platform-binding flows are often scrutinized during certification — confirm requirements with your PlayStation certification contact.

## Xbox (Xbox One, Xbox Series X|S)

- **Identity binding** — Xbox Live is one of the AGS-supported platform identity providers. Players auth via Xbox Live token; AGS issues an AGS token.
- **Xbox DLC** — DLC reconciliation via the AGS Third-party IAP component. See the Store & Catalog module docs for current details.
- **Crossplay** — supported.
- **Cert-related AGS surface** — same shape as PlayStation; in practice, IAM platform-binding is often scrutinized — confirm requirements with your Xbox certification contact.

## Nintendo Switch

- Identity binding for Switch follows Nintendo's flow; AGS supports it as a platform identity provider.
- Cert and platform constraints follow Nintendo's guidelines, not AGS's.

## DevKit considerations

- Console DevKits are often the *first* place AGS integration is exercised end-to-end. ADT's console DevKit support is a meaningful coordinator here for build delivery — see `references/ecosystem/adt.md`.
- AGS endpoints may need to be on the DevKit allow-list — check with AccelByte support for the current endpoint list.

## Crossplay across console + PC + mobile

- Single AGS player can have multiple platform identities bound (PSN + Xbox + Steam + Epic + mobile).
- Crossplay matchmaking and sessions work; the matchmaking module's region routing helps balance latency.
- Per-platform certification rules (e.g. "no crossplay between PSN and Xbox without policy approval") apply at the platform level — AGS doesn't override those.

## Where to look in the docs

- AccelByte IAM platform-provider docs: `https://docs.accelbyte.io/`
- ADT (console DevKit support): `references/ecosystem/adt.md` and `/adt`.
