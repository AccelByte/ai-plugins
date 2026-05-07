---
last-verified: 2026-04-21
note: General protobuf conventions as applied to Extend apps. Not AccelByte-specific
  — aligned with the widely-used google.aip.dev style and standard protoc-gen-go defaults.
see-also:
- '[workflow.md](workflow.md)'
---

# Proto Conventions

When you're editing `.proto` files (typically for Service Extensions where the contract is yours, occasionally when customizing an Override handler's request types), follow these conventions. They match the templates' existing style and keep your generated code clean.

## Versioning

Use a `v1`, `v2` package segment:

```proto
package mystudio.leaderboard.v1;
```

Never bump the version for additive changes (new optional field, new method). Bump to `v2` only when you need to make a breaking change AND you need to keep the old contract working during migration.

Two packages can coexist in the same service; the server implements both until callers have migrated off `v1`.

## Naming

**Messages:** `UpperCamelCase`. Request/Response suffix convention:

```proto
message GetPlayerRequest { ... }
message GetPlayerResponse { ... }
```

Even single-field wrappers — using `string` or `int64` directly as a request type ties you to that shape forever; a `message` with one field can grow without breaking callers.

**Methods:** `UpperCamelCase` verb-first. Standard verbs:

- `Get<Resource>` — single read
- `List<Resources>` — collection read
- `Create<Resource>` — create
- `Update<Resource>` — mutate
- `Delete<Resource>` — remove
- `<Verb><Resource>` — domain-specific actions (`SubmitScore`, `GrantReward`, `EvaluatePriority`)

**Fields:** `snake_case` in proto, which plugins convert to the idiomatic case for each language (Go: `SnakeCase` → `CamelCase`; Python: unchanged).

**Enum values:** `SCREAMING_SNAKE_CASE` prefixed with the enum type name:

```proto
enum MatchStatus {
  MATCH_STATUS_UNSPECIFIED = 0;
  MATCH_STATUS_PENDING = 1;
  MATCH_STATUS_ACTIVE = 2;
  MATCH_STATUS_COMPLETED = 3;
}
```

The `UNSPECIFIED = 0` entry is mandatory. proto3 treats zero as the default; having an explicit `UNSPECIFIED` means you can distinguish "not set" from "set to first real value."

## Field numbers

Never change field numbers. The wire format depends on them. If you need to drop a field, leave the number reserved:

```proto
message Player {
  reserved 3;
  reserved "old_field_name";
  string id = 1;
  string display_name = 2;
  // field 3 was `level`, removed in v2 — reserved so it can't be reused
  int64 xp = 4;
}
```

When adding a field, use the next unused number. Don't renumber existing fields to "clean up" — that's a wire-breaking change.

## Optional vs. required

proto3 doesn't have `required`. Every field is effectively optional. Use `optional` only when you need to distinguish "field unset" from "field set to zero value" — it costs an extra byte on the wire.

```proto
optional int32 max_players = 5;  // explicit optional; presence detectable
int32 min_players = 6;           // implicit optional; zero value indistinguishable from unset
```

For fields where zero / empty string has a meaningful "unset" interpretation, use `optional`. Otherwise skip it.

## REST annotations (Service Extension)

Service Extensions expose REST via gRPC Gateway using `google.api.http` annotations:

```proto
import "google/api/annotations.proto";

service LeaderboardService {
  rpc GetLeaderboard(GetLeaderboardRequest) returns (GetLeaderboardResponse) {
    option (google.api.http) = {
      get: "/v1/leaderboards/{leaderboard_id}"
    };
  }
  rpc SubmitScore(SubmitScoreRequest) returns (SubmitScoreResponse) {
    option (google.api.http) = {
      post: "/v1/leaderboards/{leaderboard_id}/scores"
      body: "*"
    };
  }
}
```

Path parameters (`{leaderboard_id}`) must be singular non-repeated fields on the request message. Everything else goes in the body for POST/PUT/PATCH.

Include the `v1` segment in the path and in the proto package — keep them aligned.

## Error returns

Return standard gRPC status codes, not custom error messages:

- `INVALID_ARGUMENT` — caller's request is malformed or fails validation.
- `NOT_FOUND` — the requested resource doesn't exist.
- `ALREADY_EXISTS` — caller tried to create something that already exists.
- `PERMISSION_DENIED` — caller is authenticated but lacks permission for this resource.
- `UNAUTHENTICATED` — caller isn't authenticated.
- `FAILED_PRECONDITION` — system state prevents the operation (e.g. resource is in the wrong state).
- `INTERNAL` — bug. Don't use for expected error conditions.

Attach human-readable detail in the status message; don't invent a custom "error" field in response messages.

## Documentation

Every message and method gets a leading comment. Don't leave a generated contract undocumented — callers see those comments in auto-generated SDKs.

```proto
// GetLeaderboard returns the current top N entries for a leaderboard.
// The size of N is configured per-leaderboard server-side and cannot exceed 100.
rpc GetLeaderboard(GetLeaderboardRequest) returns (GetLeaderboardResponse);
```

## Don't do these

- **Don't encode enums as strings.** Use proto enums. They're cheaper on the wire and unambiguous.
- **Don't nest messages more than 2 deep** unless the nesting is structurally meaningful. Flat messages are easier to read.
- **Don't reuse request messages across methods.** `GetPlayerRequest` and `UpdatePlayerRequest` deserve to be different types even if they currently have the same fields. They'll diverge.
- **Don't mix the Override contract with your own types.** If you're implementing an Override, the request/response types come from AGS. Don't shadow them with local copies.

## When in doubt

Look at the template's existing `.proto` files. Templates are AccelByte-maintained and follow internal conventions. When your edit looks out of place next to the existing style, the existing style is probably right.

For deeper guidance, the community-standard reference is Google's API Improvement Proposals at https://google.aip.dev/ — relevant for Service Extensions in particular.
