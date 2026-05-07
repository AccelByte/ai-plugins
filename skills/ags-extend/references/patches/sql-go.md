---
patch: sql
language: go
app-types:
- service-extension
docs: https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-sql-database/
last-verified: 2026-04-21
sources:
- https://docs.accelbyte.io/gaming-services/modules/foundations/extend/extend-sql-database/
- https://github.com/AccelByte/extend-service-extension-with-sql-go
see-also:
- '[nosql-go.md](nosql-go.md)'
- '[am-pub-go.md](am-pub-go.md)'
---

# SQL (PostgreSQL / Aurora) — Go

Replaces the CloudSave storage backend in a Go Service Extension template with PostgreSQL. AccelByte's managed SQL offering is Amazon Aurora PostgreSQL-compatible. The connection string format differs between local development (plain PostgreSQL) and production (Aurora with TLS), so the wiring reads an optional CA cert path from the environment to switch modes.

## Compatibility

**Service Extension** only.

## What This Patch Adds

- `pgx/v5` PostgreSQL driver dependency (`github.com/jackc/pgx/v5`) — uses `pgxpool` for built-in connection pooling
- `pkg/storage/storage.go` — replace the CloudSave implementation with a PostgreSQL one using `pgxpool`; customer adds their own queries
- `main.go` — connection string construction (with TLS branch for Aurora), `postgresStorage.Close` deferred on shutdown
- `.env.template` — `SQLDB_HOST`, `SQLDB_USERNAME`, `SQLDB_PASSWORD`, `SQLDB_DATABASE_NAME`, `SQLDB_CA_CERT_FILE_PATH`
- `docker-compose.yaml` — `postgres` service for local development, env vars wired into the app service

## Steps

Apply these steps in the app directory after cloning the template.

### 1. Add the PostgreSQL driver

```bash
go get github.com/jackc/pgx/v5
```

This pulls in `pgx/v5` which includes `pgxpool` for connection pooling. Do not use `lib/pq` — the sample repo uses `pgx/v5`.

### 2. Replace `pkg/storage/storage.go`

Replace the existing CloudSave implementation with PostgreSQL. Read the current file first to understand the interface it satisfies — keep the same interface, swap the backend.

The constructor and connection pattern to use:

```go
package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgreSQLStorage struct {
	pool *pgxpool.Pool
}

func NewPostgreSQLStorage(connectionString string) (*PostgreSQLStorage, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Parse connection string and configure pool
	config, err := pgxpool.ParseConfig(connectionString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PostgreSQL connection string: %w", err)
	}

	// Create connection pool
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create PostgreSQL connection pool: %w", err)
	}

	// Test the connection
	if err = pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	storage := &PostgreSQLStorage{pool: pool}

	// Initialize schema (create tables if they don't exist)
	if err = storage.initializeSchema(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to initialize database schema: %w", err)
	}

	return storage, nil
}

func (p *PostgreSQLStorage) initializeSchema(ctx context.Context) error {
	schema := `
	CREATE TABLE IF NOT EXISTS <your_table> (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE
		-- add your columns here
	);
	`

	_, err := p.pool.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	return nil
}

// Close closes the PostgreSQL connection pool. Call this on shutdown.
func (p *PostgreSQLStorage) Close(ctx context.Context) error {
	p.pool.Close()
	return nil
}

// Add your query methods here. Use p.pool for operations.
// Example:
//   func (p *PostgreSQLStorage) GetItem(ctx context.Context, id string) (*Item, error) {
//       row := p.pool.QueryRow(ctx, "SELECT id, name FROM items WHERE id = $1", id)
//       ...
//   }
```

Replace `<your_table>` with the customer's table name. Add query methods to satisfy the storage interface used by the service layer.

### 3. Update `main.go`

Read `main.go`. Find where the CloudSave storage is initialized (look for `cloudsave.AdminGameRecordService` or `storage.NewCloudSaveStorage`). Replace that block with:

