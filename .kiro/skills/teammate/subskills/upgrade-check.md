---
name: teammate-upgrade-check
description: Use when the user is about to move the AccelByte Unity or Unreal SDK
  to a newer version and wants to know what it breaks — diffs the symbols their code
  actually calls between the version they have and the one they are moving to, and
  reports each break at file:line.
allowed-tools: Read Glob Grep Bash ToolSearch TaskCreate TaskUpdate AskUserQuestion
model: sonnet
last-verified: 2026-08-15
sources:
- https://docs.accelbyte.io/gaming-services/getting-started/setup-game-sdk/unreal-sdk/
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin
see-also:
- '[sdk-symbol-diff.md](../references/sdk-symbol-diff.md)'
- '[grounding-rules.md](../references/grounding-rules.md)'
- '[memory-contract.md](../references/memory-contract.md)'
- '[deprecated-apis.md](../references/detectors/deprecated-apis.md)'
- '[health-check.md](health-check.md)'
---

# Upgrade check

Answers one question: moving the engine SDK from the version your project has to
a newer one, what breaks?

The answer is a list of your own call sites, each at `file:line`, each classed
against the table in [sdk-symbol-diff.md](../references/sdk-symbol-diff.md), each
cited to the SDK source at both versions. This subskill does not upgrade
anything, does not edit your project, and does not open a pull request — it
reads.

**Unity and Unreal both, and they are not the same run.** Unity pins a ref in a
package manifest and marks deprecations with one compiler attribute. Unreal pins
nothing — the SDK is a copy inside the project — and marks deprecations four
ways, of which only one reaches the compiler and one more only reaches the log at
run time. The stages below split where that matters and say which engine each
branch is for. Read the whole of a stage before deciding it does not apply.

Read [sdk-symbol-diff.md](../references/sdk-symbol-diff.md) before Stage 3. It
holds which channel settles a break and why the others cannot, and the run's
classifications come from it rather than from this file.

## Behavior Constraints

<grounding_rules>

- A break is a claim about source, so it is cited to source: the declaring file
  at an immutable ref with a line anchor, never a branch and never a raw-file
  URL ([grounding-rules.md](../references/grounding-rules.md)).
- **Grounded or it does not ship.** A call site you cannot resolve to a
  declaration at the current version is not a break — it is unresolved, and it
  belongs in the coverage note, not in the break list.
- Confirm each citation resolves and states what you quote it for. A
  source-hosting page does not always serve a whole file to an automated read;
  when a quote cannot be confirmed, cite the release-notes page instead and
  point at the file without quoting it.
- Never convert a deadline written in a marker — an attribute message or a doc
  comment — into a claim about the target version. Quote the deadline; let
  presence at the target ref decide.
- On Unreal the current version is **self-reported by a copy of the plugin that
  sits in the project and can be edited**, not read off a pin. Say so wherever
  you state it, and never present it as a ref the way Unity's manifest entry is.
- On Unreal, which marker is present decides the class. A **compiler attribute**
  (`[[deprecated]]`) is a `warns` — the build will raise it. A **doc comment with
  no attribute** is a `notice` — the build will not raise it, which is the point
  of the row. Check the declaration for the attribute; never infer it is absent
  from the SDK's habits, and never report a notice as a warning.
- A `notice` promises silence **at build time and nothing more**. 51
  implementations at 28.9.0 also call `FReport::LogDeprecated`, which warns at
  run time. Check the implementation before writing that nothing will mention
  this, and where that call is there, say the log carries it.

</grounding_rules>

<tool_usage_rules>

- `Read` and `Grep` over the user's project; `Glob` to find the Unity manifest,
  or the `.uproject` and the plugin folder on Unreal.
- `Bash` for three read-only jobs: resolving the SDK's tag list; fetching SDK
  source — both versions on Unity, the target alone on Unreal, where the current
  side is read out of the project; and reading the project's own repository
  name, commit and tree state at Stage 2, which is what a stored index is keyed
  by and what decides whether one describes the tree in front of you. Fetch each version once: an archive of a tag is a single
  request and a few hundred kilobytes, where one request per file is hundreds of
  requests for the same bytes.
- No credentials are used or needed. The SDK repository is public, and this run
  makes no call to a game namespace.
- The Stage 2 lookup and the append at the end are memory-tool calls, not `Bash`.
  Both are conditional on those tools answering and fail silently when they do
  not, which is the common case
  ([memory-contract.md](../references/memory-contract.md)).

