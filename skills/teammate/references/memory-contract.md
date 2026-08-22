---
name: teammate-memory-contract
description: The memory surface the teammate skill codes against — tools, kinds, scope/identity
  rules, retention, and how to point at your studio's memory service.
last-verified: 2026-08-18
see-also:
- '[report-schema.md](report/report-schema.md)'
- '[cross-repo-surface.md](cross-repo-surface.md)'
- '[health-check.md](../subskills/health-check.md)'
---

# Memory contract

The teammate persists to and reads from a **memory surface** from day one. One
deployment answers to the six memory tool names: a multi-tenant service, one per
AGS environment, that derives your scope from AGS IAM. This file is the contract
it answers to. Locked: the schema, the `exclude_self` filter semantics,
retention, and the namespace→studioId mapping.

**Three toolsets, and this skill treats them as three independent things.** The
six `wiki_memory_*` tools are the **memory** surface — your studio's own
reports, suppressions, history and activity. `wiki_search` / `wiki_read` /
`wiki_read_source` / `wiki_list` are the **grounding** surface — prose the scan
cites from, out of AccelByte's global, public documentation corpus, one
deployment shared by every studio. `wiki_studio_*` is the third: your studio's
own memory rewritten as pages, per AGS environment, which orients a run and
grounds nothing. They are described together here because a run has to ask
about all three and has to ask about each one separately: each is its **own
service** and they fail independently (ADR-0026, ADR-0035).

**The prefix is the boundary, and a server's name is not.** Whatever an entry is
called in your MCP config, the tool you are about to call is what says which
body of text is about to answer — and only the four bare names reach a corpus a
finding may be grounded on ([grounding-rules.md](grounding-rules.md)).

Depend on the **toolset**, never on the server: ask whether the memory tools
answer, and ask separately whether the grounding tools answer. One bit for both
quietly assumes a missing grounding layer means lost memory as well, and it does
not. Any one surface can be present without the others, and the skill degrades
along whichever is missing — see [grounding-rules.md](grounding-rules.md) for the
grounding half and § Pointing at your studio's memory service below for the
memory half.

**Whether an entry can be quoted to a colleague is decided by what stamped it,
and not by the schema.** The store stamps identity from the verified token on the
kinds that carry one — a person's gives `actor_source: iam`, which may be quoted
to a colleague; a service token gives `iam-client`, which may not. On
`kind: activity`, the one a nudge quotes, the stamp also *replaces* whatever the
client sent. An entry nothing stamped — one a run composed for itself, with no
memory service to write to — is self-asserted, stamps `git-config`, and is not
quotable. So a stamped entry is what makes a quotable entry *possible*, never a
guarantee that every entry is one — the three values `actor_source` may hold, and
what each is worth, are set out under § Scope & identity below. Tool names,
arguments, kinds and keys are the same call whatever stamped the entry.

Where this plugin ships a memory MCP entry, it can configure that entry for your
project — you supply the URL, because every studio's memory service is its own
deployment. Present only when someone installs and configures it: every
read/write below is **conditional on the memory tools being available and fails
silently when they are absent**, which is the common case. "Available" is about
the tools answering, not about a server being reachable and not about the name
you gave an entry — the `wiki_memory_*` prefix is the only thing that says memory
answered. An entry pointed at a URL that serves pages registers none of these
tools, and that is the same no-memory case as no entry at all.

## Tools

Every argument is **named** — these are MCP tools, so a call passes one object,
never a positional list:

