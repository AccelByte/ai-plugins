---
last-verified: 2026-07-21
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/getting-started/
see-also:
- '[overview.md](overview.md)'
- '[faq.md](faq.md)'
---

# AGS — Glossary

Terms that come up repeatedly across AccelByte Gaming Services. One line where possible; pointers to fuller treatments where the concept is large.

---

## Platform & tenancy

**AGS (AccelByte Gaming Services).** The managed game backend platform — modules for IAM, Lobby, Matchmaking, Sessions, Leaderboards, Achievements, Store, Analytics, Social. AccelByte's core product.

**Namespace.** The logical isolation unit inside AGS. A namespace is a tenant boundary — each game (and often each environment of each game) gets its own namespace. Players, items, leaderboards, IAM clients, and stats are all scoped to a namespace. Studios usually have at least three: development, staging/QA, and production.

**Environment.** Loose term for "which AGS deployment am I talking to" — typically a development URL, a staging URL, and a production URL. Environments are configured per studio and live alongside namespaces. Game builds carry the environment URL in their config.

**Tenant.** Sometimes used interchangeably with "studio" or "publisher." Multiple namespaces can belong to one tenant.

**Publisher namespace.** A special parent namespace some studios use to share entitlements (e.g. an account upgrade across multiple titles) across child namespaces. Not every studio needs one.

**Studio namespace.** A middle-tier namespace between Publisher and Game, used when a publisher manages multiple independent studios. Not required in simple single-studio setups.

**Region.** Geographic deployment. AGS shared cloud runs in multiple regions; private cloud is single-region by default. Matchmaking and AMS use region for latency optimization.

---

## Identity & access

**IAM (Identity & Access Management).** The AGS module handling player authentication, authorization, and account data.

**IAM client.** An OAuth 2.0 client registered with IAM. There are three kinds:
- **Public client** — used by game clients. Can do user logins. Has a client ID; no client secret stored on the device.
- **Confidential client** — used by game servers and trusted backend services. Has a client ID and a client secret.
- **AccelByte client** (admin/service) — used by Admin Portal tooling and trusted internal services.

**OAuth 2.0.** The authorization protocol AGS uses for everything. Tokens are JWTs with explicit claims (user ID, namespace, scopes, expiry). All AGS APIs require an Authorization header.

**Token.** A short-lived JWT issued by IAM. Game clients refresh proactively before expiry. Tokens carry namespace and scope; using a prod token against a dev namespace fails the namespace claim check.

**Refresh token.** Longer-lived token used to get a new access token without re-authenticating. Stored client-side; rotated on each refresh.

**Headless account.** A player account auto-created when the player first logs in via a third-party identity provider (Steam, Epic, PSN, etc.) or when using anonymous/device-ID login, without explicitly registering. The account is "headless" in that it has no AccelByte-native credentials yet — it's linked to the third-party identity or device. Players can later upgrade by adding email/password.

**Headless account linking.** The bridge mechanism AGS uses for the EOS (Epic Online Services) coexistence story. When a player authenticates via EOS, AGS creates a headless AGS account linked to the EOS identity, so the player has both identities in lockstep without a separate registration.

**Account linking / platform binding.** The general mechanism for binding multiple platform identities (Steam + PSN + Xbox + …) to a single AGS player. The basis for crossplay identity.

**Permission.** A scope-style string that grants access to a specific API surface. IAM clients and player roles each carry a list of permissions.

**Role.** A bundle of permissions. Roles are used for admin users, customer support staff, and tiered player privileges.

---

## Players & social

**Player.** A user account in AGS. Identified by `user_id` (a UUID). Players have IAM identity, optional linked platform identities, friends, stats, leaderboard scores, achievements, entitlements, and a wallet.

**Platform identity.** A binding between an AGS player and a third-party identity (Steam, Epic, PSN, Xbox, Apple, Google, Facebook, …). A player can have multiple bindings; logging in via any of them resolves to the same AGS player.

**Friend.** A bidirectional relationship between two players, scoped to a namespace.

