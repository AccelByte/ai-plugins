---
last-verified: 2026-04-29
sources:
- https://docs.accelbyte.io/
see-also:
- '[unreal.md](../game-engine/unreal.md)'
- '[unity.md](../game-engine/unity.md)'
- '[godot.md](../game-engine/godot.md)'
- '[roblox.md](../game-engine/roblox.md)'
- '[install-sdk.md](../../../subskills/install-sdk.md)'
---

# SDK — TypeScript (Web)

The AGS **TypeScript SDK** for web apps that talk to AGS — admin / live-ops dashboards, web companion apps, internal tooling, browser-based parts of an Extend App UI. **Sibling, not subset** of the Game Engine SDKs: separate distribution, different idioms, but the same underlying AGS REST + OpenAPI surface.

> **Distinct from the game SDKs.** A web companion that lives next to a Unreal / Unity / Godot / Roblox game uses *this* SDK, not the engine SDK. A game client uses the engine SDK; a web admin tool uses this one.

---

## What's in scope here

- Installation: npm package via `npm install` / `yarn add` / `pnpm add`. Importable in any modern bundler (Vite, webpack, Next.js, etc.).
- Module shape: services per AGS module exposed as TypeScript classes / functions; OAuth flows, IAM, Lobby, Sessions, Store, etc.
- Convention: Promise-based async / `await`. TypeScript types generated from the AGS OpenAPI specs.
- Auth flows: typically OAuth 2.0 PKCE for web apps. Can also use confidential clients server-side (e.g. in a Next.js API route or a Node backend that talks to AGS on behalf of the web frontend).

`subskills/install-sdk.md` is the operational install guide and includes the web-app path. This file is the conceptual "what is the TypeScript SDK?" reference.

## When to reach for the TypeScript SDK

- Building an **admin / live-ops dashboard** on top of AGS.
- Building a **web companion app** for a game already on AGS (web profile pages, web-based store, web events).
- Building **browser-based Extend App UIs** that need to call AGS APIs from inside the Admin Portal.
- Internal tooling for live-ops staff that's faster to build as a web app than to hack into the Admin Portal.

## When *not* to use it

- **The game itself** uses an engine SDK (Unreal / Unity / Godot / Roblox), not this.
- **A backend service** uses the appropriate Extend SDK (Go / Python / C# / Java) if it's an Extend app, or REST directly otherwise. The TypeScript SDK is for browser / Node web-app contexts, not for headless backend services unrelated to Extend.

## Common gotchas

- **CORS** — AGS endpoints are CORS-aware, but custom domains or admin endpoints may need explicit allow-listing. Check Admin Portal config or AccelByte support if a fetch fails CORS.
- **Token storage** — browser-side OAuth tokens need careful handling (HttpOnly cookies for refresh tokens, in-memory for access tokens). The SDK has guidance; don't put refresh tokens in `localStorage`.
- **Bundle size** — the TypeScript SDK pulls types and clients for all AGS modules by default. Tree-shake aggressively if bundle size matters.

## Where this SDK ends

- **Game-runtime calls** — if the call is happening inside the running game, it's the engine SDK's job, not this one.
- **Extend apps** — Extend apps are not web apps; they're backend services. They use Extend SDKs (Go / Python / C# / Java), owned by `/ags-extend`.

## Where to look in the docs

- AccelByte TypeScript SDK docs: `https://docs.accelbyte.io/`
- SDK npm package / source: AccelByte's GitHub and npm registry.