</tool_usage_rules>

<action_safety>

- Read-only, throughout. Do not edit the manifest, do not change the pinned ref,
  do not touch the vendored plugin folder, do not run the package manager, and do
  not open a branch or a pull request.
- The user asked what an upgrade would break, which is not permission to perform
  one. If they want the bump made, say that this subskill does not make it.
- Fetch only the SDK repository the project points at — the one the Unity
  manifest names, or the one the Unreal plugin folder came from. A project
  pointing somewhere unexpected is something to report, not something to fetch.

</action_safety>

<user_updates_spec>

Seed the progress list at Stage 1, one entry per stage:

```text
1. Settle the two versions
2. Map the call sites
3. Resolve each call site at the current version
4. Look each symbol up at the target version
5. Report the breaks
```

When the target version is not given, ask for it with the question tool, and
offer the newest tag as one option. Do not guess a target and do not silently
pick the newest — an upgrade to a version the user did not name is a different
question from the one they asked.

</user_updates_spec>

<output_contract>

Lead with the count and the two versions, then the table, then the note:

```text
Upgrade check: <current> → <target>
<N> break(s), <W> warning(s), <I> notice(s) across <M> call site(s).
<S> signature change(s). <K> call site(s) unresolved.

| Call site | Symbol | Class | What to do |
|---|---|---|---|
| Assets/Scripts/Login.cs:42 | User.ForcedLinkOtherPlatform | warns | Replacement stated in the attribute message: ForcePlatformLinkV3 |
| Source/Game/Hud.cpp:88 | UAccelByteBlueprintsCredentials::GetUserDisplayName | breaks | The Blueprint library class is gone; the accessor stays on Credentials |
| Source/Game/Profile.cpp:20 | User::ForcedLinkOtherPlatform(…, FOAuthErrorHandler) | notice | Doc comment names ForcePlatformLinkV3. Your build will not raise this, and neither will the log |
```

- The class names are **breaks**, **warns**, **notice**, **signature changed**,
  **pre-existing** and **unresolved**. Take them from the table in
  [sdk-symbol-diff.md](../references/sdk-symbol-diff.md) and use no other
  vocabulary for a row's class — ordinary plurals in the prose around it
  ("2 warnings", "3 notices") are fine. `warns` and `notice` both occur on both
  engines' terms: `warns` is a compiler attribute at the target, `notice` is a
  deprecation in prose with no attribute, and the difference is whether the
  developer's build will say it.
- A call site already calling an obsolete or already-deprecated symbol before
  the bump is `pre-existing`: mentioned once underneath, not listed as an upgrade
  break — the bump did not cause it.
- **A `signature changed` row is shown, not judged.** Name what moved — a return
  type, a parameter, `const`ness — and leave whether it breaks to the call site.
  This run compiled nothing, so it cannot settle that.
- On Unreal, the header line says where the current version was read: the
  `.uplugin`, `version.json`, the folder name, or a git ref. The first three are
  self-reported by a copy that can be edited, and only a git ref is a pin.
- Every row carries its citations. Where both versions matter, cite both.
- Close with coverage: how many call sites were resolved, how many were not, and
  why. A run that resolved most of them and says nothing reads as a clean bill.
- **Say where the call-site map came from** — derived in this run, or located
  from a stored index at this commit. Where a stored index existed and the run
  derived anyway, name the commit it sat at and say it was not used: a reader who
  knows one is there will otherwise assume it was.
- **Zero breaks is a real answer, and it is not the same as nothing to do.** Say
  it plainly, then say the warnings and notices, then the coverage. A header that
  counts only breaks buries the class the developer's build will never raise.

</output_contract>

<completeness_contract>

A run is complete when:
- Both versions are named in the output **with where each came from** — on Unity
  the manifest's ref, on Unreal the plugin folder and which of its version
  strings was read — and the target confirmed against the SDK's tag list.
- Every call site in the map is in exactly one bucket: breaks, warns, notice,
  signature changed, pre-existing, or unresolved. A call site in none of them was
  dropped silently.
- Every live row carries at least one citation a reader can open.
- The coverage note states the unresolved count, and names why they are
  unresolved rather than only counting them.
- On Unreal, the coverage note also says the Blueprint graphs were not read.
- The coverage note says where the call-site map came from, and names the commit
  of any stored index the run found and did not use.
- Exactly one `activity` entry was appended, or the run says memory was absent.

