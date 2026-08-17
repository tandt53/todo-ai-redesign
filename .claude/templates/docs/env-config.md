# Environment Configuration
<!-- Written by: architect-agent | Read by: backend-agent, web-agent, mobile-agent -->
<!-- List all env vars. Actual values are NEVER stored here — use secrets manager. -->

## Adding New Variables
1. Add to this file with description and example
2. Add to .env.example with placeholder value
3. Add to GitHub Actions / hosting platform secrets (handled directly, no deploy-agent)
4. Document in runbook.md under "Environment Variables"

## Backend
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | yes | postgresql://... | Primary DB connection |
| JWT_SECRET | yes | [32+ char random] | JWT signing secret |
| JWT_REFRESH_SECRET | yes | [32+ char random] | Refresh token secret |
| PORT | no | 3001 | Server port (default 3001) |
| NODE_ENV | yes | development/production | Runtime environment |

## Web Frontend
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| NEXT_PUBLIC_API_URL | yes | http://localhost:3001/api | Backend API base URL |

## Mobile
| Variable | Required | How set | Description |
|----------|----------|---------|-------------|
| API_BASE_URL | yes | .env / build config | Backend API URL |

## CI/CD Secrets (GitHub Actions)
| Secret name | Used by | Description |
|-------------|---------|-------------|
| DEPLOY_TOKEN | web-deploy.yml | Deploy service token |
| ASC_KEY_ID | ios-deploy.yml | App Store Connect key |
| ASC_ISSUER_ID | ios-deploy.yml | App Store Connect issuer |
| ASC_KEY_CONTENT | ios-deploy.yml | App Store Connect private key |
| MATCH_PASSWORD | ios-deploy.yml | Fastlane match repo password |
