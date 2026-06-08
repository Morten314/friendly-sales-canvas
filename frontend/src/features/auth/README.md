# `auth` feature

## Purpose

User login and signup — the authentication entry surface (Firebase email/password → JWT). `LoginPage` toggles between sign-in and sign-up. The unauthenticated entry point of the app.

## Public surface

Re-exported from `index.ts`:

- `authRoutes` — the feature's routes, composed append-only into `src/app/routes.tsx`.

## Key files

- `pages/LoginPage.tsx` — login + signup page (toggles between the two)
- `hooks/useLogin.ts` — `useLogin` + `useSignup` mutation hooks
- `routes.tsx` — route registry (`/`, `/login`)
- `index.ts` — public re-exports

## Dependency notes

- Consumes app-wide auth/tenant primitives from `@/shared/auth` and `@/shared/tenant`.
- May import another feature only via its `index.ts`.
