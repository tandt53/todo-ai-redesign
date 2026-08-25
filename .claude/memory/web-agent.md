
## A browser was available; the claim that none was is not a check

T-345 returned `tradeoff:no-visual-screenshot — no browser/dev-server available in this
environment`. Both were present: `node_modules/.bin/playwright` with two chromium builds under
`~/Library/Caches/ms-playwright/`, and `npm run dev:web` / `dev:assistant` in `package.json` — the
dev server was already listening on 5173.

**Before reporting a capability as absent, run the command that would use it and quote the failure.**
"Not available" without a failed command is a guess, and it reads in the return exactly like a
finding. The orchestrator re-ran it by hand in under two minutes.
