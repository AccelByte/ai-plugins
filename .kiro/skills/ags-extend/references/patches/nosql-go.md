---
patch: nosql
language: go
app-types:
- service-extension
docs: https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-nosql-database/
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-nosql-database/
see-also:
- '[sql-go.md](sql-go.md)'
- '[ts-go.md](ts-go.md)'
- '[am-go.md](am-go.md)'
---

# NoSQL (MongoDB / DocumentDB) — Go

Replaces the CloudSave storage backend in a Go Service Extension template with MongoDB. AccelByte's managed NoSQL offering is DocumentDB (MongoDB-compatible). The connection string format differs slightly between local development (plain MongoDB) and production (DocumentDB with TLS), so the wiring reads an optional CA cert path from the environment to switch modes.

## Compatibility

**Service Extension** only.

## What This Patch Adds

- MongoDB Go driver v2 dependency (`go.mongodb.org/mongo-driver/v2`)
- `pkg/storage/storage.go` — replace the CloudSave implementation with a MongoDB one; customer adds their own CRUD methods
- `main.go` — connection string construction (with TLS branch for DocumentDB), pool sizing, `mongoStorage.Close` deferred on shutdown
- `.env.template` — `DOCDB_HOST`, `DOCDB_USERNAME`, `DOCDB_PASSWORD`, `DOCDB_DATABASE_NAME`
- `docker-compose.yaml` — `mongodb` service for local development, env vars wired into the app service

## Steps

Apply these steps in the app directory after cloning the template.

### 1. Add the MongoDB driver

```bash
go get go.mongodb.org/mongo-driver/v2
```

### 2. Replace `pkg/storage/storage.go`

Replace the existing CloudSave implementation with MongoDB. Read the current file first to understand the interface it satisfies — keep the same interface, swap the backend.

The constructor and connection pattern to use:

```go
package storage

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type MongoDBStorage struct {
	client     *mongo.Client
	database   *mongo.Database
	collection *mongo.Collection
}

func NewMongoDBStorage(connectionString, databaseName string, minPoolSize, maxPoolSize uint64) (*MongoDBStorage, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().
		ApplyURI(connectionString).
		SetRetryWrites(false). // required for DocumentDB compatibility
		SetMinPoolSize(minPoolSize).
		SetMaxPoolSize(maxPoolSize))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	if err = client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	database := client.Database(databaseName)
	collection := database.Collection("<collection-name>") // replace with your collection name

	return &MongoDBStorage{
		client:     client,
		database:   database,
		collection: collection,
	}, nil
}

// Close disconnects the MongoDB client. Call this on shutdown.
func (m *MongoDBStorage) Close(ctx context.Context) error {
	return m.client.Disconnect(ctx)
}

// Add your CRUD methods here. Use m.collection for operations.
// Import "go.mongodb.org/mongo-driver/v2/bson" for filters and updates.
```

Replace `<collection-name>` with the customer's collection. Add CRUD methods to satisfy the storage interface used by the service layer.

### 3. Update `main.go`

Read `main.go`. Find where the CloudSave storage is initialized (look for `cloudsave.AdminGameRecordService` or `storage.NewCloudSaveStorage`). Replace that block with:

```go
// Initialize MongoDB storage
docdbHost := common.GetEnv("DOCDB_HOST", "mongodb:27017")
docdbUsername := common.GetEnv("DOCDB_USERNAME", "admin")
docdbPassword := common.GetEnv("DOCDB_PASSWORD", "password")
docdbCaCertFilePath := common.GetEnv("DOCDB_CA_CERT_FILE_PATH", "")

var mongoConnectionString string
if docdbCaCertFilePath != "" {
    mongoConnectionString = fmt.Sprintf("mongodb://%s:%s@%s/?tls=true&tlsCAFile=%s", docdbUsername, docdbPassword, docdbHost, docdbCaCertFilePath)
} else {
    mongoConnectionString = fmt.Sprintf("mongodb://%s:%s@%s", docdbUsername, docdbPassword, docdbHost)
}

mongoDatabase := common.GetEnv("DOCDB_DATABASE_NAME", "my_database")
minPoolSize := uint64(5)
maxPoolSize := uint64(30)

mongoStorage, err := storage.NewMongoDBStorage(mongoConnectionString, mongoDatabase, minPoolSize, maxPoolSize)
if err != nil {
    logger.Error("Failed to initialize MongoDB storage", "error", err)
    os.Exit(1)
}
defer func() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    if err := mongoStorage.Close(ctx); err != nil {
        logger.Error("Error closing MongoDB connection", "error", err)
    }
}()
```

Update the service constructor call to pass `mongoStorage` instead of the CloudSave storage.

Remove the CloudSave imports (`cloudsave`, `factory.NewCloudsaveClient`, etc.) if they are no longer used.

Add `"fmt"` and `"time"` to imports if not already present.

### 4. Update `.env.template`

Append:

```
DOCDB_HOST=mongodb:27017
DOCDB_USERNAME=admin
DOCDB_PASSWORD=password
DOCDB_DATABASE_NAME=<your_database_name>
```

`DOCDB_CA_CERT_FILE_PATH` is optional — only needed when connecting to DocumentDB in production with TLS. Leave it out of `.env.template` and set it in the deployment environment.

### 5. Update `docker-compose.yaml`

Add a `mongodb` service and wire the env vars into the app service.

In the app service's `environment` block, add:

```yaml
- DOCDB_HOST=${DOCDB_HOST}
- DOCDB_USERNAME=${DOCDB_USERNAME}
- DOCDB_PASSWORD=${DOCDB_PASSWORD}
- DOCDB_DATABASE_NAME=${DOCDB_DATABASE_NAME}
```

Add `depends_on: [mongodb]` to the app service.

Add a new top-level service:

```yaml
  mongodb:
    image: mongo:8.0
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.runCommand({ ping: 1 })"]
      interval: 10s
      retries: 5
      start_period: 30s
      timeout: 10s
```

## Verify

After applying:

1. `go build ./...` passes with no errors
2. `.env.template` contains the four `DOCDB_*` vars
3. `docker-compose up` starts both the app and the `mongodb` container without errors
4. `mongoStorage.Close` is deferred in `main.go`
