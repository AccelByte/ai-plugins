---
last-verified: 2026-04-21
see-also:
- '[integration.md](integration.md)'
---

# Unit Tests — Python

Conventions for unit-testing handler logic in Python Extend apps. Uses `pytest`, the de-facto standard. Works for Override, Event Handler, and Service Extension.

## File layout

- Test files in a top-level `tests/` directory (sibling to the package being tested): `mypackage/handler.py` ↔ `tests/test_handler.py`.
- Test files start with `test_` — pytest's default discovery pattern.
- Test functions also start with `test_`.

Keep tests outside the production package so `tests/` isn't shipped inside the deployed image.

## Test function shape

```python
from mypackage.handler import PriorityHandler
from mypackage.fakes import FakeTierLookup

def test_priority_vip_tier():
    # arrange
    tier_lookup = FakeTierLookup({"user-123": "vip-gold"})
    handler = PriorityHandler(tier_lookup)

    # act
    resp = handler.get_priority(user_id="user-123")

    # assert
    assert resp.priority == 100
```

Naming convention: `test_<scenario>_<optional_detail>`. Keep it snake_case; pytest collects on name prefix.

Use bare `assert` — pytest rewrites these to produce detailed failure messages. Don't use `unittest`'s `assertEquals` unless the project is already on unittest.

## Parametrized tests

Prefer parametrize for multiple scenarios of the same shape:

```python
import pytest

@pytest.mark.parametrize("tier,expected_priority", [
    ("none",         50),
    ("vip-gold",     100),
    ("vip-platinum", 200),
])
def test_priority_by_tier(tier, expected_priority):
    handler = PriorityHandler(FakeTierLookup({"u": tier}))
    resp = handler.get_priority(user_id="u")
    assert resp.priority == expected_priority
```

## Fixtures

Use fixtures for setup that multiple tests share:

```python
@pytest.fixture
def handler():
    tier_lookup = FakeTierLookup({"u": "vip-gold"})
    return PriorityHandler(tier_lookup)

def test_priority_returns_100(handler):
    resp = handler.get_priority(user_id="u")
    assert resp.priority == 100
```

Scope fixtures to `function` (default — fresh per test) unless you have an expensive setup you can genuinely share (`session` scope). Shared mutable state across tests is the #1 cause of flaky suites.

## Fakes over mocks

Prefer hand-written fakes (simple classes with the subset of methods under test) over `unittest.mock` or `pytest-mock`. Mocks over-specify behavior and make refactoring painful.

```python
class FakeTierLookup:
    def __init__(self, data: dict):
        self._data = data
    def lookup(self, user_id: str) -> str:
        if user_id not in self._data:
            raise NotFoundError(user_id)
        return self._data[user_id]
```

Mocks are acceptable when the interface is large and the test needs only one method, but don't reach for `mock.patch` reflexively.

## What to test

For each handler:

- **Happy path.** Typical input → expected output.
- **One failure path.** Missing required field raises `ValueError` / gRPC `INVALID_ARGUMENT`; unknown user raises `NotFoundError`; etc.

## Running

From the app directory (where `pyproject.toml` or `setup.py` lives):

```bash
pytest                                  # all tests in the default discovery path
pytest -v                               # verbose (shows each test as it runs)
pytest tests/test_handler.py            # one file
pytest tests/test_handler.py::test_priority_vip_tier    # one test
pytest -k "priority and not tier"       # filter by name pattern
pytest --cov=mypackage                  # with coverage (requires pytest-cov)
pytest --cov=mypackage --cov-report=html   # HTML coverage report
```

Coverage needs `pytest-cov`: `pip install pytest-cov`.

## Async tests

Event Handlers (Python) are usually written with `async def`. Test with `pytest-asyncio`:

```python
import pytest

@pytest.mark.asyncio
async def test_on_event_happy_path():
    handler = EventHandler()
    result = await handler.on_message(valid_payload)
    assert result is None  # or whatever success looks like
```

Install: `pip install pytest-asyncio`. In `pyproject.toml` or `pytest.ini`, set `asyncio_mode = "auto"` to skip the `@pytest.mark.asyncio` decorator on every test.

## Skipping integration tests

Integration tests live under `tests/integration/` and use a marker:

```python
import pytest

@pytest.mark.integration
def test_live_ags_call(): ...
```

Configure `pytest.ini` to deselect by default:

```ini
[pytest]
addopts = -m "not integration"
```

Run integration with `pytest -m integration tests/integration/`. See `references/test/integration.md`.

## Common failure modes

| Symptom | Usual cause |
|---|---|
| `no tests ran` | File or function not prefixed `test_`, or you're in the wrong directory. |
| `ImportError: No module named mypackage` | Package not installed (`pip install -e .`) or PYTHONPATH wrong. |
| Flaky test (order-dependent) | Module-level mutable state, cached imports, or a fixture with wrong scope. |
| Test for async code hangs | Missing `@pytest.mark.asyncio` or `asyncio_mode = auto` config. |

## When handlers call AGS

Inject the AGS client; test with a fake. If the handler imports the AGS SDK directly, refactor to dependency-injection (constructor parameter, or a factory fixture that returns the SDK) so tests can substitute.

Real AGS calls go in integration tests, not unit tests.
