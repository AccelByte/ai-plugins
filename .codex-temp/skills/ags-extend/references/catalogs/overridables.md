---
last-verified: 2026-05-09
authoritative-source: AGS Admin Portal → your namespace → Extend → Override points
note: The authoritative list of override points lives in the Admin Portal for the
  target namespace and changes with AGS releases. This file is a STARTER TABLE, not
  an exhaustive reference.
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
see-also:
- '[events.md](events.md)'
- '[slo.md](../production/slo.md)'
---

# AGS Override Points (Starter Catalog)

Override points are the specific decisions inside AGS services where an Extend Override can plug in. An Extend Override is only possible at a point AGS explicitly exposes; you cannot override arbitrary code paths.

## Where the authoritative list lives

**The Admin Portal is the source of truth.** Navigate:

```
Admin Portal → <target namespace> → Extend → Override points (or "Overridable endpoints")
```

The portal lists, per AGS service, exactly which methods can be overridden in your environment. AGS adds override points over time; older namespaces may show fewer options than newer ones.

## How to use this file

This file is a **starter** — it lists widely-used override points to help a developer know what shape of customization is typical before opening the portal. It is not an exhaustive reference and it is not guaranteed current. Every override point listed here should exist in a reasonably-recent AGS namespace, but the exact method name, proto path, or signature may drift between releases.

**Always confirm against the portal before scaffolding.** When the developer is ready to implement, the wizard asks which override point they're targeting — that answer should come from the portal, not this file.

## Starter table

| AGS Service | Common override points | What you typically customize |
|---|---|---|
| Matchmaking | Enrichment (EnrichTicket) and Make Matches | Who gets matched sooner (VIP tiers, regional bias); custom match-making logic |
| Matchmaking | Validation (ValidateTicket) — returns whether a ticket is eligible | Whether a ticket is even considered for a match |
| Session / Lobby | Party formation rules | How players are grouped before matchmaking |
| Entitlements | Grant evaluation _(not confirmed in public docs)_ | Whether a specific entitlement applies to a user |
| Inventory | Item visibility / listing _(not confirmed in public docs)_ | Filtering what a player sees in their inventory |
| IAM / Identity | Post-login hook _(not confirmed in public docs)_ | Custom checks or metadata attachment after AGS authenticates a user |
| Rewards | Distribution rules _(not confirmed in public docs; reward reactions may belong under Event Handler)_ | Which rewards apply under custom conditions |

Every row is "generally exposed as an override point" — but confirm in the Admin Portal before committing to an implementation.

## What doesn't go here

- **Event reactions.** If AGS emits an event when X happens and you just want to react to it, that's `catalogs/events.md` + Event Handler, not Override.
- **New endpoints.** If AGS doesn't expose the decision you want to influence as an override point, Override is not an option — consider Service Extension to front-run AGS from outside.
- **Storage-level changes.** Override replaces decision logic; it does not alter AGS's own data model.

## When the portal shows no override points

Two common causes:

1. **Namespace configuration.** Some AGS tiers or contract configurations gate Extend features. If the Extend section is missing entirely, check with your AccelByte contact about enabling it.
2. **AGS service version.** Override points are added per service version. An older namespace may need an AGS upgrade before newer override points appear.

In either case, this subskill cannot resolve it — the developer needs to contact AccelByte support / their AGS admin.

## What to point `ask` at

When a developer asks "can I override X?":

1. Answer conceptually from `overview.md` ("Override is for replacing an AGS decision synchronously").
2. If X is in the starter table above, say "commonly yes — confirm in the Admin Portal's override-points list for your namespace."
3. If X is not in the table, say "not listed in the starter catalog; the authoritative list is in the Admin Portal. If the portal doesn't show it, Override isn't an option — consider Event Handler (if AGS emits an event) or Service Extension (if you need a new API)."

Do not invent override points. If it's not in the portal, it isn't overridable.
