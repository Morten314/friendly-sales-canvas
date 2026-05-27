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
npm run preflight    # typecheck → build → test:e2e → test
```

The wrapper at `scripts/preflight.sh` runs the same chain with section headers and timing.

(Phase 1 appends `knip --strict` to this chain in its final commit; if you're reading this README in a tree after that lands, the chain ends with `→ knip --strict`.)
