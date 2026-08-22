---
name: teammate-call-site-map
description: 'How the integration surface is built: detecting the engine and SDK by
  reusing the ags skill''s own globs, mapping call sites at file:line, and naming
  what the scan could not read. Read before Stage 2 of a health check.'
last-verified: 2026-08-14
see-also:
- '[health-check.md](../subskills/health-check.md)'
- '[report/report-schema.md](report/report-schema.md)'
- '[ags sdks/_index.md](../../ags/references/sdks/_index.md)'
---

# The call-site map

One static read of the project, producing the map every detector afterwards
works from: which AGS capabilities the code calls, and where each call is.

It is a pure read. Nothing here runs a live service, needs a credential, or
depends on which mode the run is in.

## Detecting the engine and the SDK

Reuse the `ags` skill's own heuristics rather than restating them — where that
skill is installed, read them directly:

- the engine-detection globs in `ags/subskills/install-sdk.md` (Step 1 —
  `*.uproject`, `Assets/` + `ProjectSettings/`, `project.godot`, `package.json`)
- the SDK families in `ags/references/sdks/_index.md`

A Unity project shows the SDK as a package under `Packages/` or `Assets/`; an
Unreal one as a `*.uplugin` beside the `*.uproject`. No SDK found is an
*empty-result recovery*, not a failure to report as a fault.

The **map itself** is this skill's own read, and no `ags` subskill produces it:
`ags explore` infers *modules* from a live CLI, which is a different question
from where a call sits in this repository.

## Mapping the calls

Map call sites with **file:line precision** via `Grep` — the detectors key off
those locations, so a capability recorded without one is a capability no
detector can act on. Record each read to the run's access log.

Write the map as it is built, **one entry per capability** however many call
sites that capability has. Two entries naming one capability render as two
sections under the same heading, and `validate` refuses them.

## What it ships as

The map is the Report's `surface` field — one entry per capability, each
carrying at least one `{ path, line }`
([report-schema.md](report/report-schema.md) § Integration surface). Required
from `schema_version` 6, in **both** modes: this is a static read, so a run
whose live half fails relabels itself `code-only` and keeps the map it already
built.

It is what the exported page's *Services in use* section renders, and it is an
index into one commit — never a description of the project, and never a
substitute for reading the code.

## Say what you did not read

A text scan does not reach every call surface, and a list that omits half a
project's calls looks complete doing it. Each surface left unread goes in
`surface.not_read`, in one line.

On **Unreal** this is not optional. C++ call sites grep normally; Blueprint call
sites live in `.uasset` and `.umap`, which are binary and unread here. Name them,
and say how many such files the project holds — a project whose gameplay was
built by designers can have most of its calls in graphs a text scan cannot see.
