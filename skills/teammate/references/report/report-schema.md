---
name: teammate-report-schema
description: Report JSON and activity-entry contract for the teammate skill, and the
  validation rules report_tool.ts enforces.
last-verified: 2026-08-12
see-also:
- '[health-check.md](../../subskills/health-check.md)'
- '[memory-contract.md](../memory-contract.md)'
---

# Report schema

The Report is the canonical artifact of a scan: a machine-checkable set of
findings, each cited or explicitly suppressed. `report_tool.ts validate` is the
mechanical gate — nothing reaches an exported report or memory without passing
it. Keep this file and the validator in lockstep.

Field names are snake_case, matching the `activity` schema below — one
convention across both persisted kinds.

## Report object

| Field | Type | Rule |
|---|---|---|
| `schema_version` | string\|number | Non-empty, and it has to name a generation: `v5` parses to no number and is refused rather than read as generation 1, the most permissive of them. `6` today. Generation `2` requires `repo.tree_state`; `3` adds `repo.name`, `actor`, `actor_source`, and `repo.tree_hash` on a dirty scan; `4` adds `cross_reference` on a config-aware report and `provenance.started_at` wherever provenance is recorded; `5` adds `cross_reference.candidates[].unreadable_reason` on a `not-readable` row, and `read` with it on the three reasons that describe a read that was made; `6` adds `surface`, the Stage 2 call-site index, in both modes. Older generations still validate, so a stored report is readable rather than a rescan being forced by a version bump alone — with one rule deliberately outside that grandfathering, `unreadable_reason` on a settled candidate, which is refused at every generation because no stored report can carry a field that did not exist until 5. |
| `mode` | enum | `code-only` \| `config-aware`. |
| `namespace` | string | Non-empty, one line, and not made **only** of whitespace and characters that render as nothing — see *What renders as nothing* below. The AGS namespace the run read live. **Required when `mode` is `config-aware`, refused otherwise** — see below. Never the `unknown` sentinel: that belongs to an activity entry, and a config-aware report claims it read one. |
| `repo.name` | string | Non-empty, one line, and free of `@`, `:`, `+`, `/` and whitespace — the key's own separators. The repository's directory name. **Required from `schema_version` 3.** `wiki_memory_list` returns every report in the studio scope with no repo filter, so a report that cannot name its repo is read as belonging to whichever one is scanning. |
| `repo.commit_sha` | string | Non-empty, one line, and free of the key's own separators like `repo.name` — it is the key's second segment, and a project that is not a git tree supplies a stable identifier of its own here. The scanned commit, pinned into the header. |
| `repo.tree_state` | enum | `clean` \| `dirty` — whether the worktree matched `commit_sha` when it was scanned. **Required from `schema_version` 2**, and required by `memory-doc` at every generation: the clean key and the dirty key are different keys, so a report that does not say which tree it scanned would take the clean one by default. |
| `repo.tree_hash` | string | Full 64-char lowercase sha256 of the uncommitted state. **Required when `tree_state` is `dirty` from `schema_version` 3, and refused when it is `clean`** — a clean tree is identified by its commit, and a second identity for it invites a second row describing the same code. |
| `repo.url` | string | Optional. A string, one line, and not made **only** of whitespace and characters that render as nothing — until 2026-08-07 this key was named and never looked at, so it had no type check either. Where a reader goes to open the repository; a row pointing at nothing is worse than the no row that omitting it gives. |
| `actor` | object | `{ id, display }`, both non-empty and neither made **only** of whitespace and characters that render as nothing. Not held to the line rule: on this report neither value is rendered — `id` is hashed into the key by `actorSlug` and `display` is read from the *activity* entry's own actor, which carries no content rule at all yet. Who ran the scan. **Required from `schema_version` 3.** Load-bearing on a dirty report, whose key is per-person. |
| `actor_source` | enum | `iam` (a verified person) \| `iam-client` (a verified *service* — a token with a client id and no `sub`) \| `git-config` (unverified — self-asserted). **Required from `schema_version` 3** — an actor with no stated provenance cannot be told apart from one a run composed for itself. |
| `findings` | array | Zero or more findings (below). |
| `cross_reference` | object | `{ candidates }` — every candidate the run *attempted* a live read on, refuted ones included. **Required when `mode` is `config-aware` from `schema_version` 4, refused otherwise** — the same both-directions pairing `namespace` carries. See § Cross-reference inventory. |
| `surface` | object | `{ capabilities, not_read? }` — which AGS capabilities this commit calls, and where. **Required from `schema_version` 6, in both modes** — Stage 2 derives it on every run, and used to discard it. Deliberately *not* paired with `mode`, unlike `namespace` and `cross_reference`: it is a static read, so a run whose live half fails relabels itself `code-only` and keeps it. Only the per-capability `config` edge is mode-paired. See § Integration surface. |
| `provenance` | object | Optional as a whole, but a present one must carry `scanned_at`. |
| `provenance.started_at` | string | When the scan began, stamped at Stage 1. **Required from `schema_version` 4 whenever `provenance` is present**, and refused if it is after `scanned_at`. Same ISO-8601-UTC rule, same `date -u`, never composed. |
| `provenance.scanned_at` | string | Expected on new reports; absent on ones written before it existed. When the findings were derived. Stamped once by the scan and never rewritten: the reuse path serves the stored report with the stored timestamp, which is what makes a reused report visible as one. |
| `provenance.tool_version` | string | Optional, non-empty, one line, and not made **only** of whitespace and characters that render as nothing — the alternative was `(teammate )` beside the timestamp, on the one row that tells a fresh report from a reused one. The skill version that derived the findings — a stored report is only as current as the playbooks that produced it. |

`mode` and `namespace` are checked **against each other**, in both directions.
`config-aware` is a claim that part of this report came from a live read, so the
report has to name the environment it read: a mode label with no namespace behind
it cannot be checked by the person the report is forwarded to. The reverse is the
same rule from the other side — a code-only run never read a namespace, so a value
in that field was composed, and a composed environment name on a report is worse
than none. Take it from `get_token_info` (`subskills/health-check.md` Stage 1, where the probe
binds the mode before the memory key is composed from it; Stage 3 consumes what it
bound), never from the repo's own config: what the config asks for is the thing
under scan, not evidence about it.

`cross_reference` travels with `mode` on exactly the same terms, and for the same
reason: a code-only run attempted no candidate against a live namespace, so an
inventory on one was composed rather than read. A run whose reads all failed
relabels itself `code-only` and drops **both** fields together — a report
carrying one of them without the other is that relabel left half-done.

`repo.tree_state` is the difference between a commit the report *looked at* and a
commit it merely *names*. `commit_sha` is taken from `git rev-parse HEAD`, which
answers regardless of what is sitting uncommitted next to it — so a scan of a
modified worktree pins a sha whose checkout does not contain the code the
findings describe. That is survivable in the exported page, which a human reads
with context; it is not survivable under the clean key `<repo>@<sha>:<mode>`,
where the next run at that sha reuses the answer without ever seeing the tree it
came from. So a `dirty` report exports with a **Worktree** provenance row saying
so. Set it from `git status --porcelain` at Stage 1: any output at all is
`dirty`.

A dirty report is still worth keeping — on a working machine the tree is dirty
almost always, and a rule that only stores clean scans stores nothing. It is
kept under a **different key**, one that says whose edits these are
(`<repo>@<sha>+u<actor12>:<mode>`, see
[memory-contract.md](../memory-contract.md)), and only when a human agreed to it
that run: `memory-doc` refuses a dirty report unless `--allow-dirty` is passed.
`repo.tree_hash` is what makes the offer honest on the way back out — it lets a
later run say *these were your edits, and they have moved since* instead of
serving stale findings as current.

**One line means every line terminator**, not the two ASCII ones: `\n`, `\r`,
U+0085, U+2028, U+2029 and the vertical tab and form feed (U+000B, U+000C) are
all refused. Seven, and the width is the rule — a check written against `\n`
alone lets the other six through. One place answers the same seven by
rewriting instead: `log` flattens each to a single space as it writes the
line, since that value is captured command output rather than something
anyone typed. Whatever writes a terminator still cannot get one past
`validate`. So is a value made only of characters that
render as nothing, which `trim()` reads as non-blank and a reader sees as an
empty row under a heading saying the environment was read.

