# Web Platform Spec
<!-- Written by: architect-agent | Read by: web-agent, qa-web-agent -->
<!-- Fill every section. web-agent will not proceed if this file is incomplete. -->

## Stack
```
Framework:        [Next.js 14 App Router | React + Vite | Vue 3 + Nuxt | other]
Language:         TypeScript [version]
Styling:          [Tailwind CSS | CSS Modules | styled-components | other]
State (server):   [React Query | SWR | tRPC | other]
State (client):   [Zustand | Jotai | Redux Toolkit | Pinia | other]
Forms:            [React Hook Form | Formik | native | other]
Testing (unit):   [Jest + RTL | Vitest + RTL | other]
Testing (E2E):    Playwright
Package manager:  [npm | pnpm | yarn | bun]
Node version:     [version]
```

## Project Structure
```
[paste actual source structure here after scaffolding]
# default domain-modular layout:
#   {src}/{module}/web/          (web code for the module — e.g. {src}/auth/web/)
#   {src}/{module}/__tests__/    (colocated unit tests)
#   {src}/_shared/ui/            (cross-module atomic UI)
# Resolve real paths via MANIFEST ## Paths.module_src and Paths.unit_tests.
```

## Routing Conventions
<!-- How are routes named? Where do dynamic segments go? -->
- Route files: `[pattern]`
- Dynamic routes: `[pattern]`
- Protected routes: `[how auth is enforced]`
- API routes (if applicable): `[location]`

## Data Fetching Patterns
<!-- The exact pattern to use. web-agent copies this exactly. -->

### Server-side (if applicable)
```typescript
// [paste the project's data fetching pattern here]
```

### Client-side mutations
```typescript
// [paste the mutation pattern — React Query, SWR, Server Actions, etc.]
```

### Error handling
```typescript
// [paste how errors are caught and displayed]
```

## Component Conventions
```
Location:     {src}/{module}/web/components/ui/        (atomic, reusable)
              {src}/{module}/web/components/features/  (feature-specific)
              {src}/_shared/ui/                        (cross-module atomic UI)
Naming:       PascalCase, folder per component
Index:        components/[Name]/index.ts re-exports the component
Types:        co-located [Name].types.ts or inline in component file
```
<!-- {module} and {src} resolve via MANIFEST ## Paths; substitute the assigned module (e.g. auth). -->

## Styling Rules
```
Token usage:  [import path for design tokens — e.g. '@/styles/tokens']
CSS vars:     defined in [location]
Responsive:   mobile-first, breakpoints: sm=640 md=768 lg=1024 xl=1280
Dark mode:    [enabled? how — CSS vars / class / media query]
```

## TypeScript Config
```
Strict mode:  [yes/no]
Path aliases: [e.g. @/ = the project's source root from MANIFEST ## Paths.roots.src]
```

## Environment Variables
<!-- List all frontend env vars — values live under MANIFEST ## Paths.non_functional sibling (env-config), typically {specs}/_shared/env-config.md -->
```
NEXT_PUBLIC_API_URL       public API base URL
NEXT_PUBLIC_[other]       [description]
```

## Key Constraints
<!-- Anything web-agent must know that isn't covered above -->
- [e.g. "All pages must have OG meta tags"]
- [e.g. "Use ISR for product pages — revalidate every 60s"]
- [e.g. "Bundle size budget: 200kb JS for initial page load"]

## Performance Rules
- Images: [next/image | lazy loading rules]
- Fonts: [font loading strategy]
- Third-party scripts: [how to load them — strategy="lazyOnload" etc.]

## Accessibility Requirements
- Minimum WCAG level: [AA | AAA]
- Screen reader testing: [VoiceOver | NVDA | both]
- Focus management: [rules for modals, page transitions]

## Commands
```bash
dev:       [npm run dev | pnpm dev]
build:     [npm run build]
test:      [npm test | pnpm test]
typecheck: [npx tsc --noEmit]
lint:      [npm run lint]
```

---

## Test Harness
<!-- Owned by orchestrator. Brought up before qa-web-agent execution phase. Typically includes the API (from backend.md) AND a web dev server. qa-web-agent reads base_url at runtime. -->

```yaml
test_harness:
  up:       "docker compose -f compose.test.yml up -d && npm run dev:test &"
  wait_for: "curl -fsS http://localhost:3001 -o /dev/null"
  reset:    ""    # usually delegated to backend test_harness.reset; leave empty if DB reset happens upstream
  down:     "docker compose -f compose.test.yml down -v && pkill -f 'next dev'"
  base_url: "http://localhost:3001"
  env_file: ".env.test"
```

**Notes:**
- If the web app and API run separately, the web harness may need to wait for both. Use a chained `wait_for` (`curl api && curl web`) or rely on the orchestrator to bring backend harness up first, then web harness.
- `base_url` is where Playwright points at. Can differ from the API base_url.
- For Next.js / Vite / similar frameworks, the `up` command often starts a dev server in the background; make sure `down` kills it cleanly.
- If Playwright is configured with its own `webServer` block, leave `up` and `down` empty and let Playwright manage the lifecycle — qa-web-agent respects whatever the project already does.
