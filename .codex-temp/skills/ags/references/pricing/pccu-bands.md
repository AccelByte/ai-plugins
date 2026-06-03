---
last-verified: 2026-05-09
sources:
- https://accelbyte.io/pricing
- https://accelbyte.io/ags-pricing
- https://accelbyte.io/pricing-calculator
see-also:
- '[tiers.md](tiers.md)'
- '[glossary.md](../glossary.md)'
---

# Pricing — PCCU Bands

AGS pricing is metered on **Peak Concurrent Users (PCCU) per day** — the maximum number of distinct players actively interacting with AccelByte APIs in a given day. The price per PCCU/day **decreases** as PCCU grows (band-based discounting).

> **Don't quote in-repo pricing as authoritative.** Direct customers at `https://accelbyte.io/ags-pricing` for current per-PCCU pricing, and `https://accelbyte.io/pricing-calculator` to model their specific shape. Captured numbers go stale — confirmed by a 2026-04-29 crawl that the live site's bands no longer match the source material in `docs/internal/accelbyte-pricing.md`.

---

## Band shape (as of last source capture)

The PCCU pricing curve has the following shape:

- **Multiple bands**, with the per-PCCU/day price stepping down as PCCU climbs.
- The first 30 PCCU/day are permanently free (included in all Shared Cloud plans). The first paid band begins at 31 PCCU/day; discounts kick in at progressively higher thresholds.
- **Starter packages** for committed tiers existed at roughly $2,500–$3,500/month range as of source capture.
- **Above the highest band**, pricing flattens to a long-tail rate.
- **Real numbers move.** The internal capture in `docs/internal/accelbyte-pricing.md` recorded one snapshot; the live site shows different numbers as of 2026-04-29. Treat the capture as a shape illustrator, not a quote.

## How PCCU is measured

A "PCCU" is the daily peak distinct count of players hitting AGS APIs — login, lobby, matchmaking, store, leaderboards, etc. Not all players are PCCU at once; PCCU is the high-water mark within a 24-hour window.

## Practical implications

- Studios with **even traffic** (e.g. live games with ~constant DAU) tend to have PCCU close to peak DAU.
- Studios with **spiky traffic** (event launches, beta tests, weekend bursts) see PCCU spike on event days.
- The **calculator** at `https://accelbyte.io/pricing-calculator` lets studios model their cost across different DAU/PCCU ratios.

## Starter / free tier (legacy tier name)

- Up to 25k play hours **or** 90 days free.
- After trial: 30 PCCU/day included permanently. Usage beyond 30 PCCU/day billed at the applicable band rate. No monthly base fee for Shared Cloud.
- Suitable for development and early-launch.

## Enterprise tier (legacy tier name)

- Custom pricing for Private Cloud and BYOC deployments. Contact AccelByte sales for current commercial structure.
- Refer customers to AccelByte sales for current terms.

## What's not included in PCCU pricing

- **AMS** is separately priced.
- **Extend** is separately priced.
- **ADT** is a separate product entirely with separate pricing.
- **Access** (standalone IAM) has its own pricing — included if the customer is on full AGS, otherwise contract-bound.
- **AIS is deprecated** — never quote AIS pricing.

## Where to look

- `https://accelbyte.io/pricing` — authoritative current numbers.
- `https://accelbyte.io/pricing-calculator` — model your specific shape.
- `references/pricing/tiers.md` — the named tiers (Starter / Growth / Enterprise).
