---
name: teammate-detector-deprecated-apis
description: Usage of an AGS SDK API or module that is deprecated or far behind GA.
  Server/operation deprecations come from the Extend SDK MCP; client SDK deprecations
  come from the AGS release notes, or from the SDK source itself — an [Obsolete] attribute
  on Unity, and on Unreal a rare [[deprecated]] attribute or, far more often, a doc
  comment — all authoritative, none hand-curated.
last-verified: 2026-08-07
sources:
- https://docs.accelbyte.io/gaming-services/modules/ais/
- https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/
- https://github.com/AccelByte/accelbyte-go-sdk
- https://github.com/AccelByte/accelbyte-unity-sdk
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin
see-also:
- '[health-check.md](../../subskills/health-check.md)'
- '[grounding-rules.md](../grounding-rules.md)'
- '[grounding-sources.md](../grounding-sources.md)'
- '[report-schema.md](../report/report-schema.md)'
- '[memory-contract.md](../memory-contract.md)'
---

# Detector: deprecated APIs

**`detector_id: deprecated-apis`.** Flags SDK calls and modules that are
deprecated, superseded, or pinned far behind the current GA. Channel A (static)
for the call-site read; the deprecation *answer* is looked up from the source that
owns it, never from memory.

**Signal set bounded by:** the repo's own call sites, looked up one at a time.

There is no list of deprecations here to discover or to type — the candidates are
whatever the repo calls, and each one's answer comes from the source that owns it
(below). The release-notes index gets walked to reach the page that *cites* a
finding, never to enumerate what to look for, so a coverage figure over that index
would describe nothing about this detector's reach.

## Three authoritative sources, by where the call lives

AccelByte states its deprecations; this detector does **not** carry a
hand-maintained list ([grounding-sources.md](../grounding-sources.md)):

- **Server / Extend / admin operations → the Extend SDK MCP** (channel C —
  `search-symbols` / `describe-symbols`, offline, no credentials, all four SDK
  languages). A deprecated symbol states *"the endpoint is going to be
  deprecated,"* names the **substitute endpoint**, and returns a real SDK
  **source link** in its `files:` field — that link is the citation. The join key
  is the symbol `name`, which tracks the OpenAPI `operationId`.
