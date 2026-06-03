---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
- https://accelbyte.io/gaming-services
- https://accelbyte.io/ags-eos
- https://accelbyte.io/pricing
see-also:
- '[overview.md](overview.md)'
- '[glossary.md](glossary.md)'
- '[extend.md](ecosystem/extend.md)'
- '[pccu-bands.md](pricing/pccu-bands.md)'
---

# AGS — FAQ

The questions developers and technical evaluators ask most. Short answers grounded in documented AGS behavior; pointers to docs.accelbyte.io for anything that goes stale (pricing, exact module limits, SDK versions).

---

## What is AGS, in one paragraph?

AccelByte Gaming Services is a managed cloud-hosted game backend platform — modular services for identity, matchmaking, parties and presence, sessions, leaderboards, achievements, store/economy, analytics, social, and more (Cloud Save, Inventory, Challenges, Season Pass, Chat, UGC, and others), plus dedicated game-server hosting (AMS) and an extensibility layer (Extend) all under the AGS umbrella. Studios integrate AGS instead of building these systems themselves. Pricing scales with Peak Concurrent Users (PCCU); deployment options span shared cloud, private cloud, BYOC, and hybrid.

ADT (build distribution + crash reporting + playtest tooling) is a *separate* AccelByte product — not part of AGS — and lives in its own peer skill `/adt`.

## Which modules do I actually need?

Depends on the game shape. Roughly:

| Game shape | Minimum modules |
|---|---|
| Single-player with cloud saves and entitlements | IAM + Store/Entitlements + Cloud Save |
| Online co-op or competitive multiplayer | IAM + Lobby + Matchmaking + Sessions |
| Live-service with seasons and progression | IAM + Lobby + Matchmaking + Sessions + Leaderboards + Achievements + Store |
| Crossplay across PC/console/mobile | All of the above + Social + careful IAM platform-binding setup |

`/ags wizard` helps narrow this for a specific project. `references/init/modules-checklist.md` is the decision aid.

## How does AGS pricing work?

PCCU-based — billed per peak concurrent user per day, with tier discounts at higher volumes. Starter / free tiers cover early development. Private Cloud starts at $2,500/month per environment. Enterprise tier (source code access, BYOC, co-development) is custom pricing.

The illustrative bands are in `references/pricing/pccu-bands.md`. **For current numbers, point users at `https://accelbyte.io/ags-pricing`** — the in-repo bands may go stale.

## What's a namespace and how many do I need?

A namespace is the tenant boundary inside AGS. Players, items, leaderboards, IAM clients, and stats are all scoped to a namespace. Most studios run at minimum:

- A **development** namespace for engineering work
- A **staging** or **QA** namespace for pre-release testing
- A **production** namespace for the live game

Some studios add a **publisher** parent namespace if they have multiple titles sharing entitlements. Namespaces are cheap; create as many as your environment / team / region story requires.

## Is AGS the right tool if we're already on EOS / PlayFab?

**On EOS:** AccelByte has a documented coexistence story (`accelbyte.io/ags-eos`). Players keep authenticating via EOS; AGS overlays on top via headless account linking. Use Extend for custom backend logic, AMS for dedicated servers, and AGS Matchmaking for advanced skill-based matching. No EOS data migration required.

**On PlayFab:** Migration is bigger because PlayFab covers more of the same ground as AGS. Studios usually move to AGS when PlayFab's extensibility, support quality, or enterprise pricing becomes a problem. There's no equivalent of headless-account-linking for PlayFab; identity has to be migrated (as of last check — verify with AccelByte if migrating from PlayFab).

**Building in-house:** TCO argument. AGS replaces backend engineers operating their own identity, lobby, matchmaking, etc. The 3–5-year cost comparison usually favors AGS for studios that aren't trying to differentiate on backend.

## Can I run AGS on-prem or in my own AWS account?

Yes. Three flavors:

- **Private Cloud** — dedicated, single-tenant infrastructure; AccelByte still runs it. Most enterprise customers pick this for data residency or SLA reasons.
- **Bring Your Own Cloud (BYOC)** — AGS deployed into the customer's own AWS account. Useful when the customer already has cloud commitments or specific cost-allocation needs.
- **Bare Metal / Hybrid** — usually for AMS (game servers); AGS itself stays managed.

See `references/deployment/` for details. All three look the same from the SDK's perspective; the differences show up in onboarding and operations.

## Where does Extend fit?

Extend is the extensibility layer **inside AGS**. Three core patterns:

- **Override** — replace a specific decision inside an AGS service (e.g., custom matchmaking scoring) with your gRPC handler. Synchronous; AGS waits for your response.
- **Event Handler** — react to AGS events (match completed, item purchased, etc.) asynchronously via Kafka. AGS doesn't wait.
- **Service Extension** — host an entirely new microservice on AccelByte infrastructure with its own REST API.

Plus a UI pattern (**App UI**) for embedding custom Admin Portal pages.

When AGS's defaults don't fit, Extend is the answer rather than forking AGS core. Extend is part of AGS architecturally; it gets a peer skill (`/ags-extend`) because the lifecycle (scaffold, deploy, debug, observe custom services) is deep enough to warrant one.

## Where does AMS fit?

AMS (AccelByte Multiplayer Servers) is dedicated game-server hosting **inside AGS** — natively integrated with AGS Matchmaking and Sessions, with warmed server pools, watchdog lifecycle, multi-cloud regions. Studios running their own dedicated servers are typical AMS candidates. AMS is part of AGS architecturally; it routes through `/ags ams` because the operational lifecycle (fleet sizing, regional rollout, server binary upload, watchdog tuning) is deep enough to warrant a dedicated capability.