| Tool | Purpose |
|---|---|
| `wiki_memory_put({ kind, key, doc })` | Save a run report, a scan-history entry, a call-site index or a studio document. Exact-key overwrite — with one exception: a `surface` record is **write-once** and a second write to its key is refused, see § Surface records. |
| `wiki_memory_get({ kind, key })` | Read one record whose exact key is already known — the read-before-write at Stage 6, not the reuse lookup. Reuse lists and ranks (below); an exact `get` misses on a working repo almost every time. |
| `wiki_memory_list({ kind, since?, exclude_self?, nudge_read?, limit?, key_prefix?, projection?, cursor? })` | Changes-since-last-scan, load suppressions, read the activity feed. Returns a **page**, not an array — see below. `key_prefix` and `projection` apply to the keyed kinds (`report`, `suppression`, `last-nudged`, `surface`, `document`) only; passing either on an append kind is an error rather than a no-op. `nudge_read` keeps only entries that may be quoted to someone who did not write them. |
| `wiki_memory_append({ kind, entry })` | Append-only: access log, feedback, and activity. |
| `wiki_memory_rollup({ topic?, key_prefix? })` | Group your stored reports and return counts plus **complete** evidence keys. Computed for this call and never stored, so there is no saved summary and no prose — you write the sentence. Returns `{ groups, over }`; `over` says what the numbers were taken over. See [history-rollup.md](history-rollup.md). |
| `wiki_memory_topics({ key_prefix? })` | Which rollup topics have data in your scope, with a count each. Ask it when you do not already know what the records carry — the topic set is not a fixed enum. |
| `wiki_search` / `wiki_read` / `wiki_read_source` / `wiki_list` *(existing)* | The **grounding** surface, not memory: cross-cutting best-practice prose the scan may cite from AccelByte's global, public documentation corpus (a secondary layer — deprecations are grounded from the SDK/specs and the AGS release notes, not here). Listed here because a run has to tell it apart from memory rather than because it arrives with it; it is its own service, and everything else in this table is memory. |
| `wiki_studio_*` *(existing)* | Your studio's own memory rewritten as pages, per AGS environment. Pages only — that half holds no raw and has no source read on it, so the record a page was written from is a memory record, read with the memory tools above and reachable nowhere else. **Neither memory nor grounding**, and this skill calls none of them: reuse, suppressions and activity come from the six tools above, and a finding is grounded on AccelByte's corpus or not at all. Listed so that seeing these tools answer is not mistaken for either of the other two toolsets. |

**`scope` is not an argument to any of these.** The server derives it from the
caller's verified identity and stamps it onto the stored record; nothing a client
sends names, widens or moves it. It appears in this document only as the boundary
these tools read and write within. Passing one anyway is not refused: an argument
no tool declares is dropped before the call runs, and the call then succeeds
against your own scope — so a call that came back fine is never evidence that an
argument it carried was honored. Read the signatures above as the whole argument
list, and read them for what is **missing** rather than for what is extra,
because the two mistakes behave differently. An unknown argument is accepted and
silently dropped. A required one left out, or one of the wrong type, is genuinely
rejected — and that rejection lands in a path that is supposed to fail silently,
so it reads as "no memory" rather than as a bug. That is the mistake worth not
making twice.

### What a read gives back

`get` and `list` return the **stored envelope**, not the document that was put
into it:

```json
{ "scope": "...", "kind": "suppression", "key": "...",
  "doc": { ... what wiki_memory_put was given ... },
  "updated_at": "2026-07-26T04:46:54.319Z" }
```

The record's own fields — `repo`, `id`, `snippet_hash`, everything a schema
describes — live one level down, under `doc`. **Unwrap `.doc` before filtering,
validating, or matching on anything.** Reading a schema field off the envelope
yields `undefined`, and `undefined` is not an error: a repo filter written
against the envelope drops every record, and a validator run on one rejects
every record, both while reporting perfectly ordinary-looking output.
`updated_at` is the server's write stamp and belongs to the envelope, not to the
record.

### `list` returns a page, and the page says what it left out

`list` does **not** return a bare array. It returns:

```json
{ "entries": [ ...envelopes... ],
  "next_cursor": null,
  "over": { "complete": true, "kind": "report",
            "width": "namespace", "scopes": ["..."],
            "limit": 500, "limit_source": "default", "projection": "full" } }
```

`over` is what the page was taken over, and two of the things in it are
narrowings **you did not choose**: `scopes`, which is how far your identity is
allowed to read, and a `limit` the server supplied when you passed none. That is
why they are stated.

**`over.complete` is the field that matters.** It is false whenever anything
matching your filters was left out — including when you asked for fewer records
than exist, which is not an error and is the ordinary case for a small `limit`.
Read it as a denominator, not as an alarm:

- **`complete: true`** — you are holding every record that matched.
- **`complete: false`** — you are holding a page. `next_cursor` is non-null
  exactly when this is false; pass it back as `cursor` for the next page, oldest
  last, until a page comes back complete.

**Any count you take over a page is a floor unless that page was complete.**
This is the difference between *there are no suppressions* and *the suppressions
did not all fit*, and between *nothing was ever scanned here* and *your history
is a generation behind*. A truncated suppression list read as "no suppressions"
re-reports a finding a human already dismissed.

`limit` still means the most recent N. Omitting it no longer means "everything":
it means the server's default page, and the page tells you so
(`limit_source: "default"`).

`projection: "keys"` drops `doc` from every envelope and keeps
`{ scope, kind, key, updated_at }`. Useful when the key already carries what you
are deciding on — a report key names the repo, the commit and the mode — so a
bulk read can rank on keys and then `get` only the one or two it wants.