Which fields carry the line rule is stated per field in the tables, not assumed
from the type. In this report it is `namespace`, `repo.url`, a finding's `id`,
`title`, `signal` and `location.path`, a citation's `source` and `note`,
`provenance.tool_version`, a candidate's `signal`, `path`, `read` and
`result`, and on the surface each `not_read` entry, a capability's
`capability`, a call site's `path`, and a config edge's `read` and `result` —
five of its six string leaves, the sixth being `config.read_at`, which is held to
the stricter ISO-8601 rule instead. In an access log it is `value` and `note`. In an activity entry it is
`namespace` and, so far, nothing else. In a suppression it is `path`, `id` and
`repo`, held to it for a reason of their own, given with the suppression table
below. `id`, `repo` and `commit_sha` carry it everywhere they appear — a report's
`repo.name` and `repo.commit_sha`, an access log's `repo` and `commit_sha` — for
the same reason: they are the values a record is filed and found under, and one
rule covers all of them.

**A renderer that flattens is not a rule that holds.** Measured 2026-08-10 by
appending `\n## Forged heading` to every string leaf of a report and counting the
`## ` lines in the exported page. `namespace`, `tool_version` and every candidate
field go through `oneLine` and come out flat. A finding's `id`, `title` and
`location.path`, a citation's `source` and `note`, and `repo.url` are
interpolated raw, and each took the page from four headings to five — a heading
of its own, in a document whose whole authority is that the report passed.
`pr-plan` interpolates `location.path` raw too, so that one reaches a git host,
where it is world-readable and outlives the branch, and hands the unflattened
string on as `PrPlan.path`. A citation's `source` is also one line per URL in the
`citation_urls` manifest, where a second line is simply a second URL.

**Appending, not replacing, is what makes that measurement mean anything.**
Replacing a value destroys whatever shape the field already carries — a
citation's `https://`, a timestamp's ISO-8601, a hash's hex — so the value is
refused by *that* rule and the line rule is never reached, while the survey
records a refusal and moves on. `citations[].source` was missed exactly this way:
replaced, it reads as guarded; appended to a real URL, it forges.

So this rule is the second line of defence on some fields and the only one on
others, and no field is exempt because the renderer it happens to reach today is
careful — this report is the artifact that leaves the studio, and the session
rendering it elsewhere is not this one.

**The report and each finding are closed objects.** A key the tables above do not
name is a validation failure, and `validate` reports them all at once. Two
reasons. The first is that the finding object is the wrong place to record a
drop: a refuted candidate ships no finding, so a `disposition` field there could
only describe the candidates that survived — the confirmed set and half of
nothing else. That is why the instruction *do not add a disposition field to a
finding* has always been in the contract, and why `validate` now enforces it
rather than relying on a run reading the line. The record that does hold a drop
is `cross_reference`, one level up, where the refuted set is recorded whole
(§ Cross-reference inventory, ADR-0005). The other reason is spelling:
`supressed: true` is silently a live finding, and a mistyped optional field would
otherwise vanish without the report losing validity.

`started_at` is the other end of the same run, and it exists because the artifact
could not previously answer how long a scan took. Every other instant on the
report is written at Stage 6 — `scanned_at`, the access-log flush, the store's
`updated_at` — so § Scoring's wall-clock criterion came out *unrecoverable* from
two intact config-aware reports, which is a measurement the gate needs and the
file simply did not hold. Stamp it at Stage 1, from `date -u`, before anything
else runs. It is deliberately a second instant rather than a duration: a duration
is arithmetic, and the chokepoint rule says timestamps are read and never
composed — so the reader subtracts, and `validate` refuses a pair in the wrong
order, which is the only way that ordering can happen when both came from the
clock. The export renders the pair and the span on a **Wall-clock** row.

`started_at` and `scanned_at` accept **only** ISO-8601 UTC with a literal `Z` —
`YYYY-MM-DDTHH:MM:SSZ`, optionally 1–6 fractional-second digits. A `+00:00`
offset, a lowercase `z`, or a bare date is rejected: a stamp is ordered against
other stamps, so one that cannot be compared is worse than none. Take it from
`date -u +%Y-%m-%dT%H:%M:%SZ` and never compose it. The parse check rejects
month 13 and hour 25, but a real calendar overflow (`2026-02-30`) still parses,
rolling forward to 2026-03-02 — use the command and this does not arise.

`export` renders **both** provenance rows on every report, whatever the report
contains. Absent `provenance` renders `Derived: not recorded` rather than a page
that looks freshly derived, and the commit comparison still runs, because
`repo.commit_sha` is required and the pre-provenance reports are exactly the
ones most likely to be exported long after the tree moved. A third row,
**Wall-clock**, appears wherever `provenance` is recorded — the two instants and
the span between them, or `not recorded` on a report that predates `started_at`.
It is silent when `provenance` is absent entirely, because `Derived` has already
said so and a second row saying it again trains the reader to skip the block.

## Finding object

| Field | Type | Rule |
|---|---|---|
| `id` | string | Non-empty, one line, and not made **only** of whitespace and characters that render as nothing. The `report_tool.ts fingerprint` value (line-independent; keys suppressions). This is what a candidate's `finding_id` joins to. |
| `detector_id` | enum | `incomplete-integrations` \| `deprecated-apis` \| `auth-token-safety` \| `error-resilience`. |
| `severity` | enum | `info` \| `low` \| `medium` \| `high` \| `critical`. |
| `confidence` | enum | `low` \| `medium` \| `high`. |
| `title` | string | Non-empty, one line, and not made **only** of whitespace and characters that render as nothing. It is not only a page heading: `pr-plan` derives the PR title and the commit subject from it, which is the furthest any string in a report travels. |
| `location` | object | Optional `{ path, line? }`. `path` is repo-relative, one line, and, like a candidate's, not made **only** of whitespace and characters that render as nothing — it is also `pr-plan`'s output `path`, which `pr-guard` holds the diff's touched files to, so a value nobody can see is not a narrower guard but none. |
| `citations` | array | `{ source, note? }`; `source` matches `internal://` or `https?://`. `source` is one line — it is interpolated raw into the exported page, the PR body and the `citation_urls` manifest, where a line terminator opens a heading in the first two and a second URL in the third. `note`, when present, is one line and not made **only** of whitespace and characters that render as nothing: `pr-plan` writes it into the PR body, where a blank one publishes a dash and no reason behind it, and omitting the field says the same thing without the dash. |
| `suppressed` | bool | Optional; defaults false. |
| `snippet_hash` | string | Optional for reports written before it existed, expected on new ones. Full 64-char lowercase sha256 of the normalized snippet the `id` was built from. The snippet is not itself stored, so this is what lets a rescan prove two findings are the same rather than assert it — see the diff rule in `subskills/health-check.md` Stage 6. |
| `signal` | string | Optional, non-empty, one line. The playbook row this finding came from — the same vocabulary a `cross_reference` candidate carries. Write it whenever the finding came from a row with a name; leave it off for a discovered obligation that has none. It is optional for exactly that reason, and its absence is not free: a signal-keyed § Must NOT fire row is scoreable only when every live finding carries one. |

### Grounded-or-suppressed

The load-bearing rule: **a live finding (`suppressed` other than `true`) carries at
least one `https://` citation the reader can open — a public docs page, or a source
file at a pinned ref — and is suppressed when it has none.** An ungrounded claim
never reaches a report or the shared memory. Suppressed findings need no citation
(they assert nothing).

`validate` enforces something weaker. `isCitation` is a scheme-prefix test, so it
accepts `internal://`, `http://`, and `https://` alike: an `internal://`-only live
finding passes `validate` while failing the rule above. `score` closes the
cleartext half of that gap and only that half — criterion 3 gate-fails an
`http://` citation and keeps it off the manifest a resolver is handed — so
holding the rest of the line is this skill's job
([grounding-rules.md](../grounding-rules.md)). No scheme covers a file that ships
beside this skill, which is why an `ags` reference is something to reason from and
never a citation.

### Citation class

A citation is one of two things, and `validate` tells them apart:

- **pinned-source** — a code-host blob URL (`github.com`, `gitlab.com`,
  `bitbucket.org`) at an **immutable ref**, carrying a **`#L<line>` anchor**:
  `…/blob/17.16.1/Runtime/Api/UserProfiles.cs#L290`. It shows the construct.
- **docs** — everything else. It states a rule.

A code-host file URL that is neither is **refused**, not quietly reclassified: it
looks like source-level proof and cannot deliver it. Three ways to get there, all
real:

- **No anchor.** `…/blob/17.16.1/Runtime/Api/UserProfiles.cs` says the construct is
  somewhere in a 600-line file. The finding claims a specific method on a
  specific line, and the reader has no way to check the part that matters.
