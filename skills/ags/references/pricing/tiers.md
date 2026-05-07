---
last-verified: 2026-04-29
sources:
- https://accelbyte.io/pricing
see-also:
- '[pccu-bands.md](pccu-bands.md)'
- '[shared-cloud.md](../deployment/shared-cloud.md)'
- '[private-cloud.md](../deployment/private-cloud.md)'
- '[byoc.md](../deployment/byoc.md)'
---

# Pricing — Tiers

AGS sells in three named tiers. Each tier maps to a deployment model and a support package.

> **The descriptions below are illustrative.** Always direct customers at `https://accelbyte.io/pricing` for current numbers. Treat in-repo descriptions as reference, not as authoritative quotes.

---

## Tier matrix

| Tier | Hosting | Support | Notes |
|---|---|---|---|
| **Starter / Free** | Shared cloud | Community | Up to 25k play hours **or** 90 days free; then from ~$100/month |
| **Growth** | Shared cloud | Standard | PCCU-based pricing; scales with player base |
| **Enterprise** | Private cloud or BYOC | Professional + Delivery Manager | Custom pricing; dedicated infra; data residency / SLA |

## Picking the right tier

### Starter / Free

- Pre-launch development.
- Internal alphas / closed betas.
- Studios validating AGS fit before committing.
- Bounded by the play-hour and time-window caps; not a production-launch tier for a successful title.

### Growth

- Default for indie / mid-market production launches.
- Shared cloud, PCCU-based pricing per `references/pricing/pccu-bands.md`.
- Standard support — sufficient for studios that aren't running 24/7 live-service operations with multi-million PCCU.

### Enterprise

- Multi-million-dollar, multi-year contracts.
- Private Cloud (dedicated infra) or BYOC (customer's AWS account) deployment.
- **Delivery Manager** — named AccelByte contact.
- **Professional Support** with stricter SLA / response times.
- Custom contract terms (data residency, regional coverage, custom modules).
- Path: Growth tier customers approaching 100k+ PCCU and asking about data residency, SLA, or compliance are Enterprise candidates.

## Upsell / tier-change patterns

- **Free → Growth**: when the studio crosses the 25k play-hour or 90-day cap, or wants production-grade support.
- **Growth → Enterprise**: signals = data residency mention, SLA request, dedicated infra ask, PCCU approaching 100k+, regulatory / compliance concerns.

For the wider Expansion ICP guidance (which signals to watch and which buyer personas to engage), see `docs/internal/accelbyte-icp.md`.

## Where to look

- `https://accelbyte.io/pricing` — authoritative current pricing.
- `references/pricing/pccu-bands.md` — PCCU bands within Growth.
- `references/deployment/*.md` — what each deployment model means.