`key_prefix` narrows on the **client key**, server-side, before the records are
read. It is what makes a read proportional to one repo instead of to the studio's
whole history. **It also changes what a count means, so it is not for every
read** — see the reuse walk below, which must not use it.

## Kinds

Eight, in two families. `report`, `suppression`, `last-nudged`, `surface` and
`document` are **keyed documents** — you compose the key, `get` reads one back, and
`key_prefix` and `projection` narrow a `list` over them. `access-log`,
`feedback` and **`activity`** — the cross-persona colleague feed — are
**append-only**: they have no key, so both of those arguments are refused on
them rather than ignored. Every subskill run ends by
appending exactly one `activity` entry (schema in
[report-schema.md](report/report-schema.md)); a nudge in a dev-persona session
later quotes it.

`action` vocabulary (documented, **non-exhaustive** — validators do not enum it):
`ran-health-check`, `reused-report`, `opened-pr`, `found-error-increase`,
`found-deprecations`, `found-auth-risk`, `suppressed-finding`. Extend as personas
grow. Use `reused-report` when a run served a stored report without rescanning —
the feed must not imply a scan that did not happen.

## Report keys

A `report` entry is keyed by the run it came from, so the same repo at the same
commit in the same mode resolves to one entry that later runs overwrite rather
than accumulate beside. There are two shapes, and which one applies is decided
by `repo.tree_state`, never by preference:

```
<repo-name>@<commit_sha>:<mode>                 clean tree — describes the commit
<repo-name>@<commit_sha>+u<actor12>:<mode>      dirty tree — describes one person's edits
```

`<repo-name>` is the repository's directory name, `<commit_sha>` the full pinned
SHA, `<mode>` the Report's own `mode` — `code-only` or `config-aware`. The server
base64url-encodes the key on the way in — that is storage-side and
traversal-proofing; pass the plain string.

`u<actor12>` is `u` followed by 12 hex of sha-256 over an actor id — and *which*
actor id is the part to get right. A studio's memory service composes it from the
identity it stamped from the writer's token, never from the `actor` the document
carries: that one is stored exactly as sent and reaches no key. With no memory
service to stamp anything, the identity is the one the run read from `git config`
and there is no other. Hashed either way because an actor id can be an email, so
it carries the key's own `@`, and because a person's address has no business
being the visible name of a storage row when all the key needs is to tell one
person's scan from another's.

**Compose neither by hand.** `report_tool.ts memory-doc` builds the key from the
document it just validated, which is why it no longer takes a `--repo-name`: a
hand-typed name is a second source for a value the report already carries, and
the whole reason the command exists is that a second source is a second chance
to differ.

**On a dirty key the store has the last word.** A studio's memory service
composes the key it expects from the record's own fields and the identity it
stamped, and refuses a `wiki_memory_put` whose key is not that one — a refusal
that names the key the record composes. So where the identity a run read locally
is not the identity its token carries, the first write is refused and the key to
file under is in the refusal: re-run `report_tool.ts memory-doc --allow-dirty
--key <the key the refusal named>` and put what it prints. Pass the key through
that command rather than editing the payload — the document is what is being
stored, and the command exists to emit it byte for byte. The override reaches
the per-person fragment and nothing else, so a key naming another repository,
another commit or another mode is refused here rather than filed.
Nothing is moved silently, which is the point — a record filed somewhere its
author did not ask for is one that author's own read cannot find.

### Why a dirty scan is keyed at all, and why by person

On a machine someone is working on, the tree is dirty nearly always. A rule that
only stores clean scans stores almost nothing, and the reuse path was reachable
only from CI or from the half-minute after a commit.

So a dirty scan is storable — but under a key that admits what it is. It
describes uncommitted edits that exist on exactly one machine, so it is filed
under the person who made them and **offered** back only to them: a colleague at
the same commit must never be handed someone else's working tree as findings
about code they have.

Offered, not walled off. `list` returns every report your identity is allowed to
read — which is at least your own namespace and may be the whole studio — and the
ranking runs on the returned records, so a colleague's run reads every stored
dirty report before deciding to show none of them. A `key_prefix` narrows the
work and the counts; it never narrows who is allowed to read what. And the key
fragment the ranking gates on is the store's own — composed from the identity the
memory service stamped from the writer's token, not from the `actor` the document
carries. That makes it a real per-person tell, and this ranking still withholds
nothing: every record the read reached was already returned, and the ranking only
decides which of them to put in front of someone. That reasoning stops here and
does not reach the other path: an aggregate that has to keep a colleague's
uncommitted work out of a studio-wide answer asks the store instead, which
compares the stamped identity and never hands the records over
([cross-repo-surface.md](cross-repo-surface.md) § Whose records the answer is
made of). The key scopes; it does not isolate, and Stage 6 asks in those terms
(ADR-0003). What a stored report carries is paths, titles, severities and
hashes; snippets are not a Report field, so the code itself is never in the
store.

