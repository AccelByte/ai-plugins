---
last-verified: 2026-04-21
see-also:
- '[integration.md](integration.md)'
---

# Unit Tests — Java

Conventions for unit-testing handler logic in Java Extend apps. Uses JUnit 5 (Jupiter), the current-generation JUnit.

## File layout

- Production code under `src/main/java/<package>/`.
- Tests under `src/test/java/<package>/` mirroring the production structure.
- Test classes end in `Test`: `PriorityHandler.java` ↔ `PriorityHandlerTest.java`.

## Test method shape

```java
package com.mystudio.handler;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PriorityHandlerTest {

    @Test
    void priorityForVipTierIs100() {
        // arrange
        var tierLookup = new FakeTierLookup(Map.of("user-123", "vip-gold"));
        var handler = new PriorityHandler(tierLookup);

        // act
        var resp = handler.getPriority(GetPriorityRequest.newBuilder()
            .setUserId("user-123")
            .build());

        // assert
        assertEquals(100, resp.getPriority());
    }
}
```

Naming: method names describe the behavior, not the implementation. `priorityForVipTierIs100` is better than `testGetPriority`.

Use package-private visibility on test classes and methods (no `public`). JUnit 5 picks them up fine.

## Parameterized tests

For multiple scenarios of the same shape:

```java
@ParameterizedTest
@CsvSource({
    "none,         50",
    "vip-gold,    100",
    "vip-platinum, 200",
})
void priorityByTier(String tier, int expectedPriority) {
    var handler = new PriorityHandler(new FakeTierLookup(Map.of("u", tier)));
    var resp = handler.getPriority(GetPriorityRequest.newBuilder()
        .setUserId("u").build());
    assertEquals(expectedPriority, resp.getPriority());
}
```

Other parameter sources: `@ValueSource`, `@MethodSource`, `@EnumSource`.

## AssertJ for complex assertions

Plain JUnit assertions work for primitives. For collections and complex objects, add AssertJ:

```java
import static org.assertj.core.api.Assertions.assertThat;

assertThat(resp.getItemsList())
    .hasSize(3)
    .extracting(Item::getId)
    .containsExactly("a", "b", "c");
```

AssertJ has a fluent API that produces better failure messages. It's in almost every modern Java template — if yours has it, use it.

## Fakes over Mockito

Prefer hand-written fakes over Mockito when you can. Mockito encourages implementation-coupled tests ("verify method X was called"); fakes encourage behavior-coupled tests ("given input X, output Y").

```java
class FakeTierLookup implements TierLookup {
    private final Map<String, String> data;
    FakeTierLookup(Map<String, String> data) { this.data = data; }

    @Override
    public String lookup(String userId) {
        var tier = data.get(userId);
        if (tier == null) throw new NotFoundException(userId);
        return tier;
    }
}
```

Mockito is fine when the collaborator has many methods and the test touches only one. Don't introduce it for a single test.

## What to test

For each handler:

- **Happy path.** Typical input → expected output.
- **One failure path.** Invalid input throws `IllegalArgumentException` or returns the gRPC error equivalent.

## Running

```bash
./gradlew test                         # all tests
./gradlew test --tests "PriorityHandlerTest"       # one class
./gradlew test --tests "PriorityHandlerTest.priorityForVipTierIs100"  # one method
./gradlew test --info                  # verbose output
./gradlew test jacocoTestReport        # with JaCoCo coverage report
```

Reports land in `build/reports/tests/test/index.html` (human-readable) and `build/test-results/test/` (XML for CI).

## Integration tests

Keep integration tests in a separate source set (`src/integrationTest/java/`) so they don't run with `./gradlew test`:

```bash
./gradlew integrationTest
```

The `build.gradle` needs to declare the source set; templates usually do this already. See `references/test/integration.md`.

## Common failure modes

| Symptom | Usual cause |
|---|---|
| `No tests found` | Class name doesn't end `Test`, method missing `@Test`, or wrong package. |
| `NoClassDefFoundError` at test runtime | Test compile succeeded but a production class isn't on the test classpath. Usually a misconfigured `build.gradle`. |
| Gradle daemon flakiness | Run `./gradlew --stop` then retry; stale daemons cause spurious "out of memory" or "class not found" errors. |
| Tests pass locally, fail in CI | Locale / timezone difference, or relying on a file path that only exists locally. |

## When handlers call AGS

Inject the AGS SDK client as a constructor parameter (or via a DI container if the project uses Spring / Micronaut). Tests pass a fake that implements the same interface. Real AGS calls belong in integration tests.
