---
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
- https://github.com/AccelByte/extend-service-extension-go
- https://github.com/AccelByte/extend-service-extension-java
- https://github.com/AccelByte/extend-service-extension-csharp
see-also:
- '[init.md](init.md)'
---

# AGS Extend Dependency Installer

Detect the language runtime for each Extend app on disk, then run the per-language dependency command (`go mod tidy`, `pip install`, `dotnet restore`, `./gradlew dependencies`) in each app directory. Detect-only on runtimes — never install them.

## Behavior Constraints

<grounding_rules>

- Identify Extend app directories by the presence of `Makefile` + `Dockerfile` together (in the current directory or, for multi-app projects, as `*/Makefile` + `*/Dockerfile` siblings one level down). There is no project-level manifest — each app is its own directory.
- Detect language per app from on-disk files: `go.mod` → Go, `requirements.txt` or `pyproject.toml` → Python, `*.csproj` → C#, `build.gradle` / `pom.xml` → Java.
- Do not run a dependency command for a language whose runtime isn't detected. Report and skip instead.
- Runtime minimums: Go 1.21 (platform floor; official AccelByte sample repos require 1.24 — recommend 1.24+), Python 3.10, .NET 8, JDK 17. A version below the minimum is a failure, not a warning.

</grounding_rules>

<tool_usage_rules>

- Use `Bash` for runtime detection, app discovery (`test -f`, `ls */Makefile`), and dependency commands.
- Use `Glob` to enumerate Extend app dirs (`*/Makefile` siblings) when working from a parent directory.
- Use `Read` to inspect on-disk language signals if needed (e.g. peek at `go.mod` for the module path).
- Never install a language runtime. Never edit `go.mod`, `requirements.txt`, `pom.xml`, `*.csproj`, or any manifest/lock file — dependency commands handle that themselves.

</tool_usage_rules>

<parallel_tool_calling>

Run all runtime detection commands in a single batched `Bash` call set — one message, one command per language used across the apps. Do not check runtimes sequentially.

</parallel_tool_calling>

<dependency_checks>

Before running any dependency command:

1. The working directory is identified as an Extend app (Makefile + Dockerfile present) or holds one or more `*/Makefile` + `*/Dockerfile` app-dir siblings — or the user explicitly pointed at an app directory.
2. The relevant language runtime is present and at/above the minimum version.
3. The build tool required by the language is also present (`gradle` wrapper for Java, `pip` for Python). A missing build tool is treated the same as a missing runtime.

</dependency_checks>

<output_contract>

Output has three sections:

1. **Discovery block** — apps detected on disk and their detected languages.
2. **Runtime check block** — one line per distinct language with version or `not found`.
3. **Install block** — one line per app: ✓ installed, ✗ skipped ({reason}), or ⚠ failed ({first-line-of-error}).

Final line is either `Done. N/M apps ready.` or a stop block if no Extend app dir was found.

</output_contract>

<completeness_contract>

The subskill is complete when every detected app has either:

- ✓ a successful dependency install, or
- ✗ an explicit skip with reason, or
- ⚠ an explicit failure with the first line of error output captured.

Never silently skip an app. Never report `Done.` if any app hasn't been accounted for.

</completeness_contract>

## Workflow

### Step 1 — Discover apps

```bash
# Are we already inside an app dir?
test -f Makefile && test -f Dockerfile && echo "in app root: $(basename $(pwd))"
# Or one level up — enumerate apps living as siblings.
ls */Makefile 2>/dev/null
```

If the current directory has both `Makefile` and `Dockerfile`, treat it as a single Extend app. The app's name is the basename of the directory.

If `*/Makefile` siblings exist, list each directory that also has a `Dockerfile` — those are the apps. If multiple are found, ask which to operate on (or "all"):

> Found these app dirs: `event-handler`, `leaderboard-service`. Run install-dep against which? (all / 1,2 / name)

If neither pattern matches, ask:

> No `Makefile`+`Dockerfile` here or as a sibling one level down. `cd` into your Extend app directory, point me at one (absolute or relative path), or run `/ags-extend wizard` to scaffold a project first.

For each app dir, detect the language from on-disk files: `go.mod` → Go, `requirements.txt` or `pyproject.toml` → Python, `*.csproj` → C#, `build.gradle` / `pom.xml` → Java.

### Step 2 — Detect runtimes

For each distinct language across the apps, check in parallel:

| Language | Command | Minimum |
|---|---|---|
| Go | `go version` | 1.21 (1.24 recommended) |
| Python | `python3 --version` | 3.10 |
| C# | `dotnet --version` | 8.0 |
| Java | `java --version` | 17 |

Parse the version from stdout. Compare against the minimum.

Report:

```
Runtimes:
  ✓ go        1.22.0
  ✗ python3   not found
  ⚠ java      11.0.21 (minimum 17 — install JDK 17 from adoptium.net)
```

Three states per runtime:

