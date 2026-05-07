---
patch: am
language: python
app-types:
- event-handler
docs: https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
see-also:
- '[am-go.md](am-go.md)'
- '[am-pub-python.md](am-pub-python.md)'
---

# Async Messaging — Python

Adds an Async Messaging consumer to a cloned Python Event Handler template. AccelByte delivers messages to your app via gRPC — you define which topics to subscribe to in the proto file and implement `onMessage` to process them.

## Compatibility

**Event Handler** only.

## What This Patch Adds

- `proto/async_messaging/consumer_service.proto` — service definition; customer edits the topics list
- `src/async_messaging/consumer_service_pb2.py` and `consumer_service_pb2_grpc.py` — generated Python gRPC bindings (from `make proto`)
- `src/app/services/async_messaging_handler.py` — handler stub implementing `onMessage`
- `src/app/__main__.py` — handler import added, example handlers replaced with AM handler registration

## Steps

Apply these steps in the app directory after cloning the template.

### 1. Create the proto file

Create `proto/async_messaging/consumer_service.proto`:

```proto
syntax = "proto3";

package accelbyte.extend.async_messaging;

import "google/protobuf/empty.proto";
import "google/protobuf/descriptor.proto";

option go_package = "accelbyte.net/extend/asyncMessaging";

extend google.protobuf.MethodOptions {
  string topics_subscription = 50001;
}

message ReceivedMessage {
  string body = 1;
  string topic = 2;
  map<string, string> metadata = 3;
}

service AsyncMessagingConsumerService {
  rpc onMessage(ReceivedMessage) returns (google.protobuf.Empty) {
    option (topics_subscription) = "TopicA, TopicB"; // replace with actual topic names
  };
}
```

Tell the user to replace `TopicA, TopicB` with their actual topic names before proceeding.

### 2. Generate the Python gRPC bindings

```bash
make proto
```

This generates `src/async_messaging/consumer_service_pb2.py` and `consumer_service_pb2_grpc.py`. Requires Docker (the Makefile builds a `proto-builder` image). Inside a devcontainer, `./proto.sh` is run directly instead.

If `make proto` fails, check that Docker is running and the Dockerfile has a `proto-builder` stage.

### 3. Create `src/async_messaging/__init__.py`

If it does not exist, create it as an empty file to make `async_messaging` importable as a package.

### 4. Create `src/app/services/async_messaging_handler.py`

```python
import logging
from logging import Logger
from typing import Optional

from google.protobuf.empty_pb2 import Empty

from async_messaging.consumer_service_pb2 import ReceivedMessage, DESCRIPTOR
from async_messaging.consumer_service_pb2_grpc import AsyncMessagingConsumerServiceServicer


class AsyncMessagingHandlerService(AsyncMessagingConsumerServiceServicer):
    full_name: str = DESCRIPTOR.services_by_name[
        "AsyncMessagingConsumerService"
    ].full_name

    def __init__(
        self,
        logger: Optional[Logger] = None,
    ) -> None:
        self.logger = logger or logging.getLogger(__name__)

    async def onMessage(self, request: ReceivedMessage, context) -> Empty:
        self.logger.info(
            "received message",
            extra={"topic": request.topic, "body": request.body, "metadata": dict(request.metadata)},
        )

        # TODO: implement message handling logic here

        return Empty()
```

### 5. Update `src/app/__main__.py`

Read `__main__.py` and make these changes:

**a. Add imports** near the top (after existing grpc plugin imports):

```python
from async_messaging.consumer_service_pb2_grpc import (
    add_AsyncMessagingConsumerServiceServicer_to_server,
)
from .services.async_messaging_handler import AsyncMessagingHandlerService
```

**b. Remove the example handler registrations.** Find any `AppGRPCServiceOpt(...)` call that registers the template's built-in example service (typically an IAM or CloudSave-related handler). Remove it.

**c. Register the AM handler.** In the `main()` function, add before `app = App(...)`:

```python
opts.append(
    AppGRPCServiceOpt(
        AsyncMessagingHandlerService(logger=logger),
        AsyncMessagingHandlerService.full_name,
        add_AsyncMessagingConsumerServiceServicer_to_server,
    )
)
```

## Verify

After applying:

1. `make proto` completes without errors and `src/async_messaging/consumer_service_pb2.py` exists
2. `python -c "from app.services.async_messaging_handler import AsyncMessagingHandlerService"` (from `src/`) succeeds
3. `python -m app` starts the gRPC server without import errors