- **A moving ref.** `…/blob/main/Runtime/Api/UserProfiles.cs#L290` cites whatever `main`
  says on the day it is opened. The URL keeps resolving while the line drifts out
  from under it — a broken link at least announces itself. Pin a tag or a sha.
- **The raw file.** `…/raw/17.16.1/Runtime/Api/UserProfiles.cs#L290` and
  `raw.githubusercontent.com/…` are the same file served as plain text, so there
  is nothing for `#L290` to scroll to — the reader is handed the whole file and
  told the finding is in there somewhere, which is what the anchor rule exists to
  refuse. Pinning it does not rescue it; cite the blob view of the same file.

### Confidence comes from the playbook

`confidence` belongs to the detector playbook, and the run **copies** it (see each
file in [`../detectors/`](../detectors/)) — from the matching row, or, where a
detector discovers signals its table does not enumerate, from the default that
playbook states for a signal with no row. Both are constants on the page; neither
is derived from the repo. It measures how sure the
detector is that **the code exhibits the issue** — signal strength, not citation
quality. The two do not track each other in either direction:
`confidential-secret-in-client` is `critical/high` off a static read, because a
secret literal in a client build is visible and unambiguous, and it cites a docs
page because that is where the *rule* lives; a pinned-source citation can equally
back a weak signal. Ranking confidence by the URL is the conflation
[grounding-rules.md](../grounding-rules.md) forbids — *a thin citation is a
grounding problem, not a confidence one* — and a well-grounded finding whose
settling check did not run is honestly `low`.

So `validate` checks the one case with no judgement in it:

| Finding | Rule | Why |
|---|---|---|
| `suppressed: true` | must be `low` | It asserts nothing, so it has no confidence to report. A suppressed row at `medium` reads as a live finding someone forgot to ship. |

The drift this does **not** catch: three scans of one commit rated the same
detector row `high`, `medium`, `high`, with nothing in the code moved. The
playbook is not in the artifact, so the tool has nothing to compare against.
That one is held by the copy-from-the-playbook rule in each detector file, and by
Stage 4.

So passing validation is not evidence the number was copied. Only copying it is.

## Cross-reference inventory

Every candidate Stage 3 *attempted* a live read on, and what came of each.
Attempted, not settled — the row for a read that did not settle its candidate
is exactly what `not-readable` is for, whether the read failed or landed on
another question, and ADR-0006 rules the wording that way. Present on a
`config-aware` report and on no other, from `schema_version` 4.

This is the only part of the artifact that records a **removal**. A refuted
candidate is dropped, so it ships no finding and nothing else in the report
describes it — before this field, the run's most consequential act was its least
traced one, and the two config-aware pilot runs whose reports survive could be
scored on their findings and not at all on the mode (ADR-0005). The counts still
go to the spoken summary's `Cross-ref:` line, where a developer is looking when
the run ends; this is the same accounting in the place a reader looks later.

| Field | Type | Rule |
|---|---|---|
| `candidates` | array | Closed. Zero or more of the objects below. **Empty is a real answer**: the read ran and raised nothing to settle. It is an answer and not a pass — but which answer depends on what the key asked. A key whose live half asks only *of* the candidates (`must_not_appear`, `banned_dispositions`, `closed_world`) compares nothing against an empty inventory and comes back `unscoreable` on criteria 6 and 7 rather than green. A `must_appear` row is a comparison in its own right — it says the run must have *attempted* a read on that signal — so an empty inventory **fails** it rather than opening it. |

Each candidate is a closed object:

| Field | Type | Rule |
|---|---|---|
| `detector_id` | enum | The same four ids a finding carries. |
| `signal` | string | Non-empty, one line, and not made **only** of whitespace and characters that render as nothing. The playbook row — or the signal this run discovered — the candidate came from. The detector id alone names four rows or forty, so this is what makes a drop legible to someone who was not in the session. It is the one field both exporters print unconditionally, so it is the one with no gate downstream: a value of a single space reaches the page as an empty pair of backticks and the row names nothing at all. |
| `disposition` | enum | `confirmed` \| `refuted` \| `not-readable`. Three, and only three (`subskills/health-check.md` Stage 3). |
| `path` | string | Optional. Repo-relative — no leading `./`, forward slashes, no `..` — one line, and held to the same renders-as-nothing rule as `signal`. All three rules are a finding's `location.path` rules too. |
| `read` | string | The operation run against the namespace. One line. **Required on `confirmed` and `refuted`**, and, from `schema_version` 5, **required on `not-readable` unless `unreadable_reason` is `no-operation`**. |
| `result` | string | What it settled — `setBy: CLIENT`. One line, at most 200 characters, redacted. **Required on `confirmed` and `refuted`**, and optional on `not-readable` at every generation. |
| `unreadable_reason` | enum | `no-operation` \| `errored` \| `unauthorized` \| `answers-another-question` — which of the four ways it was not readable. **Required on `not-readable` from `schema_version` 5, and refused on `confirmed` and `refuted` at every generation.** |
| `finding_id` | string | Optional. The `id` of the finding this candidate became. **Refused on `refuted`**, and when present it must name a finding in this report. |

`read` and `result` are required on the two dispositions that settle something
because a verdict with no evidence recorded behind it says no more than the
silence it replaced. `not-readable` is exempt from `result`, and deliberately: it
is the disposition for a read that *did not settle this candidate*, so demanding
a result there would make a run invent one. Silence from a namespace is not a statement
about it.

Both exporters **omit** an optional candidate field made only of characters
that render as nothing, rather than printing its label with nothing after it. That covers exactly four — `path`, `read`, `result` and
`unreadable_reason` — and it matters because such a value is *truthy*: gated on
presence alone it rendered `- Read:` naming no read, and an empty pair of
backticks where the file name belongs. `validate` refuses all four as well, so
no stored report carries one; what the omission protects is a caller reaching
the exported renderers directly, which is a real path — and `path` reached a
rendered page *through* `validate` until it gained the same check.
`signal` is not in that list and is not gated: it is required, so
there is no absent form of it, and dropping it would leave a row naming no
playbook row at all — its content rule is the validator's alone.

**What renders as nothing** is Unicode's designation, not a font's: whitespace
plus the control (`Cc`), format (`Cf`) and default-ignorable categories. Naming
it that way is what makes it checkable instead of a matter of opinion, and what
reaches the characters a hand-written list misses — U+00AD, U+034F, U+061C,
U+115F, U+17B4, U+180E, U+200E, U+2062, U+3164 and U+FFA0 are all refused, and
two of them are combining marks rather than format characters, so no list of
zero-width codepoints would have covered them.

It is still not a claim about what a reader can see, and the gap has a name:
U+2800 BRAILLE PATTERN BLANK renders as blank and belongs to none of the three
categories, so it passes. Read every "renders as nothing" rule on this page as
that class.

The rule is about the **whole** value. One of those characters sitting among
visible ones is left alone — a soft hyphen inside a real path is a typo for its
author to fix, not a value this tool may refuse.

It is **not** exempt from saying it looked. A `not-readable` row exists to
separate *tried and failed* from *never looked*, and a row carrying nothing but
the disposition records neither — a live run wrote exactly that for
`confidential-secret-in-client` while its own access log held the
`GET /iam/v3/admin/namespaces/{namespace}/clients/{clientId}` behind it
(ADR-0006). So from `schema_version` 5 the row says **why**, from the four ways
there are:

* `no-operation` — no operation exposes the thing.
* `errored` — the read was made and errored.
* `unauthorized` — the read was made and the token lacked the permission.
* `answers-another-question` — the read was made and **landed**, and what came
  back settles a different proposition than the finding asserts. The IAM client
  beside the secret is Public; the leaderboard's stat code exists. Neither
  refutes the finding, and each detector's channel-B table says which is which
  (`subskills/health-check.md` Stage 3, the **Refuted** bullet).

The first three are `health-check.md`'s own trichotomy, written into the
artifact. The fourth is the case that prose left out and its worked example
describes anyway — `confidential-secret-in-client` is not readable *"even though
the read succeeded"*. Recording that one as `no-operation` would state something
false: an operation exists, and the run called it.

`read` comes with three of the four. `errored`, `unauthorized` and
`answers-another-question` all describe a read that was **made**, so each names
the operation it made. `no-operation` is the sole exemption, because it is the
only one where there is genuinely nothing to name, and asking for a `read` there
would have a run compose an endpoint it never called.

`result` is worth recording on an `answers-another-question` row — the read
landed, and what it returned is a fact — but it stays **optional** there like
everywhere else on this disposition. A required `result` is a `result` a run with
nothing to report will invent, and that is the failure the exemption exists to
avoid.