- **Present and at/above min** → proceed for apps using that language.
- **Missing** → skip apps using that language; report the install URL.
- **Below minimum** → same as missing; add the version mismatch explicitly.

Install URLs:

| Runtime | URL |
|---|---|
| Go | https://golang.org/dl |
| Python | https://python.org/downloads |
| .NET | https://dotnet.microsoft.com/download |
| Java | https://adoptium.net (Eclipse Temurin) |

### Step 3 — Install per-app dependencies

For each app whose runtime is available, run the command below from inside the app's directory:

| Language | Command |
|---|---|
| Go | `go mod tidy` |
| Python | `pip install -r requirements.txt` — if no `requirements.txt`, try `pip install -e .` or `poetry install` based on what's present |
| C# | `dotnet restore` |
| Java | `./gradlew dependencies` — if no `gradlew`, try `mvn dependency:resolve` |

Stream output. After each app, report one line:

```
  ✓ matchmaking-override (go) — go mod tidy complete
  ✗ analytics-handler (python) — skipped, python3 not found
  ⚠ leaderboard-ext (python) — failed
    error: could not find a version that satisfies the requirement grpcio-tools
```

### Step 4 — Summary

```
Done. 2/3 apps ready.

  ✓ matchmaking-override (go)
  ✗ analytics-handler (python) — install Python 3.10+ from https://python.org/downloads, then re-run
  ⚠ leaderboard-ext (python) — pip install failed; see error above
```

Do not suggest what to try next after a dependency failure — the error text is more actionable than a generic "check your requirements.txt" nudge.

## Error Handling

| Situation | Response |
|---|---|
| No `Makefile`+`Dockerfile` found and no app dir given | Ask for a path or direct to `/ags-extend wizard`. |
| Detected app dir has none of `go.mod` / `requirements.txt` / `pyproject.toml` / `*.csproj` / `build.gradle` / `pom.xml` | Report as skipped with "could not detect language in `{dir}` — expected one of go.mod, requirements.txt, pyproject.toml, *.csproj, build.gradle, pom.xml". |
| Runtime present but wrong version | Treat as missing for the purpose of this subskill. Do not try `go mod tidy` with Go 1.19 — it will produce opaque errors. |
| `go mod tidy` fails with "missing go.sum entry" | Surface the error. Do not retry with `-insecure` or other flags. |
| `pip install` fails with permission error | Suggest running inside a virtualenv. Do not prepend `sudo`. |
| `./gradlew` isn't executable | Run `chmod +x gradlew` once and retry. If it still fails, surface the error. |
| `dotnet restore` fails with NuGet source error | Surface the error. Do not modify NuGet sources. |
| User runs this outside any app or project | Stop and ask for a path — don't walk the filesystem. |
| Network offline (all dependency commands fail with DNS errors) | Say so plainly after the first couple of failures: "Looks like the dependency commands can't reach their registries — check your network and retry." |

## Examples

### Project with two Go apps, both succeed

```
User: /ags-extend install-dep

Skill: Discovered 2 Extend app dirs (Makefile + Dockerfile + go.mod):
         ./matchmaking-override   (go)
         ./match-event-handler    (go)

       Runtimes:
         ✓ go  1.22.0

       Installing dependencies...
         ✓ matchmaking-override (go) — go mod tidy complete
         ✓ match-event-handler (go) — go mod tidy complete

       Done. 2/2 apps ready.
```

### Mixed languages, Python runtime missing

```
User: /ags-extend install-dep

Skill: Discovered 2 Extend app dirs:
         ./override-go        (go — go.mod detected)
         ./analytics-python   (python — requirements.txt detected)

       Runtimes:
         ✓ go        1.22.0
         ✗ python3   not found

       Installing dependencies...
         ✓ override-go (go) — go mod tidy complete
         ✗ analytics-python (python) — skipped, python3 not found

       Done. 1/2 apps ready.

         ✗ analytics-python — install Python 3.10+ from https://python.org/downloads, then re-run /ags-extend install-dep
```

### Wrong Java version

```
Skill: Runtimes:
         ⚠ java  11.0.21 (minimum 17 — install JDK 17 from adoptium.net)

       Installing dependencies...
         ✗ guild-ext (java) — skipped, Java below minimum version

       Done. 0/1 apps ready.
```

### Single-app run (cwd is the app)

```
User: /ags-extend install-dep — I'm in ./matchmaking-override

Skill: Detected Makefile + Dockerfile + go.mod here. Treating this as a single Go app.

       Runtimes:
         ✓ go  1.22.0

       Installing dependencies...
         ✓ . (go) — go mod tidy complete

       Done. 1/1 apps ready.
```

### pip install fails

```
Skill: Installing dependencies...
         ⚠ leaderboard-ext (python) — failed
           error: could not find a version that satisfies the requirement grpcio-tools==1.60.0

       Done. 0/1 apps ready.
```