**Party.** A group of players intending to play together. Parties are shorter-lived than friend lists; they're created, joined, and disbanded around play sessions.

**Lobby.** The realtime channel that handles party state, presence, chat, and invitations. WebSocket-based.

**Presence.** A player's current online status. Updated by the Lobby when the player connects/disconnects/AFKs.

---

## Matchmaking & sessions

**Match.** A specific gameplay instance — an in-progress or completed game. Identified by a match ID; carries a player roster and (often) a server allocation.

**Matchmaking ticket.** A player's or party's request to be placed in a match, queued with attributes (MMR, region, mode preferences). The matchmaking service consumes tickets and emits matches when constraints are satisfied.

**MMR (Match Making Rating).** A numeric skill score used to balance matches. AGS stores MMR per player per game; studios update it from match outcomes via the Statistics API or via Extend.

**Session.** The lifecycle wrapper around a match — pre-game lobby, server allocation, in-game state, post-game settlement. Game clients move between session states (created, joined, in-game, finished).

**Game session vs. party session.** A party session is a group hanging out before / between matches. A game session is the actual in-progress game with a server. They're related (the party transitions into a game session) but tracked separately.

**Server allocation.** The act of assigning a dedicated game server to a match. AGS routes allocation to AMS by default; studios using their own fleets handle this themselves.

---

## Economy

**Store.** The catalog of items players can buy. Items have variants per currency and per platform.

**Item.** A single thing in the store — a skin, a bundle, a loot box, a season pass. Items have categories, prices, and entitlement effects when purchased.

**Wallet.** A player's per-namespace store of virtual currency; one wallet per currency (a player with multiple in-game currencies has multiple wallets). Real-money purchases (via Stripe or platform IAP) convert to virtual currency — the wallet holds only virtual currency.

**Entitlement.** A player's right to use an item or feature. Granted by purchase, by promotion, by achievement unlock, etc. Entitlements are checked at use-time (e.g., game client checks entitlements before letting the player equip a cosmetic).

**Order.** The transactional record of a purchase. Has states (init, pending, fulfilled, refunded). Linked to one or more entitlements.

**DLC (Downloadable Content).** Platform-level content packs. AGS reconciles platform DLC entitlements (e.g., a Steam DLC purchase) with the AGS entitlement model.

**Promotion / coupon.** Time-limited or condition-gated grants of items, currency, or discounts.

---

## Telemetry & operations

**PCCU (Peak Concurrent Users).** The peak count of simultaneously active players at any moment in a given day. Not the same as DAU (daily active users). AGS pricing meters PCCU per day; tier thresholds use PCCU as their basis.

**DAU (Daily Active Users).** Distinct players in a 24-hour window. Less important than PCCU for AGS billing; useful for retention analysis.

**Telemetry / event.** A data point emitted by AGS, by a game client, or by a custom service. AGS events are well-typed and documented; custom events are studio-defined. Events feed Analytics, Achievements progression, and (via Extend) Event Handlers.

**Admin Portal.** The web UI for studio admins to configure namespaces, manage IAM clients, edit the Store catalog, define matchmaking rules, monitor traffic, and so on.

---

## Architecture & Capability Routes

**Extend.** AccelByte's extensibility layer **inside AGS**. Three core patterns (Override, Event Handler, Service Extension) plus an App UI pattern. Runs custom backend logic on AGS infrastructure. Part of AGS architecturally; gets a peer skill — `/ags-extend` — because the lifecycle is deep.

**AMS (AccelByte Multiplayer Servers).** Dedicated game-server hosting **inside AGS** with native integration to Matchmaking and Sessions. Warmed pools, watchdog lifecycle, multi-cloud / multi-region. Part of AGS architecturally; routes through the `/ags ams` capability because the operational lifecycle is deep.

**Matchmaking.** One of the AGS modules. Routes through the `/ags matchmaking` capability because rule design, MMR tuning, ticket lifecycle, and region routing are deep enough on their own.