`unreadable_reason` is refused on `confirmed` and `refuted` for the mirror
reason: those settled the candidate on a read that landed *on the finding's own
proposition*, so there is no unreadability to explain. That refusal is **not**
version-gated. The generations exist so a stored report is not invalidated by a
bump, and no stored report can carry a field that did not exist until generation
5 — so refusing the shape everywhere costs nothing and closes a hole that gating
it would open at 4.

`result` is bounded and redacted because this report is written into a shared
studio scope and pasted into tickets. It records what a read settled, not the
body it settled from; a read of an IAM client returns more than the run needs,
and a field with no bound is where that arrives.

`finding_id` is refused on a refuted candidate because the candidate was dropped
— an id there points at a row this report did not ship. Where it is present,
`validate` checks it against the report's own findings, so a confirmed candidate
either names the row it became or names nothing at all.

**This is not a `disposition` field on a finding**, and adding one stays refused.
That shape can only describe candidates that became findings, which is the whole
set except the ones this record exists for.

```json
"cross_reference": {
  "candidates": [
    {
      "detector_id": "auth-token-safety",
      "signal": "client-authoritative-stats",
      "path": "Assets/Scripts/AGSStats.cs",
      "read": "GET /social/v1/admin/namespaces/{namespace}/stats/total-wins",
      "result": "setBy: CLIENT",
      "disposition": "confirmed",
      "finding_id": "f6dc0ed55d2bf50d"
    },
    {
      "detector_id": "incomplete-integrations",
      "signal": "achievements-no-rewards",
      "read": "GET /achievement/v1/admin/namespaces/{namespace}/achievements",
      "result": "reward attached to the unlock",
      "disposition": "refuted"
    },
    {
      "detector_id": "auth-token-safety",
      "signal": "confidential-secret-in-client",
      "path": "Assets/Resources/AccelByteSDKOAuthConfig.json",
      "read": "GET /iam/v3/admin/namespaces/{namespace}/clients/{clientId}",
      "result": "clientType: Public",
      "disposition": "not-readable",
      "unreadable_reason": "answers-another-question"
    }
  ]
}
```

The second row is the one this section exists for: it is the whole record of a
finding the developer never saw, and it says what was read to justify removing it.

The third is the one generation 5 changed. It used to carry the path and the
disposition and nothing else, which said the run had not read the client without
saying whether it had tried. It now names the call it made and why the call did
not answer — the difference between an attempt and an absence. Its reason is
`answers-another-question` and not `no-operation`, because the operation exists
and the run ran it: a Public client kind is a real answer to a different
question, and a secret literal in a client build is extractable either way. The
`result` is optional here and carried anyway, which is the shape to copy — the
read landed, so there is something true to record without inventing it.

## Integration surface

Which AGS capabilities this commit calls, and at what `file:line`. Stage 2
derives this on every run to feed Stages 3 and 4; until `schema_version` 6 it was
described in that stage as an *in-memory* inventory and thrown away at the end of
the run. The MVP requirements baseline has asked for a *Services in use* section,
with a clickable location per service, for as long as the field did not exist.
`subskills/upgrade-check.md` Stage 2 is the second reader: it looks for a stored
report at the commit it is on and takes this field as its call-site map rather
than deriving one, and derives its own the moment the commit does not match.

**It is an index into one commit, not a description of the project.** Both
exporters say so on the section's first line — and on a **dirty** scan that line
says the other true thing instead, that the read was of uncommitted edits and not
of the sha in the header. The same three answers the Worktree provenance row
gives, for the same reason: a flat *what this commit calls* under a row saying
the findings do not come from that commit is the inverse of what ADR-0024
refuses. A rendered report is pasted into a
ticket and read weeks later, and a list of services reads like an architecture
document more than any other part of this page — so the claim it makes is bounded
to the commit in the header, and reading it is never a substitute for reading the
repository (ADR-0024).

| Field | Type | Rule |
|---|---|---|
| `capabilities` | array | Closed. Zero or more of the objects below. **Empty is a real answer**: the SDK is present and the scan matched no call — which is a finding about the project, not a failed stage. |
| `not_read` | array | Optional *to `validate`*, and not optional to a run that could not read a call surface — the Report carries no engine field, so this is a rule only the scan can keep (`subskills/health-check.md` Stage 2 makes it mandatory on Unreal). Each entry one line, non-empty, and not made **only** of whitespace and characters that render as nothing — one call surface this scan did not read. Rendered **ahead of** the list, because it bounds what the list is a list of. |

Each capability is a closed object:

| Field | Type | Rule |
|---|---|---|
| `capability` | string | Non-empty, one line, and not made **only** of whitespace and characters that render as nothing. The AGS capability called — `statistics`, `matchmaking`, `lobby`. It is the heading the entry hangs off, printed unconditionally by both exporters, so it has no gate downstream. **Unique across `capabilities`**: two entries for one capability render as two sections with the same heading, and a consumer folding the index by capability counts it twice. |
| `call_sites` | array | Closed. **At least one**, and no `path:line` repeated: the count beside the capability is the one derived number this section prints, and a repeat inflates it over a location a reader opens once. Unlike `capabilities`, empty here is not an answer — the entry exists to say *where*, so one with nowhere in it is the assertion this object replaced. |
| `config` | object | Optional `{ read, result, read_at }` — what the namespace answered about this capability. **Refused unless `mode` is `config-aware`**, the same both-directions pairing `namespace` carries: a code-only run read no namespace, so an edge on one was composed. |

Each call site is a closed object:

| Field | Type | Rule |
|---|---|---|
| `path` | string | Repo-relative — no leading `./`, forward slashes, no `..` — one line, and held to the same renders-as-nothing rule. A finding's `location.path` rules, exactly. |
| `line` | number | A 1-based safe integer — `1e21` passes a looser check and renders `a.cs:1e+21`. **Required**, unlike a finding's optional `location.line`: the requirements baseline asks for a clickable location per service, and a path with no line is not one. `Grep` produces the number, so a missing one means the entry was composed rather than read. |

And so is a config edge:

| Field | Type | Rule |
|---|---|---|
| `read` | string | **Required.** The operation run against the namespace. Non-empty, one line, and not made **only** of whitespace and characters that render as nothing. |
| `result` | string | **Required.** What it answered — `setBy: CLIENT`. Non-empty, one line, renders-as-something, at most 200 characters, redacted. Same bound and same reason as a candidate's `result`. |
| `read_at` | string | **Required.** ISO-8601 UTC, the instant the read was made, and refused if it is after `provenance.scanned_at` — the same ordering `provenance.started_at` is held to. The read happened during the scan, so an instant past its end was composed, and this field is the only thing keeping the edge from reading as current. |

**The config edge is the perishable half, and it is dated for that reason.** A
studio edits AGS configuration in the Admin Portal without touching a commit, so
this is the one part of the index that can be wrong while the SHA is unchanged.
`read_at` is what keeps it from being read as current, and both exporters render
it in the past tense with the instant beside it — *Namespace said `setBy: CLIENT`
when read at …* — never as a statement of what the namespace holds now. The
`read`/`result` pair is deliberately the same shape a `cross_reference` candidate
carries (ADR-0006) rather than a parallel one: a second spelling would be a
second thing to keep true.

**Nothing here is gated on whether it renders as something**, unlike the
cross-reference rows. Every field these exporters print is required, so there is
no absent rendering to fall back to and a blank one would leave a bullet naming
nothing rather than a bullet left out. The whitespace checks live in `validate`,
which is where a required field's belong — the same split `signal` follows.

```json
"surface": {
  "not_read": ["Blueprint graphs — .uasset and .umap are binary, and this scan is a text read"],
  "capabilities": [
    {
      "capability": "statistics",
      "call_sites": [
        { "path": "Assets/Scripts/AGSStats.cs", "line": 42 },
        { "path": "Assets/Scripts/AGSStats.cs", "line": 118 }
      ],
      "config": {
        "read": "GET /social/v1/admin/namespaces/{namespace}/stats/total-wins",
        "result": "setBy: CLIENT",
        "read_at": "2026-08-12T04:12:24Z"
      }
    },
    {
      "capability": "lobby",
      "call_sites": [{ "path": "Assets/Scripts/AGSLobby.cs", "line": 88 }]
    }
  ]
}
```

