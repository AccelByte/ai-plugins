---
last-verified: 2026-09-15
sources:
- https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin
- https://github.com/AccelByte/accelbyte-unity-sdk
- https://github.com/AccelByte/accelbyte-typescript-sdk
- https://github.com/AccelByte/accelbyte-go-sdk
- https://github.com/AccelByte/accelbyte-python-sdk
see-also:
- '[_index.md](_index.md)'
- '[unreal.md](game-engine/unreal.md)'
- '[unity.md](game-engine/unity.md)'
- '[godot.md](game-engine/godot.md)'
- '[roblox.md](game-engine/roblox.md)'
- '[typescript.md](web/typescript.md)'
- '[integrate.md](../../subskills/integrate.md)'
- '[iam-authorization-preflight.md](../security/iam-authorization-preflight.md)'
---

# SDKs — Checking a method before you call it

Applies to every AGS SDK family: the Game Engine SDKs, the TypeScript Web SDK,
and the Extend SDKs.

## Why a signature is not enough

Picking a method by searching the SDK's type surface — a `.d.ts` file, a C++
header, a package's public class list — finds you a name and a signature. It
does not tell you whether that method is still the one to use.

Across the AGS SDKs, deprecation is carried in **documentation attached to the
declaration**, and in most of them it is not something a compiler enforces. A
deprecated call therefore typechecks, builds clean, and raises no editor
warning. The failure surfaces later — against a live namespace, or when the
operation is removed in a subsequent AGS release. So:

- A clean build is **not** evidence that a method is current.
- A search over signatures can match a declaration whose own documentation says
  not to use it.
- An absent marker is **not** evidence of anything. Where the convention is
  weak or inconsistent, absence means unestablished, and the answer has to come
  from a source that owns it.

## Markers by SDK family

The marker differs per family, so a single text pattern does not generalize.

| SDK family | Marker on the declaration | What tooling does with it |
|---|---|---|
| Unreal (C++) | Usually a doc comment — `@brief [DEPRECATED]`, `[DEPRECATED - Will be removed in <version>]`, or `@deprecated`. A `[[deprecated]]` attribute appears only occasionally. | Nothing at build time, in almost every case — but many deprecated methods additionally log a runtime warning; see below |
| Unity (C#) | An `[Obsolete("…")]` attribute, and frequently a bare `[Obsolete]` with no message | A compiler warning (`CS0612` / `CS0618`), easy to lose in build output; the bare form names no replacement |
| TypeScript (Web) | A `@deprecated` tag in the JSDoc block | Editor strike-through at most; no `tsc` diagnostic, so it never fails a build or a CI typecheck |
| Go (Extend) | A `// Deprecated: <date> - Use <Name> instead` comment | A vet or editor hint, not a build error; it does name the substitute and the date |
| Python (Extend) | Operation wrappers are largely unmarked | Nothing |
| Godot, Roblox | Not established | Treat as unmarked and check the source below |

Sampled on 2026-09-15 against the default branch of each SDK repository. These
counts show the shape of the problem and are not current totals — each one
moves whenever an SDK is next tagged, so quote them with their date or not at
all:

- Unity `Runtime/Api/User.cs` — 22 `Obsolete` occurrences against roughly 120
  public members, several of them the bare attribute.
- Unreal `Source/AccelByteUe4Sdk/Public/Api/AccelByteUserApi.h` — 11
  deprecation mentions, of which exactly one is a `[[deprecated]]` attribute;
  the rest are doc comments only. Two other API headers in the same plugin
  carried one doc-comment mention and no attributes between them.
- Go `iam-sdk/pkg/iamclient/o_auth2_0/o_auth20_client.go` — 19 `Deprecated:`
  comments, each naming a substitute and a date.

Unreal is the weakest compile-time signal of the set and the largest engine
surface, which is why reading the declaration matters most there. Three things
about it are worth knowing before you rely on a search:

- **`UE_DEPRECATED` is the marker an Unreal engineer would reach for, and this
  SDK does not use it.** Measured across `Source/` at two tags, the count is
  zero at both. Finding none of it settles nothing.
- **Many deprecated methods do warn — at run time, not at build.** Their
  implementations call `FReport::LogDeprecated(…)`, which emits
  `UE_LOG(LogAccelByte, Warning, …)`; measured at 51 call sites at tag 28.9.0,
  against 57 declarations carrying only a documentation comment. So the Output
  Log during a manual test pass is a real second channel, and a cheap one. Treat
  it as supplementary: it fires only on a path you actually execute, so silence
  there is not evidence, and it is no substitute for reading the declaration.
- **There is no pinned ref to cite on Unreal.** The plugin is vendored into the
  project as a copy, and the version it claims is self-reported by that copy. So
  the instruction below to cite a tag or commit cannot be satisfied the same way
  here — say which vendored copy was read and what version it claims.

## Before you write the call

1. Read the **whole declaration block** — the comment or attribute above the
   method, not just the line the search matched.
2. If it carries a deprecation marker, treat the method as not shippable and
   find what replaces it. The replacement is not adopted until it has passed
   the caller and token check in the next section — a substitute that your
   caller cannot call is not a fix.
3. If it carries no marker, and the SDK is one where the convention is weak,
   confirm against the authoritative source below rather than concluding the
   method is current.
4. Record which SDK version you read. A deprecation is a fact about a version,
   so a claim taken from a floating branch does not describe what the project
   compiles against.

## Checking the substitute

This section is where this rule is stated. The per-SDK references and the
integration subskill point here rather than restating it, so a correction lands
in one place.

A name given by a deprecation notice is a **candidate, not an answer**. Some
substitutes are admin or server operations that a player token cannot call at
all, so adopting one without checking simply moves the failure: the build is
still clean, and the call still fails against a live namespace. This is the
second dead end, and it is reached by doing the obvious thing.

Run the substitute through the same authorization check as the original, in
[iam-authorization-preflight.md](../security/iam-authorization-preflight.md):
caller type, token source, and IAM client kind. If the substitute needs a
confidential client or an admin permission and the caller is a game client,
then the substitute is not the fix, and the flow needs a different path —
a server-side call, or a different operation entirely.

Where a bare marker names no substitute at all — the Unity case — the
replacement has to be found from the source below, not guessed from a similar
method name.

## Where the answer comes from

Use what AccelByte publishes. Do not rely on a remembered list of deprecated
methods, and do not build one.

- **Server, Extend, and admin operations** — the AccelByte Extend SDK MCP
  server, which searches and describes SDK symbols across the Extend SDK
  languages. A deprecated symbol states that the endpoint is being deprecated,
  names the substitute, and returns a source link.
- **Client SDK calls (Unreal, Unity)** — the AGS release notes. Each release
  publishes a "Deprecated and removed features" section naming the affected
  engine-SDK interface and the version it is removed in. That per-version page
  is the citation.
- **The SDK source at the version the project actually uses** — the vendor
  stating it in the artifact being compiled, which is narrower and more current
  than a release note. Cite the file at a tag or commit, never at a moving
  branch, whose content drifts away from the claim.

## Auditing code that already exists

This reference is for choosing a method before the call is written. To sweep a
repository that already calls AGS — deprecated APIs among incomplete
integrations, token handling, and error paths — run `/teammate`, which reports
findings against these same sources.