This run flushes **no access log**. That envelope is the audit trail for live
namespace reads and is keyed to a scan's mode; this run makes no live call and
has no such mode, so there is nothing to flush and the absence is not an
omission.

</completeness_contract>

<empty_result_recovery>

- **No SDK entry in the manifest, and no AccelByte plugin folder.** Say where you
  looked — both places — and stop. There is no version to move from.
- **The pinned ref is a branch, not a version** (Unity). There is no fixed
  current surface, so there is no diff to take. Say that, name the ref, and stop
  — do not substitute the newest tag for the branch.
- **The plugin folder states no version at all** (Unreal): no `VersionName`, no
  `version.json`, and a folder somebody renamed. Nothing there is a pin, so ask
  which release they are on rather than inferring one from the files present.
- **The Unreal version strings disagree, or only some of them are there.** Report
  what each of the three said — including "absent" — and ask which is right rather
  than picking one. This is not a reason to stop: Stage 3 diffs against the plugin
  folder itself, so a wrong string mislabels the header and the target comparison,
  not the rows. Two agreeing and one absent is the ordinary case and needs no
  question, only a statement of which two were read.
- **The current version is already the newest tag.** Say so; there is no upgrade
  to check. Offer the health check instead.
- **No call sites found.** Nothing in the project calls this SDK, so no upgrade
  can break it. Say that rather than reporting zero breaks as a clean result.

</empty_result_recovery>

## Workflow

### Stage 1 — Settle the two versions

**Seed the progress list first**, one entry per stage, titled as
`<user_updates_spec>` gives them — before deciding the engine and before reading
any pin. A run that reaches the manifest with no list has already skipped a step.

**Which engine, first.** A Unity project has `Packages/manifest.json` and an
`Assets/` tree; an Unreal project has a `*.uproject` at its root and a `Plugins/`
folder beside it. Decide from those, not from the language of the call sites — an
Unreal project can carry C# tooling and a Unity project can carry native code.

**Unity — read the pin.** Find `Packages/manifest.json` and read the SDK entry
**by its git URL**, not by its package key. The key differs between projects; the
URL is what identifies the dependency.

The ref is the fragment after `#`. Classify it before going on:

- a tag that appears in the SDK repository's tag list → the current version;
- a branch name → stop, per `<empty_result_recovery>`;
- a tag that does not appear in the tag list → stop and say so, because
  something else has to be true that you have not established.

**Unreal — there is no pin, so read the copy.** The install route is to download
a release, extract it, and copy the folder into `Plugins/`, so the `.uproject`
entry names the module and carries no version at all:
`{ "Name": "AccelByteUe4Sdk", "Enabled": true }`. Find the plugin folder under
`Plugins/` and read all three of these:

| Where | What to read |
|---|---|
| `AccelByteUe4Sdk.uplugin` | `VersionName` |
| `version.json` | `version` |
| the folder name | the `X.X.X` in `accelbyte-unreal-sdk-plugin-X.X.X` |

If that folder is a git checkout or a submodule, its ref is a real pin and
outranks all three — use it, and say that is what you used. Otherwise take the
version they agree on and **state that it is self-reported**: the copy is
writable, so a project that patched a file still reports the release it was
extracted from. Where they disagree, report all of them and ask, per
`<empty_result_recovery>` — do not stop, because Stage 3 reads the folder itself
and a wrong string mislabels the header without changing a single row.

Do not read `EngineVersion` out of the `.uplugin` as the supported engine range.
The key is **absent** at 24.0.0, 26.0.0, 27.0.0, 28.0.0 and 28.5.0, and reads
`"4.27"` at 28.6.0 and 28.9.0 — the only two tags it was checked present at, three
months apart — while the install page's prerequisite is Unreal Engine 4.27 or
Unreal Engine 5 up to 5.6.

**Both engines — settle the target.** If the user named one, confirm it is in the
tag list. If they did not, ask. Take the tag list from the repository; never
build a ref out of a changelog heading, which names versions that were never
tagged.

### Stage 2 — Map the call sites

What this run needs is which SDK symbols the project calls, and where, at
`file:line` precision. A stored health check already holds that map for the
commit it ran on — the Report's `surface` field, one entry per AGS capability,
each carrying at least one `{ path, line }`
([report-schema.md](../references/report/report-schema.md) § Integration
surface). Where one was stored for the commit you are on, it says where to look
and saves the sweep. It never saves the reading, and nothing here rests on it.

