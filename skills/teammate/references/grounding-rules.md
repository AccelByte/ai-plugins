---
name: teammate-grounding-rules
description: The grounded-or-suppressed rule and citation requirements every teammate
  finding obeys before it reaches a Report or shared memory.
last-verified: 2026-08-18
see-also:
- '[report-schema.md](report/report-schema.md)'
- '[grounding-sources.md](grounding-sources.md)'
- '[health-check.md](../subskills/health-check.md)'
- '[memory-contract.md](memory-contract.md)'
---

# Grounding rules

The teammate's credibility is its grounding. A studio acts on a finding only if
it trusts the finding is real — so the rule is absolute and mechanical, not a
matter of the model's discipline.

## The rule: grounded-or-suppressed

> **A finding either carries a citation or it is suppressed. There is no third
> state.** A live claim (`suppressed` other than `true`) must carry at least one
> `https://` citation **the reader can open** — a public documentation page, or a
> source file at a pinned ref. An ungrounded live claim is a validation failure,
> not a warning.

A Report is exported and shared, sometimes with someone who has no plugin
installed, so `https://` is the only form of citation that resolves for every
reader. `validate` also accepts `internal://`, so it cannot enforce that half of
the rule; see [What a citation is](#what-a-citation-is). Holding the line is this
skill's job.

This is enforced by `report_tool.ts validate`
([report-schema.md](report/report-schema.md)) — a Report with an uncited live
finding exits non-zero and never renders. The rule is a backstop the tool holds,
not a promise the model keeps.

## What a citation is

A citation is `{ source, note? }` where `source` is a **resolvable provenance
target**:

- `https://…` — an AccelByte documentation URL (or another authoritative page)
  that directly backs the claim. Never invent a plausible-looking docs URL, and
  never assemble one from a path you infer: reach the page by navigating from a
  known-good index, then cite the URL you actually landed on. **Nothing downstream
  checks this for you** — `validate` only confirms the `source` string starts with
  `https://` or `internal://`, so an unreachable URL passes validation and ships.
  Confirming reachability is this skill's job, not the tool's: fetch every URL you
  are about to cite, and drop or re-source any that does not resolve.
- `internal://<path>` — an **internal provenance marker only.** It records which
  curated AccelByte-internal fact a claim came from; it does **not** resolve to
  anything you or a Report's reader can open, so it cannot be the grounding a
  shipped finding rests on. `validate` accepts the scheme, which means an `internal://`-only
  finding passes the tool and still reaches a reader with nothing they can check.

  So: every **shipped** finding needs at least one `https://` source the reader can
  actually open — a public docs page, or a source file at a pinned ref. There is no
  scheme for citing a reference that ships beside this skill, and `validate` would
  reject one, so an `ags` reference is something to *reason from*, never something
  to cite. When the only backing is an internal fact or this family's own
  restatement of it, find the public page that fact rests on and cite that; when no
  such page exists, **suppress the finding** and name the page that would have to
  exist to ship it. What settles a grounding gap is always a page, never a check: a
  live read is evidence about the code and produces nothing a reader can open, so
  offering one here answers a different question than the one that suppressed the
  finding. Suppression is the designed outcome here, not a failure.

`note` is an optional one-line gloss on *why* the source backs the finding.

A citation must **actually support the specific claim**. A general landing-page
URL under a finding that asserts a precise limit or deprecation is a weak
citation — prefer the deepest page that states the fact.

When no deeper page exists, resolve it **as a grounding problem, which is what it
is**: a page that does not state the fact is not a citation for that fact, so the
claim is ungrounded and the finding is suppressed with what would settle it named.
Do not instead ship it live at lower `confidence`. Confidence says how sure the
detector is that *the code* exhibits the issue, and a thin docs page says nothing
about the code — the detector may be entirely certain. Lowering it there produces a
finding no reader can act on: "low confidence" tells them to go re-check their
code, when what is actually thin is the documentation behind the claim. The two
call for opposite work, and the field cannot distinguish them
([Grounding is not confidence](#grounding-is-not-confidence)).

Never upgrade a general source into precise-sounding prose.

## A source-file citation is pinned and anchored

When the citation is the code itself — an `[Obsolete]` marker, a signature, a
constant — it goes to a code-host blob URL at an **immutable ref**, with a
**`#L<line>` anchor** on the construct:

```
https://github.com/AccelByte/accelbyte-unity-sdk/blob/17.16.1/Runtime/Api/UserProfiles.cs#L290
```

`validate` refuses the other three shapes, because each reads as source-level
proof while being unable to deliver it:

- **No anchor** — a file-level link says the construct is somewhere in three
  thousand lines. The finding names one overload; the reader cannot check the part
  the finding rests on. Drop the anchor and the citation quietly stops being
  evidence for anything narrower than "this file exists".
- **A branch ref** (`/blob/main/…`) — it cites whatever `main` says on the day it
  is opened. The link never breaks, so nothing announces that the line moved. Pin
  the tag the repo pins, or the sha.
- **The raw file** (`/raw/…`, or `raw.githubusercontent.com/…`) — plain text, so
  the anchor scrolls to nothing and the reader gets the whole file to search.
  Pinning the ref does not fix it, because the ref was never the problem: swap
  `raw` for `blob` and keep the anchor.

The line number is already in hand: the grep that found the construct printed it.
A run that greps, reads the line, and then cites the bare file has thrown the
precise half away at the last step.

## Where citations come from

Every citation traces to a source that *owns* the fact, queried at scan time — not
to the model's memory. The [grounding-sources.md](grounding-sources.md) map says
which source grounds which detector. In order of preference:

1. **The authoritative AGS source for the fact.** A server/admin deprecation comes
   from the Extend SDK MCP (the structured deprecation flag, offline, no
   credentials); a client SDK deprecation from the AGS release notes or from the SDK
   source at the version the project has — an `[Obsolete]` marker at the ref the
   manifest pins on Unity, a `[[deprecated]]` attribute or a doc comment in the
   vendored plugin copy on Unreal; best-practices
   from the module docs ([grounding-sources.md](grounding-sources.md)). A live read
   of the namespace through the AGS API MCP is **not** on this list: it is evidence
   about the code, so it moves `confidence` and refutes candidates, but it is not a
   target a Report's reader can open. Cite exactly what the source
   returns — for a server deprecation, the SDK source link the MCP hands back.
   The `ags` skill's own references are that family's maintained representation of
   these same facts. **Reuse them by reading them** — where that skill is installed,
   read its reference and defer to it in prose rather than restating the fact
   inline. Read the file directly rather than telling the reader to follow a
   `see-also` entry to it — an `internal://` marker does not resolve here, so a
   `see-also` line naming an `ags` file is not a link anyone can open. That
   is for reasoning, not for citing: what a finding *cites* is the live
   `https://docs.accelbyte.io` page the fact rests on, because that is the only
   target every reader of an exported Report can open
   ([What a citation is](#what-a-citation-is)). An `internal://` marker records where
   a fact came from and never stands as a shipped finding's grounding. When it is the
   only backing and no public page states the fact, the finding is suppressed.
2. **The detector playbook.** Each detector reference
   (`references/detectors/*.md`) carries the citations for the facts it asserts,
   and names the authoritative source each claim is looked up from. A finding that
   matches something the playbook writes out inherits that playbook's source. A
   finding a discovering detector turned up by walking its source index is cited by
   the page the walk read it on — the playbook names the index, and the page that
   states the obligation is the one that grounds it. That is the **deepest** page
   stating it, and it need not be one the playbook enumerates: a walk that reaches
   a page the table never listed has found the obligation the table was calibrating
   against, not a different kind of thing. This is the always-available
   path — it works with no MCP installed.
3. **The curated Wiki corpus.** When the grounding tools are present,
   `wiki_search` / `wiki_read` ground cross-cutting best-practice prose against
   **AccelByte's global, public documentation corpus**
   ([memory-contract.md](memory-contract.md)). It is a secondary, optional
   layer — the authoritative deprecation flags live in the SDK and specs
   (source 1), not here. When those tools are absent, the scan **degrades
   silently** to the playbook citations.

   **Which corpus this means, because three toolsets answer here and only one is
   a source.** The tool-name prefix is the boundary. Read it off the name of the
   tool you are about to call — never off what a server is named, which is
   whatever whoever configured it chose (ADR-0035):

   | Tools | What answers | May ground a finding |
   |---|---|---|
   | `wiki_search` / `wiki_read` / `wiki_read_source` / `wiki_list` | AccelByte's global, public documentation, one deployment for everyone | **Yes** — AccelByte owns these facts |
   | `wiki_studio_*` | your studio's own memory, rewritten as pages | **No** |
   | `wiki_memory_*` | your studio's own memory, raw | **No** |

   Your studio's **memory** — reports, history, activity, and the pages written
   from them — is a different body of text entirely, and it is **never a
   grounding source for a finding**: a claim about AccelByte behaviour is not
   made true by your own notes asserting it, and it is not made true by those
   same notes rewritten as a page. Memory orients a run; sources ground it.
   Losing one does not degrade the other, which is why the toolsets are asked
   about separately (ADR-0026).

   **`wiki_studio_*` answering is not the grounding corpus answering.** A studio
   given only its own per-environment wiki has wiki tools in the session and no
   grounding corpus at all. That is the *absent* case, and the honest reading —
   fall back to the playbook citations. What the check above asks for is the
   four bare names and nothing else.

Never cite from training memory. If no owning source grounds a claim, the claim is
not grounded — suppress or drop it.

## Suppress vs drop

Both keep an ungrounded or intentionally-quiet claim out of the shipped findings.
They differ in whether the claim is *recorded*:

- **Suppress** (`suppressed: true`) — the finding is kept in the Report, marked
  suppressed, and needs no citation (a suppressed finding asserts nothing). Use it
  when the claim is worth *remembering* across runs: a candidate the user
  reviewed and waved off, or a real pattern with no citation yet. Suppression is
  keyed by the finding's line-independent fingerprint, so it survives code drift —
  the same candidate stays suppressed on the next scan.
- **Drop** — the candidate never enters the Report at all. Use it for noise: a
  match the detector playbook did not actually confirm.

Because the fingerprint is line-independent, two identical occurrences of the
same call collapse to one id — **suppressing one suppresses both** (see
[report-schema.md](report/report-schema.md)).

## Grounding is not confidence

Two independent axes; do not conflate them:

- **Grounded-or-suppressed** is binary and mandatory — cited, or not shipped.
- **`confidence`** (`low` / `medium` / `high`) is how sure the detector is that
  the code actually exhibits the issue. A finding can be well-cited (grounded) yet
  `low` confidence — e.g. a static (channel-A) signal a live read would confirm,
  which code-only mode cannot run. Ground it, cite it, and mark the confidence
  honestly; say what a config-aware run would settle.

The direction that stays clear: **an unrun check lowers confidence; a thin
citation is a grounding problem, not a confidence one.** A live read that would
confirm the code is evidence about the code, so not running it leaves the detector
genuinely less sure — that is confidence, used correctly. A docs page that does not
state the fact is evidence about the documentation, and routing it into
`confidence` mislabels a grounding failure as uncertainty about the code. Grounding
failures are resolved by finding the right source or suppressing, never by shipping
live at a lower number.

## No fabrication

- Do not invent citations, URLs, deprecations, limits, or error codes.
- Do not restate an SDK signature, a numeric limit, or a security claim from
  memory — take it from the playbook or the Wiki, cited.
- When unsure whether a source supports a claim, treat it as unsupported: suppress
  the finding and say what would ground it. A missing finding costs a re-scan; a
  fabricated one costs the studio's trust.
