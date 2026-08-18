---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/getting-started/
- https://accelbyte.io/gaming-services
see-also:
- '[glossary.md](glossary.md)'
- '[faq.md](faq.md)'
- '[iam.md](modules/iam.md)'
- '[extend.md](ecosystem/extend.md)'
---

# AGS — Overview

AccelByte Gaming Services (AGS) is a managed, cloud-hosted game backend platform. Studios integrate AGS instead of building and operating their own backend services for identity, social, multiplayer, economy, and analytics. AGS runs as a multi-tenant SaaS by default, with private-cloud and bring-your-own-cloud options for enterprise customers with data-residency or dedicated-infrastructure requirements.

The platform is **modular** — studios adopt the modules they need and pay for actual usage, metered as Peak Concurrent Users (PCCU) per day. AGS is the core platform; **Extend** adds custom backend logic on top of it; **AMS** (AccelByte Multiplayer Servers) hosts dedicated game servers and integrates natively with AGS matchmaking and sessions; **ADT** (AccelByte Development Toolkit) handles build distribution, crash reporting, and playtesting; **Access** provides standalone cross-platform identity for studios that aren't ready for full AGS.

---

## Core service modules

| Module | What it does |
|---|---|
| **IAM** (Identity & Access Management) | Player accounts, authentication, OAuth 2.0, SSO, ban management, role-based access |
| **Parties & Presence** | Party management, platform presence, invitations |
| **Chat** | Party chat, personal DMs, session chat |
| **Matchmaking** | Rule-based matchmaking with custom attributes (MMR, region, party size, …) |
| **Session Management** | Game session lifecycle, server assignment, reconnection |
| **Leaderboards** | Global and seasonal leaderboards, score ingestion |
| **Achievements** | Configurable achievement and progression systems |
| **Entitlements & Store** | Item catalog, purchase flows, wallet, DLC management |
| **Game Analytics** | Event ingestion and player-behavior data pipeline |
| **Friends** | Friends, blocking, notifications |

Each module exposes both REST APIs (with OpenAPI specs) and SDK methods. Game clients typically use the SDK; web portals and admin tools use REST directly via OAuth.

---

## Deployment models

| Model | Description | Best for |
|---|---|---|
| **Public Cloud** | AccelByte-managed, multi-tenant | Indie / mid-market studios; early titles before launch |
| **Private Cloud** | Dedicated infrastructure, single-tenant, AccelByte-managed | Enterprise studios with data-residency, compliance, or SLA requirements |
| **Bring Your Own Cloud (BYOC)** | Deployed into the customer's own AWS environment | Publishers with existing cloud commitments or cost agreements |
| **Bare Metal / Hybrid** | AMS on bare metal or hybrid; AGS still managed | High-performance, cost-sensitive multiplayer titles |

For day-to-day development, all four models look similar from the SDK's perspective. The differences show up in onboarding (Admin Portal URL, SLA, who runs the upgrade window) rather than in API surface.

---

## SDKs and integration surface

AGS ships three SDK families:

- **Game Engine SDKs** — for the game itself (clients and dedicated servers). Currently: **Unreal Engine, Unity, Godot, Roblox**. This is what most studios reach for when they say "the AGS SDK."
- **TypeScript SDK for Web Apps** — a standalone library for web apps that talk to AGS: admin / live-ops dashboards, web companion apps, browser-based tooling. Sits alongside the Game Engine SDKs as a sibling, not a subset.
- **Extend SDKs** — Go, Python, C#, Java. These are *not* game-client SDKs; they're the libraries Extend apps use to talk to AGS from inside AccelByte's infrastructure. Owned by the `/ags-extend` skill, not this one.

Underneath all three families:

- **REST + OpenAPI** — every AGS service has a REST surface with OpenAPI specs. Custom engines (anything outside the four supported game engines) integrate via REST directly. The SDKs are thin wrappers over this surface.
- **OAuth 2.0** — all client and server access is OAuth-mediated. Game clients use Public IAM clients; game servers and backend services use Confidential IAM clients. Admin tools and web apps also use Public clients with appropriate redirect URIs.
- **Crossplay-ready** — single persistent player identity across PC, console, and mobile. Players keep one account regardless of where they log in.

See `references/sdks/game-engine/` for per-engine specifics, `references/sdks/web/typescript.md` for the Web SDK, and `/ags-extend` for Extend SDK material.

---

## Pricing shape

AGS is metered on **Peak Concurrent Users (PCCU) per day** — the maximum number of players hitting AccelByte APIs in a given day. Pricing tiers down at higher volumes; starter/free tiers cover early development.

Detailed bands and tier descriptions are in `references/pricing/pccu-bands.md` and `references/pricing/tiers.md`. Current numbers live at `https://accelbyte.io/pricing` — quote those rather than the in-repo bands when answering customers, since the in-repo numbers are illustrative and may go stale.