```go
// Initialize PostgreSQL storage
sqlHost := common.GetEnv("SQLDB_HOST", "localhost:5432")
sqlUsername := common.GetEnv("SQLDB_USERNAME", "postgres")
sqlPassword := common.GetEnv("SQLDB_PASSWORD", "postgres")
sqlDatabase := common.GetEnv("SQLDB_DATABASE_NAME", "extend")
sqlCACertFile := common.GetEnv("SQLDB_CA_CERT_FILE_PATH", "")

// Build PostgreSQL connection string (URI format)
postgresConnectionString := fmt.Sprintf(
    "postgres://%s:%s@%s/%s",
    sqlUsername,
    sqlPassword,
    sqlHost,
    sqlDatabase,
)
if sqlCACertFile != "" {
    postgresConnectionString += fmt.Sprintf("?sslmode=require&sslrootcert=%s", sqlCACertFile)
}

postgresStorage, err := storage.NewPostgreSQLStorage(postgresConnectionString)
if err != nil {
    logger.Error("Failed to initialize PostgreSQL storage", "error", err)
    os.Exit(1)
}
defer func() {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    if err := postgresStorage.Close(ctx); err != nil {
        logger.Error("Error closing PostgreSQL connection", "error", err)
    }
}()
```

Update the service constructor call to pass `postgresStorage` instead of the CloudSave storage.

Remove the CloudSave imports (`cloudsave`, `factory.NewCloudsaveClient`, etc.) if they are no longer used.

Add `"fmt"` and `"time"` to imports if not already present.

**Note:** `SQLDB_HOST` includes the port (e.g. `localhost:5432`). There is no separate `SQLDB_PORT` variable.

### 4. Update `.env.template`

Append:

```
SQLDB_HOST=localhost:5432
SQLDB_USERNAME=postgres
SQLDB_PASSWORD=postgres
SQLDB_DATABASE_NAME=<your_database_name>
SQLDB_CA_CERT_FILE_PATH=
```

`SQLDB_CA_CERT_FILE_PATH` is empty for local development. In production (Aurora), set it to the CA certificate path provided by AccelByte.

### 5. Update `docker-compose.yaml`

Add a `postgres` service and wire the env vars into the app service.

In the app service's `environment` block, add:

```yaml
- POSTGRES_HOST=${POSTGRES_HOST}
- POSTGRES_PORT=${POSTGRES_PORT}
- POSTGRES_USERNAME=${POSTGRES_USERNAME}
- POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
- POSTGRES_DATABASE_NAME=${POSTGRES_DATABASE_NAME}
- POSTGRES_SSLMODE=${POSTGRES_SSLMODE:-disable}
```

**Note:** The docker-compose uses `POSTGRES_*` env vars for the local container wiring. The app reads `SQLDB_*` variables. The `.env.template` maps between them — set `SQLDB_HOST=postgres:5432` when running via docker-compose (the service name `postgres` resolves inside the Docker network).

Add `depends_on` with health check condition to the app service:

```yaml
    depends_on:
      postgres:
        condition: service_healthy
```

Add a new top-level service:

```yaml
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=guild_service
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d guild_service"]
      interval: 10s
      retries: 5
      start_period: 30s
      timeout: 5s
```

Add a named volume at the top level:

```yaml
volumes:
  postgres_data:
    driver: local
```

Replace `guild_service` with the customer's database name.

## Production notes

- **TLS is required** for Aurora connections. Set `SQLDB_CA_CERT_FILE_PATH` to the CA certificate provided by AccelByte. The connection string appends `?sslmode=require&sslrootcert=<path>` when the cert path is set.
- **Connection pooling** — `pgxpool` manages the pool internally. Default pool sizes are usually fine; tune via `pgxpool.ParseConfig` options if needed.
- **Local tunnel** — use `extend-helper-cli tunnel --resource-name <name> --namespace <ns> --local-port <port>` to connect to the managed Aurora instance from your local machine for debugging.
- **Provisioning** — request SQL database access via Admin Portal → Development Utilities → Extend Database Integration.
- **Schema migrations** — the sample repo uses `initializeSchema` in the storage constructor with `CREATE TABLE IF NOT EXISTS`. For production, consider a dedicated migration tool (e.g. `golang-migrate`) for versioned schema changes.

## Verify

After applying:

1. `go build ./...` passes with no errors
2. `.env.template` contains the five `SQLDB_*` vars
3. `docker-compose up` starts both the app and the `postgres` container without errors
4. `postgresStorage.Close` is deferred in `main.go`
