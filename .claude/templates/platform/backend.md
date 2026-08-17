# Backend Platform Spec
<!-- Written by: architect-agent | Read by: backend-agent, qa-api-agent -->

## Stack
```
Framework:    [Express | Fastify | NestJS | FastAPI | Django+DRF | Go/Gin | other]
Language:     [TypeScript | Python 3.12 | Go 1.22]
Runtime:      [Node 20 | Python 3.12 | Go 1.22]
ORM:          [Prisma | Drizzle | SQLAlchemy | Django ORM | GORM | sqlx]
Database:     [PostgreSQL | MySQL | MongoDB | SQLite] [version]
Migrations:   [Prisma Migrate | Alembic | Django migrations | Flyway | golang-migrate]
Auth:         [JWT + [library] | OAuth2 | session-based]
Cache:        [Redis | in-memory | none]
Queue:        [BullMQ | Celery | none]
Testing:      [Jest + supertest | pytest + httpx | Go testing + testify]
```

## Project Structure
```
[paste actual backend structure here]
# default domain-modular layout:
#   {src}/{module}/api/          (handlers, services, repos, models, middleware for the module)
#   {src}/{module}/__tests__/    (colocated unit/integration tests)
#   {src}/_shared/api/           (cross-module middleware, shared libs)
# Resolve real paths via MANIFEST ## Paths.module_src and Paths.unit_tests.
```

## Layered Architecture
```
[Route / Handler]     → input parsing, validation, call service
[Service]             → business logic, orchestrate repositories
[Repository]          → database queries only
[Model / Schema]      → data types, validation schemas

File locations (per module, e.g. auth):
  Routes:       {src}/{module}/api/[routes | handlers]/
  Services:     {src}/{module}/api/services/
  Repositories: {src}/{module}/api/repositories/
  Models:       {src}/{module}/api/models/ (or schemas/)
  Middleware:   {src}/{module}/api/middleware/  (or {src}/_shared/api/middleware/ for cross-cutting)
```

## Request/Response Patterns
```typescript
// [Paste the project's standard request handler pattern]
// [Include how validation is done — e.g. zod schema inline or separate file]
// [Include how responses are formatted]
```

## Error Response Format
```json
{
  "code": "ERROR_CODE_STRING",
  "message": "Human readable message",
  "details": {}
}
```
All error codes must match the module's api-contracts (MANIFEST ## Paths.api_contracts).

## Authentication Pattern
```
Type:           [JWT Bearer token | Session cookie | API key]
Token location: [Authorization header | httpOnly cookie]
Expiry:         [access: 15min | refresh: 7d — or project values]
Middleware:     [how routes are protected — e.g. requireAuth middleware]
```

## Database Conventions
```
Migrations:   [location — typically {src}/_shared/db/migrations/ in the default layout]
Naming:       [snake_case tables | camelCase models]
Timestamps:   [created_at / updated_at on every table: yes/no]
Soft deletes: [deleted_at pattern: yes/no]
UUIDs:        [primary keys: uuid | bigint serial]
```

## Environment Variables
<!-- Names only — values live at {specs}/_shared/env-config.md (resolve via MANIFEST ## Paths). -->
```
DATABASE_URL          PostgreSQL connection string
JWT_SECRET            JWT signing secret
JWT_REFRESH_SECRET    JWT refresh signing secret
REDIS_URL             Redis connection (if applicable)
[OTHER]               [description]
```

## Logging
```
Library:    [pino | winston | structlog | Go slog]
Format:     [JSON in production | pretty in development]
Level:      [info | debug — and how to configure]
What to log: request/response summary, errors (with stack), key business events
What NOT to log: passwords, tokens, PII
```

## Commands
```bash
dev:        [npm run dev | uvicorn app.main:app --reload | go run cmd/api/main.go]
test:       [jest {src}/{module}/__tests__ | pytest {src}/{module}/__tests__ | go test ./...]   # resolve via MANIFEST ## Paths.unit_tests
migrate:    [npx prisma migrate dev | alembic upgrade head | python manage.py migrate]
seed:       [npm run db:seed | python manage.py loaddata | go run cmd/seed/main.go]
typecheck:  [npx tsc --noEmit | mypy app/ | — ]
lint:       [eslint {src}/{module} | ruff check {src}/{module} | golangci-lint run]
```

## Key Constraints
- [e.g. "All DB queries must use transactions for multi-table writes"]
- [e.g. "Rate limit: 10 requests/minute on /auth/login"]
- [e.g. "All endpoints require auth except: POST /auth/login, POST /auth/register"]
- [e.g. "Response time SLA: p99 < 500ms for all endpoints"]

---

## Test Harness
<!-- Owned by orchestrator. Orchestrator runs `up` before QA execution phase, `reset` between QA agents, `down` after all QA agents return. qa-api-agent reads base_url + env_file at runtime. -->

```yaml
test_harness:
  up:       "docker compose -f compose.test.yml up -d api db"
  wait_for: "curl -fsS http://localhost:3000/health | grep -q 'ok'"
  reset:    "docker compose -f compose.test.yml exec -T api npm run db:reset"
  down:     "docker compose -f compose.test.yml down -v"
  base_url: "http://localhost:3000"
  env_file: ".env.test"
```

**Field meanings:**
- `up` — command to bring up the test stack (API server + test DB, seeded). Runs once per QA execution phase.
- `wait_for` — health check command that exits 0 when the stack is ready. Orchestrator blocks until this passes (max 60s).
- `reset` — command to reset the test DB to a clean seeded state between QA agent dispatches. Optional; if missing, orchestrator will not reset between dispatches (appropriate if tests use transactional rollback).
- `down` — command to tear down the stack after all QA agents return. Should clean up volumes and networks.
- `base_url` — the URL qa-api-agent uses to reach the API during test execution. Also used by qa-web-agent if its web app talks to the same API.
- `env_file` — env var file the harness loads (test DB credentials, API keys, test Stripe keys, etc.). Never commit real secrets — use test-only keys.

If the project has no test harness (e.g. unit-in-process only, no integration tests), leave the commands empty:

```yaml
test_harness:
  up: ""
  wait_for: ""
  reset: ""
  down: ""
  base_url: "http://localhost:3000"
  env_file: ".env.test"
```
