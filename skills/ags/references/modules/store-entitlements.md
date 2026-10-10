---
last-verified: 2026-10-09
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/modules/online/wallets-payments/how-to/create-store/
- https://docs.accelbyte.io/gaming-services/modules/online/wallets-payments/how-to/create-items/
- https://docs.accelbyte.io/gaming-services/modules/online/wallets-payments/how-to/publish-store/
- https://raw.githubusercontent.com/AccelByte/accelbyte-go-sdk/main/spec/platform.json
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
- **Currencies** — real (via platform IAP — PlayStation, Xbox, Steam, etc.) and virtual (gold coins, gems, in-game currencies).
- **Wallet** — each virtual currency is its own per-player wallet with publisher-namespace or game-namespace scope. Platform IAP credits are tracked in platform-specific sub-wallets (Steam, PSN, Xbox); overall balance = sum of sub-wallets.
- **Orders** — transactional records. States: Unpaid → Paid → Fulfilled (success); Refunding → Refunded; Chargeback → Chargeback Reversed; Fulfill Failed; Closed (unpaid orders expire after 10 min). One order can yield multiple entitlements.
- **Entitlements** — what the player owns. Granted by purchase, by promotion, by achievement unlock, etc. Checked at use-time (e.g. before equipping a cosmetic).
- **DLC reconciliation** — platform DLC (Steam DLC, PSN DLC, Xbox DLC) is reconciled with the AGS entitlement model so players don't lose ownership across platforms.
- **Promotions / coupons** — time-limited or condition-gated grants of items, currency, or discounts.

## Creating items

Items are created in a **draft** store — a published store's items cannot be modified — with `POST /platform/admin/namespaces/{namespace}/items?storeId={storeId}`. Required body fields: `name`, `itemType`, `entitlementType`, `categoryPath`, `status` (`ACTIVE` / `INACTIVE`), `localizations` and `regionData`.

Two requirements trip item creation, and both come from the **store**, not the item:

- **`regionData` must have an entry for the store's default region** — every item, including free items and items with `purchasable: false`. Missing it fails with **30022** `Default region [{region}] is required`. A free item is priced, not unpriced: an entry with `price: 0`. Each entry needs `price`, `currencyCode`, `currencyNamespace` and `currencyType` (`REAL` / `VIRTUAL`). Never omit `regionData` or send it empty to mean "free".
- **`localizations` must include the store's default language**, with a `title`. Missing it fails with **30021** `Default language [{language}] required`.

The store's `defaultRegion` and `defaultLanguage` are set when the store is created, and fall back to `US` and `en` only when it was created without them. Read the store (`GET /platform/admin/namespaces/{namespace}/stores/{storeId}`) rather than assuming US/en.

A free item granted by the game rather than sold, in a store whose defaults are US / en:

```json
{
  "name": "season_pass_free",
  "itemType": "INGAMEITEM",
  "entitlementType": "DURABLE",
  "categoryPath": "/rewards",
  "status": "ACTIVE",
  "purchasable": false,
  "localizations": { "en": { "title": "Free Season Pass" } },
  "regionData": {
    "US": [ { "price": 0, "currencyCode": "USD", "currencyNamespace": "<namespace>", "currencyType": "REAL" } ]
  }
}
```

`itemType` and `categoryPath` above are illustrative; use the item's real type and an existing category. Type-specific fields apply too: `useCount` for consumables, `targetCurrencyCode` for `COINS`, `appId`/`appType` for `APP`, `targetNamespace` when selling a game's item from the publisher namespace. `purchasable` controls whether the item can be bought and `listable` whether players see it; neither relaxes the default-region requirement.

Changes go live only when the draft is published: `PUT /platform/admin/namespaces/{namespace}/stores/{storeId}/catalogChanges/publishAll` (or `publishSelected`).

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

For a worked example (e.g. idle-gacha backend integrating with AGS wallet, stats, cloud save), check the current Extend Apps Directory — verify the app name and URL at https://docs.accelbyte.io/ as names may change.

## Where to look in the docs

- AccelByte Store / Entitlements docs: `https://docs.accelbyte.io/`
