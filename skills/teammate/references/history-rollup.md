---
name: teammate-history-rollup
description: 'How to ask what a studio keeps getting wrong: the aggregate read, what
  its `over` block means, and why the same numbers get three different amounts of
  prose. Read before answering any question about a studio''s own history.'
last-verified: 2026-08-03
see-also:
- '[memory-contract.md](memory-contract.md)'
- '[cross-repo-surface.md](cross-repo-surface.md)'
- '[grounding-rules.md](grounding-rules.md)'
- '[nudge-protocol.md](nudge-protocol.md)'
---

# History rollup

One question: *what do we keep getting wrong?* It is answered from the reports
already stored, grouped by the memory server and phrased by you.

    wiki_memory_rollup({ topic: "detector_id" })

Two things about that call are the whole design.

**The counting happens over there; the sentence happens here.** The server
returns groups, counts and evidence keys — no prose, ever. Nothing is stored,
nothing is folded, and there is no cached paragraph written by whoever asked
last. You write the answer for the person in front of you and throw the wording
away.

**Three readers want the same numbers and three different amounts of prose.**
That is why the split falls where it does:

| Reader | When | How much prose |
|---|---|---|
| Orientation | every scan, before any detector runs | none — the counts inform what you look at, and the user sees nothing |
| A user's question | on demand | a real answer, with evidence they can follow |
| A colleague nudge | riding a response you were already giving | one sentence |

A stored paragraph would serve all three with one phrasing, chosen by whichever
session ran last — so two of them get prose written for somebody else, and the
reader who wanted no prose at all pays for a paragraph it discards.

## Asking

`topic` names a dimension the stored reports carry. Omit it and the grouping is
the site tuple — detector plus path — which answers *the same problem in the same
file, over and over*.

    wiki_memory_topics({})

Ask this first whenever you do not already know what the records hold. It
returns only the dimensions that **have data in your scope**, with a count each,
so it answers *what can I ask* without guessing. A dimension every record leaves
empty is not offered, because asking for it returns one empty group and nothing
else — `signal` is the usual one, since a run that discovered an obligation with
no stable name writes none rather than inventing one.

`key_prefix` narrows the scan to one repo — `key_prefix: "<repo-name>@"` — and
that is the right call whenever the question is about this repo rather than
about the studio. It narrows the work, never who is allowed to read what.

## Reading the answer

Every response carries an `over` block, and **it is not optional context**. Two
people in the same studio can ask the same question at the same instant and
correctly get different totals, because how far a grant reaches varies per
person and neither of them can see the other's.

| Field | What it changes about the number |
|---|---|
| `complete` | `false` means records were left out. The number is a floor. |
| `unreadable` | how many records could not be opened, and so are missing from every count |
| `reports` | how many were read, including the ones excluded below |
| `excluded_dirty` | how many were other people's uncommitted work, and so are not in any count |
| `scopes` / `width` | which namespaces the number covers |
| `key_prefix` | the narrowing you asked for |
| `excluded_others_dirty` | always true — the per-person rule ran, whether or not it removed anything |

`reports` and `excluded_dirty` are what tell an empty history from one that is
simply not yours to see. Zero groups with `reports: 0` means nothing has been
scanned; zero groups with `reports: 4, excluded_dirty: 4` means four scans exist
and every one of them describes somebody else's uncommitted edits. Say the
second as *"nothing I can show you"*, never as *"nothing scanned"* — they send
the user to different next steps.

Three rules follow, and none of them is stylistic:

- **Never show a count without what it was taken over.** A number nobody can
  reproduce is worse than no number, because it will be repeated.
- **Never compare two rollups taken under different narrowings.** One taken with
  a `key_prefix` and one without are not the same measurement, and neither is a
  studio-wide one against a namespace-wide one.
- **`complete: false` changes the sentence, not just a footnote.** Say "at least
  N", not "N".

## Citing what a rollup says

A rollup is a compiled artifact. It orients a run and points at evidence, and it
**can never satisfy a citation** — cite what it pointed at, read on its own.

`evidence` is a complete list of the report keys behind a count, not a sample.
That is what makes the count auditable: a claim of fourteen findings that names
fourteen keys can be checked, and one that names five cannot. Use those keys to
`wiki_memory_get` the report a claim rests on and cite what the report cites.

So: *"auth-token-safety in `Assets/Scripts/Auth.cs`, six times across four
repos"* is a rollup speaking, and it is fine. *"…and the docs say client-written
stats need server authority"* is a claim about AccelByte, and it needs the page,
fetched and read.

## Suppressions, and what the numbers already account for

`suppressed` counts the findings in a group that a human has already dismissed.
It is a filter, not a retraction: a dismissal landing today changes tomorrow's
read, and nothing is walked back, because there was no earlier answer to
correct.

Read it as the group's own footnote — *"nine, two of which your team has
already decided are fine"* — never as a reason to hide the group.

## What never happens here

- **No rollup is stored.** If you find yourself wanting to save the summary,
  that is the read you should have made instead.
- **No count is invented from a sample.** The counts come back with their
  evidence; do not recompute one from a subset you happened to fetch.
- **No answer is composed from someone *else's* uncommitted work.** Your own
  counts for you — a dirty scan is filed under its author's name so it can,
  which is the whole reason the exclusion is per person rather than a blanket
  skip. Everyone else's is gone before you see it: that part is the server's,
  it has already happened, you do not need to filter for it, and you cannot
  undo it.
- **No group is quietly dropped.** If a question is too coarse the read fails
  with the ceiling named, and the right response is to narrow it and ask again,
  not to report the part that fit.

## When there is nothing

An empty result is the ordinary case on a new studio, and on any install with no
memory server at all. Say the history is empty and carry on with the run — it is
not a fault to report, and every other rule still works without it.
