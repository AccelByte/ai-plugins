---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/gaming-services/services/extend/
- https://accelbyte.github.io/extend-apps-directory/
see-also:
- '[handoff.md](../../subskills/handoff.md)'
---

# Ecosystem — Extend

Pointer reference. Extend is **part of AGS architecturally** — the extensibility layer inside the platform — but its lifecycle is deep enough to live in its own peer skill, `/ags-extend`. This file describes when an AGS conversation should hand off to that skill.

**Routing rule.** Anything Extend-specific (Override / Event Handler / Service Extension / App UI / `extend-helper-cli` / Extend SDKs in Go/Python/C#/Java / Extend Apps Directory) belongs in `/ags-extend`. `/ags` only covers conceptual "what is Extend?" / "should I use Extend?" questions.

---

## What Extend is, in one paragraph

Extend is the extensibility layer **inside AGS**. It runs custom backend code on AccelByte infrastructure, wired into AGS auth and events, so studios can modify AGS behavior or add new services without operating their own cloud. Three core patterns plus a UI pattern; all of them are isolated from AGS core upgrades, so studios on Extend don't carry version-update risk on their custom code.

## The four patterns

| Pattern | Shape | When to reach for it |
|---|---|---|
| **Override** | Synchronous gRPC handler that AGS calls to make a decision | Change *how* an AGS service decides something (matchmaking priority, purchase validation, …) |
| **Event Handler** | Async Kafka consumer | React to AGS events (match completed, item purchased, achievement unlocked) without blocking AGS |
| **Service Extension** | New microservice on AGS infra (REST + gRPC) | Add a brand-new feature AGS doesn't cover; you own the API contract |
| **App UI** | Custom web UI embedded in the Admin Portal | Replace Swagger-driven admin with a purpose-built interface for an Extend app |

The full details — patterns, examples, when each fits, when each doesn't — live in `/ags-extend` and its `references/overview.md`.

---

## Hand off to `/ags-extend` when…

The user mentions any of these (case-insensitive):

- "Extend", "Override", "Event Handler", "Service Extension", "App UI"
- "custom backend logic", "custom matchmaking logic", "custom purchase validation"
- "react when X happens" (event-driven workflows)
- "we need an API AGS doesn't have"
- `extend-helper-cli`, "deploy a custom service to AGS", "build a custom service"
- "Extend Apps Directory"
- gRPC service in the AGS context
- Override / EAC / Vivox / Discord / Tournament integration apps

The handoff message — given verbatim by `subskills/handoff.md`:

> That's an Extend question. Run `/ags-extend` to invoke the Extend skill — it owns the full lifecycle (concept questions, scaffolding, deploying, debugging, observability). I can come back to `/ags` afterwards if you need help wiring the rest of AGS to your Extend app.

---

## Stay in `/ags` when…

The question is about Extend *adjacency* but the real work is still on the AGS side:

- "Should I add Extend?" / "Do I need Extend?" — that's `/ags handoff`. Decide first; route to `/ags-extend` only if the answer is yes.
- "What is Extend?" as part of a broader "what does AccelByte sell?" question — covered by `/ags ask` with a one-paragraph summary and a pointer.
- "How does Extend interact with my Lobby integration?" — the AGS side (Lobby integration) stays here; the Extend side (whatever the Extend app does) belongs in `/ags-extend`.

When in doubt: if the next concrete action is on an Extend app (scaffold, deploy, debug, observe an Extend service), hand off. If the next action is on AGS proper (configure the Admin Portal, integrate the SDK, troubleshoot a Lobby disconnect), stay.

---

## Upsell signals (for AccelByte staff using this skill)

A studio is a candidate for adopting Extend when they say things like:

- "AGS doesn't support X" — *if* X is a logic / behavior thing, not a missing module.
- "We've been writing our own webhooks / Lambdas to glue AGS to other systems."
- "We want to override the matchmaking algorithm."
- "We need to validate purchases against our own anti-fraud system."
- "We want to push AGS events into our analytics warehouse."

For these conversations, `/ags handoff` walks the trade-off. The actual Extend conversation moves to `/ags-extend ask`.

---

## Open-source Extend apps relevant to AGS conversations

(Names only — the authoritative list is `https://accelbyte.github.io/extend-apps-directory/`.)

- **Vivox Authorization Service** — voice chat tokens
- **Rank Suite** — weekly MMR ranking
- **Core Matchmaker** — customizable matchmaking
- **Challenge Suite** — daily missions and quests
- **MMR Calculator** — match-outcome MMR updates
- **Gacha Suite** — gacha backend + sample client
- **EOS Voice Integration** — for studios coexisting with EOS
- **EOS Easy Anti-Cheat** — anti-cheat plumbing
- **Tournament System** — bracket management
- **Discord Integration** — Discord ↔ AGS bridge
- **Moderation Service** (third-party — Tisane Labs) — chat moderation

The directory is a starting-point accelerator: studios can fork a working app rather than building from scratch.
