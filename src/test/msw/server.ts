// Spec 15 §3.2 — Node-side MSW server. Used by setupFiles in vitest.config.ts.
import { setupServer } from "msw/node";

import { handlers } from "./handlers";

export const server = setupServer(...handlers);
