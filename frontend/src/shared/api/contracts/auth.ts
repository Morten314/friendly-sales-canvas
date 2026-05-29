import { z } from "zod";

// Success (2xx) token-mint response. zod runs ONLY on a 2xx body (spec 20 §3.3);
// a 404 (JWT optional — CLAUDE.md auth reality check) short-circuits before the
// parser, so this is NOT a success|error union. Modeled permissively: JWTManager
// reads `token`/`refreshToken`, while the repo's MSW mock returns
// `access_token`/`expires_in` — accept both, reconcile against the live capture.
export const AuthTokenResponseSchema = z
  .object({
    token: z.string().nullish(),
    refreshToken: z.string().nullish(),
    access_token: z.string().nullish(),
    expires_in: z.union([z.string(), z.number()]).nullish(),
  })
  .passthrough();
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;

export const AuthRefreshResponseSchema = z
  .object({
    token: z.string().nullish(),
    access_token: z.string().nullish(),
    expires_in: z.union([z.string(), z.number()]).nullish(),
  })
  .passthrough();
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;
