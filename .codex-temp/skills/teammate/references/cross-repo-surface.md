---
name: teammate-cross-repo-surface
description: 'How to answer which of a studio''s projects call a given AccelByte capability:
  the `list` over `surface` folded in this session, what its envelope means, and why
  the answer is never stored. Read before answering any question that spans more than
  one repository.'
last-verified: 2026-08-16
see-also:
- '[memory-contract.md](memory-contract.md)'
- '[history-rollup.md](history-rollup.md)'
- '[report-schema.md](report/report-schema.md)'
---

# Cross-repo surface

One question: *which of our games call Matchmaking?* It is answered from the
`surface` records already stored — one per repository per commit scanned — read
with `wiki_memory_list`, folded here, and phrased for the person who asked.

Two things about that shape are the whole design.

**There is no cross-repo object, and there is not going to be one.** Nothing
stores a map of the studio. The fold is **computed for this read and stored
nowhere**, so there is no saved summary to keep current, nothing to invalidate,
and no paragraph written by whoever asked last. If you find yourself wanting to
save the answer, that is the read you should have made instead. This is what
lets a studio-wide question be answered with no studio-wide thing to maintain.

**The counting happens here, and so does the honesty.** The store hands back
records; every narrowing, every exclusion and every refusal below is yours to
apply and yours to declare. A rollup gets its `over` block from the server
([history-rollup.md](history-rollup.md)); this read gets a page envelope and you
build the rest of the answer's footnote from it.

## Asking

```text
wiki_memory_list({ kind: "surface" })
```

Walk `next_cursor` until `over.complete` is true before concluding anything.

**`list` is the only tool that spends your studio read width.** `get`, `put` and
`append` are your own namespace whatever your grant reaches — so none of them can
see another project's records, and a `get` that misses says nothing about a
studio. There is no other call that answers this question, and no argument
anywhere that widens one of the other three.

`key_prefix: "<repo-name>@"` narrows the scan to one repository. That is the
right call for *what does this project call* and the wrong one here: it is the
narrowing that turns a studio-wide question into a single-repo one, and it lands
in the answer's footnote either way.

**One row per repository.** A project scanned at twenty commits has twenty
records, and folding all of them counts that project twenty times over twenty
different trees. Take that repository's most recently **stored** record — the
envelope's `updated_at`, the server's own write stamp — and say which commit the
row was taken at. Each capability appears at most once inside a record, so a
capability counted twice in one repository is a malformed record rather than a
real second call site.

## Reading the envelope

Every page carries an `over` block, and **it is not optional context**. Two
people in the same studio can ask this at the same instant and correctly get
different answers, because how far a grant reaches varies per person and neither
of them can see the other's.

| Field | What it changes about the answer |
|---|---|
| `complete` | `false` means records matching your filters were left out. Every count over that page is a floor. |
| `next_cursor` | Non-null **exactly when** `complete` is false. Two spellings of one fact; branch on either, and pass it back as `cursor` for the next page. |
| `width` / `scopes` | How far your identity may read, and the namespaces actually read. **A narrowing you did not choose.** |
| `limit` / `limit_source` | The page size. `limit_source: "default"` means the server supplied one because you passed none — **the second narrowing you did not choose**. |
| `key_prefix` | The repository narrowing, when you asked for one. |
| `projection` | `keys` drops `doc`; `full` is what a capability match needs. |

Three rules follow, and none of them is stylistic:

- **Never show a count without what it was taken over.** A number nobody can
  reproduce is worse than no number, because it will be repeated.
- **`complete: false` changes the sentence, not just a footnote.** Say "at least
  N of your projects call it", never "N".
- **Never compare two folds taken under different narrowings.** One taken across
  the studio and one taken inside a namespace are not the same measurement, and
  neither is one with a `key_prefix` against one without. Two aggregates taken
  under different narrowings are not comparable, and nothing may present them as
  though they were — including the same question asked by two colleagues, whose
  read widths differ.

## Whose records the answer is made of

**Another person's uncommitted work is excluded from the answer; your own is
kept.** A dirty-tree record (`+u<actor12>`,
[memory-contract.md](memory-contract.md) § Surface records) describes edits that
exist on one machine. Folding a colleague's into a studio-wide answer reports a
capability the committed code does not have, attributed to a project the asker
will go and look at.

You cannot decide that from the key, and you must not try: the fragment is a hash
of an actor id, so any caller can compute a colleague's, and the identity inside
the document is a label a client chose. Ask the store instead, which compares the
principal it stamped at write time:

