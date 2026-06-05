# `auth` feature

Login + signup UI (Firebase email/password). Consumes the `shared/auth` context
(`AuthProvider`, `useAuth`) and `shared/tenant` (`selectTenant`); the AuthContext and Firebase
config live in `shared/auth/` (ADR-0002), not here. Public surface: `authRoutes` (`/`, `/login`).