Two properties fall out of the shape, and both are deliberate:

- **The tree hash is not in the key.** It rides in the document
  (`repo.tree_hash`). Keying on it would mint a permanent row per batch of
  edits — a dozen in an afternoon — in a kind this contract declares durable and
  never auto-pruned. One slot per person per commit per mode, overwritten by each
  rescan, holds the newest answer and grows with commits rather than with
  keystrokes. The hash still does its job on the way back out: it is how a later
  run says *these were your edits, and they have moved since*.
- **Storing one is a decision, not a default.** `memory-doc` refuses a dirty
  report unless `--allow-dirty` is passed, and the flag means a human answered
  yes *this run* (health-check.md Stage 6 asks). The tool cannot verify that
  anyone was asked, which is exactly why refusing is the default rather than a
  warning.

### Finding a report to reuse — walk back, do not guess

An exact-key `wiki_memory_get` answers one question: *is there a report for this
commit, in this mode?* On a working repo the answer is almost always no, because
the commit moved or the last scan was dirty. A miss then reads as "nothing was
ever scanned here" when a perfectly usable report sits one commit back.

So the reuse path lists and ranks rather than getting:

```
wiki_memory_list({ kind: "report" })            # the whole kind, in your scope
report_tool.ts memory-lookup --repo-name … --mode … --actor … --tree-hash …
                             --commits <git rev-list -n 200 HEAD> <envelopes.json>
```

**Do not pass `key_prefix` on this read, and do walk the cursor to the end.**
The list comes back covering other repos, other modes and other people, and
narrowing it is the caller's job — but not on the server, and not by prose. On
the server, a repo-prefixed list drops exactly the nameless records
`unplaceable` counts, so the count silently becomes zero and *your history is a
generation behind* prints identically to *no prior scan*. In prose, narrowing is
how a run offers a colleague's working tree. The command below does it
mechanically, on records, and returns at most one candidate of each kind:

| Rank | What matched |
|---|---|
| `exact` | this commit, clean tree — the same code about to be scanned |
| `own-dirty-here` | this commit, your own uncommitted edits; `tree_matches` says whether they are still on disk |
| `clean-ancestor` | the nearest earlier commit with a clean report |
| `own-dirty-ancestor` | the nearest earlier commit with your own dirty report |

It also returns two things a run must say out loud rather than swallow:

- `rejected` — stored reports this run cannot honestly offer. Two ways in. Most
  no longer validate: memory outlives the rules in force when it was written, so
  a store holds records from before the current schema, and validating only on
  the way in honors those forever with nothing checking them. The rest fail to
  state their `tree_state`, which older generations allowed — and a report that
  cannot say whether it described the commit it names or somebody's uncommitted
  edits cannot be ranked, because every rank asserts one or the other. A
  rejected record is reported to the user and never matched — and because it is
  *reported*, it is scoped exactly like `unplaceable` below, plus a match on
  `repo.name`. The list reaches every namespace your grant covers, so a defect
  found before that match is another team's repo and sha, printed to this user
  as a fault in their store. A record this run cannot claim is skipped in
  silence, however defective it is.
- `unplaceable` — a count of stored reports that name no repo, so they cannot be
  claimed by this one, taken only among the records the other filters keep: this
  run's mode, a commit in this repo's rev-list, and — when the record describes
  uncommitted work — this person's. The number is read back to the user as
  *their* history, and the list reaches every namespace your grant covers, so
  counting every nameless record in it reports other repos' and other people's
  reports as the user's own.
  Every report written before generation 3 is one. Without
  the count, a store full of them answers every lookup with "nothing stored" and
  never says why — and the difference between *no prior scan* and *your history
  is a generation behind* is the difference between rescanning and knowing you
  had to.

  This is the count a narrowed or truncated read destroys, in two different
  ways, which is why the walk above says both things. A `key_prefix` drops the
  nameless records outright. A page that stopped at the cap holds some of them
  and no way to know how many are behind it — so the command reports
  `read_complete`, echoing the page's own `over.complete`, and a `false` there
  makes `unplaceable` and `rejected` floors rather than counts. A read that made
  no claim at all comes back `null`, never `true`: silence about completeness is
  not a completeness claim.

