---
last-verified: 2026-08-17
sources:
- https://docs.accelbyte.io/
see-also:
- '[private-cloud.md](private-cloud.md)'
- '[byoc.md](byoc.md)'
- '[tiers.md](../pricing/tiers.md)'
---

# Deployment — Public Cloud

The default AGS deployment model. AccelByte-managed multi-tenant cloud. **Most studios start here.**

> Previously called **Shared Cloud**. Same tier, renamed — older AccelByte documentation and support threads still use the old name.

---

## What it is

A multi-tenant, AccelByte-operated cloud deployment that hosts namespaces for many studios on shared infrastructure. The studio gets a namespace (or several) and an Admin Portal URL; AccelByte runs the underlying infra, scaling, upgrades, security, and ops.

## When it's the right answer

- **Indie / mid-market studios** building their first online title or expanding a single title.
- **Pre-launch and early-launch** phases when the player base is small (note: default CCU quota is 25,000 concurrent players per game — see CCU quota note below).
- Studios that **don't have data-residency constraints** and aren't bound by enterprise compliance requirements.
- Studios that **want minimal ops involvement** — the whole point is that someone else runs the platform.

## When to consider moving off public cloud

- **Data residency** — players in jurisdictions that require data to stay in a specific region (GDPR, certain APAC markets, etc.).
- **Enterprise SLA needs** — when a contract demands stricter uptime guarantees than the standard tier provides.
- **Dedicated infra ask** — explicit isolation requirements (regulatory, customer concerns).
- **Scale economics** — at high PCCU, dedicated infra can become more cost-effective than shared.

The next step is **Private Cloud** (`references/deployment/private-cloud.md`) or **BYOC** (`references/deployment/byoc.md`).

## Operational shape

- **Upgrades** — AccelByte's release cadence; managed maintenance windows. Studios don't control when upgrades happen but get advance notice.
- **Support tier** — Discord Community for self-serve; higher-tier support is contract-dependent.
- **Region choices** — limited to the regions AGS already operates in. Adding a region is an AccelByte-side decision, not a customer-side one.

## CCU quota

Default 25,000 concurrent players per game. New logins above the quota return HTTP 403 unless Login Queue is enabled (Admin Portal → Login Queue). Contact AccelByte support to raise the cap.

## Pricing implications

PCCU-based, with starter / free tiers covering early development. See `references/pricing/tiers.md`. Always direct customers to `https://accelbyte.io/pricing` for current numbers.

## Where to look in the docs

- AccelByte deployment docs: `https://docs.accelbyte.io/`