`not_read` is the half a reader cannot infer, and the Unreal case is why it
exists: a text scan reaches C++ call sites and not Blueprint graphs, which live
in binary `.uasset` and `.umap` files. On a project whose gameplay was built by
designers, this section can omit most of the calls and look complete doing it.
Naming what was not read is the difference between a short list and a short list
that says so. The second entry above carries no `config` — this report is
config-aware and the run read nothing about `lobby`, which is the honest shape:
an edge is written when a read was made, never to fill the column.

## Suppression record (`--kind suppression`)

A human's standing dismissal of a finding. Durable, not commit-pinned; keyed and
motivated in [memory-contract.md](../memory-contract.md) § Suppression records.
Validated with `report_tool.ts validate --kind suppression` — on write, and again
on read before a stored record is matched against a candidate. A suppression is
the one kind that silences output, so an unchecked one is the only record that
can hide a finding rather than merely be wrong.

| Field | Type | Rule |
|---|---|---|
| `schema_version` | string\|number | Non-empty / present. |
| `id` | string | Non-empty, one line, and free of the key's own separators — it is the last segment of `<repo-name>@<detector-id>:<id>`. The `fingerprint` the dismissal was granted against. |
| `repo` | string | Non-empty, one line, free of the key's own separators, and matching the key's first segment. Required: `wiki_memory_list` has no repo filter, so this is what the load path narrows on. |
| `detector_id` | enum | Same four ids as a finding. |
| `path` | string | Repo-relative, no leading `./`, forward slashes, no `..`, one line, and not a value that renders as nothing — a finding's `location.path` rules, exactly. The same string passed to `fingerprint --path`. |
| `snippet_hash` | string | **Required.** Full 64-char lowercase sha256. Optional on a finding, required here — see below. |
| `reason` | string | Non-empty. Why the human dismissed it, in their words. |
| `actor` | object | `{ id, display }`, both non-empty. **Server-stamped on a write the memory service accepts.** |
| `actor_source` | enum | `iam` \| `git-config` — the **human** subset, and `iam-client` is refused here alone. A suppression records that somebody decided a finding did not matter; a service deciding that is how a scanner gets quietly switched off by the pipeline it runs in. A machine may run a scan and file its report, and may not dismiss a finding. |
| `ts` | string | ISO-8601. Server-stamped on a write the memory service accepts; with no memory service to stamp it, read from `date -u`, never composed. |

`path` obeys one spelling because it is **compared, not just displayed**:
`Assets/X.cs` one run and `./Assets/X.cs` the next is a recovery match that
silently fails and a dismissal that silently returns. The same string is a
`fingerprint --path` input, so a second spelling is also a second id for one
finding. `location.path` on a finding is held to the same rule.

**One line is part of that spelling, not a rendering concern.** Most other
single-line rules in this schema are there because a terminator forges
structure in something that renders or parses the value — a heading in the
exported page, a second URL in the `citation_urls` manifest. A `path` is
refused a terminator for a further reason that applies even where nothing reads
it: the memory service flattens *every* string in a suppression before it writes
it — the rule there is structural, not a list of prose fields — so a terminator
here would be replaced by a space and the stored `path` would no longer be the
one the next scan derives. The match would miss and the dismissal would return
— the same failure `./Assets/X.cs` causes, by another route. The rule is
enforced in `requireRepoPath`, so it reaches a suppression's `path`, a
finding's `location.path`, a `cross_reference` candidate's `path` and a surface
call site's `path` alike.

**A value with nothing visible in it is refused before the spelling is
checked.** `requireRepoPath` asks only about *shape*, so a single space and a
lone U+200B were both repo-relative, slash-free, `..`-free and one line, and
passed. Nobody reading the store can tell which file such a record was granted
for — and it is not harmless for being unreadable. A candidate's path comes
from a real file, so it is never invisible-only, which closes the match branch
that compares `detector_id` and `path`; but the ordinary branch compares
`snippet_hash` and `id` and never reads `path`
([suppression-matching.md](../suppression-matching.md) § Match), so a record
like this still suppresses whenever its `id` was written rather than derived
from its own `path`. Refusing it means such a record is reported as invalid
instead of dismissing a finding on the strength of a path nobody can read. The
content refusal replaces the shape
checks rather than joining them — the same three-step the other three `path`
fields already used, and the one this field was left out of. A `path` that is
*only* a line terminator therefore reports the content refusal, not the line
one, because the content check runs first.

A neighbouring argument reaches `id` and `repo`. They are not part of the match
— they are two of the three segments of the key the record is filed under,
`<repo-name>@<detector-id>:<id>` — and there the existing rule was a character
short. They are refused the key's own separators, and that class leans on `\s`,
which does not match U+0085 NEXT LINE. So that one spelling passed, was
flattened into a space, and a space *is* a separator: the stored record no
longer satisfies the rule it was checked against, and the next run to load it
refuses it over a character nobody typed. Refusing at the write is the same
outcome moved to where it can be explained. Both carry the line rule now, and so
do `commit_sha` and a report's `repo.name`, which go through the same check.

`snippet_hash` is optional on a finding and required here because the failure
modes differ: a finding without one is harder to diff, while a suppression
without one cannot be matched at all once its `id` stops re-deriving — leaving
the run to either re-litigate a decision a human already made or assert a match
it cannot compute.

## Activity entry (`--kind activity`)

