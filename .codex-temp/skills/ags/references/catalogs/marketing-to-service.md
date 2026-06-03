---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/api-explorer/
- https://docs.accelbyte.io/gaming-services/modules/
- https://docs.accelbyte.io/gaming-services/modules/foundations/
- https://docs.accelbyte.io/gaming-services/modules/online/
- https://docs.accelbyte.io/gaming-services/modules/multiplayer/
- https://docs.accelbyte.io/gaming-services/modules/ais/
- https://github.com/AccelByte/accelbyte-go-sdk/tree/main/spec
see-also:
- '[modules.md](modules.md)'
- '[_index.md](../sdks/_index.md)'
---

# Catalog — Marketing Names ↔ Service Names

The customer-facing AGS docs (`docs.accelbyte.io/gaming-services/modules/...`) group functionality under marketing names like **Foundations / Online / Multiplayer**, with subcategories like **Identity & Access**, **Wallets & Payments**, **Parties & Presence**.

The actual REST/OpenAPI surface — and the code Extend SDKs (Go / Python / C# / Java) and the upcoming Game Engine SDK rewrites are generated from — uses **service names** like `iam`, `platform`, `lobby`, `session`. These are the filenames in [`accelbyte-go-sdk/spec/`](https://github.com/AccelByte/accelbyte-go-sdk/tree/main/spec) and the URL prefixes you see in the API Explorer.

This mismatch matters for one reason: **a developer reading the marketing docs and then using the SDKs will see different names for the same thing.** The Extend SDKs already use service names. Unreal / Unity / other Game Engine SDKs are migrating from marketing-style naming to service-name naming, so this gap will keep getting more visible until it's flat.

This catalog is the canonical translation table. Use it whenever a user asks "where does Friends live?", "what spec backs Wallets?", or "I see `social.json` — what is that?".

## Notes on the source-of-truth conventions

- **Marketing taxonomy** is taken from the live left-nav at [docs.accelbyte.io/gaming-services/modules/](https://docs.accelbyte.io/gaming-services/modules/).
- **Service name** is the spec filename (and the URL prefix). It is the canonical name used by the SDKs and by the AccelByte engineering org.
- **Spec title** comes from `info.title` inside each spec JSON. Strip the leading `justice-` and trailing `-service` — those are legacy/internal naming and do not appear in any customer-facing surface.
- **Spec description** is `info.description`, first line.
- **External docs URL** (where present) is `externalDocs.url` in the spec.
- The API Explorer page lists the spec JSON URLs alphabetically. A few API Explorer-only groupings (e.g. **Reporting & Moderation**) do not match the docs taxonomy and are listed separately at the bottom.

> ⚠ **Naming gotcha:** `social.json` is **not** a "Social" service. Its `info.title` is `justice-statistics-service` and its endpoints live under `/social/...` for legacy reasons. Treat it as the **Statistics** service with the URL/filename `social`. This is the single biggest naming trap in the AGS surface.

> ⚠ **Naming gotcha:** `lobby.json` is one big spec that backs **Friends**, **Presence**, **Parties & Presence**, **Multiplayer Notifications**, and **Player Blocks** all at once. Do not assume one subcategory ↔ one spec.

> ⚠ **Naming gotcha:** `platform.json` is the e-commerce service. It backs **Store & Catalog**, **Wallets & Payments**, **Rewards**, and entitlement / fulfillment flows. The filename is misleading — it is not a generic "platform" service.

---

## Foundations

| Subcategory | Primary services (spec filename) | Spec `info.title` | Notes |
|---|---|---|---|
| **Identity & Access** | `iam` | `justice-iam-service` (→ **IAM**) | Accounts, OAuth 2.0, namespaces, authentication, authorization, roles & permissions, account linking, ban management. The single biggest service in the surface. |
| Identity & Access (auxiliary) | `gdpr` | `justice-gdpr-service` (→ **GDPR**) | Player data export & erasure under Identity & Access in some doc cuts; under Legal & Privacy in others. Exposed in both. |
| Identity & Access (auxiliary) | `basic` | `justice-basic-service` (→ **Basic**) | User profiles, namespace configs, country groups, file storage. Shared by IAM-adjacent flows. |
| **Game Analytics** | `gametelemetry` | `Analytics Game Telemetry` (→ **Game Telemetry**) | Event ingestion endpoints, the API surface behind the AGS Analytics dashboards. |
| **Legal & Privacy** | `legal` | `justice-legal-service` (→ **Legal**) | Legal agreements (ToS, EULA, Privacy Policy), age gate config. |
| Legal & Privacy (auxiliary) | `gdpr` | `justice-gdpr-service` (→ **GDPR**) | GDPR / CCPA data portability and erasure. |
| **Tools & Utilities** | `loginqueue` | `justice-login-queue-service` (→ **Login Queue**) | Player traffic queueing during peak load. |
| Tools & Utilities (auxiliary) | `iam` | (→ **IAM**) | Login allowlist and profanity filter live in IAM. |
| Tools & Utilities (auxiliary) | (no public spec) | — | Configuration Migration, Audit Logs, Access Logs, Grafana Cloud Observability are platform/admin features without dedicated public OpenAPI surfaces. |
| **Extend** | `csm` | `Custom Service Manager` (→ **CSM**) _(note: `info.title` is `custom-service-manager` (hyphenated); `info.description` is `Custom Service Manager`)_ | The Extend control plane — registers and manages Extend Override / Service Extension / Event Handler / App UI deployments. Customers usually don't call CSM directly; they interact via the Admin Portal and the Extend SDKs. |

## Online

| Subcategory | Primary services (spec filename) | Spec `info.title` | Notes |
|---|---|---|---|
| **Achievements** | `achievement` | `justice-achievement-service` (→ **Achievement**) | Configurable achievements & progression. |
| **Cloud Save** | `cloudsave` | `justice-cloudsave-service` (→ **CloudSave**) | Player and game key-value storage. |
| **Friends** | `lobby` | `justice-lobby-server` (→ **Lobby**) | Friends list, friend requests, blocks, third-party platform friend sync. Implemented inside the Lobby spec under `/friends/...` and `/lobby/...`. No standalone `friends.json` exists. |
| **Inventory** | `inventory` | `justice-inventory-service (Early Access)` (→ **Inventory**) | Player item storage and acquisition. |
| **Leaderboards** | `leaderboard` | `justice-leaderboard-service` (→ **Leaderboard**) | Global / seasonal leaderboards, score ingestion. |
| **Presence** | `lobby` | (→ **Lobby**) | Online/away/invisible/in-game status. Same spec as Friends. |
| **Rewards** | `platform` | `justice-platform-service` (→ **Platform**) | Reward configuration & granting. Lives in the e-commerce service. |
| **Season Pass** | `seasonpass` | `justice-seasonpass-service` (→ **SeasonPass**) | Tiered seasonal reward systems. |
| **Statistics** | `social` | `justice-statistics-service` (→ **Statistics**) | ⚠ The filename is `social` for legacy reasons; the service is **Statistics**. URL prefix `/social/...`. |
| **Store & Catalog** | `platform` | (→ **Platform**) | Catalog, items, store config, entitlements. |
| **Wallets & Payments** | `platform` | (→ **Platform**) | Wallets, sales, payments, fulfillment, subscription, IAP receipt validation. All under one spec. |
| **Challenges** | `challenge` | `justice-challenge-service` (→ **Challenge**) | Player challenges and reward grants. |
| **User Generated Content (UGC)** | `ugc` | `justice-ugc-service` (→ **UGC**) | Player-uploaded content management. |

## Multiplayer

| Subcategory | Primary services (spec filename) | Spec `info.title` | Notes |
|---|---|---|---|
| **Chat** | `chat` | `justice-chat-service` (→ **Chat**) | Real-time chat, channels, moderation hooks. Distinct from Lobby. |
| **Dedicated Server Hub** | `lobby` | (→ **Lobby**) | DS Hub is the server-facing WebSocket channel inside the Lobby service. No standalone `dshub.json`. |
| **Guilds & Clans** | `group` | `justice-group-service` (→ **Group**) | Player groups (used to back the Guilds & Clans feature). |
| **Matchmaking** | `match2` | `Justice Match Service v2` (→ **Match v2**) | Rule-based matchmaking, ticket lifecycle, backfill. The `2` reflects the v2 generation; the v1 matchmaking service is deprecated and not in the public spec list. Deep matchmaking work routes through `/ags matchmaking`. |
| **Multiplayer Notifications** | `lobby` | (→ **Lobby**) | Client and server notifications run through the Lobby + DS Hub websockets. |
| **Multiplayer Servers** | `ams` | `fleet-commander` (→ **AMS / Fleet Commander**) | AccelByte Multiplayer Servers — fleet management, dedicated server lifecycle. The spec title is `fleet-commander` (the control component). The product name is **AMS**. Deep AMS work routes through `/ags ams`. |
| **Parties & Presence** | `lobby` | (→ **Lobby**) | Party lifecycle, party invites, presence. Same spec as Friends. |
| **Peer-to-Peer** | `session` | `justice-session-service` (→ **Session**) | P2P matches are modeled as P2P sessions in the Session service; there is no standalone P2P spec. |
| **Session** | `session` | `justice-session-service` (→ **Session**) | Game session lifecycle, server allocation, reconnection, persistent sessions. |
| Session (auxiliary) | `sessionhistory` | `justice-session-history-service` (→ **Session History**) | Read-only history of matchmaking tickets and session telemetry (only 2 endpoints; very narrow). |

## AccelByte Intelligence Service (AIS)

AIS is a top-level peer module, not a Foundations / Online / Multiplayer subcategory. AIS is **only available to existing customers** — for new customers, AccelByte directs analytics needs to AGS Analytics (`gametelemetry`) instead.

| Subcategory | Primary services (spec filename) | Notes |
|---|---|---|
| AIS Dashboard | (no public REST spec) | Out-of-box dashboards in the Admin Portal and Grafana. |
| AIS Data Warehouse | (no public REST spec) | Single-tenant data warehouse; consumption is via Snowflake / Redshift / S3 connectors, not via an AGS-public REST API. |
| AIS Data Connector | (no public REST spec) | Configuration-driven; same pipeline pattern as AGS Analytics' Data Connector V2. |
| AIS Infrastructure / Custom Dashboard | (no public REST spec) | Operated by AccelByte; customers do not call REST endpoints directly. |

## API Explorer-only groupings (no docs-taxonomy equivalent)

The API Explorer page (`docs.accelbyte.io/api-explorer`) renders some additional category headers in its sidebar that do **not** match the docs/modules taxonomy. These are reader-side groupings, not product categories. Map them via the underlying spec files:

| API Explorer category | Underlying spec(s) | Where it appears in marketing docs |
|---|---|---|
| **Reporting** _(also labelled 'Reporting & Moderation' in some UI views)_ | `reporting` (`justice-reporting-service`) — player-on-player reports, automated moderation actions. Adjacent moderation features land in `iam` (bans, sanctions), `chat` (chat moderation hooks), and the **Profanity Filter** under Foundations → Tools & Utilities. | No single subcategory. The Reporting service has no module page; the moderation surface is split across IAM (bans / sanctions), Chat (chat moderation), and Tools & Utilities (profanity filter). |

If a user asks specifically about `reporting.json` or "the Reporting service", the answer is: it's a real service (`reporting`, title `justice-reporting-service`) that handles player-submitted reports and moderation workflows, but AccelByte does not publish a top-level module page for it; it is grouped into a sidebar bucket on the API Explorer alongside IAM-driven moderation features.

---

## Reverse lookup — service filename → marketing home

When you see a `*.json` spec name and need to point a user at the right docs page:

| Spec filename | Marketing home (module → subcategory) |
|---|---|
| `achievement` | Online → Achievements |
| `ams` | Multiplayer → Multiplayer Servers (also product name **AMS**, capability route `/ags ams`) |
| `basic` | Foundations → Identity & Access (auxiliary; profiles & namespace config) |
| `challenge` | Online → Challenges |
| `chat` | Multiplayer → Chat |
| `cloudsave` | Online → Cloud Save |
| `csm` | Foundations → Extend (control plane) |
| `gametelemetry` | Foundations → Game Analytics |
| `gdpr` | Foundations → Legal & Privacy (also Identity & Access in some doc cuts) |
| `group` | Multiplayer → Guilds & Clans |
| `iam` | Foundations → Identity & Access |
| `inventory` | Online → Inventory |
| `leaderboard` | Online → Leaderboards |
| `legal` | Foundations → Legal & Privacy |
| `lobby` | Online → Friends, Online → Presence, Multiplayer → Parties & Presence, Multiplayer → Multiplayer Notifications, Multiplayer → Dedicated Server Hub |
| `loginqueue` | Foundations → Tools & Utilities |
| `match2` | Multiplayer → Matchmaking (capability route `/ags matchmaking`) |
| `platform` | Online → Store & Catalog, Online → Wallets & Payments, Online → Rewards (e-commerce) |
| `reporting` | API Explorer → Reporting & Moderation (no dedicated module page) |
| `seasonpass` | Online → Season Pass |
| `session` | Multiplayer → Session, Multiplayer → Peer-to-Peer |
| `sessionhistory` | Multiplayer → Session (auxiliary; matchmaking ticket history) |
| `social` | Online → Statistics ⚠ filename is misleading |
| `ugc` | Online → User Generated Content (UGC) |

## When to use this catalog

- A user reads the docs and asks "where is Friends in the SDK?" → here, then `references/modules/lobby.md`.
- A user is reading an Extend SDK (Go / Python / C# / Java) and asks "what does `platform.PaymentService` correspond to in the docs?" → here, then `Online → Wallets & Payments`.
- A user sees `social.json` and is confused → here (call out the Statistics rename trap).
- A user asks for the spec URL for a feature → look up the row, then concatenate `https://raw.githubusercontent.com/AccelByte/accelbyte-go-sdk/refs/heads/main/spec/<filename>.json`.

## Out of scope

- Per-endpoint mapping (URL → SDK method). The Extend SDK source is the source of truth for that — route to `/ags-extend` rather than chasing it from this catalog.
- Game Engine SDK (Unreal / Unity / Godot / Roblox) class layout. Those are in `references/sdks/game-engine/<engine>.md`.
- Deprecated spec files (e.g. v1 matchmaking) that are not in the API Explorer list above.
