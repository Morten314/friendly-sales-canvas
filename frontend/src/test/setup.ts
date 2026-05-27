import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

// Spec 15 §3.1 — MSW lifecycle. `onUnhandledRequest: 'error'` is intentional:
// any test that fires an un-mocked network request fails loudly instead of
// silently hitting (or refusing) a real backend.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