The cross-persona colleague feed. What a nudge in a dev-persona session quotes ("Dave found
increasing errors in stats 1 day ago"). Validated with
`report_tool.ts validate --kind activity`.

| Field | Type | Rule |
|---|---|---|
| `schema_version` | string\|number | Non-empty / present. |
| `actor` | object | `{ id, display }`, both non-empty. **Server-stamped on an append the memory service accepts.** |
| `actor_source` | enum | `iam` (a verified person) \| `iam-client` (a verified service) \| `git-config` (unverified — self-asserted). Only `iam` is ever quoted to a colleague — see [memory-contract.md](../memory-contract.md) § `exclude_self` and `nudge_read`. |
| `persona` | enum | `dev` \| `liveops`. |
| `subskill` | string | The subskill that ran (e.g. `health-check`, `observe`). |
| `action` | string | Documented, non-exhaustive vocabulary (see [memory-contract.md](../memory-contract.md)). Checked for that vocabulary's *shape* — lowercase, digits, single dashes — not against a list of its members, so a new verb needs no validator change. Must equal the access-log envelope's `run`. |
| `namespace` | string | Structured — enables entitlement-aware nudge filtering. Required, so a run that read no namespace still has to fill it: the pinned value is `unknown`, and a nudge read must never match it against a real namespace. A code-only scan is the ordinary case for that. Non-empty, one line, and not made **only** of whitespace and characters that render as nothing — the same line-terminator set the report is held to: a value like that renders as an entry claiming an environment nobody read, and this feed is shared across a studio, so a value carrying a line break can forge structure in whatever renders it. |
| `target` | string | Redacted before it reaches here. |
| `summary` | string | Redacted before it reaches here. |
| `severity` | enum | Optional: `info` \| `warn` \| `critical`. |
| `ts` | string | ISO-8601. **Server-stamped on an append the memory service accepts** — never invented by the model. With no memory service to stamp it, take it from `date -u +%Y-%m-%dT%H:%M:%SZ` and set `actor_source: git-config`; read, never compose. |

`scope` is intentionally **not** an entry field — it is a `wiki_memory_*`
argument the server derives from the caller's identity, never client-asserted
(see [memory-contract.md](../memory-contract.md)). `validate` checks the
server-stamped fields are present and well-formed; it does not (and cannot)
prove they were server-issued — that guarantee lives in the Wiki MCP write path.
Its job here is to reject entries assembled off-contract before they are
appended.

## Access-log entry (`kind: access-log`)

`report_tool.ts log` writes one JSON line per access into `$RUNDIR`. The run
flushes the whole thing as **one** `wiki_memory_append` entry when it records
itself — after Stage 7, never before, because `run` names an outcome Stage 7 is
still deciding (health-check.md § *Recording the run*). A run that stops before
its detectors ran does not flush at all: it has no scan to claim, and the trail
stays in `$RUNDIR`. The envelope is fixed —
it is the customer-visible audit trail, so a studio has to be able to parse every
run the same way:

| Field | Type | Rule |
|---|---|---|
| `repo` | string | Repository name, one line, free of the key's own separators, matching the report key's first segment. |
| `commit_sha` | string | The pinned SHA. One line, free of the key's own separators. |
| `mode` | string | The run's mode — `code-only` or `config-aware`, the same value the Report carries. |
| `run` | string | What the run did — the same value as the `activity` entry's `action`, in that vocabulary's shape: lowercase, digits, single dashes. |
| `entries` | array | The access lines in order, each `{ kind, value, note? }` exactly as `log` wrote them. |
| `ts` | string | ISO-8601 UTC, when the flush happened. |

Closed, like a finding: a field the table does not name is refused rather than
carried, because a trail is read by tooling that has only these paths to read it
by. That closedness describes the envelope **as it is assembled, before the
append** — `scope` is a `wiki_memory_*` argument the server derives from the
caller's identity, so an envelope read back out of memory carries one and is
refused here. Validate what you are about to write, not what the store handed
back.

```bash
npx tsx "$TOOL" validate --kind access-log "$RUNDIR/access-log.json"
```

**`run` is an action, not a description and not a path.** It is held to the shape
of the `action` vocabulary rather than to a list of its members, which stays open
by design ([memory-contract.md](../memory-contract.md)). The shape is what
separates `opened-pr` from a run directory's name — the first live run to flush
an envelope wrote `teammate-run.3AIePY` into this field, and nothing rejected it,
because no `--kind` covered this document at the time.

**The array is `entries`.** Do not rename it per run — an audit trail nobody can
parse by a fixed path is not an audit trail. A reuse run flushes too: reading a
stored report is itself an access, logged as
`{ kind: "read", value: "memory:report/<key>", note: "stage1b hit; …" }`.

## Commands

`report_tool.ts` is the single gate every model-composed artifact passes before
it is exported, written to memory, or pushed to a git host. Run each via
`npx tsx .../scripts/report_tool.ts <command> [args]`.

**A flag that takes a value requires one.** A flag reaching the command line
without its value — `--at-commit "$COMMIT"` on an unset variable, left alone at
the end of the line or sitting in front of the next flag — is a usage error
(`2`), never read as a flag nobody wrote. Optional means the caller may omit it;
it never means the value may go missing on the way. Losing one used to render a
report `freshness unverified`, ship a PR body with no `STALE` line, derive a
finding id from an empty snippet, and write zero bytes out of the redaction
chokepoint — each at exit `0`.

| Command | Purpose |
|---|---|
| `validate [--kind report\|activity\|suppression\|access-log] <file.json>` | Schema-check + grounded-or-suppressed. Fails (`1`) on any problem. |
| `memory-doc [--allow-dirty] [--key <key>] <report.json>` | Emit the exact `wiki_memory_put` payload — `{ kind, key, doc }` — built from the file it just validated. The key comes from the document, so there is no `--repo-name` to disagree with it. Refuses (`1`) an invalid report, one with no `repo.name`, one that does not state `repo.tree_state`, and a `repo.tree_state` of `dirty` unless `--allow-dirty` says a human agreed to store it this run. **The `doc` is never composed by hand**: a stored report once carried `detectors_run` and `prior_report_diff` — fields the schema does not define and `validate` refuses — because the object that was checked and the object that was persisted were built twice. `--key` files the payload under the key the hosted store named: that store composes a dirty report's key from the principal it stamped from the verified token, so it refuses the first write of every dirty report and quotes the key it computed — re-run with `--key <that key>` rather than hand-editing the emitted JSON, which is the step this command exists to remove. It is not a passthrough: it is accepted only on a dirty report, only when the `<repo-name>@<commit_sha>` base and the trailing `:<mode>` are the document's own, and only when the part between them is `+u` and exactly 12 lowercase hex characters. |
| `memory-lookup --repo-name <n> --mode <m> [--actor <id>] [--tree-hash <h>] --commits <rev-list.txt> <envelopes.json>` | Rank the stored reports that could stand in for this scan, from a `wiki_memory_list({ kind: "report" })` result. Emits `{ candidates, rejected, unplaceable, read_complete }`: at most one of `exact`, `own-dirty-here`, `clean-ancestor`, `own-dirty-ancestor`, each with its distance from HEAD and the reason it matched, plus every stored report it cannot honestly offer — one that no longer validates, or one that never stated its `tree_state` and so cannot be placed in any rank — and a count of those naming no repo (pre-generation-3, unplaceable). Both are scoped to this run's own history, by two filter sets that are not the same one. A record is *counted* in `unplaceable` once this run's mode, this repo's rev-list and — for uncommitted work — this person have kept it. A record is *reported* in `rejected` only after one filter more: `repo.name` matching this repo. The list result covers every namespace this identity may read, and `rejected` prints a key, so a fault reported before that match names another team's repo and commit to this user. `read_complete` echoes the page's own `over.complete` — `null` when the input made no claim, never `true` — and a `false` there makes both `rejected` and `unplaceable` floors rather than counts, warned on stderr. Do not narrow this read with `key_prefix`: it drops exactly the nameless records `unplaceable` counts. `unplaceable` never takes that match, because its whole population is the records naming no repo — which is why it is a count and not a list. Another person's dirty report is never a candidate. Exits `2` on a list result it cannot read — an entry that is not an envelope, or an envelope with no `doc` — because a flattened result silently matches nothing and prints exactly like an empty store. |
| `fingerprint --detector <id> --path <repo-path> [--snippet-file <f>] [--json]` | Line-independent finding id — `hash(detector_id ∥ path ∥ normalized snippet)`. Snippet on stdin when `--snippet-file` is omitted. Survives reindent / blank-line / whitespace churn, so it keys suppressions across code drift. `--json` emits `{ id, snippet_hash }`; take both when minting a finding, since only the hash survives to make the id checkable on a later run. Bare output stays the id alone. |
| `redact [--in <file>]` | Strip secrets (private keys, JWTs, AWS ids, bearer tokens, named `secret=`/`token=` assignments) from stdin or a file. Run on a finding snippet before persist/export, and on an activity `summary`/`target` before append. |
| `export [--format md\|html] [--out <file>] [--at-commit <sha>] <report.json>` | Render a report to Markdown (canonical) or a self-contained single-file HTML. **Validates first and refuses (`1`) an invalid report** — the chokepoint holds at the export boundary. `--at-commit` is the commit being looked at now: the render compares it to `repo.commit_sha` and marks the report `STALE` when they differ. Omitting it renders `freshness unverified` — an absent check never reads as a passed one. PDF = print-to-PDF from the HTML; no PDF library ships. |
| `pr-plan --finding <id> [--at-commit <sha>] <report.json>` | The one-fix PR's `{ branch, title, body, path }` (Stage 7). Validates the report first and refuses (`1`) an invalid one, then refuses the finding itself when it is **suppressed** — the report never asserted it, so a PR would ship a claim the run withheld — when it has no `location.path`, or when it carries no citation. `branch` is derived, never composed: `teammate/fix-<detector-id>-<finding-id>`, so two runs fixing one finding collide loudly instead of opening a duplicate, and the only interpolated value is a 16-char hex fingerprint. `title` and `body` are redacted, because a PR body is world-readable on a public repo and outlives the branch — further than an export ever travels. The body carries the citation, the pinned commit, the mode and the finding id, so a reviewer who did not run the scan can check it. |
| `pr-guard --expect <path> [--expect <path>…] [--expect-branch <name>] [--in <f>]` | Hold a worktree to what the fix declared: `git status --porcelain` on stdin, one `--expect` per declared path. Fails (`1`) on any undeclared change, on an empty tree (there is no fix to open), and on output it cannot parse — including a path git quoted, which it refuses to decode rather than match approximately. This is the mechanical form of *no writes outside the PR branch*, and `--expect-branch` is the branch half of that sentence: pipe `git status --porcelain -b` and the `## <branch>` header arrives in the same read as the paths, so the branch compared is git's answer and not the run's — there is no flag that takes the branch on the caller's word, because a run asserting its own compliance is the failure the whole stage is built around. It fails (`1`) when HEAD is on any other branch, when HEAD is detached, and when the output carries no header at all, since a check that could not be made is not a check that passed. Omit it and the branch is not read, which is what the path-only callers before it did — but omitting it is the only way to get there, and it took three refusals to make that sentence true. A `--expect-branch` whose value went missing is a usage error under the flag rule above; an empty one (`--expect-branch ""`) is refused here for the same reason; and a *misspelt* one (`--expect-branchh`) is refused as an unrecognized argument, because until it was, the flag simply vanished and this command printed the path-only green, exit `0`, on a worktree sitting on `master`. Reading any of the three as *no branch was expected* prints that green over the check the caller asked for. The failures it exists to stop: `git add -A` on a tree that already held unrelated edits, sweeping someone's unfinished work into a PR opened in their name — and skipping `git checkout -b`, which leaves the paths byte-identical while every edit lands on the developer's own branch. |
| `score --key <key.json> [--json] [--urls-out <file\|->] <report.json>` | Score an exported report against a scoring key: recall, precision, citations, wall-clock, severity drift, and — on a config-aware run — inventory completeness and disposition correctness. Refuses (`1`) a key whose shape it cannot read, then refuses (`1`) a report that does not pass `validate` — the key first, because that failure is the caller's and costs nothing to find. Text summary by default, the stable scorecard JSON under `--json`. It scores what is mechanically checkable and **declines a verdict on the rest**, naming each decline with its reason: whether a cited page states the claim comes back as `needs_human`, never as a pass; a criterion whose input the artifact does not carry comes back as `unscoreable`. **No network I/O** — the flat `citation_urls` manifest exists so a separate resolver can check for 404s. `--urls-out` writes that manifest as plain lines for one, so the hand-off needs no JSON processor: one line per URL, and `<url><TAB><quote>` wherever a key row required a verbatim quote (§ The scoring key). `-` writes it to stdout and moves the scorecard to **stderr**, so the manifest can be piped straight into a resolver — moved, never dropped, because a gate whose result went into a pipe is a gate nobody read. Exits `0` pass · `1` fail · `4` incomplete. See § The scorecard. |
| `log --file <f> --kind read\|endpoint\|git --value <v> [--note <n>]` | Append one JSON line to the access log (repo paths read, AGS endpoints called, git/gh invocations). Append-only — prior lines are never rewritten. `value` and `note` are single-line: a logged path or `gh` argument carrying a line terminator forges structure in whatever renders the trail. This command **flattens** rather than refuses — each terminator becomes one space, a CRLF pair becomes one space and not two — because `--value` is usually whatever a command printed, and a stray break in one captured argument should not fail the whole envelope at flush time. `validate --kind access-log` still refuses a terminator in an entry assembled some other way. Flushed to `wiki_memory_append` once, when the run records itself — after Stage 7, and not at all when the run stopped before its detectors ran. |

The chokepoint rule: fingerprints, actors, timestamps, and branch names are never
model-composed — they come from this tool (or, on an append the memory service
accepts, from its own write path).

Two behaviors worth knowing:

- `fingerprint` is deliberately line-independent, so two identical occurrences of
  the same call in one file share an id — **suppressing one suppresses both**.
- `redact` errs toward over-redaction: a non-secret identifier named like a
  secret (`password`, `token`) in an assignment may be masked. That is the safe
  direction for a control whose failure mode is a leaked secret.

### The scoring key

`score` reads a key file — the machine-readable half of a fixture's adjudication.
Top level: `key_version` (`1`), `name`, `source`, `applies_to_mode`, `must_fire`,
`must_not_fire`, `cross_reference`, `open_questions`. A `must_fire` row carries
`n`, `signal`, `detector_id`, `path`, `line`, `line_end`, `severity`,
`severity_conditional`, `confidence`, `confidence_conditional`,
`must_be_suppressed`, `citation_urls`, `citation_quotes`,
`banned_citation_urls`, `adjudication`, and `needs_ruling`. A key that asks
nothing — no `must_fire` row, no `must_not_fire` rule and no `cross_reference`
*question* — is refused, because every criterion would then answer off an empty
population and the card would come back green for checks that never ran. The
live half is read for what it asks, not for whether it is written down: a
`cross_reference` that requires no candidate, forbids none, bans no disposition
and declares no closed world asks nothing, whether it is absent, spelled `{}`,
or spelled as lists whose entries all render as nothing. A blank wearing a
length is still nothing asked.

**A `must_fire` row joins to a finding on the site tuple** —
`(detector_id, location.path, location.line)` — never on the row's `signal`,
because that row asserts a finding at a *place* and the site is what carries the
claim. `line: null` keys the file rather than a line; `line_end` keys a span.
`cross_reference.candidates` *does* carry `signal`, so
`cross_reference.must_appear` / `must_not_appear` join on that.

**A `kind: "signal"` `must_not_fire` row joins on the finding's own `signal`**,
which is what that row is asserting — a name that must not be reported anywhere,
which no site tuple can express while another row of the same detector must fire
nearby. A name that is *present* fails the row outright. An *absence* is trusted
only when every live finding carries a `signal`: on a report where none does,
"no finding carries this name" is true of a field nobody wrote, and reporting
that as a pass would be scoring zero out of zero. Until then the row scores
`unscoreable` and says how many findings were unsigned.

**§ Must NOT fire is scored on what the run shipped**, not on what the report
mentions. A suppressed entry is the outcome those rows predict — § Must fire
already scores one as a correct outcome — so it is counted, under
`suppressed_rule_hits`, and never called a false positive.

**Rows take their pick in specificity order, not the order they are written in**:
rows whose firing is settled before rows a `needs_ruling` leaves open on
`recall`, exact lines before spans before
file-level rows, ties by key order. A finding is claimed by at most one row, so
without that ordering a `line: null` row listed first eats the finding an
exact-line row below it names — and the run is reported as having missed a
detection it made. When a row still matches more than one unclaimed finding, the
detection is recorded as matched (something fired at that site) and criterion 5
declines: which of them the row meant is not something the key says.

`needs_ruling` is how a key says a human has not settled something about a row —
either the question in words, or a list of `open_questions` ids, so a key can
state each question once and point at it rather than copying prose into every
row it blocks. It may sit on **any** row object: a `must_fire` row, a
`must_not_fire` rule, or a `cross_reference.must_appear` row. Whatever it names
is scored `unscoreable` — never a pass and never a fail — and it makes the
verdict `incomplete`. Ruling it either way would state an adjudication nobody
made. **Every spelling that names no question is refused** — `[]`, `""`, `[""]`,
`["   "]`, and every spelling of that same nothing a reader cannot see — the
zero-width codepoints, a soft hyphen, a Hangul filler — which `trim()` reads as
a value and a reader sees as blank. An
empty list is zero questions written as though there were some, and
it read as a row declared unsettled that suspended nothing, so every check on it
ran and could reach a verdict under a reason line naming no question; a blank
string, or a list of them, prints that same reason line and leaves nobody
anything to settle. Write `null`, or omit the field, on a row that is settled.

An `open_questions` entry states the question once so rows can point at it:
`id`, `what`, `sides` and `blocks` are prose the scorecard renders, so each is
checked for shape rather than left to a comment — `id`, `what` and `blocks` are
strings that are not made only of whitespace and characters that render as nothing, `sides` is a list of those. All four are
optional, and `null` says absent on all four, which is how this key writes an
absent optional everywhere else. A scalar where the list belongs is refused by
name here rather than reaching the line that joins it.

**A ruling suspends the checks its questions name, and no others.** An
`open_questions` entry also carries `blocks_checks`, a list drawn from `recall`,
`severity`, `confidence`, `suppressed`, `citations` (a `must_fire` row),
`precision` (a `must_not_fire` rule), and `inventory` / `on_confirm` (a
`cross_reference.must_appear` row); an unknown name is refused, because a
misspelt one would silently suspend nothing. A row citing a question with no
`blocks_checks` — or one this key does not carry, which is every row using the
prose spelling — has its whole row suspended, which is the safe direction. The
narrow scope is what stops a settled check riding out on an unsettled one: a row
unruled on its severity and its recall denominator still has its
`must_be_suppressed` compared, and a run that shipped it live is still a gate
fail.

A row unruled on `recall` still claims the finding it fired at, so that finding
is not also reported as a false positive; `matched_of_shipped` therefore counts
it as accounted-for, while `recall.counts.matched` does not.

`severity_conditional` / `confidence_conditional` are the other half of
`severity` / `confidence`: the values a key accepts only on a condition it states
in prose, as `[{ "value": "high", "condition": "verbatim" }]`, or `null` on a row
granting no latitude. Both halves of an entry are required — a value with no
condition is an accepted value, and belongs in the array beside it. A shipped
value matching one lands in `needs_human` with the condition attached and leaves
criterion 5 `unscoreable`: evaluating the condition is exactly the judgement this
tool declines, so listing the value outright would grant a pass nobody earned and
leaving it out would fail a run the source scores as zero drift.

`citation_quotes` is the one part of *"does the page state that claim"* a machine
can settle, and it runs only where a key cut one out: `[{ "url", "quote" }]`
names a page the row already cites and the sentence it must state, **verbatim**,
or `null` on a row requiring none. Both fields are required, the `url` must be
one of that row's `citation_urls`, and the quote must be one line holding no tab
— the manifest is newline-delimited and tab-separated, so either would split one
requirement into two entries nothing states.

A citation's own `note` is a paraphrase, which is why nothing here matches
against it: substring-matching paraphrases produces alarms nobody can act on.
The declared-quote path is the narrow case where the key already wrote the
sentence down. It is emitted for a **live** finding that actually cites that page
— a suppressed row asserts nothing, and a declaration the run never cited is a
question about the key rather than a page to open — and it does not answer
criterion 3: one sentence on one page is not whether the page states this
finding's claim, so `states_the_claim` stays `needs-human` either way. **A row
that declared no quote is not a row whose quote checked out**, and nothing on the
scorecard says otherwise: `citation_quotes` is simply empty, and the criterion
stays `unscoreable`.

The key's own shape is checked before anything is scored, and a wrong type is
refused rather than read: `severity`, `confidence`, `citation_urls`,
`citation_quotes`,
`banned_citation_urls`, `must_not_appear`, `banned_dispositions`, `sides` and
`blocks_checks` must be
arrays, `must_be_suppressed` and `closed_world` booleans, `needs_ruling` null or
one of its two spellings with something in it. Two of those arrays are closed
vocabularies rather than free strings — `blocks_checks` names a check this
harness runs, and `banned_dispositions` one of `confirmed` / `refuted` /
`not-readable` — and every free string the key states a constraint in must
carry something that renders, not merely be non-empty: `trim()` leaves a
zero-width space standing, so one used to read as a constraint the harness then
compared against. That covers a `must_fire` row's `signal`, `detector_id` and `path`, the
entries of its four string lists, both halves of a conditional value and of a
required quote, `needs_ruling` wherever it sits, a `must_not_fire` rule's
`signal` or `glob`, and the `cross_reference` lists. Each of those spellings
fails open rather
than loudly: a misspelt disposition bans nothing, a blank signal names no
candidate, and the key still reads as having asked, so criterion 6 compares
every candidate against it and reports the green. A
scalar where an array belongs used to read as *no constraint*, which switched
off the check the row was written to make and reported `pass` for it. `score`
runs that check for you. `scoreReport` is exported and a caller can reach it
without one, so it **raises** on the same shapes rather than defaulting: a
scalar `banned_citation_urls` turned a citation gate fail into a clean
`incomplete` with zero failures and left no trace on the scorecard, which is
worse than a crash.

### The scorecard

`--json` emits one object, and its shape is pinned by `scorecard_version` — `2`
today, bumped from `1` when `citation_quotes` was added:

| Field | What it holds |
|---|---|
| `verdict` | `pass` \| `fail` \| `incomplete`. `fail` when any criterion failed; `incomplete` when nothing failed and something is `unscoreable` or in `needs_human`; `pass` only when every question the key asked was answered mechanically and answered yes. **`fail` outranks `incomplete` on purpose** — the citation criterion leaves a `needs_human` row for every cited finding, so an `incomplete` that swallowed failures would be the verdict on nearly every run, and a missed detection would arrive dressed as an open question. |
| `key` / `report` | What was scored against what: the key's `name`, `key_version`, `source`, `applies_to_mode`; the report's `schema_version`, `mode`, `repo`, `commit_sha`, and finding count. |
| `criteria` | Seven entries — `recall`, `precision`, `citations`, `wall_clock`, `severity_drift`, `inventory_completeness`, `disposition_correctness` — each with `id`, `name`, `gating`, and a `status` of `pass`, `fail`, `unscoreable`, or `not-applicable`. `not-applicable` is not `unscoreable`: a key with no cross-reference half asks nothing about a live read, so nothing about it is open. **A criterion with an open question is never `pass`** — citations reads `unscoreable` while any citation is unopened by a human *or* unresolved by a resolver (it carries both an `open` count and an `unresolved` one, and this tool does no network I/O, so a non-empty `citation_urls` manifest is always the second); precision reads `unscoreable` while any extra has no rule covering it; and severity drift reads `unscoreable` when nothing was compared, because `0 of 0 checked` is a check that did not run rather than one that passed. Recall reads the same way against a key naming no `must_fire` row; disposition correctness against an inventory holding no `confirmed` candidate, where the copy rule has no population; and inventory completeness against either half of the same emptiness — a `cross_reference` naming nothing to compare, **or** an inventory with nothing in it to be compared, since three of that criterion's four comparisons run over the candidates themselves and a key can name every one of them and still compare nothing. Vacuous satisfaction is not satisfaction. The summary line is what an operator transcribes into a gate table, and a green row against an unasked question is the reading this harness exists to prevent. |
| `gating` | Whether the criterion can fail the run. Only `wall_clock` is `false`: a slow run is recorded, never failed (§ Scoring 4). It can still leave the card `incomplete` — a span the artifact does not carry is a missing input, and every pre-generation-4 report has one. |
| `failures` | Every failure, flat, prefixed with the criterion that raised it. |
| `needs_human` | What no harness can settle, each with what it asks and the URLs it asks about. Citations land here per finding — whether a page states the *specific* claim is prose — as do the key's own `open_questions`. |
| `unscoreable` | Every check that could not be made, with the reason. A code-only report against a key with a cross-reference half lands here for criteria 6 and 7, as does a config-aware one whose inventory came back empty **and whose key asks nothing on the `must_appear` side** — a `must_appear` row is a comparison, and an empty inventory fails it rather than opening it; a report with no `provenance.started_at` lands here for wall-clock. |
| `citation_urls` / `citation_internal_refs` | De-duplicated, sorted manifests of the citation targets this criterion accepts — `https://` on the first, `internal://` on the second. A citation in any other scheme is a gate fail and reaches neither, because the first list is what a resolver is handed and a cleartext URL must not be gate-passed here and fetched there. This tool performs no network I/O. |
| `citation_quotes` | `{ url, quote, finding_id }` for every verbatim quote a key row required of a page a live finding cited, sorted by URL then quote. The same resolver confirms each one appears on the page it names. **Empty means no row asked for a quote** — never that a quote was found. `--urls-out` folds this into the URL manifest as a tab-separated second field. |

Per-criterion detail: `recall` carries `matched` / `missed` / `unscoreable` and a
`counts` block, and each miss carries the key's own `adjudication` so the reason
travels with the failure; `precision` carries **both** `extras` (criterion 2's
count of shipped findings matching no key row) and `matched_of_shipped` (the gate
table's ratio), each labelled, because the source document is ill-typed there and
collapsing them would silently pick a reading — an extra matching a
`must_not_fire` glob fails, and an extra the key names no rule for is asked of a
human instead, which is § Scoring's own instruction to *record it, do not score
it*; `citations` carries a per-finding
row with each citation's scheme, class, and membership in the key's
`citation_urls` / `banned_citation_urls`, plus the
`internal_only_on_live_finding` gate — a **banned** URL present is a gate fail,
as is a citation written in neither `https://` nor `internal://`, cleartext
`http://` included, while a named URL *absent* is recorded on `expected_absent`
and opened as `unscoreable`: that row's `citation_urls_logic` names the
connective, and whether an absent member of an AND row is a fault is a question
the key's own contract leaves unsettled;
`wall_clock` is `gating: false`, carries
the span in seconds against a 600-second soft target, and states in `measured`
that a `pass` there means two parseable instants in order rather than a measured
span — both are the run's self-report, and nothing in the artifact distinguishes
a `started_at` stamped at Stage 1 from one composed at Stage 6 beside every other
timestamp; `severity_drift` names the
site, field, actual value and accepted set, plus a `conditional` list of the
values the key accepts only on a prose condition and a `checked` count of the
rows it actually compared; `inventory_completeness` set-compares
the candidate signals and enforces `banned_dispositions` and `closed_world`;
`disposition_correctness` holds each confirmed candidate's linked finding against
the key's `on_confirm` values, which are copied and never re-rated.

**On a config-aware run, a confirmed candidate moves criterion 5's accepted set
too.** The key states a signal's code-only `severity`/`confidence` on its
`must_fire` row and its confirmed values under `cross_reference.must_appear`'s
`on_confirm`; when the report is `config-aware` and a `confirmed` candidate for
that signal names the finding a row claimed, criterion 5 holds the finding to the
`on_confirm` values. Holding it to both at once made criteria 5 and 7 mutually
unsatisfiable — `client-authoritative-stats` is code-only `high/medium` and
confirmed `high/high`, so a doc-perfect run failed one of them whichever pair it
shipped.

## Exit codes

`0` valid · `1` validation/refusal failure · `2` usage error · `3` I/O error ·
`4` `score` only — the scorecard is incomplete. Its own code because neither of
the others fits: `0` would report a run as scored when part of it was never
checked, and `1` would report a refusal the tool did not make.
