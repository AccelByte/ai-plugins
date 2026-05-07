---
patch: ts
language: go
app-types:
- service-extension
docs: https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-task-scheduler/
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-task-scheduler/
- https://github.com/AccelByte/extend-service-extension-with-task-scheduler-go
- https://github.com/AccelByte/extend-service-extension-with-task-scheduler-go/blob/master/pkg/proto/task_scheduler/task_scheduler.proto
see-also:
- '[nosql-go.md](nosql-go.md)'
- '[am-pub-go.md](am-pub-go.md)'
---

# Task Scheduler — Go

Adds a Task Scheduler handler to a cloned Go Service Extension template. The sidecar calls your app's `RunScheduledTask` gRPC method when a scheduled task fires — you implement what happens when it runs.

## Compatibility

**Service Extension** only.

## What This Patch Adds

- `pkg/proto/task_scheduler/task_scheduler.proto` — `ScheduledTaskHandler` service definition
- `pkg/pb/task_scheduler/` — generated Go gRPC bindings (from `make proto`)
- `pkg/service/taskSchedulerService.go` — handler implementing `RunScheduledTask`
- `main.go` — task scheduler service registered on the gRPC server

## Steps

Apply these steps in the app directory after cloning the template.

### 1. Create the proto file

Create `pkg/proto/task_scheduler/task_scheduler.proto`:

```proto
syntax = "proto3";

package accelbyte.extend.task_scheduler.v1;
// Version v1.0.0

option csharp_namespace = "AccelByte.Extend.TaskScheduler";
option go_package = "accelbyte.net/extend/taskscheduler";
option java_multiple_files = true;
option java_package = "net.accelbyte.extend.taskscheduler";

import "google/protobuf/timestamp.proto";

// ScheduledTaskHandler service - run by main container to handle scheduled tasks
// This service is implemented by the Extend service's main container
// and called by the Sidecar when a scheduled task needs to be run
service ScheduledTaskHandler {
  // RunScheduledTask runs a scheduled task
  // The main container implements this RPC to handle task runs
  rpc RunScheduledTask(ScheduledTaskRequest) returns (ScheduledTaskResponse);
}
message ScheduledTaskRequest {
  string run_id = 1;             // Unique run ID for idempotency
  string task_id = 2;            // Task definition ID
  string namespace = 3;          // Namespace
  string task_name = 4;          // Human-readable task name
  google.protobuf.Timestamp scheduled_time = 5;      // Scheduled run time
  int32 attempt_number = 6;      // Current attempt number (1-based)
  string payload = 7;            // Task payload (JSON string)
}
message ScheduledTaskResponse {
  bool success = 1;                        // Whether the task succeeded
  string message = 2;                      // Optional message or error description
  string result_data = 3;                  // Optional result data as JSON object
  int32 http_status_code = 4;              // HTTP-style status code (200, 400, 500, etc.)
}
```

### 2. Generate the Go gRPC bindings

```bash
make proto
```

This generates `pkg/pb/task_scheduler/task_scheduler.pb.go` and `task_scheduler_grpc.pb.go`. Requires Docker. Inside a devcontainer, `./proto.sh` is run directly.

### 3. Create `pkg/service/taskSchedulerService.go`

```go
package service

import (
	"context"
	"log/slog"

	ts "<module>/pkg/pb/task_scheduler"
)

type TaskSchedulerServiceImpl struct {
	ts.UnimplementedScheduledTaskHandlerServer
}

func NewTaskSchedulerService() *TaskSchedulerServiceImpl {
	return &TaskSchedulerServiceImpl{}
}

func (t *TaskSchedulerServiceImpl) RunScheduledTask(ctx context.Context, req *ts.ScheduledTaskRequest) (*ts.ScheduledTaskResponse, error) {
	slog.Default().Info("task started",
		"run_id", req.RunId,
		"task_id", req.TaskId,
		"task_name", req.TaskName,
		"namespace", req.Namespace,
		"attempt", req.AttemptNumber,
	)

	// TODO: implement task logic here
	// req.Payload contains the task payload as a JSON string
	// req.RunId can be used for idempotency checks

	return &ts.ScheduledTaskResponse{
		Success:        true,
		Message:        "task executed successfully",
		HttpStatusCode: 200,
	}, nil
}
```

Replace `<module>` with the module name from `go.mod` (first line: `module <name>`).

If your handler needs access to other services (e.g., CloudSave, a database), add them as fields and pass them in via the constructor.

### 4. Update `main.go`

Read `main.go`. Find the section that registers services on the gRPC server (look for `pb.RegisterServiceServer`). Add the task scheduler registration alongside it:

**a. Add the import** for the task scheduler pb package:

```go
ts "<module>/pkg/pb/task_scheduler"
```

**b. Register the task scheduler service** after registering the main service:

```go
// Register Task Scheduler Service
taskSchedulerService := service.NewTaskSchedulerService()
ts.RegisterScheduledTaskHandlerServer(s, taskSchedulerService)
```

## Verify

After applying:

1. `go build ./...` passes with no errors
2. `pkg/pb/task_scheduler/task_scheduler_grpc.pb.go` exists
3. `main.go` calls `ts.RegisterScheduledTaskHandlerServer`
