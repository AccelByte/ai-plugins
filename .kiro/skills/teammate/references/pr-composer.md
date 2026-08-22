---
last-verified: 2026-07-28
sources:
- https://cli.github.com/
- https://github.com/cli/cli
see-also:
- '[health-check.md](../subskills/health-check.md)'
- '[report-schema.md](report/report-schema.md)'
- '[grounding-rules.md](grounding-rules.md)'
- '[memory-contract.md](memory-contract.md)'
- '[accelbyte git.md](../../accelbyte/references/git.md)'
- '[ags debug.md](../../ags/subskills/debug.md)'
- '[ags-extend upgrade.md](../../ags-extend/subskills/upgrade.md)'
---

# Composing the one-fix PR

How a scan turns **one** finding into **one** pull request on **one** fresh
branch, with **one** approval interaction and nothing else touched.

This file owns the procedure. Which finding is worth fixing is the scan's
judgement; whether the fix is correct is yours; whether it ships is the
developer's. What is not anyone's judgement is the branch name, the PR title,
the PR body, and the answer to *did anything else change* — those come from
`report_tool.ts` (`pr-plan`, `pr-guard`), for the same reason fingerprints do.
A PR body is world-readable on a public repo and outlives the branch it
describes. It travels further than an exported Report ever does, so it is
assembled from validated fields and redacted rather than written out and checked
afterwards.

## What has to be true before you start

Each of these is a **stop**, not a warning. Say which one stopped you and what
the developer can do about it, then finish the run without the PR.

- **A report that validates.** `pr-plan` validates it first and refuses *every*
  finding in an invalid one, before it looks at the finding you named — so a
  refusal here is about the report, not about your choice.
- **A finding the report actually asserts.** Shipped, not suppressed; with a
  `location.path`; with at least one citation. `pr-plan` refuses the rest, and
  the suppressed case is the one that matters: suppression means the scan
  declined to make the claim, so a PR "fixing" it ships the claim anyway,
  through a door that skips grounding entirely.
- **A clean worktree.** `git status --porcelain` is empty. A tree with edits
  already in it makes the fix diff unreviewable — the same reason
  `ags-extend/subskills/upgrade.md` requires it before a version bump — and it
  is how someone's unfinished work ends up in a PR opened in their name.
- **A normal HEAD.** On a branch, not detached, and no merge, rebase, cherry-pick
  or bisect in progress. Creating a branch out of one of those states loses work
  that is not committed anywhere.
- **A remote to push to.** `git remote -v` names one. Without it the PR has
  nowhere to go and the ladder below degrades to propose-only.
- **The scanned commit is still HEAD.** If the tree moved since Stage 1 pinned
  it, the finding may no longer be there. Re-pin and rescan, or stop.

## Can this machine open a PR at all?

The capability gate, in order. It answers *may I* by finding out, never by
assuming — and a run without credentials is the ordinary case on a cloud or
headless host, not an error.

1. **Is there a remote?** `git remote -v`. No → propose-only.
2. **Can we authenticate to it?** For GitHub, `gh auth status`. For every other
   host, whether push credentials resolve at all. Do not walk the install-and-
   authenticate ladder here — [`git.md`](../../accelbyte/references/git.md) owns
   it, including the `gh auth login` step that also configures git itself. Point
   the developer at it and stop; a scan is not the place to start an interactive
   login.
3. **Authenticated → push + PR.** **Not authenticated → propose-only.**

**Propose-only** means: show the change you would make, as a diff, in the
response. Do not write it to disk, do not create a branch, do not commit. Name
the finding as the run's *Next step* and say plainly that no credentials were
found, so the fix was described rather than opened. A run that cannot finish the
job leaves the project exactly as it found it.

## The sequence

Create the branch **before** editing. The developer's branch never carries this
change, not even briefly — if they decline, there is nothing to unwind on it.

```bash
START_BRANCH=$(git rev-parse --abbrev-ref HEAD)   # to return to, whatever happens
PLAN=$(npx tsx "$TOOL" pr-plan --finding "$ID" --at-commit "$COMMIT" "$RUNDIR/report.json")
read_plan() { printf '%s' "$PLAN" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).$1"; }

BRANCH=$(read_plan branch)
FIXPATH=$(read_plan path)
TITLE=$(read_plan title)                          # the commit subject *and* the PR title
BODYFILE="$RUNDIR/pr-body.md"
read_plan body > "$BODYFILE"

git checkout -b "$BRANCH"      # fails loudly if the branch exists — see below
```

