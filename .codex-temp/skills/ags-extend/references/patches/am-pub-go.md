---
patch: am-pub
language: go
app-types:
- service-extension
docs: https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-async-messaging/
see-also:
- '[am-pub-python.md](am-pub-python.md)'
- '[am-go.md](am-go.md)'
---

# Async Messaging Publisher — Go

Adds an Async Messaging publisher to a cloned Go Service Extension template. Your app calls the sidecar's gRPC publisher service to push messages to a topic — the sidecar handles routing to the actual SNS/SQS infrastructure.

## Compatibility

**Service Extension** only.

## What This Patch Adds

- `pkg/proto/async_messaging/publisher_service.proto` — publisher client contract
- `pkg/pb/async_messaging/` — generated Go gRPC bindings (from `make proto`)
- `pkg/service/myService.go` — service struct updated to hold publisher client and enabled flag; `PublishMessage` call added to the relevant method
- `main.go` — publisher channel dialed, `ASYNC_MESSAGING_PUBLISHER_ENABLED` flag read, client passed to service constructor

## Steps

Apply these steps in the app directory after cloning the template.

### 1. Create the proto file

Create `pkg/proto/async_messaging/publisher_service.proto`:

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
  string topic = 2;  // together with MANAGED_QUEUE_SNS_TOPIC_ARN_BASE to construct the actual SNS ARN

  // TraceId
  map<string, string> metadata = 3;
}

service AsyncMessagingPublisherService {
  rpc PublishMessage(PublishMessageRequest) returns (google.protobuf.Empty) {
  };
}
```

### 2. Generate the Go gRPC bindings

```bash
make proto
```

This generates `pkg/pb/async_messaging/publisher_service.pb.go` and `publisher_service_grpc.pb.go`. Requires Docker. Inside a devcontainer, `./proto.sh` is run directly instead.

### 3. Update `pkg/service/myService.go`

Read the file. Add the publisher client and enabled flag to the service struct and constructor:

**a. Add the import** for the publisher pb package:

```go
asyncMessaging "<module>/pkg/pb/async_messaging"
```

Replace `<module>` with the module name from `go.mod`.

**b. Add fields to the struct:**

```go
publisherClient asyncMessaging.AsyncMessagingPublisherServiceClient
publishEnabled  bool
```

**c. Add parameters to the constructor** and store them:

```go
func NewMyServiceServer(
    publisherClient asyncMessaging.AsyncMessagingPublisherServiceClient,
    publishEnabled bool,
    // ... existing params
) *MyServiceServerImpl {
    return &MyServiceServerImpl{
        publisherClient: publisherClient,
        publishEnabled:  publishEnabled,
        // ... existing fields
    }
}
```

**d. In the method where you want to publish,** add the publish call:

```go
msg := &asyncMessaging.PublishMessageRequest{
    Body:  "<your JSON payload>",
    Topic: "<your topic name>",
    Metadata: map[string]string{
        // optional trace metadata
    },
}

if !g.publishEnabled {
    slog.Default().Info("publishing disabled — would publish", "msg", msg)
} else {
    _, err = g.publisherClient.PublishMessage(ctx, msg)
    if err != nil {
        return nil, status.Errorf(codes.Internal, "failed to publish message: %v", err)
    }
}
```

### 4. Update `main.go`

Read `main.go`. Find where the service is initialized (look for `service.NewMyServiceServer`). Add the publisher wiring before that call:

**a. Add the import** for the publisher pb package (already done if you ran `make proto`):

```go
asyncMessaging "<module>/pkg/pb/async_messaging"
```

**b. Add publisher channel setup** after the gRPC server is created and before service initialization:

```go
// Setup publisher client connection
publisherServiceHost := common.GetEnv("ASYNC_MESSAGING_PUBLISHER_GRPC_HOST", "localhost")
publisherServiceAddr := publisherServiceHost + ":" + common.GetEnv("ASYNC_MESSAGING_PUBLISHER_GRPC_PORT", "7474")
publisherConn, err := grpc.NewClient(
    publisherServiceAddr,
    grpc.WithTransportCredentials(insecure.NewCredentials()),
)
if err != nil {
    logger.Error("Failed to connect to publisher service", "address", publisherServiceAddr, "error", err)
    os.Exit(1)
}
defer publisherConn.Close()

publisherClient := asyncMessaging.NewAsyncMessagingPublisherServiceClient(publisherConn)
publishEnabled := strings.ToLower(common.GetEnv("ASYNC_MESSAGING_PUBLISHER_ENABLED", "true")) == "true"
```

**c. Update the service constructor call** to pass the new values:

```go
myServiceServer := service.NewMyServiceServer(publisherClient, publishEnabled, /* existing args */)
```

Add `"google.golang.org/grpc/credentials/insecure"` to imports if not already present.

## Verify

After applying:

1. `go build ./...` passes with no errors
2. `pkg/pb/async_messaging/publisher_service_grpc.pb.go` exists
3. `main.go` dials `ASYNC_MESSAGING_PUBLISHER_GRPC_HOST:ASYNC_MESSAGING_PUBLISHER_GRPC_PORT` and passes the client to the service constructor