**ADT (AccelByte Development Toolkit).** Build distribution + crash reporting + playtest tooling. Originally **BlackBox**, rebranded under AccelByte in March 2023. **Separate AccelByte product** — not part of AGS. Has its own peer skill `/adt`. Works without AGS, though AGS customers can route ADT crash data into AGS analytics.

**Access.** Standalone packaging of the **AGS IAM slice** for studios that only need cross-platform identity. Strict subset of full AGS — same identity engine, fewer modules turned on. Adopting full AGS later doesn't require migration.

**AIS (AccelByte Intelligence Service).** *Deprecated.* No longer actively sold. Do not recommend AIS or include it in module lists. Studios with analytics needs use AGS Analytics + their own BI stack (BigQuery, Snowflake, etc.).

**EOS (Epic Online Services).** Epic's free game-services platform. Common starting point for studios that later need more capability than EOS provides. AGS has a documented coexistence story (`accelbyte.io/ags-eos`) for studios overlaying AGS on EOS via headless account linking.

**EOS Easy Anti-Cheat (EAC).** Epic's anti-cheat. AccelByte publishes an Extend app (`EOS Easy Anti-Cheat`) that maps EAC signals to AGS enforcement.

---

## Tooling

**AGS CLI.** The `ags` binary for namespace, IAM, profile, auth, diagnostics, and generated AGS API commands. Distributed as prebuilt archives from `https://github.com/AccelByte/accelbyte-ags-cli/releases/latest`; install the asset that matches the user's OS/architecture and put `ags` / `ags.exe` on the user's `PATH`. Not the same tool as `extend-helper-cli`, which is Extend-specific.

**`extend-helper-cli`.** The Extend-specific CLI — builds, pushes, and deploys Extend apps; also fetches logs and health for Extend apps. Extend-only; AGS uses its own CLI for namespace work. See `/ags-extend install-cli`.

**MCP server.** Model Context Protocol server. AccelByte ships **two** MCP servers that connect AI IDEs to AGS context:

- **`AGS API MCP`** (`ags-api-mcp-server`) — exposes AccelByte API operations as MCP tools so AI assistants can search and call AGS endpoints from inside the editor. There is no shared default endpoint: Shared Cloud uses `https://{studio}-{game}.prod.gamingservices.accelbyte.io/mcp/{studio}-{game}` (the `{studio}-{game}` namespace appears in both the host and the path); Private Cloud uses `https://{environment_name}.accelbyte.io/mcp`. Owned by `/ags install-mcp`. Source: `content/mcps/ags-api.yaml`.
- **`AGS Extend SDK MCP`** (`ags-extend-sdk-mcp-server`) — exposes Extend SDK symbols and code-gen tooling to AI assistants for Extend app development. Owned by `/ags-extend install-mcp`. Source: `content/mcps/ags-extend-sdk.yaml`.

Both ship as part of the plugin via the MCP configuration the compiler emits to `plugins/<target>/.mcp.json` (or the platform-equivalent file). Optional but high-leverage for AI-assisted workflows.

**SDK (Game Engine).** The AGS client library for a specific game engine. Currently: **Unreal, Unity, Godot, Roblox**. Used by game clients and dedicated game servers. Each Game Engine SDK wraps the same underlying REST + OpenAPI surface.

**SDK (TypeScript Web).** A standalone TypeScript library for web apps that need to talk to AGS — admin / live-ops dashboards, web companion apps, browser-based tooling. Sits alongside the Game Engine SDKs as a sibling, not a subset. Owned by `/ags`.

**SDK (Extend).** A different SDK family — Go, Python, C#, Java — used **by Extend apps** (not by game clients) to talk back to AGS from inside AccelByte's infrastructure. Owned by `/ags-extend`. If a developer says "the Go SDK" or "the Python SDK" in an AccelByte context, they mean this family.

**REST + OpenAPI.** The underlying API surface every SDK wraps. Custom engines (anything outside Unreal / Unity / Godot / Roblox) integrate via REST directly. Specs are auto-generated from the AGS service contracts.