**Read the three values that decide this, here.** Nothing earlier in the run has
them, and each is one read-only command: the repository is
`basename "$(git rev-parse --show-toplevel)"`, the commit is
`git rev-parse HEAD`, and the tree is clean when `git status --porcelain` prints
nothing. Take all three before matching a key, because a key names the
repository, the commit and the mode, and every rule below turns on them. Read
the repository from the toplevel rather than from the directory you happen to be
in: a run started in a subdirectory that names it from the working directory
composes a name no stored key uses, and matches nothing while looking exactly
like a project nobody has scanned. Where the project is not a checkout, or any of
the three commands fails, no key can be matched at all — this stage derives the
map and the coverage note says which read was missing rather than naming a
commit nobody established.

**A stored index is used only at its own commit.** It is an index into one
commit and is never rewritten, so a record naming an earlier commit stays a true
statement about *that* commit and says nothing about the tree in front of you.
There is no forward-porting and nothing reconciles. `HEAD` anywhere other than
the commit the record names, or uncommitted edits under you, means this stage
**derives the map itself** — and the coverage note says a stored index was found,
which commit it sat at, and that it was not used. A record keyed to one person's
uncommitted edits is never taken at all: it describes a tree that exists on one
machine ([memory-contract.md](../references/memory-contract.md) § Report keys).

**Finding one.** List the keys, then read the one that matches:

```text
wiki_memory_list({ kind: "report", projection: "keys" })
wiki_memory_get({ kind: "report", key: "<the matching key>" })
```

`projection: "keys"` is what makes this cheap: a report key names the repository,
the commit and the mode, which is the whole of what decides this. Walk
`next_cursor` until `over.complete` is true before concluding anything from the
page — a page that stopped at the server's cap is a floor, and "no index stored"
and "the index did not fit" are the same silence otherwise. Take the clean-tree
key for this repository at this commit; take neither shape of dirty key, and take
no other commit. The mode does not decide it — `surface` is a static read that
both modes carry, and only its per-capability `config` edges belong to a live
one. Those describe a namespace as it answered at the instant beside them, and
this run reads none.

**Absent is the ordinary case.** No memory tools, no stored report for this
repository, or none at this commit — a first run on a project has none of them,
and none of it is a fault to report. Derive the map and carry on.

**Deriving it.** Grep the project sources for the SDK's namespace and for the API
surface it exposes, at `file:line` precision.

**Read every call site either way.** A `surface` entry names a capability and a
location and no receiver at all; Stage 3 needs the **receiver** — the type or
accessor the call is made on — and a bare method name is not enough to resolve a
declaration. So a stored index points and this run reads: open each
`{ path, line }` it names, take the symbol and the receiver off the line itself,
and grep for whatever the entries do not name. A location that no longer holds a
call is dropped, not carried.

**Nothing in the output cites the index.** A row's call site cites the file this
run opened; a break cites the SDK source at both versions. A stored index may
orient a run and point at evidence, and can never be what an answer rests on —
so a re-derive always outranks it, and where the two disagree the code is right
(ADR-0010, ADR-0024).

**What a stored index did not read travels with it.** Its `not_read` names each
call surface that scan could not reach, one line each. Those bound this run's map
exactly as they bounded that one, so they belong in this run's coverage note
rather than being dropped on the way across.

**Unreal has two call surfaces, and a text scan reaches one.** C++ call sites
grep normally. Blueprint call sites live in `.uasset` and `.umap` files, which
are binary — nothing in this run reads them. That matters more than it sounds:
at 28.9.0 the SDK exposes 480 `BlueprintCallable` declarations across 40 headers
under `Public/Blueprints/` (`grep -ro BlueprintCallable … | wc -l` and
`grep -rl … | wc -l`), so a project whose gameplay was built by designers can have
most of its calls in graphs this run cannot see.

So on Unreal the coverage note carries one extra line: the Blueprint graphs were
not read, and how many `.uasset` files the project holds. "3 breaks" over a
Blueprint-heavy project answers a much smaller question than its reader will
take it for. And where a removed symbol turns out to be a
`UFUNCTION(BlueprintCallable)` — the declaration Stage 3 finds will say — state
that Blueprint callers of it break too and were not searched.

### Stage 3 — Resolve each call site at the current version