An ancestor report is **not** an answer to this run — the code has moved since.
It is offered as context, with its distance stated, so the user can choose it
knowingly. Serving one as though it described HEAD is the same error as keying a
dirty scan on the commit.

Because the mode is in the key, a code-only report and a config-aware one sit
side by side at the same commit and neither is offered in place of the other.
That is the point: a config-aware report carries a live cross-reference of the
namespace that a code-only report never made, so serving one as the other would
answer a question nobody asked. Say which mode you looked for when reporting a
miss.

Two reports is the floor, not the ceiling. The dirty key adds one slot per
person per mode on top of those, so a commit several people have scanned dirty
holds a row for each of them — which is why the lookup ranks candidates rather
than expecting to find one. A third row at a commit is the ordinary case, not an
anomaly.

**Read this key; never improvise one.** `memory-doc` composes it from the
document it just validated (above) — what the format is for is reading a stored
key back: ranking a candidate against this run, and naming the one key Stage 6
must read before it writes. A key improvised by hand differs by a character and
reads as a miss. A repo with no commit has no stable key and therefore no
reuse — scan it every time.

### Serving a stored report as a file

A reader who accepts a stored report may want it on disk. Write out the JSON
exactly as it came back under the envelope's `.doc` and export **that** — do not
retype the findings, and do not restamp `provenance.started_at` or `scanned_at`:

```bash
cat > "$RUNDIR/stored-report.json" <<'JSON'
<the stored report document, verbatim>
JSON
npx tsx "$TOOL" export --format md --at-commit "$COMMIT" \
  --out "$RUNDIR/teammate-report.md" "$RUNDIR/stored-report.json"
```

What a run says in the transcript reaches only the person who ran it. The file
gets forwarded, and the rendered `Derived:` row is the only thing that travels
with it. Restamping it to now — or writing the report out by hand and leaving
the row off — turns a reused answer into one that looks freshly derived, which
is the failure the whole reuse path exists to avoid.

## Suppression records

A `suppression` is a human's standing decision to dismiss a finding. It is
durable and never auto-pruned, so unlike a report it is **not** commit-pinned —
it has to survive every commit after the one it was granted at, which is the
only reason it is worth storing:

```
<repo-name>@<detector-id>:<id>
```

`<repo-name>` matches the report key's first segment, `<id>` is the
`fingerprint` the dismissal was granted against. The repo belongs in the key
because an `id` is a hash of detector, path and snippet — none of which is
repo-specific — so two repos sharing a file can mint the same id, and a bare-`id`
key silently lets one studio repo's dismissal overwrite another's.

The repo is **also** a field, and that is the one the load path uses. `list`
returns every suppression your grant covers, whatever repo it came from.
Filtering to this repo is done on the returned records, and skipping it is how
one repo's dismissal gets applied to another's finding.

`key_prefix: "<repo-name>@"` is safe on *this* read — a suppression key leads
with the repo name, and no count here depends on records that name no repo. What
is not safe is stopping at one page. **Walk `next_cursor` until `over.complete`
is true**, because a suppression list cut short by the cap is indistinguishable
from a shorter one, and the two are read the same way: as "no suppression
matched". That re-reports a finding a human already dismissed.

A record carries what a later run needs to prove the match, not just assert it:

| Field | Rule |
|---|---|
| `schema_version` | Present. |
| `id` | The `fingerprint` this was granted against. |
| `repo` | Repository name, matching the key's first segment. Required — the load path filters on it. |
| `detector_id` | One of the four detector ids. |
| `path` | Repo-relative, no leading `./`, forward slashes, and not a value that renders as nothing. The same string that was passed to `fingerprint --path`. |
| `snippet_hash` | **Required** — the full 64-char digest. |
| `reason` | Why the human dismissed it, in their words. |
| `actor` / `actor_source` | Who dismissed it, same shape as an `activity` entry. Required: a record with no actor was not granted by a person. |
| `ts` | ISO-8601, server-stamped on a write the memory service accepts. |

Validate with `report_tool.ts validate --kind suppression` **on both sides** —
before writing, and again on every record read back before matching on it. The
write gate alone is not enough here. Memory outlives the run that wrote it, so a
store holds records from before the current rules existed; validating only on
write means those are honored forever without anything checking them. A record
that fails validation is reported to the user and never matched
([health-check.md](../subskills/health-check.md) Stage 1b).

**Why `snippet_hash` is required here when a finding may omit it.** A finding
without one is merely harder to diff. A suppression without one cannot be
matched at all the moment its `id` stops re-deriving, and the run is then left
choosing between re-litigating a dismissal the human already made and asserting
a match it cannot compute. The second silently re-points a suppression at a
finding it was never granted for. A suppression with no proof is not a
suppression.

