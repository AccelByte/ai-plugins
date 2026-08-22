---
name: teammate-sdk-symbol-diff
description: How an engine SDK version bump is checked against a project's own call
  sites — which channel settles whether a symbol survives, and which others only orient,
  on Unity and on Unreal.
last-verified: 2026-08-07
sources:
- https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/
- https://docs.accelbyte.io/gaming-services/knowledge-base/release-notes/older-release-notes/ags-3.78.0/
- https://github.com/AccelByte/accelbyte-unity-sdk
- https://github.com/AccelByte/accelbyte-unreal-sdk-plugin
- https://docs.accelbyte.io/gaming-services/getting-started/setup-game-sdk/unreal-sdk/
see-also:
- '[upgrade-check.md](../subskills/upgrade-check.md)'
- '[grounding-rules.md](grounding-rules.md)'
- '[deprecated-apis.md](detectors/deprecated-apis.md)'
---

# SDK symbol diff

One question: moving the engine SDK from the version your project has to a newer
one, which of your call sites stop compiling, which start warning, and which are
deprecated with nothing at build time to tell you?

**Two engines, and they are not the same problem.** Unity pins a ref in a package
manifest and marks deprecations with one compiler attribute. Unreal pins nothing —
the SDK is a copy of a plugin sitting inside the project — and it marks
deprecations four different ways, only one of which a compiler reads. The spine
below holds for both engines. The Unreal sections say what changes on top of it.

Only the first channel below answers the first of those questions — whether a
call site still compiles. The annotation channels decide the other two, which is a
real job and a narrower one: between them they say whether anything will tell the
developer, and when. The last two only orient.

| Channel | What it is | What it settles |
|---|---|---|
| The symbol at both versions | the SDK's own source, at each of the two | **whether the declaration is still there** — the necessary condition, both engines. Not always the sufficient one; see the signature case below |
| `[Obsolete]` at the target | a C# attribute on the declaration | **Unity**: why, usually the replacement, and that the build will warn |
| `[[deprecated]]` at the target | the C++ attribute, one occurrence in this SDK | **Unreal**: the same, and the same build warning |
| A deprecation in a doc comment | prose on or above the declaration, several spellings | **Unreal**: why. Never whether, and never that the build will say anything |
| `FReport::LogDeprecated` in the `.cpp` | a `UE_LOG(…, Warning, …)` in the implementation | **Unreal**: that the developer's log says it at **run time**, even where the header is silent |
| `Deprecated*` `UFUNCTION`/`UPROPERTY` meta | Unreal Header Tool metadata | **Unreal**: that a **Blueprint** caller gets a build warning; a C++ caller gets nothing |
| `CHANGELOG.md` | the release's own prose summary | orientation only |
| AGS release notes | the announcement, with a removal version | orientation, and the migration route |

**Whether it still builds is settled by presence, and by nothing else.** An
annotation never makes a call site stop compiling; it decides which of the
non-breaking classes a surviving row gets, once presence has already answered the
first question. Keep the two jobs apart — reading an annotation as evidence about
survival is the first failure below.

## Why the other channels cannot be the spine

Three cases, each of which defeats a different shortcut. All three were measured
on the Unity SDK; the two Unreal sections after them say what changes when there
are several markers and the compiler-read one is rare.

**The marker is gone by the time the removal is.** The AGS 3.78.0 release notes
say it plainly:

> Deprecated the Api.TurnManager.GetClosestTurnServer interface, which will be
> removed in AGS version 3.81

