# Brewra Frontend (PWA)

React 18 + Vite + TypeScript + Tailwind + shadcn-ui PWA for the Brewra GTM intelligence product.

See repo root `CLAUDE.md` and `AGENTS.md` for architecture, branch model, and gotchas.

## Local dev

```bash
npm install
npm run dev          # vite dev server on :5175, proxies /api/* to production backend
```

## Tests and pre-merge gate

```bash
npm run preflight    # typecheck → build → test:e2e → test → knip --strict
```

The wrapper at `scripts/preflight.sh` runs the same chain with section headers and timing.
