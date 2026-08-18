---
last-verified: 2026-05-09
sources:
- https://accelbyte.io/pricing
see-also:
- '[pccu-bands.md](pccu-bands.md)'
- '[public-cloud.md](../deployment/public-cloud.md)'
- '[private-cloud.md](../deployment/private-cloud.md)'
- '[byoc.md](../deployment/byoc.md)'
---

# Pricing — Tiers

AGS sells in three named tiers. Each tier maps to a deployment model and a support package.

> **Note:** As of 2026, AGS pricing uses a hosting × module bundle matrix rather than the Starter/Growth/Enterprise tier names below. Refer to `https://accelbyte.io/pricing` for the current structure. The descriptions below are retained as historical reference.

> **The descriptions below are illustrative.** Always direct customers at `https://accelbyte.io/pricing` for current numbers. Treat in-repo descriptions as reference, not as authoritative quotes.

---

## Tier matrix

| Tier | Hosting | Support | Notes |
|---|---|---|---|
| **Starter / Free** | Public cloud | Community | Up to 25k play hours **or** 90 days free; see live pricing for post-trial structure |
| **Growth** | Public cloud | Standard | PCCU-based pricing; scales with player base |
| **Enterprise** | Private cloud or BYOC | Professional + Delivery Manager | Custom pricing; dedicated infra; data residency / SLA |

## Picking the right tier

### Starter / Free

- Pre-launch development.
- Internal alphas / closed betas.
- Studios validating AGS fit before committing.
- Bounded by the play-hour and time-window caps; not a production-launch tier for a successful title.

### Growth

- Default for indie / mid-market production launches.
- Public cloud, PCCU-based pricing per `references/pricing/pccu-bands.md`.
- Standard support — sufficient for studios that aren't running 24/7 live-service operations with multi-million PCCU.

### Enterprise

- Multi-million-dollar, multi-year contracts.
- Private Cloud (dedicated infra) or BYOC (customer's AWS account) deployment.
- **Delivery Manager** — named AccelByte contact (verify this is still the current term).
- **Support tiers** — as of 2026, publicly listed prices: Standard $1,000/title/month, Professional $5,500/title/month, Enterprise custom. Enterprise contracts typically include Professional Support or above.
- Custom contract terms (data residency, regional coverage, custom modules).
- Path: Growth tier customers approaching high PCCU (internal guidance: ~100k+ — not a documented product threshold) and asking about data residency, SLA, or compliance are Enterprise candidates.

## Upsell / tier-change patterns

- **Free → Growth**: when the studio crosses the 25k play-hour or 90-day cap, or wants production-grade support.
- **Growth → Enterprise**: signals = data residency mention, SLA request, dedicated infra ask, PCCU approaching high volume (internal guidance: ~100k+ — not a documented product threshold), regulatory / compliance concerns.

For the wider Expansion ICP guidance (which signals to watch and which buyer personas to engage), see `docs/internal/accelbyte-icp.md`.

## Where to look

- `https://accelbyte.io/pricing` — authoritative current pricing.
- `references/pricing/pccu-bands.md` — PCCU bands within Growth.
- `references/deployment/*.md` — what each deployment model means.