```text
wiki_memory_list({ kind: "surface" })                        # A — everything
wiki_memory_list({ kind: "surface", exclude_self: true })    # B — everyone else's
```

Both walked to `over.complete`, both under the same narrowing. The keys in A and
not in B are yours. Keep every clean record, keep your own dirty records, drop
the dirty records in B. A key that turns up in B and not in A means a write
landed between the two reads — say the answer is a floor rather than pretending
the pair was atomic.

Where you are the only person whose scans the read reaches, B comes back empty,
every record reads as yours and the exclusion removes nothing. That is the right
answer, not a degraded one. With no memory server configured neither read
happens, so there is no fold to make and the question goes unanswered — never
answered from what one machine holds.

**Say what this is, and do not say more.** It is a rule about what the answer is
*composed from*. It is not a boundary on who may read what: `list` returned those
records to you, and it returns every stored record whose key your grant reaches,
your colleagues' dirty scans included. Nothing here — and nothing you say about
it — may imply that a stored record is readable only by the person who wrote it.
The true sentence is that a scan files under its author's name in the studio
scope, that nobody else's answer will be built out of it, and that anyone in the
studio whose grant covers it can still read the record. Say all three or say
none; the compressed version is a promise this store does not make.

A record written before the store stamped identities is nobody's own, so a dirty
one is in no answer at all. That is the fail-closed direction, not a bug to work
around.

## When the question is too coarse

The capability names come from records your studio's own runs wrote, so the
number of groups is bounded by your data rather than by anything here. **Past
200 groups the fold refuses: return an error naming the ceiling, and never a
truncated aggregate.** A group set missing members while the answer reads
complete is the completeness flag lying in a new way, and a question that lands
past the ceiling was too coarse to be useful — so the failure it deserves is a
bad answer rather than a slow one.

Say the ceiling, say what was asked, and offer the two narrowings that work:
name one capability, or name one repository. Do not report the part that fit.

This ceiling is this fold's own, applied here because the fold happens here. It
is not the memory server's, which refuses `wiki_memory_rollup` over a different
read at a number of its own; the two are separate reads and separate limits.

## Citing what the fold says

A `surface` record is a compiled artifact. It orients a run and points at
evidence, and it **can never satisfy a citation** — and neither can any answer
folded out of a pile of them. Cite what the record pointed at, opened and read on
its own.

So *"four of your projects call matchmaking — `{studio}-{game}` at
`Assets/Scripts/Match.cs:88`"* is the fold speaking, and it is fine as long as
the row's commit rides with it. *"…and that call needs a server-authoritative
session"* is a claim about AccelByte, and it needs the page, fetched and read.
*"`{studio}-{game}` still calls it today"* is a claim about a working tree that
nobody in this read has seen, and the record cannot support it: every row is a
true statement about the commit it names and about no other tree. This read
inspects no working copy, so a commit for the asker's own project arrives with
the question or not at all. Where one arrived and the row was taken at another,
the row describes a different tree: say so and name the commit it was taken at,
because a reader who knows an index exists will otherwise assume it described
what they have.

Each capability in a row names its call sites, so the hop from the fold to the
evidence is short: open the `{ path, line }` at that commit and read it. A
location that no longer holds a call is dropped, not carried.

## What never happens here

- **No fold is stored.** No cross-repo record, no cached group set, no saved
  phrasing. Every ask recomputes.
- **No count is invented from a sample.** Name the record keys behind a group in
  full or do not give a number — a claim of four projects that can name four
  keys is checkable, and one that names two is not.
- **No answer is composed from someone *else's* uncommitted work**, and the
  exclusion is per person rather than a blanket skip so that your own still
  counts for you.
- **No group is quietly dropped.** Past the ceiling the fold refuses and names
  it; the right response is to narrow the question and ask again.
- **No config edge is served as current.** An edge carries the instant it was
  read; render it in the past tense with that instant beside it, because a
  studio edits AccelByte configuration without touching a commit.

## When there is nothing

An empty result is the ordinary case, and it is **not a fault to report**. There
are several honest ways to get one: no memory server at all, a studio whose
projects have never been scanned, one project rather than several, or nobody
calling the capability that was asked about. Say which one it is — "nothing has
been scanned yet" and "nothing calls it" send the asker to different next steps —
and carry on with the run. Every other rule still works without it.

**A fifth belongs with them.** A project's `surface` record is written beside
the report by the scan that made it, so a project whose scans had nowhere to
file one — no memory server, or a dirty tree its owner declined to file — has no
record however often it was scanned. The fold answers *no* about that project
exactly as it does about one that never calls the capability, and those are
different answers: say a project has no stored index rather than that it does
not call the thing.
