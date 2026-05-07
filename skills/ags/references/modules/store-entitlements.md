---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[iam.md](iam.md)'
- '[achievements.md](achievements.md)'
- '[glossary.md](../glossary.md)'
---

# Module — Store & Entitlements

Item catalog, purchase flows, wallet, DLC management. The economy layer of AGS. Defines what's for sale, what currencies exist, how purchases happen, and what each player owns.

---

## What it covers

- **Catalog** — items (skins, bundles, loot boxes, season passes, DLC), per-currency pricing, per-platform variants, categorization.
- **Currencies** — real (USD via Stripe / platform IAP) and virtual (gold coins, gems, in-game currencies).
- **Wallet** — per-player, per-namespace currency balances.
- **Orders** — transactional records with states (init, pending, fulfilled, refunded). One order can yield multiple entitlements.
- **Entitlements** — what the player owns. Granted by purchase, by promotion, by achievement unlock, etc. Checked at use-time (e.g. before equipping a cosmetic).
- **DLC reconciliation** — platform DLC (Steam DLC, PSN DLC, Xbox DLC) is reconciled with the AGS entitlement model so players don't lose ownership across platforms.
- **Promotions / coupons** — time-limited or condition-gated grants of items, currency, or discounts.

## How Store / Entitlements relates to the other modules

| Module | Relationship |
|---|---|
| **IAM** | Wallet and entitlements are per-player, scoped via IAM identity |
| **Achievements** | Achievement unlocks can grant entitlements |
| **Analytics** | Order events feed monetization analysis |
| **Extend** | Custom purchase flows, custom anti-fraud, dynamic pricing — all Extend Override conversations |

## When custom logic is needed

Common Extend patterns:

- **Override** — replace the purchase-validation decision (anti-fraud, custom item availability rules).
- **Override** — dynamic pricing (compute price at purchase time based on player segment / region / live-ops state).
- **Service Extension** — custom storefront features AGS doesn't natively support (custom bundles, gacha mechanics, dynamic loot boxes).
- **Event Handler** — react to purchase events (CRM updates, external fulfillment, fraud monitoring).

`Gacha Suite` in the Extend Apps Directory is a worked example: idle-gacha game backend integrating with AGS wallet, stats, cloud save.

## Where to look in the docs

- AccelByte Store / Entitlements docs: `https://docs.accelbyte.io/`
