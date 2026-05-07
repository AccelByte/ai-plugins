---
patch: am
language: go
app-types:
- event-handler
docs: https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
see-also:
- '[am-python.md](am-python.md)'
- '[am-pub-go.md](am-pub-go.md)'
---

# Async Messaging — Go

Adds an Async Messaging consumer to a cloned Go Event Handler template. AccelByte delivers messages to your app via gRPC — you define which topics to subscribe to in the proto file and implement `OnMessage` to process them.

## Compatibility

**Event Handler** only.

## What This Patch Adds

- `pkg/proto/async_messaging/consumer_service.proto` — service definition; customer edits the topics list
- `pkg/pb/async_messaging/` — generated Go gRPC bindings (from `make proto`)
- `pkg/service/asyncMessagingHandler.go` — handler stub implementing `OnMessage`
- `main.go` — pb import updated, example handlers replaced with the AM handler registration

## Steps

Apply these steps in the app directory after cloning the template.

### 1. Create the proto file

Create `pkg/proto/async_messaging/consumer_service.proto`:

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

### 2. Generate the Go gRPC bindings

```bash
make proto
```

This generates `pkg/pb/async_messaging/consumer_service.pb.go` and `consumer_service_grpc.pb.go`. Requires Docker (the Makefile builds a `proto-builder` image). Inside a devcontainer, `./proto.sh` is run directly instead.

If `make proto` fails, check that Docker is running and the Dockerfile has a `proto-builder` stage.

### 3. Create `pkg/service/asyncMessagingHandler.go`

```go
package service

import (
	"context"
	"log/slog"

	"google.golang.org/protobuf/types/known/emptypb"

	pb "<module>/pkg/pb/async_messaging"
)

type AsyncMessagingHandler struct {
	pb.UnimplementedAsyncMessagingConsumerServiceServer
}

func NewAsyncMessagingHandler() *AsyncMessagingHandler {
	return &AsyncMessagingHandler{}
}

func (h *AsyncMessagingHandler) OnMessage(ctx context.Context, msg *pb.ReceivedMessage) (*emptypb.Empty, error) {
	slog.Default().Info("received message", "topic", msg.Topic, "body", msg.Body, "metadata", msg.Metadata)

	// TODO: implement message handling logic here

	return &emptypb.Empty{}, nil
}
```

Replace `<module>` with the module name from `go.mod` (first line: `module <name>`).

### 4. Update `main.go`

Read `main.go` and make these changes:

**a. Update the pb import.** Find the existing `pb "..."` import pointing at the template's example pb package. Replace it with:

```go
pb "<module>/pkg/pb/async_messaging"
```

**b. Remove the example handler registrations.** Find all `pb.Register...Server(s, ...)` calls and remove them. They register the template's built-in example handlers which are not used in the AM pattern.

**c. Register the AM handler.** Add after the existing server setup:

```go
asyncHandler := service.NewAsyncMessagingHandler()
pb.RegisterAsyncMessagingConsumerServiceServer(s, asyncHandler)
```

**d. Remove any `ITEM_ID_TO_GRANT` env check** if present — it's part of the base template's example and not needed.

## Verify

After applying:

1. `go build ./...` passes with no errors
2. `pkg/pb/async_messaging/consumer_service.pb.go` exists
3. `main.go` registers `AsyncMessagingConsumerServiceServer` and no longer registers the old example handlers
