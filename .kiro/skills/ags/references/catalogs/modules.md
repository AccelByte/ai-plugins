---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/
see-also:
- '[iam.md](../modules/iam.md)'
- '[lobby.md](../modules/lobby.md)'
- '[matchmaking.md](../modules/matchmaking.md)'
- '[session.md](../modules/session.md)'
- '[statistics.md](../modules/statistics.md)'
- '[leaderboards.md](../modules/leaderboards.md)'
- '[achievements.md](../modules/achievements.md)'
- '[store-entitlements.md](../modules/store-entitlements.md)'
- '[analytics.md](../modules/analytics.md)'
- '[social.md](../modules/social.md)'
- '[marketing-to-service.md](marketing-to-service.md)'
---

# Catalog — AGS Modules (Quick Lookup)

One-line description per module, plus a pointer to the full reference. Use as a fast scan when you need to confirm a module exists and find the right place to dive in.

---

| Module | One-line | Full reference |
|---|---|---|
| **IAM** | Player accounts, OAuth 2.0, platform identity binding, ban management | `references/modules/iam.md` |
| **Lobby** | WebSocket-based party, presence, chat, invites (SDK service name; public docs now surfaces this as 'Chat' + 'Parties & Presence') | `references/modules/lobby.md` |
| **Matchmaking** | Rule-based matchmaking; deep work in `/ags-matchmaking` | `references/modules/matchmaking.md` |
| **Session Management** | Game session lifecycle, server allocation, reconnection | `references/modules/session.md` |
| **Statistics** | Persistent player stats for progression, MMR, leaderboard inputs, and achievement criteria | `references/modules/statistics.md` |
| **Leaderboards** | Global / seasonal leaderboards, score ingestion | `references/modules/leaderboards.md` |
| **Achievements** | Configurable achievements & progression systems | `references/modules/achievements.md` |
| **Store / Entitlements** | Catalog, purchase flows, wallet, DLC reconciliation | `references/modules/store-entitlements.md` |
| **Analytics** | Event ingestion, telemetry pipeline | `references/modules/analytics.md` |
| **Social** | Friends, blocking, notifications (internal grouping; public docs surfaces 'Friends' under Online, 'Multiplayer Notifications' separately) | `references/modules/social.md` |

## Marketing names ↔ service names

The customer-facing AGS docs use marketing names (Foundations / Online / Multiplayer; Identity & Access; Wallets & Payments; etc.). The SDKs and OpenAPI specs use **service names** (`iam`, `platform`, `lobby`, etc.) — the same names you see in the API Explorer and on `accelbyte-go-sdk/spec/*.json`. Extend SDKs use service names today; Game Engine SDKs are migrating in that direction. When a question crosses the two vocabularies (e.g. "where does Friends live in the SDK?", "what is `social.json`?"), see `references/catalogs/marketing-to-service.md`.

## Modules with peer skills

| Area | Peer skill | Why |
|---|---|---|
| Matchmaking depth | `/ags-matchmaking` | Rule design, MMR tuning, ticket lifecycle |
| Dedicated game servers | `/ags-ams` | Fleet config, warmed pools, watchdog |
| Extensibility | `/ags-extend` | Override / Event Handler / Service Extension / App UI |

## Modules sold standalone

- **Access** — IAM only, packaged as its own product. See `references/ecosystem/access.md`.

## Modules that aren't AGS

- **ADT** (build distribution / crash reporting / playtest) — separate AccelByte product. See `references/ecosystem/adt.md` and `/adt`.

## Potentially Deprecated

- **AIS (AccelByte Intelligence Service)** — listed as active in current docs (as of 2026-05-08 audit); deprecation status unconfirmed. Verify with the AccelByte product team before advising customers. Studios with serious analytics needs typically use AGS Analytics + their own BI stack regardless.