In the SDK the marker is present from 17.0.0 through 17.4.0, and at no tag
outside that range. At 16.25.4 — the tag immediately before 17.0.0 — the method
is declared and unmarked. From 17.0.0 it is declared *and* carries
[an `[Obsolete]`](https://github.com/AccelByte/accelbyte-unity-sdk/blob/17.0.0/Runtime/Api/TurnManager.cs#L96)
reading "This method is deprecated and will be removed on 3.81 release. Please
use" — the same deadline and the same migration route as the note. From 17.5.0
the declaration is gone, and by 17.16.1
[`Runtime/Api/TurnManager.cs`](https://github.com/AccelByte/accelbyte-unity-sdk/blob/17.16.1/Runtime/Api/TurnManager.cs#L36)
offers `public void GetTurnServers(ResultCallback<TurnServerList> callback)`
instead.

So the attribute exists **only in the window between the deprecation and the
removal**, and a bump that crosses the removal lands past the far edge of it.
Look for the marker at the version you are moving *to* and you find nothing —
not because the call is fine, but because the declaration it was attached to is
gone, which is the break itself. An attribute-driven check reads the loudest
signal available as silence.

Read a marker at the version where the symbol still exists — usually the one you
are moving *from*. Never read its absence at the target as "not deprecated".

**The changelog's symbol names are not the source's symbol names.** In
`CHANGELOG.md` at 17.16.1, the entry for 17.16.0 announces a deprecation of
`User.ForceLinkOtherPlatform` and an addition of `User.ForcePaltformLinkV3`. The
source declares `ForcedLinkOtherPlatform` and `ForcePlatformLinkV3` — one
changelog spelling is missing a letter, the other has two transposed. Neither
names a member that exists. `ForceLinkOtherPlatform` is not quite absent from
the code: it is the prefix of a public parameters type, so a grep for it can
match and still not find the method the entry is about, which is the worse
outcome of the two. `ForcePaltformLinkV3` matches nothing at all. Either way a
run that takes its symbol names from the changelog reports the upgrade clean.

That pair is named here by file and tag rather than quoted with a citation, on
purpose: this is the channel the table above calls orientation-only, so quoting
it as ground would be the mistake the row is warning about. Read it yourself at
the tag if you want to check it — which is the whole point, because a symbol
name is exactly the thing a changelog is allowed to get wrong and source is not.

**A name that survives may not be the same symbol.** `GetClosestTurnServer`
still exists at 17.16.1 — as a method on the *result* of the call that replaced
it,
[`Runtime/Models/TurnManagerModels.cs`](https://github.com/AccelByte/accelbyte-unity-sdk/blob/17.16.1/Runtime/Models/TurnManagerModels.cs#L43):
`public AccelByteResult<TurnServer, Error> GetClosestTurnServer()`. That is
exactly the migration the release note describes — "we recommend transitioning
to the GetClosestTurnServer() method from the result of
Api.TurnManager.GetTurnServers". A bare-name search across the tree finds the
name, concludes the call site is fine, and misses a break that is real.

So: **match a symbol where the call site resolves it** — in the type and file
that declares it — never by name alone across the SDK's files. The third case is
the one that makes this non-negotiable, because it fails in the safe-looking
direction: it under-reports.

## Unreal: four markers, and only one reaches the C++ compiler

Unity has one marker and it is a compiler attribute. Unreal has four in use, read
by four different things at three different times, and which ones are present is
what decides a row's class. The table below carries a fifth row for the marker the
SDK conspicuously does **not** use, because that is the one an Unreal engineer
greps for and finds nothing. Measured over `Source/` at 26.0.0 (2024-07-05) and
28.9.0 (2026-07-14), tag dates from `git log -1 --format=%ci "${tag}"`:

| Marker | 26.0.0 | 28.9.0 | What reads it, and when |
|---|---|---|---|
| `UE_DEPRECATED` | 0 | 0 | Unreal's own macro — this SDK does not use it |
| `[[deprecated("…")]]` | 0 | **1** | the C++ compiler, at build |
| `DeprecatedFunction` / `DeprecatedProperty` / `DeprecatedNode` meta | 2 | 2 | Unreal Header Tool — Blueprint callers, at build |
| `FReport::LogDeprecated(…)` in the **implementation** | 42 | **51** | `UE_LOG(LogAccelByte, Warning, …)`, at run time |
| a documentation comment on the declaration | 54 | 57 | nothing, ever |

Counted at each tag with:

```sh
grep -ro 'UE_DEPRECATED' Source/ | wc -l
grep -ro '\[\[deprecated' Source/ | wc -l
grep -rE 'LogDeprecated\(' Source/ | grep -v AccelByteReport | wc -l
grep -rEi 'deprecat' Source/ --include='*.h' --include='*.cpp' | grep -cE ':[[:space:]]*(\*|//|/\*)'
```

The last is the comment count, and deliberately not the 177 a bare
`grep -ric deprecat` returns at 28.9.0. Of that 177, 120 lines are code and 51 of
those are the `LogDeprecated` calls one row above — so the bare number counts the
same deprecations twice and files them under the row that reads nothing.

Read 54 and 57 as a **lower bound**: the second stage matches a line whose content
*starts* with a comment marker, which excludes the trailing `// DEPRECATED`
spelling named below.

**Do not read the top row as a promise of silence.** That is the mistake this table
exists to stop, and it is easy to make because `UE_DEPRECATED` is the marker an
Unreal engineer would look for. The SDK uses the plain C++ attribute instead. Its
one occurrence is on `GetInputValidations` in
[`AccelByteUserApi.h`](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/28.9.0/Source/AccelByteUe4Sdk/Public/Api/AccelByteUserApi.h#L1364),
and it first appears at **28.6.0** — the same release that first writes an
`EngineVersion` into the `.uplugin`. At every tag before that the SDK carried no
compiler-read deprecation at all.

So: the SDK deprecates constantly and *almost* always says so only in prose. Almost
always is not always, and a run built on the stronger claim gets the loudest case
backwards. Look for the attribute. Do not assume its absence.

The prose markers come in at least five spellings. One header at 28.9.0 carries
four of them by itself — `@deprecated`, `[DEPRECATED]`, `DEPRECATED:`, and a
bracketed form carrying an AGS calendar version, the last at
[`AccelByteUserApi.h:1352`](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/28.9.0/Source/AccelByteUe4Sdk/Public/Api/AccelByteUserApi.h#L1352),
whose `@brief` opens "[DEPRECATED - Will be removed in 2026.5]". A fifth is a
trailing `// DEPRECATED` on the declaration line. None of those is the attribute:
on that same symbol the attribute sits twelve lines below the comment, and it is
the attribute and not the comment that makes the build speak.

Four consequences, and the last is the one that gets a run wrong.

**The marker decides the class.** An attribute at the target is a `warns` — the
same class Unity gets, for the same reason, and the developer's own build will
raise it. A deprecation in prose with **no** attribute is a **notice**: nothing
raises it at build time, so this run may be the only place it is said — check the
runtime channel below before claiming more than that. Blueprint
metadata and no attribute is neither for a C++ caller and a build warning for a
Blueprint one; say which caller you mean. Never report a notice as a warning —
that tells a reader their build will flag it, and it will not.

**A notice is silence at build time, and that is all it is.** Check the
*implementation* before promising more: 51 implementations at 28.9.0 call
`FReport::LogDeprecated`, which is a `UE_LOG(…, Warning, …)` the developer's own
log carries at run time. `GetInputValidations` does both — the attribute at build
and the log at run — while neither `ForcedLinkOtherPlatform` overload does either,
and those really are only in the comment. So a `notice` row says "your build will
not raise this", and adds "and it logs a warning at run time" wherever the `.cpp`
shows that call.

**Both cases are real here, on the same symbol and on its neighbour.**
`GetInputValidations` is declared at 26.0.0 with nothing on it
([`AccelByteUserApi.h:1269`](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/26.0.0/Source/AccelByteUe4Sdk/Public/Api/AccelByteUserApi.h#L1269))
and at 28.9.0 with the attribute, so that bump is a genuine `warns`.
Both `ForcedLinkOtherPlatform` overloads at 28.9.0 —
[L1013](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/28.9.0/Source/AccelByteUe4Sdk/Public/Api/AccelByteUserApi.h#L1013)
and
[L1032](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/28.9.0/Source/AccelByteUe4Sdk/Public/Api/AccelByteUserApi.h#L1032)
— carry an `@deprecated` naming `ForcePlatformLinkV3`, no attribute, and no
`LogDeprecated` in the `.cpp`, so both are `notice`. Note the plural: the class is
decided per overload, never per name.

**A missing marker settles nothing.** On Unity the marker at least appears in the
window before removal, which is what makes the ordering in the first case above
worth stating. On Unreal, symbols leave with nothing written anywhere in the
source. `SendStartMatchmaking` is declared five times — five overloads, by
`grep -c SendStartMatchmaking` on the header — in
[`AccelByteLobbyApi.h`](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/26.0.0/Source/AccelByteUe4Sdk/Public/Api/AccelByteLobbyApi.h#L823)
at 26.0.0, not one of them carrying deprecation prose of any kind, and at 28.9.0
the name is absent from every file under `Source/` — the only occurrence left in
the checkout is in `CHANGELOG.md`. A run that looked for a marker and found none
learned nothing. Look for the declaration.

## The Unreal case that defeats file-and-name

Matching in the declaring type rather than the declaring file is a refinement on
Unity. On Unreal it is the whole rule, because one header routinely declares the
same name in two classes: the C++ API, and the `UBlueprintFunctionLibrary` that
exposes it to Blueprint.

`Source/AccelByteUe4Sdk/Public/Core/AccelByteCredentials.h` at 26.0.0 declares
`GetUserDisplayName` twice —
[`const FString& GetUserDisplayName() const`](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/26.0.0/Source/AccelByteUe4Sdk/Public/Core/AccelByteCredentials.h#L68)
on `class Credentials`, and
[`static FString GetUserDisplayName()`](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/26.0.0/Source/AccelByteUe4Sdk/Public/Core/AccelByteCredentials.h#L119)
under a `UFUNCTION(BlueprintCallable)` on
`UAccelByteBlueprintsCredentials : public UBlueprintFunctionLibrary`.

At 28.9.0 the file is still there, the name is still there, and
`UAccelByteBlueprintsCredentials` is gone — the whole class, with every static
accessor on it. A call on `Credentials` survives; a call on the Blueprint library
breaks. Match on file-and-name and both come back clean.

Grepping the target for the class name does not rescue it either:
`UAccelByteBlueprintsCredentials` still returns a hit at 28.9.0, inside a comment
in `AccelByteHttpRetrySchedulerBase.h`. The blunter version of the same trap is a
header that goes entirely — `Api/AccelByteSessionBrowserApi.h` is present at
26.0.0 and gone at 28.9.0, while `SessionBrowserServerUrl` survives in
[`AccelByteSettings.h`](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/28.9.0/Source/AccelByteUe4Sdk/Public/Core/AccelByteSettings.h#L139),
so a search for `SessionBrowser` at the target still finds something.

`AccelByteCredentials.h` shows one more thing, and it is why presence is
necessary in C++ without being sufficient. The `Credentials` declaration that
survives is
[`FString GetUserDisplayName() const`](https://github.com/AccelByte/accelbyte-unreal-sdk-plugin/blob/28.9.0/Source/AccelByteUe4Sdk/Public/Core/AccelByteCredentials.h#L59):
the return type moved from `const FString&`. Same name, same declaring class,
same file, different signature. Whether that breaks a particular call site
depends on what the caller does with the result, and this run compiles nothing —
so it ships as a **`signature changed`** row naming what moved, never as a row
quietly passed as unaffected.

## Reading the two refs

**Target**, on either engine, comes from the SDK repository's tag list. Never
build a ref out of a changelog heading: the Unity 17.16.0 changelog carries a
`17.15.0` section, and no `17.15.0` tag exists, so a ref built that way does not
resolve.

**Current, on Unity,** comes from the project's own package manifest. Find the
entry by its git URL, not by its package key — the key that holds the SDK is not
the same string in every project, and matching on it silently finds nothing. A
**floated ref** — a branch such as `#main` rather than a version — is not a
version: there is no fixed current surface to compare against, so there is no
diff to take. Say that, and stop; do not substitute the newest tag for it.

**Current, on Unreal, is not a ref at all.** AccelByte's
[install instructions](https://docs.accelbyte.io/gaming-services/getting-started/setup-game-sdk/unreal-sdk/)
have you download a release, extract it, and copy the folder into
`[YourProject]/Plugins/`; the `.uproject` then names the module and nothing else
— `{ "Name": "AccelByteUe4Sdk", "Enabled": true }` carries no version. So there
is no pin to read. The version is self-reported by the copy, in three places that
can disagree:

| Where | What it holds |
|---|---|
| `AccelByteUe4Sdk.uplugin`, `VersionName` | the release the copy claims to be |
| `version.json`, `version` | the same string, written separately |
| the extracted folder name, `accelbyte-unreal-sdk-plugin-X.X.X` | the release it came from, if nobody renamed it |

`VersionName` and `version.json` agreed with the tag at all six tags checked —
24.0.0, 26.0.0, 27.0.0, 28.0.0, 28.5.0 and 28.9.0, read with
`git show "${tag}:AccelByteUe4Sdk.uplugin"` and `git show "${tag}:version.json"` —
so reading either is reasonable.
What neither is, is *evidence*: a vendored copy is writable, and a project that
patched one file still reads `28.9.0`. Say the current version is self-reported;
where the three disagree, report the disagreement instead of picking one. A
plugin folder that is a git checkout or a submodule is the one Unreal case with a
real pin — use it, and say that is what you used.

Do not read `EngineVersion` out of the `.uplugin` as the supported engine range.
The key is **absent** at every tag sampled before 28.6.0 — 24.0.0, 26.0.0, 27.0.0,
28.0.0 and 28.5.0 — and reads `"4.27"` at 28.6.0 and at 28.9.0, the two sampled
after it. Seven tags, not a sweep: 28.1–28.5.x are unread, so "first appears at
28.6.0" is the earliest *sampled* appearance and not a proven first. Meanwhile the
install page states the prerequisite as Unreal Engine 4.27 or Unreal Engine 5 up
to 5.6 — one unmoving number, on a plugin covering two engine generations.

## What the run concludes, per call site

Six classes, and these are their only names. The rows key on the **marker**, not
on the engine, because both engines reach both of the first two.

| At the current version | At the target version | Class |
|---|---|---|
| declared | absent | **breaks** — the call no longer compiles |
| declared | declared, same signature, newly carrying a compiler attribute — `[Obsolete]` on Unity, `[[deprecated]]` on Unreal | **warns** — compiles, and the developer's own build says so |
| declared | declared, same signature, newly deprecated **in prose only** — an Unreal doc comment with no attribute | **notice** — compiles, and the build says nothing. Check the `.cpp` for a `LogDeprecated` before promising more silence than that |
| declared | declared, signature changed | **signature changed** — name what moved |
| already deprecated | deprecated the same way | **pre-existing** — the bump did not cause it |
| absent | either | **unresolved** — no declaration matched at the current version, so the run cannot speak for this call site |

`breaks`, `warns` and `notice` are what an upgrade costs. `signature changed` is
the one a run cannot settle on its own, because whether it breaks depends on what
the caller does with the result and this run compiles nothing — so it is shown
under its own name and never folded into one of the other three. `pre-existing`
is worth mentioning once and is not a reason to hold the upgrade back.
`unresolved` means one thing however it came about — no declaration at the
current version, whether because the symbol belongs to something else or because
this run could not resolve the receiver. Either way it is a gap in the run rather
than a clean result, and the coverage note says which cause applied.

**`notice` is not a quieter `warns`.** A `warns` row promises the developer their
next build will tell them; a `notice` row promises it will not, and that promise is
the whole value of the row. It is a promise about the **build** and nothing else:
51 implementations at 28.9.0 log a warning at run time, so a notice on one of
those is quiet at compile and loud in the log. Never merge the two classes to keep the
table narrow, and never reach for `warns` as a catch-all for "deprecated but still
compiles".

## What an attribute message may be used for

An `[Obsolete]` message is the SDK author speaking, and it is usually the best
statement of the replacement available anywhere — for example
[`Runtime/Api/UserProfiles.cs`](https://github.com/AccelByte/accelbyte-unity-sdk/blob/17.16.1/Runtime/Api/UserProfiles.cs#L290),
whose message says to "use GetUserProfilePublicInfo instead". Quote it and offer
it as the fix direction.

Two limits on that:

- **Some markers carry no message at all.** There is then no replacement to
  offer. Say the replacement is not stated rather than inferring one from a
  similar name — a near-match is how a rename and a redesign get confused.
- **A deadline in a message is in whatever scheme its author chose**, and some
  of those schemes name no version at all. At one tag the removal deadlines
  include an AGS calendar version, a bare service name with no version attached,
  and
  [`ISwitchImp.cs`](https://github.com/AccelByte/accelbyte-unity-sdk/blob/17.16.1/Runtime/ThirdParties/Nintendo%20Switch/ISwitchImp.cs#L12),
  which says "This interface will be removed on August release." — a month with
  no year, which resolves to nothing at all. Quote a deadline; never convert one
  into a comparison against the target ref. Whether a symbol survives the bump
  is settled by looking for it at the target ref, and by nothing else.

On Unreal both limits apply to whichever marker is there — the `[[deprecated]]`
attribute carries a message exactly as `[Obsolete]` does — and a third one is
sharper. A doc comment is unstructured prose, so there is no field to read and no
guarantee a replacement is named at all: some entries name one, some say only
that the method "will be removed in the future". And the deadlines that do carry
a number are usually in AGS's calendar scheme, not the SDK's — `GetInputValidations`
says "removed in version 2026.5" in both its comment and its attribute, while the
SDK's own tags at that time are `28.x`. Those two number lines never meet, so
reading the deadline as a statement about an SDK tag produces a comparison
neither side ever made.

## Citing what the diff found

A break is a claim about source, so it cites source: the declaring file at an
immutable ref with a line anchor, one citation per side where both sides matter
([grounding-rules.md](grounding-rules.md)). The release-notes page is cited in
addition when one announces the change, because it carries the removal version
and the migration route in the vendor's own words — but it is never cited
*instead*, since a release note describes an intention and the source is what
shipped.

Confirm each citation resolves and states what it is quoted for before it goes
in front of the user. A source-hosting page does not always serve the whole file
to an automated read, so a citation into a large file can be correct and still
be unverifiable; when that happens, cite the release-notes page for the claim
and point at the file without quoting it.