- **Client (Unity / Unreal) SDK calls → the AGS release notes.** Every AGS release
  publishes a **"Deprecated and removed features"** section that names the exact
  affected engine-SDK interface and the version it will be **removed** in (e.g.
  the Unity SDK's `Api.TurnManager.GetClosestTurnServer`, removed in AGS 3.81).
  That per-version page is the citation. On Unity the SDK's own `[Obsolete]`
  marker in source confirms it; on Unreal what confirms it is whichever marker the
  declaration carries, and usually that is a doc comment rather than an attribute.
  This is what grounds a *client-side* finding.
- **The engine SDK's own source, at the exact version the project has** — a
  first-class source, not merely corroboration, because it is the vendor stating
  the deprecation in the artifact the project actually compiles against, which is
  **narrower and more current** than a release note. Cite the SDK file at a tag or
  commit — never `blob/master`, whose content drifts away from the claim.

  **On Unity** that means an `[Obsolete]` attribute on the called overload. Read
  the pinned ref out of `Packages/manifest.json`
  (`…accelbyte-unity-sdk.git#17.16.1`) and cite
  `…/accelbyte-unity-sdk/blob/<pinned-ref>/Runtime/Api/<File>.cs`; if the repo
  floats the dependency on a branch instead of a tag, say so and drop the
  confidence, because there is no stable ref to cite. Two things make the Unity
  channel decisive. First, the engine **compiler** can confirm it mechanically: a
  C# `CS0612` / `CS0618` warning in `Logs/Editor.log` naming the exact member is
  the project's own toolchain agreeing, so quote it. Second, it catches what the
  release notes structurally cannot — an overload deprecated in-place with no
  removal version announced.

  **On Unreal the same channel exists in four tiers, and which tier a finding
  rests on changes what it may promise.** Most deprecations are a **documentation
  comment** above the declaration, in several spellings (`@deprecated`,
  `[DEPRECATED]`, `DEPRECATED:`, a trailing `// DEPRECATED`) — 57 such lines
  across `Source/` at 28.9.0. Nothing reads those. Rarely the SDK uses the **C++
  attribute** `[[deprecated("…")]]`, which the compiler does raise: exactly one
  occurrence at 28.9.0 and none before 28.6.0. A couple of `UFUNCTION`/`UPROPERTY`
  `Deprecated*` metadata entries reach Blueprint callers. And **51 implementations
  call `FReport::LogDeprecated`**, a `UE_LOG(…, Warning, …)` the developer sees at
  run time rather than at build. `UE_DEPRECATED`, the marker an Unreal engineer
  would look for, appears **zero** times at either tag — so a zero on that row says
  nothing about whether anything speaks. Read the declaration *and* the
  implementation before promising a quiet build or a quiet log. All four are
  citable at a tag exactly as `[Obsolete]` is. There is no pinned ref to read on
  Unreal either — the plugin is a copy inside the project and its version is
  self-reported — so the version stated with the finding says where it was read
  from ([sdk-symbol-diff.md](../sdk-symbol-diff.md)).

  When a finding rests on this channel alone, on either engine, note that no
  removal version is published and hold severity at `medium` rather than
  escalating.

Never guess a deprecation from a method's name. A call that none of the three
sources above flags is **not** a finding — that is the fabrication the
grounded-or-suppressed rule ([grounding-rules.md](../grounding-rules.md)) forbids.
Conversely, do **not** suppress a call the SDK source marks `[Obsolete]` merely
because the release notes are silent about it: silence in one channel is not
absence in all three.

## Signals

| Found in the call-site map | Finding | Grounded by |
|---|---|---|
| A server/admin SDK call whose operation the Extend SDK MCP flags `deprecated` (match the called method to a symbol `name` / `operationId`) | `deprecated-endpoint-called` — migrate to the substitute endpoint the MCP names | Extend SDK MCP symbol (its `files:` SDK source link) |
| A Unity/Unreal SDK call named in an AGS release notes "Deprecated and removed features" section | `deprecated-sdk-call` — migrate before the named removal version | [AGS release notes](https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/) (the version page that names it) |
| A Unity SDK call binding to an overload the **pinned** SDK source marks `[Obsolete]` — often with no release-note entry at all, because the deprecation is in-place | `deprecated-sdk-call` — migrate to the non-obsolete overload | The SDK file at the repo's pinned ref (`blob/<tag>/Runtime/Api/…`), plus a `CS0612`/`CS0618` warning from the project's own compile if one exists |
| An Unreal SDK call resolving to a declaration the SDK deprecates — a `[[deprecated]]` attribute, or far more often a doc comment alone | `deprecated-sdk-call` — migrate to the replacement the marker names, if it names one. Where the marker is a comment alone, say the build will not raise it, and check the `.cpp` for a `FReport::LogDeprecated` before calling it silent | The SDK header at the version the project has (`blob/<tag>/Source/AccelByteUe4Sdk/Public/…`), quoting the marker, plus the implementation where it logs. A comment-only deprecation has no build warning to corroborate it, and the absence of one is not evidence the call is fine |
| AGS Analytics / AIS event calls (the AIS analytics client; `SendAnalyticsEvent` against AIS) | `ais-deprecated` — AIS is offered to existing customers only, so new telemetry does not belong on it | [AIS module docs](https://docs.accelbyte.io/gaming-services/modules/ais/) — the only citable source; the `ags` glossary AIS entry corroborates it when that skill is installed, but corroboration is not grounding |
| SDK package/plugin manifest pinned several releases behind current GA | `sdk-behind-ga` — schedule an upgrade | Needs a version source from the repo itself; suppress when none exists (see Grounding) |

## Findings

| Finding | Severity | Confidence (code-only) | The fix direction |
|---|---|---|---|
| `deprecated-endpoint-called` | medium | high on a confirmed operation match; low on a name-only match | Migrate to the substitute endpoint the MCP names; keep the old call until the substitute is wired. |
| `deprecated-sdk-call` | medium while the named removal version is still ahead, or when the SDK deprecates it in place with no removal version published; **high once a named removal version has shipped** or the interface is already absent from the SDK version the project has — the break is present-tense, not upcoming | `high` when the release notes name the exact interface, or the SDK source deprecates that exact overload — `[Obsolete]` on Unity, a doc comment on Unreal; `medium` when the match is looser than the literal name. A compiler warning corroborates a marker and is never required for it — on Unreal the attribute that would produce one is rare, so its absence is not a reason to lower confidence | Migrate to the replacement the SDK author names — an `[Obsolete]` message on Unity, the attribute message or doc comment on Unreal — or to the interface the release notes point to; where nothing names one, say so rather than inferring from a similar name. |
| `ais-deprecated` | medium | medium | Move telemetry off AIS to the current Analytics offering, which the AIS page points to; AIS remains only for existing integrations. Name a specific successor product only if the source you cite names it. |
| `sdk-behind-ga` | low | low — **suppressed** unless the repo itself supplies both version numbers, because nothing public states the current-GA number (see Grounding) | Schedule an SDK upgrade; run `upgrade-check` against the version you have in mind first, to see what breaks. |

`deprecated-endpoint-called` is near-certain when the called operation maps to a
symbol the MCP flags — the flag is authoritative and the substitute endpoint is
explicit. `deprecated-sdk-call` is well-grounded whenever the release notes name
the exact interface (the citation carries the removal version, which sets
urgency); its residual uncertainty is only whether the studio's call site is
truly that interface, which a string match on a distinctive method name settles.

`ais-deprecated` has a specific public source, so it ships at medium confidence.
`sdk-behind-ga` is a heuristic — "behind" needs a current-GA number this detector
does not carry yet. That is a grounding problem, not a confidence one: with no
public page stating the number, it **suppresses**. It ships only when the repo
supplies both versions itself (see Grounding), and then it is framed as "worth
scheduling", not "broken".

**The `Confidence (code-only)` column is the value the finding carries.** Copy it;
do not re-rate it against the evidence in front of you. `deprecated-sdk-call` in
particular has come out `high`, `medium`, and `high` on three scans of one commit
with the same `[Obsolete]` marker and the same pinned tag underneath — the column
above already answers it, and the answer does not depend on who is reading.

### Suppression-only rows — walk it, every run

`sdk-behind-ga` can only ever ship suppressed unless the repo itself supplies both
version numbers. Evaluate it every run and emit it whenever its trigger fires;
leaving it out is a statement that the trigger did not fire, not that the run ran
short of attention (Stage 5's walk).

| Row | Trigger | If it fires |
|---|---|---|
| `sdk-behind-ga` | The repo pins an SDK version and no public page states the current GA number | Emit, `suppressed: true`, `confidence: low`, no citation |

## Grounding

- `deprecated-endpoint-called` is grounded per finding by the Extend SDK MCP
  symbol that carries the flag: cite the SDK source link it returns, and quote its
  substitute endpoint. The mechanism (a structured `deprecated` flag in the specs,
  surfaced offline via the MCP, agreeing across the generated SDKs) is background —
  what a finding cites is the SDK source link the MCP itself returned.
- `deprecated-sdk-call` is grounded in the specific
  [AGS release notes](https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/)
  version page whose "Deprecated and removed features" section names the interface
  — cite that page and quote the named removal version. The
  [Unity SDK repository](https://github.com/AccelByte/accelbyte-unity-sdk) carries
  the matching `[Obsolete]` marker in source.

  **The announcing page is not the removal version.** A deprecation is announced in
  the release *before* removal, so the page to cite is the one whose text names the
  interface — not a page named after the removal version, which may not exist at
  all. Reach it by opening the
  [release-notes index](https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/)
  and following its
  [older releases](https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/older-release-notes/)
  list; do not construct a per-version path by pattern. Worked example — the
  `Api.TurnManager.GetClosestTurnServer` deprecation is announced on
  [ags-3.78.0](https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/older-release-notes/ags-3.78.0/)
  ("which will be removed in AGS version 3.81"), and there is **no** `ags-3.81`
  page — the older-release list runs 3.78.0, 3.79.0, 3.80.0 and then changes to
  calendar versioning. A missing page is not a missing release: the
  [ags-3.80.0](https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/older-release-notes/ags-3.80.0/)
  page states a deprecation was *"rescheduled to AGS version 3.81 (2025.1)"*, so
  **3.81 ≡ 2025.1**, which shipped as
  [ags-2025.1.0](https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/older-release-notes/ags-2025.1.0/)
  on 4 February 2025. When an announced removal version has no page of its own, look
  for its calendar equivalent before concluding it never landed — and never assert
  that it didn't; say the removal version could not be confirmed.
- `ais-deprecated` is grounded in the
  [AIS module docs](https://docs.accelbyte.io/gaming-services/modules/ais/), which
  state that "AIS is only available to existing customers and is not offered to new
  customers" and direct analytics needs to the Analytics section. That page names
  **no** successor product, so the finding says only that AIS is closed to new
  integrations and points at Analytics — **do not name `gametelemetry` (or any other
  service) as the documented substitute under this citation.** The `ags` glossary
  reaches the same conclusion (`ags/references/glossary.md`: "AIS …
  *Deprecated.* … Studios with analytics needs use AGS Analytics") — reuse it; the
  citation stays the AIS module docs.
- `sdk-behind-ga` has **no citable runtime source at all**, and that is the reason it
  almost always suppresses. Its only backing is an internal product reference whose
  SDK matrix (Unreal 4.27–5.x, Unity current LTS) is not restated in any shipped
  reference, so there is nothing for a finding to cite. Ship it only when the repo
  itself supplies the version evidence — a pinned SDK tag several releases behind a
  release-notes-published current version, both named — and suppress it otherwise. A
  repo that floats the dependency on a branch (`…-unity-sdk.git#main`) declares no
  version, which is not the same as being behind one; that is a suppression, not a
  low-confidence finding. The version-by-version break detail is
  [`upgrade-check`](../../subskills/upgrade-check.md), which answers it against a
  named target version rather than against current GA.

### What is grounded now vs what a symbol index would add

The AGS release notes make a client-side deprecation **citable today** — a finding
names the interface, the removal version, and the page that says so. What is still
missing is a *queryable, structured* index of the Unity/Unreal SDK symbols, so a
scan matches a call site to a deprecation by **reading the release notes / the SDK
source**, not by querying an index. Flag only what the release notes name or what
the SDK source deprecates at the version the project has — `[Obsolete]` on Unity,
an attribute or a doc comment on Unreal — and cite whichever of the two states
it.

That missing index is a limit on **breadth**, not on whether a version bump can be
checked at all. Matching one call site needs the declaration it resolves to at
both versions, not a catalogue of every symbol, and reading both is bounded by what
the project actually calls — the same bound this detector already works under.
[`upgrade-check`](../../subskills/upgrade-check.md) does exactly that; an index
would make the lookup cheaper and let a run answer questions nobody's code asked
yet, which is a different thing from unblocking it. Where that leaves this
detector is unchanged: it reports what is deprecated at the ref you pin today,
and the break detail against a target version is the other subskill's.

## Channel B — what a live read settles

**Nothing here.** This is the one detector a config-aware run changes not at all,
and it is stated rather than left out so a run does not go looking for a read that
would settle a deprecation. Every finding keeps exactly the confidence the code-only
path gave it.

Two reasons. A deprecation is a fact about the *SDK*, not about a namespace: no
environment setting makes a call deprecated or un-deprecates one. And the AGS API
MCP is not a deprecation source in the first place — its bundled specs omit
deprecated operations by design
([grounding-sources.md](../grounding-sources.md)), which makes an operation's
absence from `search-apis` an inviting false signal. **An operation you cannot find
is not evidence that it is deprecated.** Flag only what the three sources above
state.

## What not to flag

- A call that **all three** sources above are silent on — not flagged by the Extend
  SDK MCP, not named in the release notes, and not deprecated in the SDK source at
  the version the project has (`[Obsolete]` on Unity, a doc comment on Unreal).
  Silence across every channel is authoritative; do not add it back from memory.
  Silence in *one* channel is not: a call the release notes never mention is still
  a finding when the SDK source deprecates it.
- An SDK method you *think* is deprecated but that no channel states — that is the
  fabrication the grounded-or-suppressed rule
  ([grounding-rules.md](../grounding-rules.md)) forbids.
- A pinned-but-current SDK version — "behind GA" means several releases back, not
  "not the very latest patch".