Then edit **that one file**, and prove it:

```bash
git status --porcelain -b | npx tsx "$TOOL" pr-guard --expect "$FIXPATH" --expect-branch "$BRANCH"
```

`pr-guard` is the mechanical form of *no writes outside the PR branch*, and it
checks both halves of that sentence from the one read. It fails when anything
undeclared changed, when nothing changed at all, and when it cannot parse the
tree — including a path git quoted, which it refuses to decode rather than risk
matching an allowed path approximately.

`-b` is what makes the branch half checkable. It puts a `## <branch>` header at
the top of the same output the paths come from, so the branch is git's answer
rather than the run's: skipping `git checkout -b` and editing straight on the
developer's branch leaves the paths byte-identical, and this is the only thing
that catches it. `--expect-branch` fails on a branch that is not `$BRANCH`, on a
detached HEAD, and — this is the point — on output with no header in it, because
a check that could not be made is not a check that passed. A failure here is a
stop: go back to the starting branch and report what else was in the tree.

**Then ask — once.** Show the diff, the branch name, and the PR title, and put
one question with two answers: *Open the PR* / *Don't*. This is the single
approval interaction the whole stage is allowed. Do not ask again after the
push, do not ask about the branch name separately, and do not ask whether to
apply the edit and then whether to push — that is two interactions wearing one
name.

On **yes**:

```bash
git add "$FIXPATH"     # never `-A`, never `.`
git commit -m "$TITLE"
git push -u origin "$BRANCH"
gh pr create --base "$START_BRANCH" --head "$BRANCH" --title "$TITLE" --body-file "$BODYFILE"
git checkout "$START_BRANCH"
```

`$TITLE` is one string used twice, and it is `pr-plan`'s, not yours. The commit
subject and the PR title must be the same words: they are read side by side in
every git host's UI, and a reader who sees two different sentences has no way to
tell which one describes the commit. `pr-plan` bounds it to a length a commit
subject can carry, so there is no case where it is too long to reuse — if it
reads as truncated, the full sentence is the first line of the body. Composing
your own because the generated one felt wrong is the failure this whole file
exists to prevent; it is the same instinct as writing a fingerprint by hand.

On **no**:

```bash
git checkout "$START_BRANCH"
git branch -D "$BRANCH"
```

Either way the developer ends on the branch they started on. Say where the PR
is, or say that nothing was opened and the branch is gone.

## Never

- **Never `git add -A` or `git add .`.** Add the declared path and nothing else.
  This is the rule `pr-guard` exists to make checkable rather than remembered.
- **Never edit or push on the branch you started on**, and never on `main` /
  `master` / the remote's default. The PR targets that branch; it does not write
  to it. `--expect-branch` makes this one checkable too — it is the reason the
  status read carries `-b`.
- **Never force-push.** Nothing this stage does needs it, so a run reaching for
  it has lost track of what it is on.
- **Never `git commit --amend`, `reset --hard`, `clean`, or `stash`.** All four
  destroy work that is not this run's to destroy. The stash in particular is
  shared with every other worktree of the repo.
- **Never merge the PR, approve it, or mark it ready when it was opened as a
  draft.** Present and stop.
- **Never open a second PR in one run**, and never bundle a second finding into
  the first. One fix is the contract; two is a review nobody asked for.
- **Never write your own commit subject or PR title.** Both are `$TITLE` from
  `pr-plan`, unedited and identical to each other, for the same reason the branch
  name is derived: it is a string that reaches a git host and outlives the run.
- **Never reuse a branch that already exists.** `git checkout -b` failing means a
  PR for this finding was probably opened already — the branch name is derived
  from the finding id precisely so the collision is loud. Look for the existing
  PR and point at it instead of opening a duplicate.

## What the run records

Log every git and `gh` invocation through the access log
(`report_tool.ts log --kind git`) as it happens, so the trail is mechanical
rather than recalled — into the run directory, which is the only place this stage
writes. **This stage does not touch memory.** The scan writes memory once, after
this stage returns, under *Recording the run*
([health-check.md](../subskills/health-check.md)): one access-log envelope and
one activity entry, both naming the outcome this stage produced.

That outcome is `opened-pr` **only when a PR was actually opened**
([memory-contract.md](memory-contract.md)) — and only then. A run that proposed a
fix without opening one did not open a PR, and the feed goes to colleagues who
cannot see the difference unless the entry states it. A stage that wrote its own
entry here would be the second one for the run, and the feed shows two rows as
two pieces of work, not as a correction.
