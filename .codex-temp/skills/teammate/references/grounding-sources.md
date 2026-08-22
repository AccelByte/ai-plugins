---
name: teammate-grounding-sources
description: Where a teammate finding's citation legitimately comes from — the authoritative
  AccelByte sources the detectors query at scan time (Extend SDK MCP, AccelByte docs,
  the optional Wiki), how to cite each, why a live AGS read is evidence and never
  a citation, and the honest coverage gaps.
last-verified: 2026-08-18
sources:
- https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/
- https://docs.accelbyte.io/gaming-services/knowledge-base/graceful-disruption-handling/
- https://docs.accelbyte.io/policies/rate-limit/
- https://github.com/AccelByte/accelbyte-go-sdk
- https://github.com/AccelByte/accelbyte-unity-sdk
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin
see-also:
- '[grounding-rules.md](grounding-rules.md)'
- '[incomplete-integrations.md](detectors/incomplete-integrations.md)'
- '[deprecated-apis.md](detectors/deprecated-apis.md)'
- '[auth-token-safety.md](detectors/auth-token-safety.md)'
- '[error-resilience.md](detectors/error-resilience.md)'
- '[memory-contract.md](memory-contract.md)'
---

# Grounding sources

[`grounding-rules.md`](grounding-rules.md) says every finding is **cited or
suppressed**. This file says *where a citation legitimately comes from*. The
teammate is a **consumer** of AccelByte's own authoritative data, never a curator
of a parallel copy — a hand-maintained list would duplicate the source, drift out
of date, and invite the exact fabrication the grounding rule forbids. So each
detector reads its facts from the source that already owns them, at scan time.
Where the source enumerates its own pages, the detector reads *which* facts to
look for from there too, so its coverage tracks the source rather than the memory
of whoever wrote the playbook.

## The sources, by detection channel

The channels match the family's model: **A** static code read (always available),
**B** live AGS read via the AGS API MCP (needs credentials), **C** a
tool/MCP the studio has installed.

| Source | Channel | Grounds | Availability |
|---|---|---|---|
| **Extend SDK MCP** (`search-symbols` / `describe-symbols`) | C | Deprecations of server / Extend / admin **operations** — authoritative, per-operation | Offline, no credentials, all four SDK languages |
| **AGS release notes** (`.../knowledge-base/release-notes/`) | A | Deprecations of **client** (Unity/Unreal) SDK calls — per version, with the removal version | Public, always available |
| **Engine SDK source at the version the project has** | A | Client SDK calls the source deprecates — `[Obsolete]` on Unity; on Unreal a rare `[[deprecated]]` attribute or, far more often, a doc comment — including an overload deprecated in-place that no release note announces | Public. On Unity the ref comes from the repo's own manifest; on Unreal there is no pin, and the version is self-reported by the plugin copy |
| **AGS API MCP** (`get_token_info`, GET `run-apis`; `search-apis` / `describe-apis`) | B / A | **Nothing.** It supplies live config (enabled-vs-called) as *evidence* — moving `confidence`, refuting candidates — and the non-deprecated API surface for discovery | Live reads need credentials (Stage 3); surface enumeration is offline |
| **AccelByte docs** (`docs.accelbyte.io/gaming-services/modules/…`) | A | Per-module integration best-practices and public reference | Public, always available — the floor when no MCP is present |
| **AccelByte knowledge base and policies** (`…/knowledge-base/…`, `…/policies/rate-limit/`) | A | Cross-service practices no single module owns — retry, reconnection, rate limits, disruption handling, and the SDK versions each became automatic in | Public, always available |
| **`ags` skill references** | A | Module facts, security/auth rules, SDK-detection heuristics — the AGS family's maintained representation of AccelByte facts. Reason from these; they are **not** a citable target | Present when the AGS family is installed alongside this skill |
| **Wiki grounding tools** (`wiki_search` / `wiki_read` / `wiki_read_source` / `wiki_list`) | C | Cross-cutting prose from AccelByte's global, public documentation corpus — one deployment, the same for every studio. **Not** your studio's own material, which reaches you under two other prefixes and grounds nothing (rows below) | Optional; degrades silently when absent, and independently of whether either studio-scoped toolset is available |
| **Your studio's pages** (`wiki_studio_*`) | C | **Nothing.** Your own memory rewritten as pages. It orients a run and it is not a citation: a claim about AccelByte behaviour is not made true by your own notes, rewritten or not | Optional; its absence costs no citation, and its presence supplies none — a session holding only these has no grounding corpus |
| **Your studio's memory** (`wiki_memory_*`) | C | **Nothing.** Prior reports, scan history, suppressions and the activity feed ([memory-contract.md](memory-contract.md)) | Optional; degrades silently when absent, and independently of the two rows above |