---

## Where AGS fits, and what's separate

The AccelByte product picture is simpler than the marketing pages make it look. There are really **two products**:

1. **AGS** (this skill) — the core game backend platform. Includes IAM, Lobby, Sessions, Leaderboards, Achievements, Store/Entitlements, Analytics, Social, plus three deeper areas with dedicated routes:
   - **Matchmaking** — rule-based matchmaking. Deep work routes through `/ags matchmaking`.
   - **AMS** (AccelByte Multiplayer Servers) — dedicated game-server hosting integrated with Matchmaking and Sessions. Deep work routes through `/ags ams`.
   - **Extend** — extensibility layer (Override / Event Handler / Service Extension / App UI). Deep enough to live in `/ags-extend`.
2. **ADT** (AccelByte Development Toolkit) — build distribution + crash reporting + playtest tooling. Originally BlackBox; rebranded under AccelByte. Standalone product with its own skill `/adt`.

**Access** is not a separate product — it's the AGS IAM slice sold on its own for studios that only need cross-platform identity. Adopting full AGS later is enabling more modules, not migrating.

```
   ┌──────────────────────────────── AGS ────────────────────────────────────┐
   │                                                                         │
   │   IAM   Lobby   Sessions   Leaderboards   Achievements   Store          │
   │     Analytics   Social    + standalone packaging "Access" (IAM only)    │
   │                                                                         │
   │   ┌─── Matchmaking ───┐   ┌────── AMS ──────┐   ┌──── Extend ────┐      │
   │   │  rule-based       │   │  dedicated game │   │  Override      │      │
   │   │  matchmaking      │   │  server hosting │   │  Event Handler │      │
   │   │  (/ags matchmaking)│  │  (/ags ams)     │   │  Service Ext.  │      │
   │   └───────────────────┘   └─────────────────┘   │  App UI        │      │
   │                                                 │  (/ags-extend) │      │
   │                                                 └────────────────┘      │
   │                                                                         │
   └─────────────────────────────────────────────────────────────────────────┘

   ┌─── ADT (standalone, /adt) ───────────────────────────────────────────────┐
   │   Build distribution   Crash reporting   Playtest tooling                │
   └──────────────────────────────────────────────────────────────────────────┘
```

- **AMS and Matchmaking** are part of AGS and route through nested `/ags` capabilities because their workflows are deep. **Extend** is also part of AGS but keeps its own lifecycle skill.
- **ADT** is a true sibling product. AGS customers can route ADT crash data into AGS analytics, but ADT works without AGS.
- **Access** is a strict subset of AGS IAM. Same SDKs, same Admin Portal flows, fewer modules turned on.

See `references/ecosystem/` for the "when do I add this" decision triggers per capability, skill, or product.

---

## What AGS is *not*

- **Not a game engine** — it's a backend platform. Use Unreal, Unity, or your own engine; AGS sits behind it.
- **Not a server-hosting solution by itself** — for dedicated game servers, use AMS or another fleet provider.
- **Not a build/asset/QA tool** — that's ADT.
- **Not infinitely customizable in core** — when AGS's defaults don't fit, the answer is **Extend**, not forking the core. Forking AGS isn't supported and the SDK assumes the canonical service contracts.

---

## Why studios choose AGS

- **Reduces backend headcount risk** — engineers don't have to build or operate identity, lobby, matchmaking, store, etc., in-house.
- **Faster time-to-market** — modules ship fully-formed with well-known SDK surfaces; no cold-start period rebuilding plumbing.
- **Predictable scaling** — PCCU-based pricing matches cost to actual demand; the platform absorbs traffic spikes without studio-side work.
- **Multiplatform out of the box** — Steam, PSN, Xbox, Epic Games, mobile, with crossplay handled at the IAM layer.
- **Extensibility without forking** — Extend adds custom logic that runs alongside core AGS services, isolated from version updates.

---

## Common entry paths

| Studio shape | Typical entry |
|---|---|
| Indie / mid-market, building first online title | Public cloud + Foundations modules (IAM + a few of Lobby / Achievements / Store) |
| Mid-market with multiplayer focus | Public cloud + Foundations + Matchmaking + Sessions; AMS later |
| AAA / publisher | Private cloud + full module set; Extend for studio-specific behavior; ADT for build pipeline |
| Existing EOS studio outgrowing defaults | AGS overlay on EOS via headless account linking; Extend for the gaps EOS doesn't cover |
| Studio wanting only cross-platform identity | Access (standalone) — upgrade to full AGS later if needed |

`/ags wizard` walks a studio through this decision; `/ags handoff` covers the "should I bring in Extend / AMS / ADT" questions once AGS is in place.
