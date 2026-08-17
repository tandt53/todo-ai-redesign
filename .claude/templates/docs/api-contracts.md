# API Contracts
<!-- Written by: architect-agent | Read by: web-agent, mobile-agent, backend-agent, qa-api-agent, qa-web-agent, qa-mobile-agent -->
<!-- This is LAW. No agent invents API shapes. All deviations require an ADR. -->

## Base URL
```
Development: http://localhost:[port]/api
Staging:     https://api-staging.[domain]/api
Production:  https://api.[domain]/api
```

## Authentication
```
Type:   Bearer token (JWT)
Header: Authorization: Bearer <token>
Expiry: access=15min, refresh=7d
```

## Standard Error Format
```json
{
  "code": "ERROR_CODE_STRING",
  "message": "Human-readable description",
  "details": {}
}
```

## Endpoints
<!-- architect-agent adds endpoints here as features are designed -->
<!-- Format per endpoint: see below -->

---

## POST /auth/login
**Feature**: F-[id]
**Auth required**: No

### Request
```json
{ "email": "string — required", "password": "string — required" }
```

### Response 200
```json
{ "token": "string", "refreshToken": "string", "user": { "id": "uuid", "email": "string", "role": "string" } }
```

### Errors
| Status | Code | Reason |
|--------|------|--------|
| 400 | INVALID_INPUT | Missing or invalid fields |
| 401 | INVALID_CREDENTIALS | Wrong email or password |
| 429 | RATE_LIMITED | Too many attempts |