**On Unreal the current source is already in the project.** The plugin folder
under `Plugins/` *is* what the project compiles against, so read it rather than
fetching the tag it claims to be. That is better evidence than the tag on two
counts: it is what the compiler sees, and it holds whether or not the version
string is accurate or the copy has been edited. Fetch the tag only when the
folder cannot be read, and say which one you used.

On Unity, fetch the SDK source at the current ref, once.

Either way, for each call site find the declaration it resolves to: the file,
the type, **and the signature**. On Unreal that last one is load-bearing rather
than pedantic — `SendStartMatchmaking` is five overloads in a single header, and
`AccelByteCredentials.h` declares the same accessor on both the C++ class and
the `UBlueprintFunctionLibrary` that exposes it to Blueprint. "The declaration in
this file with this name" is not one declaration there.

A call site that resolves to no declaration at the current version is
**unresolved** — one bucket, whatever the cause. That is a gap in the run, not a
finding, and it is never reported as a break. Name the cause in the coverage note:
the symbol belongs to another package, the call goes through a wrapper this run
did not follow, or the receiver could not be determined.

### Stage 4 — Look each symbol up at the target version

Fetch the SDK source at the target ref, once. For each resolved call site, look
for the same symbol **in the declaring file, type and signature Stage 3 found** —
never by name across the whole tree. A name can survive a version bump while the
symbol the call site used does not, and a bare-name search reports that as no
break. On Unreal a whole class can go while its file and its method names stay,
so the type is what carries the answer, not the file.

Classify with the table in
[sdk-symbol-diff.md](../references/sdk-symbol-diff.md), and read the marker before
you name the class:

- absent at the target → **breaks**;
- newly carrying a **compiler attribute** — `[Obsolete]` on Unity,
  `[[deprecated]]` on Unreal → **warns**, because the developer's build will say
  it too;
- newly deprecated **in prose with no attribute** — an Unreal doc comment →
  **notice**, because the build will not say it;
- deprecated the same way at both versions → **pre-existing**;
- still declared with a different signature → **signature changed**.

The Unreal attribute is rare — one symbol in the whole SDK at 28.9.0, and none at
all before 28.6.0 — which is exactly why it has to be checked for rather than
assumed away. Grep the declaration you resolved to; do not reason from how the
SDK usually behaves. Then grep its implementation for `FReport::LogDeprecated`:
51 implementations call it at 28.9.0, and a `notice` row saying the developer will
hear nothing is wrong wherever that call is present.

For a warning or a notice, read what the SDK author wrote. If it names a
replacement, that is the fix direction and it is quotable. If it carries no
replacement — common in the Unreal comments, which often say only that the method
will be removed at some point — say the replacement is not stated, and do not
infer one from a similar name.

Where a release note announces the change, cite it alongside the source: it
carries the removal version and the migration route in the vendor's own words.
Cite it in addition, never instead — a release note describes an intention, and
the source is what shipped.

### Stage 5 — Report the breaks

Emit the table per `<output_contract>`. Order it worst-first: breaks, then
warnings, then notices, then signature changes, and within each the files with
the most call sites first.

If the user asks what to do next, the fix direction per row is what you have;
making the change is their call, and this subskill does not make it.

### Recording the run

Append one activity entry so a colleague's session can see this ran:

```text
wiki_memory_append({ kind: "activity", entry: { … } })
```

with `persona: "dev"`, `subskill: "upgrade-check"`, `action:
"ran-upgrade-check"`, and `namespace: "unknown"` — this run reads no namespace,
and that is the pinned value for one that does not
([report-schema.md](../references/report/report-schema.md) § Activity entry).
Put the two versions and the break count in `summary`.

When memory is absent, skip the append silently and say so once in the output.
It is a degraded surface, not a failed run
([memory-contract.md](../references/memory-contract.md)).

## Error Handling

- **The SDK source cannot be fetched.** Say so and stop. A partial fetch is
  worse than none: a symbol missing because the fetch was short is
  indistinguishable from one that was removed, and reporting it as a break is
  the fabrication this whole subskill is arranged to avoid.
- **The tag list cannot be read.** Neither version can be confirmed. Stop rather
  than trusting the project's own string on its own.
- **The Unreal plugin folder is there but cannot be read.** Fall back to the tag
  the version string names, and say in the output that the current side came from
  the tag rather than from the code in the project — which makes it only as good
  as a version string nothing verified.
- **A citation will not confirm.** Fall back to the release-notes page for that
  row; if nothing confirms, the row does not ship, and the coverage note says
  one was dropped and why.
