---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[shared-cloud.md](shared-cloud.md)'
- '[private-cloud.md](private-cloud.md)'
- '[tiers.md](../pricing/tiers.md)'
---

# Deployment — Bring Your Own Cloud (BYOC)

AGS deployed into the customer's own AWS environment. **AccelByte-managed**, but on the customer's cloud account.

---

## What it is

The customer brings their AWS account (existing org-level commitments, cost-allocation buckets, security boundaries). AccelByte deploys AGS into that account and runs ops on top of it. Customer pays AWS directly for infrastructure; pays AccelByte for the platform license and management.

## When it's the right answer

- **Existing cloud commitments** — customer has a multi-year AWS spend agreement and wants to consume that commit.
- **Cost-allocation discipline** — finance / IT requires AGS infra costs to live in the customer's AWS account for reporting.
- **Specific cloud-account isolation requirements** — security model that demands AGS run inside the customer's network boundary even if AccelByte operates it.
- **Hybrid setups** — pairing BYOC of AGS with bare-metal AMS, or with on-prem services the customer already runs.

## What's included

- AccelByte deploys AGS components into the customer's AWS account.
- AccelByte continues to manage operations, upgrades, monitoring, security patches.
- Customer maintains AWS-account-level controls (IAM at the AWS layer, billing, network).

## Operational shape

- **Upgrades** — coordinated with customer; similar to Private Cloud but with customer-side AWS-layer validation steps.
- **Support** — Professional Support / Delivery Manager typical, since BYOC is enterprise-tier.
- **Region** — wherever the customer has AWS presence.

## How it differs from Private Cloud

| | Private Cloud | BYOC |
|---|---|---|
| Infra owned by | AccelByte | Customer (AWS account) |
| Infra paid by | AccelByte (rolled into contract) | Customer (direct to AWS) |
| Best for | Data-residency / SLA / compliance | Existing AWS commitments to consume |

## Pricing implications

Custom — typically Enterprise tier. Customer has AWS bill plus AccelByte license. The shape of the AccelByte license depends on the contract; this is a sales conversation.

## Where to look in the docs

- AccelByte deployment / Enterprise tier docs: `https://docs.accelbyte.io/`
- AccelByte sales for contract conversations.