## Surface records

A `surface` record is the call-site index one health check derived at one
commit: which AGS capabilities that project calls, and at what `file:line`. It
is the same object the Report carries as its `surface` field
([report-schema.md](report/report-schema.md) § Integration surface), stored on
its own so a later run — and a question about a *different* repository — can
reach it without reading a whole report.

```
<repo-name>@<commit_sha>                clean tree — describes the commit
<repo-name>@<commit_sha>+u<actor12>     dirty tree — describes one person's edits
```

`<repo-name>`, `<commit_sha>` and `u<actor12>` are exactly the report key's, and
the dirty key exists for exactly the report key's reason. **What is missing is
the `:<mode>` segment**, and its absence is the thing to notice: one commit holds
**one** surface record whichever mode the run was in. That is deliberate — the
index is a static read of the sources that both modes make, and only a
capability's `config` edge belongs to the live half. It has a consequence worth
knowing before you write one: the first record stored at a commit is the record
that commit has.

**One thing writes it**: `health-check` Stage 6, once per run, from the Report
that run just validated — the same fields, rearranged, never derived a second
time ([health-check.md](../subskills/health-check.md) Stage 6). A run that reused
a stored report scanned nothing and writes none.

**It is write-once.** A second `wiki_memory_put` to a key that already holds a
surface record is refused, not merged and not overwritten. A rescan at the same
clean commit therefore meets that refusal as its ordinary outcome: the run
continues and says the key was already stored, rather than treating the refusal
as a success or as a fault. Silence there would hide the one case worth seeing —
a different tree composing a key that already exists. The record's whole
value is that it cannot go stale — a record about `abc123` is a true statement
about `abc123` permanently — and that is only true while nothing can edit it
afterwards. A new commit is a new key; nothing reconciles, and there is no
watermark to rot. So a config edge stored beside a capability is dated at the
instant it was read and stays that way: re-reading the namespace does not update
the record, it produces a fresh read that belongs to whoever made it.

A record is a closed object — an unlisted field is refused, not ignored:

| Field | Rule |
|---|---|
| `repo.name` | **Required.** One visible line, and refused any of `@ : + / ` or whitespace: these compose the key, so a name carrying a separator could compose a colleague's dirty key exactly. |
| `repo.commit_sha` | **Required.** Same line rule, same separator refusal, same reason. |
| `repo.tree_state` | **Required**, `clean` or `dirty`, never defaulted — the two are different keys, and a record that does not say which tree it scanned would take the clean one and publish one machine's uncommitted edits as the answer for that commit. Read it from `git status --porcelain`. |
| `actor.id` | **Required when `tree_state` is `dirty`**, because the key is per-person there. Absent on a clean record. |
| `scanned_at` | **Required.** ISO-8601 UTC. |
| `mode` | **Required**, `code-only` or `config-aware`. |
| `namespace` | Optional, one visible line — and **required** on a record carrying any `config` edge, because an edge that cannot say which namespace answered is unattributable rather than merely undated. The pairing runs both ways: a `code-only` record carrying a config edge is refused, since a code-only run read no namespace. |
| `capabilities` | **Required array.** Empty is a real answer — the SDK is present and the scan matched no call. Absent has not answered. Each entry is `{ capability, call_sites, config? }` on the rules [report-schema.md](report/report-schema.md) states, including at least one `{ path, line }` per capability and a **required** `line`. |
| `not_read` | Optional array of one-line entries, each naming one call surface the scan could not reach. Mandatory in practice on Unreal, where Blueprint graphs are binary and a text scan can miss most of a project's calls while looking complete. |

Strings here are **refused** rather than flattened where they carry a line
terminator, which is the opposite call from an `activity` entry. Every one of
them is machine-derived evidence — a repo-relative path, a capability name, the
operation a config edge ran — and on a path a space where a terminator was is a
*different path*, so repairing it would quietly produce a location pointing at
nothing.

**Nothing cites a surface record.** It is a compiled artifact: it may point at
evidence and it can never be what a claim rests on. A consumer that needs the
fact opens the file the record named and cites that. A re-derive always wins —
see [cross-repo-surface.md](cross-repo-surface.md) for the studio-wide read, and
[upgrade-check.md](../subskills/upgrade-check.md) Stage 2 for the single-repo one.

## Scope & identity (security-critical)

