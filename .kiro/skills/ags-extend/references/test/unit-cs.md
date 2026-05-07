---
last-verified: 2026-04-21
see-also:
- '[integration.md](integration.md)'
---

# Unit Tests — C#

Conventions for unit-testing handler logic in C# / .NET Extend apps. Uses xUnit, the modern default in the .NET ecosystem. NUnit and MSTest also work; use what the template ships.

## File layout

- Production project: `src/MyApp/`.
- Test project: `tests/MyApp.Tests/`.
- Test classes end with `Tests`: `PriorityHandler.cs` ↔ `PriorityHandlerTests.cs`.

The test project references the production project via `<ProjectReference>` in the `.csproj`.

## Test method shape

```csharp
using Xunit;

namespace MyStudio.Handler.Tests;

public class PriorityHandlerTests
{
    [Fact]
    public void Priority_ForVipTier_Returns100()
    {
        // arrange
        var tierLookup = new FakeTierLookup(new() { ["user-123"] = "vip-gold" });
        var handler = new PriorityHandler(tierLookup);

        // act
        var resp = handler.GetPriority(new GetPriorityRequest { UserId = "user-123" });

        // assert
        Assert.Equal(100, resp.Priority);
    }
}
```

Naming: `MethodUnderTest_Scenario_ExpectedResult`. Common convention in .NET; keeps the test name self-documenting.

`[Fact]` for single-case tests. `[Theory]` with `[InlineData]` for parameterized.

## Parameterized tests

```csharp
[Theory]
[InlineData("none",         50)]
[InlineData("vip-gold",    100)]
[InlineData("vip-platinum", 200)]
public void Priority_ByTier_ReturnsExpected(string tier, int expected)
{
    var handler = new PriorityHandler(new FakeTierLookup(new() { ["u"] = tier }));
    var resp = handler.GetPriority(new GetPriorityRequest { UserId = "u" });
    Assert.Equal(expected, resp.Priority);
}
```

`[MemberData]` or `[ClassData]` for data sources that aren't inline constants (computed test cases, larger datasets).

## FluentAssertions for readability

Plain `Assert` works. For complex assertions, add FluentAssertions (most templates include it):

```csharp
using FluentAssertions;

resp.Items.Should().HaveCount(3)
    .And.Contain(i => i.Id == "a");
```

Better failure messages and more natural reading. Use it when the project already does; don't introduce it for one test.

## Fakes over Moq

Prefer hand-written fakes over Moq. Same reasoning as other languages — fakes couple to behavior, mocks couple to implementation.

```csharp
internal class FakeTierLookup : ITierLookup
{
    private readonly Dictionary<string, string> _data;
    public FakeTierLookup(Dictionary<string, string> data) => _data = data;

    public string Lookup(string userId)
    {
        if (!_data.TryGetValue(userId, out var tier))
            throw new NotFoundException(userId);
        return tier;
    }
}
```

Moq is fine for large interfaces where the test touches one method. Don't reach for it reflexively.

## What to test

For each handler:

- **Happy path.** Typical input → expected output.
- **One failure path.** Invalid input throws `ArgumentException` (or the gRPC error equivalent for a handler).

## Running

```bash
dotnet test                                     # all tests
dotnet test --filter "FullyQualifiedName~PriorityHandlerTests"   # one class
dotnet test --filter "Priority_ForVipTier_Returns100"            # one test
dotnet test --logger "console;verbosity=detailed"                # verbose
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=lcov  # with coverage (requires coverlet)
```

For `dotnet test` to find tests, the project needs test SDK packages: `Microsoft.NET.Test.Sdk`, `xunit`, `xunit.runner.visualstudio`. Templates include these.

## Async tests

gRPC handlers are usually async. xUnit handles async Task naturally:

```csharp
[Fact]
public async Task Priority_ForVipTier_Returns100Async()
{
    var handler = new PriorityHandler(...);
    var resp = await handler.GetPriorityAsync(new GetPriorityRequest { UserId = "u" });
    Assert.Equal(100, resp.Priority);
}
```

Return `Task` / `async Task`; never `async void` in tests.

## Integration tests

Keep integration tests in a separate test project (`tests/MyApp.IntegrationTests/`) or filter by category:

```csharp
[Trait("Category", "Integration")]
public class LiveAgsTests { ... }
```

Run with `dotnet test --filter "Category!=Integration"` to skip, `--filter "Category=Integration"` to include. See `references/test/integration.md`.

## Common failure modes

| Symptom | Usual cause |
|---|---|
| `No test is available` | Test project doesn't reference the test SDK packages; or the test class isn't `public`. |
| `System.IO.FileNotFoundException: Could not load file or assembly ...` | Production project reference is missing or a version conflict between the two projects. |
| Async test that never completes | Returning `async void` instead of `async Task`; xUnit can't await it. |
| Tests pass locally, fail in CI | Culture/locale differences, or relying on timezone-specific behavior without fixing it via a clock abstraction. |

## When handlers call AGS

Inject the AGS client via constructor (or DI container — Microsoft.Extensions.DependencyInjection is the default). Tests pass a fake that implements the same interface. Real AGS calls belong in integration tests.