### Deprecations → the operation source and the two client sources

Three authoritative surfaces, split by where the call lives:

- **Server / Extend / admin operations → the Extend SDK MCP.** A deprecated symbol
  carries *"the endpoint is going to be deprecated,"* the **substitute endpoint**,
  and a real SDK **source link** in its `files:` field — cite that link. The flags
  originate in AccelByte's OpenAPI specs and flow into every generated SDK, so the
  answer is authoritative and current (a curated internal pin records the
  mechanism).
- **Client (Unity/Unreal) SDK calls → the AGS release notes.** Each AGS release
  publishes a "Deprecated and removed features" section that names the exact
  engine-SDK interface and the version it is **removed** in — cite the page that
  names the interface (the announcing release, not the removal version, which often
  has no page of its own) and quote the removal version from it. Reach that page by
  following the release-notes index, never by building a per-version path from a
  pattern. See [`deprecated-apis.md`](detectors/deprecated-apis.md) for the worked
  lookup.
- **Client (Unity/Unreal) SDK calls → the SDK source at the version the project
  has.** The vendor stating the deprecation in the artifact the project compiles
  against is a source in its own right, not merely corroboration for the release
  notes, and it is the only channel that catches an overload deprecated in-place
  with no removal version announced. Cite the SDK file at a tag or commit, never
  `blob/master`. The two engines differ in what there is to cite. **Unity:** an
  `[Obsolete]` attribute on the called overload, at the ref the manifest pins,
  confirmed mechanically by the engine's own `CS0612` / `CS0618` compiler warning.
  **Unreal:** usually a doc comment above the declaration, which no compiler
  reads; rarely a `[[deprecated]]` attribute, which every compiler does; and in 51
  implementations at 28.9.0 a `FReport::LogDeprecated` that warns the developer's
  log at run time. Check which are there, and never read a quiet build as
  evidence. There is no pinned ref either, because the plugin is a copy inside the
  project whose version is self-reported
  ([`sdk-symbol-diff.md`](sdk-symbol-diff.md)).

**Do not hand-maintain a deprecation list, and do not guess a deprecation from a
method name** — a call *all three* surfaces are silent on is not a finding. But
silence in one channel is not absence in all three: a call the release notes never
mention is still grounded when the SDK source deprecates it at the version the
project has — `[Obsolete]` on Unity, an attribute or a doc comment on Unreal. The
Extend SDK MCP covers server/admin operations only; when it is absent, client-side
deprecations still have two full channel-A sources, and there is no fourth list to
fall back on. The Wiki corpus, if present, can raise confidence but is not a
grounding source on its own.

### Live config → the AGS API MCP (Stage 3)

`get_token_info` gives the namespace; the enabled-vs-called read is discovered with
`search-apis` / `describe-apis` and run as a GET through `run-apis`. This is channel
B and needs credentials, so a code-only run names the check without running it and a
config-aware run runs it.

Either way the read **grounds nothing.** A live namespace is not a page the reader
of an exported Report can open, and most of those readers have no access to it at
all. What the read does is supply evidence about the code and its configuration: it
raises **confidence** on a finding that is already cited, and it refutes candidates
the static signal got wrong — the most valuable thing it does, because a false
positive removed costs the studio nothing to act on. A claim whose only backing is
the live read has no openable source, so it is **suppressed** — in a config-aware
run just as in a code-only one, because running the read does not produce a source
([grounding-rules.md](grounding-rules.md)).
Note: the AGS API MCP is **not** a deprecation source — its bundled specs omit
deprecated operations by design.

### Best-practices → the module docs, and the knowledge base

The `incomplete-integrations` and `auth-token-safety` playbooks cite the deepest
`docs.accelbyte.io/gaming-services/modules/…` page that states the practice. These
are public and always available. A studio's installed Unity how-to knowledge base
can corroborate a practice at the client-method level, but **cite the live module
docs, not the knowledge base's own `source_url`** — those links may be stale.

`error-resilience` cites a second family of public pages, because the practices it
asserts are not per-module: AccelByte states them once, for every service at once,
under `docs.accelbyte.io/gaming-services/knowledge-base/…` (the *graceful
disruption handling* pages and *AGS best practices*) and under
`docs.accelbyte.io/policies/rate-limit/`. These are as citable as the module docs
and carry the same requirement — cite the page that states the practice, at the
depth it is stated. They are also **version-bearing**: the retry and reconnection
pages name the exact SDK versions where a behaviour became automatic, which is
what lets a version comparison ship live rather than suppressed
([`grounding-rules.md`](grounding-rules.md)).

