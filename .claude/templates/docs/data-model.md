# Data Model
<!-- Written by: architect-agent (after spec-agent provides the data section) | Read by: backend-agent, qa-api-agent -->

## Entities
<!-- One section per entity. Keep each section concise. -->

### [EntityName]
**Description**: [what this represents]
**Feature(s)**: F-[id]

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | UUID | yes | primary key |
| [field] | [string/int/bool/datetime/enum] | yes/no | [notes] |

**Relationships**:
- belongs to: [Entity] (via [foreign_key])
- has many: [Entity]

**Constraints**:
- [business rule, e.g. "email must be unique across all users"]

---

## Enums
| Name | Values | Used by |
|------|--------|---------|
| [EnumName] | value1, value2 | [Entity.field] |

## Key Relationships Diagram (text)
<!-- Simple ASCII or text description — architect-agent owns the actual schema in db-schema.md -->
[EntityA] --< [EntityB]  (one-to-many)
[EntityC] >--< [EntityD] (many-to-many via [junction_table])
