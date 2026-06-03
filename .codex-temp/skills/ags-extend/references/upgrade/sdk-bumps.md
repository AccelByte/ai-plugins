---
last-verified: 2026-05-09
note: SDK package names are per AccelByte's observed repo naming. The current latest
  version per package is NOT tracked here — pull from the SDK's GitHub releases page
  at bump time.
sources:
- https://github.com/AccelByte
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/
see-also:
- '[breaking-changes.md](breaking-changes.md)'
- '[security.md](../production/security.md)'
---

# SDK Bumps — Per-Language Install/Upgrade Commands

Consumed by `subskills/upgrade.md`. Gives the canonical command shape per language; the specific version to target is fetched at runtime.

## AccelByte SDK packages

| Language | Package | GitHub release page |
|---|---|---|
| Go | `github.com/AccelByte/accelbyte-go-sdk` | `https://github.com/AccelByte/accelbyte-go-sdk/releases` |
| Python | `accelbyte-py-sdk` (on PyPI) | `https://github.com/AccelByte/accelbyte-python-sdk/releases` |
| Java | `net.accelbyte.sdk:sdk` | `https://github.com/AccelByte/accelbyte-java-sdk/releases` |
| C# | `AccelByte.Sdk` (NuGet) | `https://github.com/AccelByte/accelbyte-csharp-sdk/releases` |

Package names are per AccelByte's observed conventions. If an install fails with "package not found," the name has drifted — check the release page URL.

## Bump commands

### Go

```bash
# Pull the latest version from the release page first; don't blind-install.
# Then:
go get github.com/AccelByte/accelbyte-go-sdk@v<target-version>
go mod tidy
```

The `@<version>` suffix pins exactly. Omitting it pulls whatever `go get` decides is "latest," which is ambiguous during a bump — prefer explicit pinning.

`go mod tidy` reconciles indirect dependencies. Always run after a direct dep bump.

Post-bump verification:

```bash
go build ./...
go test ./...
```

### Python

Preferred: edit `requirements.txt` (or `pyproject.toml`) to pin the version:

```
accelbyte-py-sdk==<target-version>
```

Then:

```bash
pip install -r requirements.txt --upgrade
```

For `pyproject.toml` with a lock file (Poetry, PDM), use the tool's native command:

```bash
poetry add accelbyte-py-sdk@<target-version>
# or
pdm add accelbyte-py-sdk@<target-version>
```

Post-bump:

```bash
pytest
```

### Java

Edit `build.gradle` (Groovy) or `build.gradle.kts` (Kotlin):

```groovy
dependencies {
    implementation 'net.accelbyte.sdk:sdk:<target-version>'
}
```

Then:

```bash
./gradlew build --refresh-dependencies
./gradlew test
```

`--refresh-dependencies` forces Gradle to re-resolve (bypassing its cache of the old version).

Maven equivalent (if the project uses Maven instead of Gradle):

```xml
<dependency>
  <groupId>net.accelbyte.sdk</groupId>
  <artifactId>sdk</artifactId>
  <version>{target-version}</version>
</dependency>
```

Then `mvn clean install`.

### C#

```bash
dotnet add package AccelByte.Sdk --version <target-version>
dotnet restore
dotnet build
dotnet test
```

## Picking the target version

For a clean bump, pick the most recent non-major version. All AccelByte SDKs are currently pre-v1.0 (e.g. Go: v0.87.x, Python: v0.83.x, Java: v0.80.x, C#: v0.79.x). Under pre-v1.0 SemVer, **minor bumps may include breaking changes** — review the release notes before applying.

For example, if current is `v0.87.0`:

- Good default: latest `v0.x.y` — e.g. `v0.87.2`. Likely stable but review the changelog.
- Risky: any bump that jumps multiple minor versions. Breaking API changes can land in any minor release before v1.0.

**Don't cross a minor version unintentionally on pre-v1.0 SDKs.** The `subskills/upgrade.md` workflow warns explicitly when the target may include breaking changes.

## Transitive dependencies

An SDK bump commonly pulls in new versions of transitive dependencies (gRPC, protobuf, logging libraries). Two failure modes:

- **Diamond dependency conflict.** Two direct deps require incompatible versions of the same transitive. Surfaces as a build error or runtime `ClassNotFoundException` / `undefined symbol`. Resolve by bumping both direct deps together, or pinning the transitive explicitly.
- **Major-version-jump in a transitive.** The SDK bump moves from `grpc v1.50` to `grpc v1.60`; that's usually safe but can break apps using deprecated APIs.

Surface these with the language's native tool: `go mod graph | grep <conflict>`, `pip check`, `./gradlew dependencies`, `dotnet list package --vulnerable`.

## Pinning strategies

- **Dev / hobby / indie studios.** Pin to a specific version in the manifest. Upgrade on a quarterly cadence or when you need a specific feature. Predictable; no surprise breakage from a drift.
- **AAA / continuous deployment.** Consider using a lockfile + automated Dependabot-style bumps with a test-gate. Catches security patches quickly; the CI test suite is your safety net.

Neither is wrong. Match cadence to your test coverage and ops maturity.

## When the bump should be skipped

- **Security advisory on current version.** Bump, even if inconvenient.
- **Known bug fixed in the new version.** Bump.
- **New features you don't need.** Don't bump for the sake of it; every bump risks a regression. "The latest version exists" is not a reason.

## Rollback

If the bump goes wrong:

```bash
git checkout -- go.mod go.sum          # Go
git checkout -- requirements.txt        # Python (simple case)
git checkout -- build.gradle            # Java
git checkout -- *.csproj packages.lock.json   # C#
```

Then re-run the language-native restore (`go mod download`, `pip install -r requirements.txt`, `./gradlew build`, `dotnet restore`) to pull the old version back.

Don't commit the partial bump. Either finish it (all breakage addressed + tests green) or roll back fully.