That family is **enumerable**, and `error-resilience` uses it that way: the
*graceful disruption handling* section is an index that lists its own children, so
the detector walks it at scan time and takes the obligations it finds rather than
carrying a copied list. Follow the links the index gives — never build a page path
from a pattern, the same rule the release notes get above. This is what keeps the
detector's **coverage** current and not only its citations: a page AccelByte adds
is a signal the next scan checks, with no edit to this skill. Where the walk
cannot reach the index, the playbook's own rows are the floor and the run says it
fell back to them ([`error-resilience.md`](detectors/error-resilience.md)).

The module docs under `.../modules/…` are **not** enumerable this way — the
obligation sits inside integration prose and the page set has no bounded index —
so `incomplete-integrations` and `auth-token-safety` still read fixed lists of
signals. That is a known asymmetry, not a preference.

### AGS module facts → the `ags` skill references

The `ags` skill maintains detailed, versioned references for the same facts these
detectors assert — e.g. `security/iam-authorization-preflight.md` (Public vs
Confidential clients, the secret-in-client boundary), `debug/auth-failures.md`
(wrong-client-kind, dev-build-vs-prod-namespace), `modules/statistics.md`
(Leaderboards read from a stat code, Rewards listen to stat events),
`integrate/lobby-session.md` (Session notifies players of the server endpoint),
and `glossary.md` (AIS is deprecated). **Reuse these by reading them** — where the
`ags` skill is installed, read its reference and defer to it rather than restating
the fact. Do not tell the reader to follow a `see-also` entry to get there: an
`internal://` marker does not resolve here, so the pointer a reader would follow is
not one they can open. One marker backs both skills, which is why the two never
disagree — but a **marker is not a citation**, and neither is an `ags` reference.
Both are things
to reason from. What a finding *cites* is the live `docs.accelbyte.io` page the fact
rests on: an exported Report travels to readers who have no skill installed, and
`validate` accepts no scheme for a sibling file anyway. So use the `ags` reference to
decide *whether* the finding is real, then cite the public page that states it — and
where no public page states it, suppress the finding rather than reaching for a
target the reader cannot open ([grounding-rules.md](grounding-rules.md)). Do not fork
a parallel copy that drifts.

## Citing each source

- A **deprecated operation** → the SDK source link the Extend SDK MCP returns (a
  real `https://` GitHub source page).
- A **deprecated client SDK call** → the AGS release-notes version page that names
  it, quoting the removal version it states.
- A **deprecated client SDK call the release notes do not name** → the SDK source
  file at a tag or commit, quoting what deprecates it: on Unity the `[Obsolete]`
  line, plus the `CS0612` / `CS0618` warning when the engine emits one; on Unreal
  whichever marker the declaration carries — a `[[deprecated]]` attribute, which
  the build does raise, or far more often a doc comment, which it does not. No
  removal version is published in this case, so hold severity at `medium`.
- A **best-practice** → the deepest module docs page that states it.
- A **general or landing-page** source under a precise claim is weak, and that is
  a grounding problem: a page that does not state the fact does not cite it.
  Find the deeper page, or suppress the finding and name what would settle it.
  Do not ship it live at lower `confidence` — confidence is about the code, not
  about the documentation ([`grounding-rules.md`](grounding-rules.md)).
- Never invent a `docs.accelbyte.io` URL to stand in for a missing deep link —
  cite the SDK source link instead.

## Coverage gaps (state them, do not paper over them)

- **No queryable client-SDK index yet.** Server / Extend / admin deprecations
  match automatically via the Extend SDK MCP. Client (Unity/Unreal) deprecations
  are grounded either by the **AGS release notes** (which add the removal version)
  or by **what the SDK source says at the version the project has** — an
  `[Obsolete]` marker on Unity, an attribute or a doc comment on Unreal — but with
  no structured symbol index, matching a call site means reading those sources, not
  querying them. Ground it and cite whichever states it. The gap is breadth, not
  capability: checking one version bump needs the declarations the project's own
  call sites resolve to at both versions, which is bounded by the project rather
  than by the size of the SDK, and that is what
  [`upgrade-check`](../subskills/upgrade-check.md) reads. An index would widen the
  question that can be asked, not make the answer possible.
- **No per-operation public docs link** for most server-side deprecations — the
  SDK source link is the citation, not a docs page.
- **A studio-installed knowledge base may carry stale citation URLs.** Use its
  content only when you can re-ground the claim to a live module docs page.
- **Two detectors still read a fixed list of signals.** `incomplete-integrations`
  and `auth-token-safety` draw on the module docs, which no index enumerates, so
  what they look for is bounded by what their playbooks name — and unlike
  `error-resilience`, they have no coverage figure to report, so that bound is
  invisible in the summary. Treat a clean result from either as *nothing among
  these signals*, not as *nothing*.

When none of these sources is present, the detector playbooks are the floor: they
carry their own citations, so the scan still reports — it just cannot pull the
freshest live answer.
