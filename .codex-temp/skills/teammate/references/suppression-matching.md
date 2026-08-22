---
name: teammate-suppression-matching
description: How a stored suppression is loaded, validated and matched against a candidate
  finding — the envelope, the validate gate, and the four hash/id branches.
last-verified: 2026-08-13
see-also:
- '[memory-contract.md](memory-contract.md)'
- '[health-check.md](../subskills/health-check.md)'
- '[report/report-schema.md](report/report-schema.md)'
---

# Suppression matching

A suppression is a human decision that one specific finding should not be
reported again. This file is how one is loaded, checked and matched.

It has two callers, which is why it lives here rather than inside either of
them: the health check loads suppressions before it scans, on **both** the
rescan and the reuse path, and it writes a new one when a developer dismisses a
finding. Load and match are described once, so the two cannot drift into
disagreeing about what counts as a match.

## Load

`wiki_memory_list({ kind: "suppression" })` — so a finding a human already
dismissed is not re-litigated as new. Four things about what comes back
([memory-contract.md](memory-contract.md) § Suppression records):

- Each element is a **stored envelope**, not a suppression:
  `{ scope, kind, key, doc, updated_at }`. The record is under `doc`. **Unwrap it
  first.** Every field below — `repo`, `id`, `snippet_hash` — is `doc.repo`,
  `doc.id`, `doc.snippet_hash`, and reading them off the envelope gives
  `undefined` on every record rather than an error.
- It is **every** suppression your identity may read, from every repo. **Drop
  the records whose `doc.repo` is not this one before matching anything** —
  otherwise a dismissal granted in a sibling repo is applied to a finding here,
  silently. Narrowing the read itself with `key_prefix: "<repo-name>@"` is safe
  here and does the same job earlier; the `doc.repo` check still runs, because
  the key and the field are two sources and the field is the one that decides.
- **Walk `next_cursor` until `over.complete` is true.** A suppression list cut
  short by the server's default cap is indistinguishable from a shorter one, and
  both read as "no suppression matched" — which re-reports a finding a human
  already dismissed as though it were new. If the walk cannot be completed, treat
  suppressions as **unknown** for this run and say so, rather than as absent.
- Suppressions are not commit-pinned, so the list spans every commit, not just
  this one. That is deliberate: surviving later commits is the only reason to
  store one.

## Validate before matching

**Validate every surviving record before matching on it**, the same way a record
is validated before it is written. `validate` reads a file, so write each
unwrapped `doc` out first — one file per record, keyed by the envelope's `key` so
a rejection can be named back to its record:

```bash
cat > "$RUNDIR/loaded-suppression-<key>.json" <<'JSON'
{ ...the record's `doc` object, verbatim... }
JSON
npx tsx "$TOOL" validate --kind suppression "$RUNDIR/loaded-suppression-<key>.json"
```

Exit `0` accepts the record; `1` rejects it and prints why. Treat any other exit
(`2` usage, `3` I/O) as a bug in this procedure, not as a verdict on the record —
never read a failure to run the check as a check that passed.

The write path has always been gated. The read path is where it matters more:
memory outlives the run that wrote it, so a record that could not be written
today can still be sitting in the store from before the rules existed, and
honoring it silences a live finding on the authority of a record nothing checked.
**A record that fails `validate` is not a dismissal. Never match on it.** Say
which records were rejected and why, and ship the candidates they would have
covered — a suppression the user can see and re-grant is recoverable, one applied
in silence is not.

One rejection is worth naming, because it is the likeliest thing in an existing
store: **a record with no `actor` was not granted by a person.** It is a detector
self-suppression that some earlier run promoted into a durable record. Honoring
it lets one run's judgment silence every later run permanently, with nobody
having decided. That inverts the grounded-or-suppressed rule, which suppresses an
ungrounded finding **in that report only** and re-evaluates it next time — when
there may be a citation, a config-aware run, or a docs page that did not exist
before.

## Match

A candidate is suppressed when a **validated** record matches it. Matching
resolves the same way the Stage 6 diff resolves a stored finding, and **the hash
decides before the id does** — the id is a hash of the snippet the hash is taken
from, so where they disagree the id is the field that was written by hand:

- **Same `snippet_hash`, same `id`** → suppressed. The ordinary case.
- **Same `snippet_hash`, different `id`**, with the same `detector_id` and
  `path` → the same finding, whose stored `id` a previous run recorded wrong.
  Apply the suppression and **say** the match came from the snippet hash. This is
  the only branch that can fire honestly, because equal detector, path and
  snippet hash imply an equal id by construction — reaching it means an earlier
  run wrote an id it had not derived, or spelled the path differently.
- **Differing `snippet_hash`** → **not** the same finding, whatever else matches.
  The code under the dismissal changed. Ship the candidate.
- **Differing `snippet_hash` but the same `id`** → the stored record's own two
  fields contradict each other and cannot both be true. Trust the hash, ship the
  candidate, and tell the user this suppression carries an id and a hash that
  disagree, so they can re-grant it. Do **not** let the matching id suppress
  here: that is a dismissal applied on the strength of the one field that was not
  computed.

A record carrying no `snippet_hash` never reaches these branches — `validate`
requires the field, so it is rejected above and reported like any other invalid
record. Re-granting writes one with a hash, which resolves it once and for good.

**Never apply a suppression you could not match.** A dismissal is a human
decision about one specific finding; re-pointing it at a different one hides a
live finding under someone's name and gives them no way to know it happened.
