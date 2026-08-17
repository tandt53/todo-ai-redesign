# Coding Standards
<!-- Written by: architect-agent | Read by: all implementation agents -->
<!-- These apply across all platforms unless platform/*.md overrides -->

## General
- Self-documenting names — avoid abbreviations
- Comments for WHY, not WHAT
- Functions do one thing
- Max function length: 40 lines (split if longer)
- No magic numbers — use named constants

## TypeScript / JavaScript
- Strict TypeScript — no `any`
- Named exports preferred over default exports
- Async/await over `.then()` chains
- Error boundaries around async operations
- No `console.log` in committed code

## Python
- Type hints on all function signatures
- Docstrings on public functions/classes
- f-strings over `.format()` or `%`
- Explicit exception types — no bare `except:`

## Swift
- SwiftUI over UIKit for new code
- Value types (struct) preferred over classes
- `async/await` over completion handlers
- Force unwrap (`!`) prohibited — use guard/if-let

## Kotlin
- Data classes for models
- Sealed classes for state
- Coroutines over callbacks
- Extension functions over utility classes

## Git
- Branch naming: `[type]/[ticket]-[short-description]`
  - Types: feat/ fix/ chore/ refactor/ docs/
  - Example: `feat/T-042-user-login`
- Commit format: `[type]: [description]` (conventional commits)
  - Example: `feat: add JWT auth to login endpoint`
- PRs: one feature or fix per PR
- PR description: link to task, list of changes, test instructions

## File Naming
- Web components: PascalCase (`LoginForm.tsx`)
- Web utilities/hooks: camelCase (`useAuth.ts`)
- Mobile screens: PascalCase (`LoginScreen.tsx`)
- Backend: camelCase files, PascalCase classes
- Tests: `[file].test.[ext]` co-located with source
