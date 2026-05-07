---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[iam.md](../modules/iam.md)'
- '[store-entitlements.md](../modules/store-entitlements.md)'
- '[pc-steam-epic.md](pc-steam-epic.md)'
- '[console.md](console.md)'
---

# Platform — Mobile (iOS, Android)

Reference notes for AGS integrations on iOS and Android. The mobile-specific variables are **identity providers** (Apple, Google, Facebook) and **In-App Purchase flows** (Apple IAP, Google Play Billing).

---

## iOS

- **Identity providers** — Apple Sign-In, Google Sign-In, Facebook Login are AGS-supported. Apple Sign-In is required by App Store policy if other social sign-ins are offered.
- **IAP** — Apple IAP transactions are reconciled with the AGS Store / Entitlements model. Receipts validate against Apple's servers, and the entitlement is granted on AGS side.
- **Common gotcha** — Apple's anonymous-ID-on-Apple-Sign-In needs careful handling for cross-device account binding. Make sure the AGS account links to the stable Apple ID, not the per-app token.

## Android

- **Identity providers** — Google Sign-In, Facebook Login, Google Play Games. AGS-supported.
- **IAP** — Google Play Billing transactions reconciled with AGS Store / Entitlements.
- **Common gotcha** — Google Play Games sign-in is a separate flow from Google Sign-In; some studios bind both. Decide which is the primary identity for crossplay.

## Crossplay with PC and console

- Mobile crossplay is supported via account linking — same shape as PC and console.
- Performance / balance considerations for mobile-vs-PC crossplay are gameplay-design problems, not AGS problems.

## App Store / Play Store policy interaction

- Apple's In-App Purchase requirements apply when you sell digital goods to iOS players. AGS Store + IAP reconciliation gives a clean path; bypassing IAP for digital goods is forbidden by Apple policy.
- Google has parallel rules; same architecture applies on Android.
- AccelByte Access (standalone IAM packaging) is a common starting point for studios shipping a mobile-first title that needs cross-platform identity but isn't ready for full AGS economy adoption.

## Where to look in the docs

- AccelByte IAM platform-provider docs: `https://docs.accelbyte.io/`
- AccelByte Store IAP reconciliation: `https://docs.accelbyte.io/`
