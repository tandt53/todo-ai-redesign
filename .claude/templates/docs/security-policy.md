# Security Policy
<!-- Written by: architect-agent | Read by: reviewer-agent (C7), all implementation agents -->

## Severity Levels
| Level | Definition | Response time |
|-------|-----------|---------------|
| Critical | Data breach risk, auth bypass, RCE | Block release, fix immediately |
| High | Privilege escalation, data exposure | Fix within current sprint |
| Medium | Information disclosure, CSRF | Fix within next sprint |
| Low | Best practice violations | Fix when convenient |

## Automated Scans (reviewer-agent C7 runs these)
| Tool | Platform | What it catches |
|------|---------|----------------|
| npm audit / pip-audit / govulncheck | all | Known CVEs in dependencies |
| semgrep | all | Code patterns, injection risks |
| secretlint | all | Committed secrets |
| bandit | Python | Python-specific security issues |

## Required Controls
- [ ] All API endpoints require auth except explicitly listed public ones
- [ ] Passwords hashed with bcrypt (cost ≥ 12) or argon2
- [ ] JWTs signed and validated — never decoded without verification
- [ ] All DB queries parameterized — no string concatenation
- [ ] Input validated at API boundary — reject and return 400
- [ ] Rate limiting on: /auth/login, /auth/register, /auth/reset-password
- [ ] CORS configured explicitly — no wildcard in production
- [ ] Error responses never include stack traces
- [ ] Secrets only from environment variables — never hardcoded
- [ ] HTTPS enforced — no HTTP in production

## Public Endpoints (no auth required)
<!-- List endpoints that are intentionally unauthenticated -->
- POST /auth/login
- POST /auth/register
- POST /auth/refresh
- GET /health

## PII Fields
<!-- Fields that contain personally identifiable information -->
| Table | Column | Handling |
|-------|--------|---------|
| users | email | encrypted at rest, excluded from logs |