- **`scope` is server-derived from the caller's identity, never client-asserted.**
  A studio only ever reads and writes within its own scope. This is the label-
  vs-tenant rule: the client may *label* an entry, but it can never *choose the
  tenant*.
- **`namespace → studioId` mapping.** A studio runs many namespaces
  (dev/staging/prod, multiple titles) that all map to one studio `scope`. The
  entry's `namespace` field stays as-is (structured, for entitlement-aware nudge
  filtering); `scope` is the studio it rolls up to. The mapping is server-owned
  and fixed here, so no record ever needs re-keying.
- **Activity identity is server-stamped.** `wiki_memory_append` **ignores any
  client-supplied `actor`/`ts` for `kind: activity`** and derives them from the
  token. An entry written with no memory service to stamp it carries an `actor`
  read from `git config`, self-asserted, and is never quoted at a colleague.

### `actor_source` — the three values, and what each is worth

| value | who wrote it | may be quoted to someone else |
|---|---|---|
| `iam` | a verified person, from their own token's `sub` | **yes** |
| `iam-client` | a machine — a service token with a client id and no `sub` | no |
| `git-config` | self-asserted — a run composing an actor for itself with no memory service to stamp one, or an entry written before this service existed | no |

There is no fourth value, and an entry carrying one is not readable.

`iam-client` exists because a service token is neither of the other two: it
names a caller, so the entry is honestly attributed, but the caller is not a
person. "Some Service found bugs in your store code" is a different sentence
with a different trust story, so it never appears as a colleague.

## `exclude_self` and `nudge_read`

Nudge reads call
`wiki_memory_list({ kind: "activity", since, exclude_self: true, nudge_read: true })`
at tangent points. The two flags answer different questions and both are needed.

**`exclude_self` — whose is this.** Applied server-side from the caller's token,
so the client never needs its own server-derived identity to filter itself out.
This is what lets Amy see "Dave found increasing errors in stats 2 days ago"
without her own runs echoed back.

**`nudge_read` — may this be repeated.** Keeps only entries a name can be
attached to: `iam`, and nothing else. Machine runs and `git-config` entries —
whether a run composed the actor for itself with no memory service to write to,
or the entry was written before this service existed — stay fully readable in
their own right and are **never quoted at a colleague as if the actor were
verified** — excluded, not dropped. An entry
whose `actor_source` is missing or unrecognized is excluded too: a record that
does not say where its identity came from has not earned the benefit of the
doubt.

Ask for `nudge_read` explicitly. It is not inferred from `exclude_self`, so a
read that omits it gets everything the width reaches — which is right for a
history view and wrong for a quote. Like every other filter it is declared back
in `over`, so a page always says whether it was applied.

**Neither flag exists on `wiki_memory_rollup`, and the reason is worth knowing.**
A rollup returns counts, so there is nobody in it to quote and nothing for
`nudge_read` to keep out — a group saying six findings across four repos names
no one. And its per-person rule runs the opposite way to `exclude_self` and is
not optional: another person's uncommitted-tree report is **excluded from your
aggregate**, your own is kept, and that comparison is made against the identity
the server stamped when the record was written rather than any actor in the
body. It is not a flag because it is not a choice; `over.excluded_others_dirty`
says it happened.

Two consequences that catch people out. A report you can see in
`wiki_memory_list` may legitimately be missing from your rollup, because the
list hands you the records and lets you judge while the aggregate never shows
them to you at all. And a record written before the store stamped identities is
nobody's own, so if it is dirty it is in no one's aggregate — which is the
fail-closed direction and not a bug to work around.

## Retention

`activity`, `access-log`, `feedback` and **`surface`** are kept for **~90 days**.
`report`, `suppression`, `last-nudged` and **`document`** are durable — nothing
deletes them on a schedule. A document is durable on a correctness argument and
not a preference: a digested page's statements carry source keys that are checked
to name records that exist, so a document that aged out would leave every page
citing it unable to resolve. Every kind sits in exactly one of those two lists and the split is
checked when the store is configured: a kind in neither would get no rule, which
reads identically to durable.

**`surface` is retained on a cost argument, not a privacy one**, and it is the
only member of that list that is not a log. It is an index into one commit,
rebuildable from the repository by a Stage 2 that every health check performs
anyway, and nothing may cite it — so ageing out costs a re-derive that was going
to happen and leaves no claim unsupported. What it buys is a bound on growth
that would otherwise be one object per commit scanned, plus one per person per
dirty tree. Read an absent record the same way you read an absent report: the
ordinary case, and not a fault to report.

