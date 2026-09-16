---
last-verified: 2026-09-15
sources:
- https://docs.accelbyte.io/
- https://docs.accelbyte.io/gaming-services/knowledge-base/developer-faq/#handling-cors-cross-origin-resource-sharing-in-web-development
see-also:
- '[deprecation-check.md](../deprecation-check.md)'
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

- Installation: `npm install @accelbyte/sdk @accelbyte/sdk-iam` (plus any additional `@accelbyte/sdk-*` module packages needed). The core `@accelbyte/sdk` is a peer dependency of all module packages and must be installed. Importable in any modern bundler (Vite, webpack, Next.js, etc.).
- Module shape: services per AGS module exposed as TypeScript classes / functions; OAuth flows, IAM, Lobby, Sessions, Store, etc.
- Convention: Promise-based async / `await`. TypeScript types generated from the AGS OpenAPI specs.
- Auth flows: typically OAuth 2.0 PKCE for web apps. The package ships separate browser and Node entry points. Confidential client flows are not documented in the README — verify with AccelByte if you need server-side OAuth beyond the PKCE flow.

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

- **CORS** — the public AGS guidance does not establish an Admin Portal field or
  public API for changing browser origins. Private Cloud customers can request
  that AccelByte add their web domains to the server allow list; this is not
  available for Public Cloud. Before changing configuration, verify the active
  deployment and current setting with AccelByte support. For local development,
  use a local proxy such as Vite or `http-proxy-middleware`; do not disable
  browser security or repurpose an OAuth redirect URI as a CORS setting.
- **Token storage** — browser-side OAuth tokens need careful handling. The SDK uses `withCredentials` to send cookies automatically; avoid storing tokens in `localStorage`.
- **Deprecated methods** — a deprecated operation is marked with a `@deprecated` tag in its JSDoc block and nothing else. It is not a TypeScript diagnostic, so the call typechecks, builds, and passes CI unchanged; a method picked out of the type surface by name can already be deprecated. Read the whole JSDoc block on the declaration before calling it. When the tag names a substitute, see `../deprecation-check.md` § Checking the substitute before adopting it — on this SDK several substitutes are admin-only operations a player token cannot call.
- **Bundle size** — the SDK is modular. Install only the `@accelbyte/sdk-*` packages you actually use. If you install multiple modules, tree-shake aggressively.

## Where this SDK ends

- **Game-runtime calls** — if the call is happening inside the running game, it's the engine SDK's job, not this one.
- **Extend apps** — Extend apps are not web apps; they're backend services. They use Extend SDKs (Go / Python / C# / Java), owned by `/ags-extend`.

## Where to look in the docs

- AccelByte TypeScript SDK source + docs: `https://github.com/AccelByte/accelbyte-typescript-sdk`
- SDK npm package: `@accelbyte/sdk` and `@accelbyte/sdk-*` module packages on npm.
