---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[unreal.md](unreal.md)'
- '[unity.md](unity.md)'
- '[godot.md](godot.md)'
- '[typescript.md](../web/typescript.md)'
- '[install-sdk.md](../../../subskills/install-sdk.md)'
---

# SDK — Roblox

The AGS **Roblox SDK** for experiences built on Roblox. Wraps the AGS REST + OpenAPI surface adapted to Roblox's runtime model — Lua-based scripting, Roblox-managed servers, Roblox identity as the platform identity provider.

> **Versions move.** Check `https://docs.accelbyte.io/` and the SDK's GitHub release notes for the current capability matrix.

---

## What's in scope here

- Installation: Roblox Studio import (Models / packages) or pulled via Roblox's standard distribution mechanisms.
- Module shape: services exposed per AGS module — same logical layout as the other Game Engine SDKs, adapted to Lua idioms.
- Convention: coroutine / Promise-style async appropriate for Lua / Luau.
- IAM model: Roblox-authenticated players are linked to AGS players via platform identity binding (Roblox as a platform identity provider). Other identity providers can be linked too if the experience supports them.

`subskills/install-sdk.md` covers the operational install. This file is the conceptual "what is the Roblox SDK?" reference.

## Notes specific to Roblox

- Roblox runs servers itself; the AMS / dedicated-server pattern doesn't apply the same way — server-side AGS calls happen from Roblox-managed server scripts using a Roblox-style server identity.
- Outbound HTTP from a Roblox experience uses Roblox's HttpService with allow-listing constraints. The AGS SDK abstracts this but the experience must be configured to allow outbound calls to AGS endpoints.
- DataStore interplay: Roblox experiences typically use Roblox DataStores for persistent state. AGS can sit alongside or replace specific DataStore use cases (Store, leaderboards, achievements). Both can coexist; the choice is usually about cross-platform identity and crossplay needs.

## Where this SDK ends

- **Non-Roblox runtimes** — integrate via REST + OpenAPI, not the Roblox SDK.
- **Extend SDKs** (Go / Python / C# / Java) — unrelated; for Extend apps. Owned by `/ags-extend`.

## Where to look in the docs

- AccelByte Roblox SDK docs: `https://docs.accelbyte.io/`
- SDK source / releases: AccelByte's GitHub.