The `~` is doing real work: deletion is a background sweep, not something that
happens on any read or write, so a read can briefly return an entry past the
window. Treat the window as a **floor on what you will find, never a ceiling on
what you may see** — an entry older than 90 days is not a signal that anything is
wrong, and its absence is not a signal that it was never written.

Nudge reads are separately bounded to the **last 14 days** with `since`, and that
bound is the one that decides what a nudge is allowed to be about. A stale spike
is not a live nudge, and passing `since` is what makes that true — the retention
window is far too wide to stand in for it.

One thing `since` does not do on the two logs: `access-log` and `feedback` carry
a timestamp from whatever produced the entry, so `since` filters them but cannot
make the read cheaper. Only `activity` is timed by the server. Nothing about the
results differs; ask for what you need on all three.

## Following a page's source keys back to raw

A digested page carries, on every statement, the raw records it was written from.
Those are what make it citable — and they are also a **route**: a page that says
less than you need names the records that say more.

A source key is `{kind}/{name}`, where `name` is **base64url of the record's own
key**, not the key itself. So the walk is:

```
  document/ZGVzaWduL21hdGNobWFraW5nLXYy
     |                  |
   kind          base64url(key)

  ->  wiki_memory_get({ kind: "document", key: "design/matchmaking-v2" })
```

Split on the first `/`, base64url-decode the rest, and `get` it.

**It is the memory server that answers this, not the wiki.** The studio wiki
holds pages and no raw at all — that is why it registers three tools and has no
source read. A session with the wiki configured and memory not cannot make this
walk, and the honest thing to say is that the raw is on a server this install
does not have.

Two places a page tells you to make it:

- **`over.truncated_source_keys`** — records the digest read only in part, because
  the record ran past what one pass hands the model: its own share of that pass,
  which is smaller when the pass carries many records. The page is written from
  the head of them. A `document` of ordinary length is not cut; a very long one,
  or one sharing a crowded pass, can be. Read the named records if the answer
  needs what the page did not see.
- **`moved_source_keys`** — records that have moved since the page was written.
  The page is not wrong so much as no longer joined to its evidence.

Both are lists of the same `{kind}/{name}` refs, and both are absent on a page
where nothing applies. An absent list means the thing did not happen; there is no
empty-list spelling of it.

## Chokepoint

Everything the model composes passes `report_tool.ts` before any append:
findings via `validate` + `fingerprint` + `redact`; activity entries via
`validate --kind activity` + `redact` on `target`/`summary`. Fingerprints,
actors, and timestamps are never model-composed.

## Pointing at your studio's memory service

The memory service is what makes a colleague nudge possible at all: it derives
your scope from AGS IAM rather than from anything you configure, and stamps each
entry's actor from the token that made the call. Every studio's is its own
deployment, one per AGS environment, so what you configure is an entry carrying
that environment's URL, and every call carries an AGS token.

With no such entry configured, the skill degrades to no-memory: it still scans
and reports, it just cannot reuse a prior report or surface colleague activity.
Grounding is untouched by that, which is the point of treating the toolsets
separately — the scan keeps its optional citation layer while losing memory
entirely. Verify with one `wiki_memory_put` / `wiki_memory_get` round-trip before
relying on memory reads.

**These are separate services** (ADR-0026, ADR-0035). Memory holds your
studio's raw records under `wiki_memory_*`. A per-environment wiki serves the
pages written from those records, under `wiki_studio_*` — the pages and not the
records, which stay with memory and are read with the memory tools:
`wiki_memory_get` for the keyed document kinds, and `wiki_memory_list` for the
`activity` and `feedback` records, which have no key. AccelByte's global,
public documentation corpus — the grounding half — is a third deployment shared
by every studio, and it keeps the four bare names. They are deployed
separately, so they can be reachable separately: one being down implies nothing
about the others. Configure one entry per URL you are given, and
expect the memory one first — the studio-pages half serves what has been written
so far, which starts empty.

**The two wikis answer to different tool names on purpose.** Your studio's pages
are `wiki_studio_*` precisely so a run can tell from the name of the tool it is
calling which body of text answered: a claim about AccelByte behaviour is
grounded on AccelByte's corpus or it is not grounded, and your own notes do not
become evidence by being rewritten as a page
([grounding-rules.md](grounding-rules.md)). Nothing about the schema, the six
memory tool names or the degradation rules changes with the split — only how
many endpoints you point at.

**Ask your AccelByte contact for that URL rather than assuming one.** There is no
published endpoint to default to. Pointing at the wrong one gets you a denial and
never somebody else's studio, because the scope is derived from the token and
never from anything the client sends — but a guessed URL still costs you a
debugging session for a reason that was never in your config.
