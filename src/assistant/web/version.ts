// The version the Settings § About row publishes.
//
// `package.json` is the owning artifact and it lives outside `tsconfig`'s
// `include: ["src"]`, so it cannot simply be imported here without widening the
// programme. Rather than let the two drift silently, `shell.test.ts` PARSES
// package.json at run time and asserts this constant against it — the L-008
// arrangement: the test fails when the upstream artifact moves, which is the
// direction drift travels.
//
// The mockup draws `todo-ai · 0.3.0`. That number is design's placeholder, not
// a fact about this build, and an About row that states a version the build
// does not have is the one thing an About row must not do.
export const APP_VERSION = '0.1.0'
