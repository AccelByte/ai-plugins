---
last-verified: 2026-04-29
sources:
- https://accelbyte.io/ags-eos
- https://docs.accelbyte.io/
see-also:
- '[headless-account-linking.md](headless-account-linking.md)'
- '[auth-flow.md](../integrate/auth-flow.md)'
- '[pc-steam-epic.md](../platforms/pc-steam-epic.md)'
---

# Cookbook — EOS Coexistence

How studios on **Epic Online Services (EOS)** add AccelByte alongside without migrating off EOS.

> EOS is Epic's free game-services platform. Many studios start there and outgrow it. AccelByte's official position is **coexist, don't migrate** — keep using EOS for what it does well, layer AGS on top for what EOS doesn't.

The official AccelByte page on this is `https://accelbyte.io/ags-eos`.

---

## What stays on EOS

- **Authentication** — players continue authenticating via EOS.
- **Friends, lobbies, sessions, P2P** — EOS provides these well; no need to replace.
- **Player Data Storage** — EOS's lightweight per-player storage stays in place.

## What AGS adds on top

- **Custom backend logic** — Extend Service Extensions for features EOS doesn't cover (custom economy, custom progression, studio-specific systems).
- **Async event workflows** — Extend Event Handlers triggered by gameplay events from either EOS or AGS.
- **Custom databases** — for complex querying / persistent state beyond EOS Player Data Storage.
- **AccelByte Multiplayer Servers (AMS)** — dedicated game-server hosting if EOS's free-tier hosting isn't enough.
- **Matchmaking** — when EOS matchmaking can't express what you need.
- **Store / Entitlements** — for the studio's own economy on top of platform entitlements.
- **AI-assisted development** — scaffolding Extend apps via AI / MCP.

## The bridge: headless account linking

Players authenticate via EOS as normal. When AGS first sees an EOS player, AGS auto-creates a **headless account** linked to the EOS identity. Players see a single login flow (EOS); AGS sees a linked AGS account in the background.

For the implementation pattern, see `references/cookbook/headless-account-linking.md`.

**No EOS data migration required.** Extend acts as a logic layer on top of existing EOS player data.

## Open-source Extend apps relevant to EOS studios

(Names only — full list at `https://accelbyte.github.io/extend-apps-directory/`.)

- **EOS Voice Integration** — syncs EOS Voice rooms with AGS session and party state.
- **EOS Easy Anti-Cheat** — authenticates EAC signals and maps them to AGS enforcement policies.
- **Core Matchmaker** — overrides EOS matchmaking with custom MMR / Elo logic.
- **Rank Suite** — adds MMR-based weekly ranking on top of EOS multiplayer sessions.

These apps deploy as Extend apps inside AGS infrastructure. The conversation about scaffolding them belongs in `/ags-extend`, not `/ags`.

## When NOT to add AGS to an EOS game

- The studio is happy with EOS's defaults and isn't hitting any limits.
- The game is small and won't scale into the cost regime where AGS pays for itself.
- The studio doesn't need any of: custom backend logic, custom economy, advanced matchmaking, custom dashboards, dedicated server hosting beyond EOS's free tier.

## Common signals that EOS coexistence is the right move

- "We've been writing our own webhooks / Lambdas to glue EOS to other systems" — Extend Event Handlers replace that glue.
- "We need custom matchmaking logic" — Extend Override.
- "We need an API EOS doesn't have" — Extend Service Extension.
- "We need custom anti-cheat enforcement beyond what EAC does standalone" — `EOS Easy Anti-Cheat` in the Extend Apps Directory plus your own enforcement policies.

## Where the work happens

- `/ags ask` answers EOS-coexistence concept questions.
- `/ags-extend ask` covers Extend pattern selection for the specific gap the studio is filling.
- `/ags-extend init` or `/ags-extend wizard` to scaffold the actual Extend app from a template.
