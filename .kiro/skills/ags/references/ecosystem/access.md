---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/identity-access/
see-also:
- '[overview.md](../overview.md)'
- '[iam.md](../modules/iam.md)'
- '[handoff.md](../../subskills/handoff.md)'
---

# Ecosystem — Access

Pointer reference. **AccelByte Access** is the standalone-packaging name for the AGS Identity & Access (IAM) module — for studios that need cross-platform player authentication and live identity management without committing to the full AGS platform.

> **Status note (verified 2026-04-29).** There is currently **no public marketing product page** for Access at `accelbyte.io/access` or `accelbyte.io/products/access`. The Identity & Access module lives inside the AGS docs at `docs.accelbyte.io/gaming-services/modules/foundations/identity-access/`. Treat "Access" as a packaging concept that internal sales / sources describe; route customers to the docs IAM module page or to AccelByte sales for the standalone offering specifics.

---

## What Access is

Access is the same identity engine that powers AGS IAM, available as its own product. It handles platform identity, OAuth 2.0, crossplay account linking, and operational debugging tools — the building blocks studios need before they can do anything else online.

## Headline capabilities

| Capability | What it covers |
|---|---|
| **Platform identity providers** | Steam, PlayStation, Xbox, Epic Games, Google Play, Apple, Facebook |
| **Enterprise identity providers** | Azure Active Directory, Google Workspace, AWS Cognito, OpenID Connect |
| **OAuth 2.0** | Full implementation; IAM clients for game servers, web portals, and admin tools |
| **Crossplay identity** | Single persistent player identity across PC, console, mobile |
| **Real-time debugging** | Trace and debug login errors, token failures, auth edge cases |
| **Role-based access control** | Granular permissions for players, developers, admin users |
| **Player sanctions** | Account bans and feature-specific bans for moderation enforcement |

---

## When to suggest Access

Strong signals:

- Studio is **handling auth themselves** and asking about cross-platform login support.
- **Console certification** blockers tied to account linking or platform identity requirements (PSN, Xbox).
- **Crossplay expansion** — player identity needs to work across new platforms (e.g., adding PSN after PC launch).
- Studio is **launching on a new platform** and the auth surface is the bottleneck.
- **Auth-related support tickets** dominating their backlog — token failures, login errors, session management bugs.
- Studio uses a **legacy or custom IdP** and is struggling to maintain it.

Soft signals:

- Studio mentions the cost of integrating multiple platform IdPs themselves.
- Compliance / regulatory pressure on identity (data residency, age verification).

> **Shared Cloud caveat:** GDPR processes are not yet supported in AGS Shared Cloud. Studios with GDPR requirements should confirm deployment type (Private Cloud or BYOC) with AccelByte sales before committing.

---

## When Access isn't the right answer

- The studio also needs lobby, matchmaking, store, achievements, etc. — **just go to full AGS**. Access is a strict subset; adopting full AGS later isn't a migration, it's enabling more modules. If the conversation is going to land on AGS anyway, skip Access.
- The studio is a **single-platform** title that doesn't need crossplay and isn't planning multi-platform expansion. Access's value is concentrated in the cross-platform story.
- The studio wants **gameplay-oriented** identity features (friends, parties, presence). Those live in the AGS Lobby module — Access doesn't include them.

---

## Relationship to AGS

Access is the IAM module of AGS, sold standalone. From an SDK perspective, the same Game Engine SDK (Unreal / Unity / Godot / Roblox) and the standalone TypeScript Web SDK are used; Access just doesn't enable the other AGS modules. Studios on Access can:

- Add Lobby / Matchmaking / Store / Leaderboards / Achievements later, without identity migration.
- Keep the same OAuth client model and the same player accounts when expanding.

This makes Access a low-commitment entry point for studios that want a cross-platform login layer first and the rest of AGS later (or never).

---

## Pricing

- Included in AGS Foundations when using the full platform.
- Standalone pricing exists; refer customers to AccelByte sales for current numbers.

---

## Where to send users for the actual Access work

`/ags` covers Access conceptually but the integration steps look almost identical to AGS IAM. For a studio adopting Access standalone:

- The IAM module reference (`references/modules/iam.md`) covers the technical surface.
- The SDK install subskill (`subskills/install-sdk.md`) — when scoped to Access — only enables the IAM-related SDK pieces.
- AccelByte sales for the standalone licensing conversation.

If a studio outgrows Access, the next step is enabling more AGS modules (Lobby first, typically) — that's `/ags wizard` or `/ags integrate`, not a separate migration project.
