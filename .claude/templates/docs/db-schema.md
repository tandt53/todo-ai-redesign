# Database Schema
<!-- Written by: architect-agent | Read by: backend-agent -->
<!-- Updated after every migration. Cross-cutting view of all tables (per-module entities live in {specs}/{module}/data-model.md). -->

## Database
**Type**: [PostgreSQL | MySQL | MongoDB | SQLite]
**Version**: 
**Migration tool**: [Prisma | Alembic | Django | Flyway | golang-migrate]

## Tables

<!-- architect-agent adds one section per table when designing the schema -->

### users
**Added**: [date] | **Feature**: F-[id] | **Migration**: [migration file]

| Column | Type | Nullable | Default | Constraints | PII |
|--------|------|----------|---------|-------------|-----|
| id | UUID | NO | gen_random_uuid() | PK | no |
| email | VARCHAR(255) | NO | — | UNIQUE | yes |
| created_at | TIMESTAMPTZ | NO | NOW() | — | no |
| updated_at | TIMESTAMPTZ | NO | NOW() | — | no |

**Indexes**: idx_users_email (unique)
**Referenced by**: sessions.user_id

## Migration History
| File | Date | Description |
|------|------|-------------|
| [filename] | [date] | [description] |
