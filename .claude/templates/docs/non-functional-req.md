# Non-Functional Requirements
<!-- Written by: spec-agent | Read by: architect-agent, reviewer-agent (C7) -->

## Performance
| Metric | Target | Measurement |
|--------|--------|-------------|
| API p99 response time | < 500ms | Datadog / CloudWatch |
| Web LCP | < 2.5s | Lighthouse / Core Web Vitals |
| Mobile app launch | < 2s cold start | Instruments / Firebase Perf |
| Database query p99 | < 100ms | Query logs |

## Availability
| Service | Target | Notes |
|---------|--------|-------|
| API | 99.9% uptime | |
| Web | 99.9% uptime | |

## Scale
| Resource | Current | 12-month target |
|----------|---------|----------------|
| Concurrent users | | |
| Records per table (largest) | | |
| API requests/day | | |

## Security
- Auth: [JWT / OAuth2 / session — what's required]
- Data at rest: [encryption required? which fields?]
- Data in transit: HTTPS required everywhere
- PII handling: [regulations — GDPR / CCPA / HIPAA]
- Minimum password rules: [length, complexity]

## Accessibility
- Web: WCAG [2.1 AA | 2.2 AA]
- Mobile: [iOS Accessibility Guidelines | Android Accessibility]
- Screen reader support: [required? which readers?]

## Offline Support
- Web: [PWA offline? which features work offline?]
- Mobile: [which features work without network?]