## Where does Matchmaking fit?

Matchmaking is one of the AGS modules, but rule design / MMR tuning / ticket lifecycle / region routing is a domain of its own. So matchmaking lives inside AGS architecturally and routes through `/ags matchmaking` for the deep work. `/ags` covers matchmaking conceptually; `/ags matchmaking` covers operations.

## Where does ADT fit?

ADT (AccelByte Development Toolkit) is build distribution + crash reporting + playtest tooling. Originally **BlackBox**, rebranded under AccelByte in March 2023. **A separate AccelByte product** — does not require AGS — with its own peer skill `/adt`. AGS customers can route ADT crash data into AGS analytics, but ADT works fully without AGS. Sweet spot is studios with a build-distribution headache (zip-and-share, slow delivery) or a crash-triage backlog.

## Where does Access fit?

Access is the **standalone packaging of AGS IAM** — same identity engine, sold without the rest of AGS. For studios that need cross-platform identity (Steam + PSN + Xbox + Epic + …) without committing to the full AGS platform. A strict subset of full AGS — adopting full AGS later doesn't require migration, just turning on more modules.

## Is AIS (AccelByte Intelligence Service) still a thing?

No. **AIS is deprecated** and no longer actively sold. Do not recommend AIS or include it in module lists. Studios with analytics needs use AGS Analytics plus their own BI stack (BigQuery, Snowflake, Redshift, etc.).

## How long does an AGS integration take?

Depends entirely on game shape and the studio's experience with backend SDKs. Rough orders of magnitude:

- IAM only (login + accounts): days to a week per platform target.
- IAM + Lobby + simple matchmaking: weeks.
- Full live-service stack (above + Sessions + Store + Leaderboards + Achievements + Social): one to several months for a well-staffed team.

The biggest variable is platform certification — adding PSN or Xbox brings cert work that's mostly independent of AGS but interleaved with IAM platform binding.

## What SDKs are supported?

AGS has three SDK families. Don't conflate them:

**Game Engine SDKs** — for game clients and dedicated game servers:

- **Unreal Engine** (4.27 – 5.x)
- **Unity** (current LTS lines)
- **Godot**
- **Roblox**

**TypeScript SDK for Web Apps** — standalone library for web apps that talk to AGS (admin tools, live-ops dashboards, web companion apps). Sibling of the Game Engine SDKs, not a subset.

**Extend SDKs** — *not* for game clients; these are the libraries Extend apps use to talk back to AGS:

- **Go**, **Python**, **C#**, **Java**

Custom game engines (anything outside Unreal / Unity / Godot / Roblox) integrate via REST + OpenAPI directly. Native C++ projects on a custom engine go via REST too.

For specifics on Game Engine SDKs and the TypeScript Web SDK, see `references/sdks/`. For Extend SDKs, that conversation belongs in `/ags-extend`. SDK versions move; treat the in-repo notes as a starting point, not a version-pinned source.

## Does AGS support crossplay?

Yes — it's a core design point. A single AGS player can have multiple platform identities bound (Steam, PSN, Xbox, Epic, mobile). Logging in via any of them resolves to the same AGS player. Crossplay session and matchmaking are supported, modulo per-platform certification rules.

## Can I customize matchmaking rules?

Yes, two ways:

1. **Native rule configuration** in the Admin Portal — attribute-based matchmaking with custom rule expressions. Covers most needs.
2. **Extend Override** — replace the matchmaking decision (e.g., custom MMR formula, VIP priority boost) with your own gRPC service when native rules aren't expressive enough.

Start native. If you hit the rule-expression ceiling, escalate to Extend Override via `/ags-extend`.

## Can I export AGS data to my own warehouse?

AGS Analytics emits events that can be exported to external warehouses (BigQuery, Snowflake, Redshift, etc.). The exact export mechanism depends on tier and deployment model — for the current options, point users at `https://docs.accelbyte.io/` Analytics docs or contact AccelByte support. Studios with serious data needs usually pair AGS Analytics with an external BI stack rather than relying on AGS dashboards alone.

## What's the SLA?

Standard tiers come with the published AccelByte SLA. Enterprise (private cloud) customers can negotiate dedicated SLAs as part of their contract. Specific uptime numbers and credits are contract-bound; refer customers to their contract or AccelByte sales.

## What about anti-cheat?

AGS doesn't ship its own anti-cheat. Common patterns:

- **Easy Anti-Cheat** via Epic — AccelByte publishes an Extend app (`EOS Easy Anti-Cheat`) that maps EAC signals to AGS enforcement.
- Studios with custom anti-cheat plug into AGS bans/enforcement via the IAM API.

Anti-cheat is a Extend-shaped problem in practice; the AGS-native surface is mostly ban management and incident reporting.

## Can I write a custom Admin Portal page?

Yes — via Extend's **App UI** pattern. That belongs in `/ags-extend ask` and the Extend lifecycle.

## What happens during AGS upgrades?

Shared-cloud customers upgrade with AccelByte's release cadence — managed maintenance windows. Private-cloud and BYOC customers schedule upgrades with their Delivery Manager. Extend apps are isolated from core AGS upgrades — by design, Extend's contract is stable across AGS versions, so studios on Extend don't carry version-update risk on their custom code.

## Where do I get help?

- **Docs:** `https://docs.accelbyte.io/`
- **Pricing:** `https://accelbyte.io/pricing`
- **EOS coexistence:** `https://accelbyte.io/ags-eos`
- **Extend Apps Directory:** `https://accelbyte.github.io/extend-apps-directory/`
- **Support:** AccelByte support portal (link is in the Admin Portal). Enterprise customers also have a Delivery Manager.
