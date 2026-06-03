---
patch: am-pub
language: python
app-types:
- service-extension
docs: https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
last-verified: 2026-05-09
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
see-also:
- '[am-pub-go.md](am-pub-go.md)'
- '[am-python.md](am-python.md)'
---

# Async Messaging Publisher — Python

Adds an Async Messaging publisher to a cloned Python Service Extension template. Your app calls the sidecar's gRPC publisher service to push messages to a topic — the sidecar handles routing to the configured messaging backend.

## Compatibility

**Service Extension** only.

## What This Patch Adds

- `proto/async_messaging/publisher_service.proto` — publisher client contract
- `src/async_messaging/publisher_service_pb2.py` and `publisher_service_pb2_grpc.py` — generated Python gRPC bindings (from `make proto`)
- `src/app/services/my_service.py` — service accepts publisher client and enabled flag; `PublishMessage` call added
- `src/app/__main__.py` — publisher channel created, `ASYNC_MESSAGING_PUBLISHER_ENABLED` flag read, stub passed to service

## Steps

Apply these steps in the app directory after cloning the template.

### 1. Create the proto file

Copy `publisher_service.proto` from the canonical proto repository at `github.com/AccelByte/accelbyte-api-proto` (check the `asyncapi/` or `extend/` subtree) into `proto/async_messaging/publisher_service.proto`. The version below is a reference — always prefer the canonical repo to avoid drift.

Create `proto/async_messaging/publisher_service.proto`:

```proto
syntax = "proto3";

package accelbyte.extend.async_messaging;
// Version v1.0.0

import "google/protobuf/any.proto";
import "google/protobuf/empty.proto";
import "google/protobuf/struct.proto";
import "google/protobuf/descriptor.proto";

option csharp_namespace = "AccelByte.Extend.AsyncMessaging";
option go_package = "accelbyte.net/extend/asyncMessaging";
option java_multiple_files = true;
option java_package = "net.accelbyte.extend.asyncMessaging";

message PublishMessageRequest {
  string body = 1;
  string topic = 2;  // topic name to publish to

  // TraceId
  map<string, string> metadata = 3;
}

service AsyncMessagingPublisherService {
  rpc PublishMessage(PublishMessageRequest) returns (google.protobuf.Empty) {
  };
}
```

### 2. Generate the Python gRPC bindings

```bash
make proto
```

This generates `src/async_messaging/publisher_service_pb2.py` and `publisher_service_pb2_grpc.py`. Requires Docker. Inside a devcontainer, `./proto.sh` is run directly.

### 3. Create `src/async_messaging/__init__.py`

If it does not exist, create it as an empty file to make `async_messaging` importable as a package.

### 4. Update `src/app/services/my_service.py`

Read the file. Add publisher client support to the service:

**a. Add imports** at the top:

```python
from async_messaging.publisher_service_pb2 import PublishMessageRequest
from async_messaging.publisher_service_pb2_grpc import AsyncMessagingPublisherServiceStub
```

**b. Add constructor parameters** for the publisher:

```python
def __init__(
    self,
    # ... existing params ...
    publisher_client: AsyncMessagingPublisherServiceStub,
    publish_enabled: bool,
) -> None:
    # ... existing assignments ...
    self.publisher_client = publisher_client
    self.publish_enabled = publish_enabled
```

**c. In the method where you want to publish,** add the publish call:

```python
msg = PublishMessageRequest(
    body="<your JSON payload>",
    topic="<your topic name>",
    metadata={},  # optional trace metadata
)
if not self.publish_enabled:
    self.logger.info(f"Publishing disabled — would publish: {msg}")
else:
    try:
        await self.publisher_client.PublishMessage(msg)
    except Exception as e:
        await context.abort(StatusCode.INTERNAL, f"failed to publish message: {e}")
```

Add `from grpc import StatusCode` if not already imported.

### 5. Update `src/app/__main__.py`

Read `__main__.py`. Make these changes:

**a. Add imports** near the top:

```python
import grpc.aio

from async_messaging.publisher_service_pb2_grpc import AsyncMessagingPublisherServiceStub
```

**b. Add default constants:**

```python
DEFAULT_ASYNC_MESSAGING_PUBLISHER_GRPC_HOST: str = "localhost"  # not in official docs; may be subject to change
DEFAULT_ASYNC_MESSAGING_PUBLISHER_GRPC_PORT: int = 7474
DEFAULT_ASYNC_MESSAGING_PUBLISHER_ENABLED: bool = True  # not in official docs; may be subject to change
```

**c. In `main()`, read publisher config and create the stub.** Add before the service is constructed:

```python
with env.prefixed("ASYNC_MESSAGING_PUBLISHER_"):
    publisher_host = env.str("GRPC_HOST", DEFAULT_ASYNC_MESSAGING_PUBLISHER_GRPC_HOST)
    publisher_port = env.int("GRPC_PORT", DEFAULT_ASYNC_MESSAGING_PUBLISHER_GRPC_PORT)
    publish_enabled = env.bool("ENABLED", DEFAULT_ASYNC_MESSAGING_PUBLISHER_ENABLED)

publisher_channel = grpc.aio.insecure_channel(f"{publisher_host}:{publisher_port}")
publisher_client = AsyncMessagingPublisherServiceStub(publisher_channel)
```

**d. Update the service constructor call** to pass the new values:

Find the `AppOptionGRPCService(...)` or `AppGRPCServiceOpt(...)` call that registers the main service. Pass `publisher_client` and `publish_enabled` to the service class:

```python
# Example — adapt to the actual constructor signature in my_service.py
MyService(
    sdk=sdk,
    logger=logger,
    publisher_client=publisher_client,
    publish_enabled=publish_enabled,
)
```

## Verify

After applying:

1. `make proto` completes and `src/async_messaging/publisher_service_pb2_grpc.py` exists
2. `python -m app` starts without import errors
3. The service connects to `ASYNC_MESSAGING_PUBLISHER_GRPC_HOST:ASYNC_MESSAGING_PUBLISHER_GRPC_PORT` on startup
