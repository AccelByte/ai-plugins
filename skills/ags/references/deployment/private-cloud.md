---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[shared-cloud.md](shared-cloud.md)'
- '[byoc.md](byoc.md)'
- '[tiers.md](../pricing/tiers.md)'
---

# Deployment — Private Cloud

Dedicated infrastructure, single-tenant, **AccelByte-managed**. The Enterprise tier deployment.

---

## What it is

AGS deployed on dedicated infra for a single customer. AccelByte still runs ops, upgrades, and platform-level security — but the underlying infrastructure isn't shared with other studios.

## When it's the right answer

- **Data residency requirements** — GDPR, certain APAC jurisdictions, or contractual obligations that mandate data stays in a specific region.
- **Enterprise SLA** — stricter uptime and incident-response guarantees than standard.
- **Compliance** — regulated markets (financial-tied gaming, age-gated jurisdictions, certain government contracts).
- **Scale** — at high PCCU, dedicated infra becomes economically attractive vs. shared.
- **Strategic partnership** — large publishers signing multi-year platform deals typically want this tier.

## What's included (typically)

- Dedicated infrastructure, single-tenant.
- AccelByte-managed (operations, upgrades, security).
- **Delivery Manager** — a named AccelByte-side contact owning the relationship.
- **Professional Support** tier with stricter response SLAs.
- Custom contract terms negotiated for SLA, data handling, region selection.

## Operational shape

- **Upgrades** — scheduled with the Delivery Manager rather than on AccelByte's general release cadence. Customers can negotiate maintenance windows.
- **Region** — single region by default, dictated by data-residency need. Multi-region setups exist but require contract-level agreement.
- **Support** — Professional Support with stricter SLAs.

## How it differs from BYOC

| | Private Cloud | BYOC |
|---|---|---|
| Infrastructure ownership | AccelByte | Customer's own AWS account |
| Operated by | AccelByte | AccelByte (using customer's cloud commitments) |
| Best for | Data-residency / SLA / compliance needs | Existing cloud commitments to consume |

## Pricing implications

Custom pricing — not PCCU bands. Contract-bound. Refer customers to AccelByte sales for specifics.

## Where to look in the docs

- AccelByte deployment / Enterprise tier docs: `https://docs.accelbyte.io/`
- AccelByte sales for contract conversations.
