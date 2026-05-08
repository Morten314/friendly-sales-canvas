import {
  TEST_LEAD_ID_1, TEST_ICP_ID_1, TEST_SIGNAL_ID_1,
  TEST_USER_ID, TEST_ORG_ID, TEST_TIMESTAMP,
} from './identities';

export interface Lead {
  lead_id: string;
  user_id: string;
  org_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  industry: string;
  stage: string;
  created_at: string;
}

export const lead = (overrides: Partial<Lead> = {}): Lead => ({
  lead_id: TEST_LEAD_ID_1,
  user_id: TEST_USER_ID,
  org_id: TEST_ORG_ID,
  company_name: 'Acme Corp',
  contact_name: 'Jane Doe',
  email: 'jane@acme.test',
  industry: 'SaaS',
  stage: 'Discovery',
  created_at: TEST_TIMESTAMP,
  ...overrides,
});

export const leadList = (n = 3): Lead[] =>
  Array.from({ length: n }, (_, i) =>
    lead({
      lead_id: `lead_${i.toString().padStart(8, '0')}`,
      company_name: `Company ${i}`,
    }),
  );

export const signal = (overrides: Record<string, unknown> = {}) => ({
  signal_id: TEST_SIGNAL_ID_1,
  user_id: TEST_USER_ID,
  org_id: TEST_ORG_ID,
  agent: 'scout',
  headline: 'Acme Corp announces $50M Series B funding',
  snippet: 'Acme Corp closed a $50M Series B led by Sequoia.',
  source_url: 'https://example.test/acme-funding',
  next_best_actions: [
    { label: 'Reach out to CEO', type: 'email' },
    { label: 'Send congrats on LinkedIn', type: 'linkedin' },
  ],
  status: 'new',
  created_at: TEST_TIMESTAMP,
  ...overrides,
});

export const signalList = (n = 5) =>
  Array.from({ length: n }, (_, i) =>
    signal({
      signal_id: `sig_${i.toString().padStart(8, '0')}`,
      headline: `Test signal ${i}`,
    }),
  );

export const icp = (overrides: Record<string, unknown> = {}) => ({
  icp_id: TEST_ICP_ID_1,
  user_id: TEST_USER_ID,
  org_id: TEST_ORG_ID,
  name: 'SaaS CTOs',
  industry: 'SaaS',
  company_size: '50-500',
  geography: ['US', 'EU'],
  pain_points: ['scaling', 'tech debt'],
  created_at: TEST_TIMESTAMP,
  ...overrides,
});

export const orgProfile = {
  org_id: TEST_ORG_ID,
  name: 'Test Org',
  industry: 'SaaS',
  size: '50-500',
  website: 'https://test-org.test',
  created_at: TEST_TIMESTAMP,
};

export const orgList = [
  { id: TEST_ORG_ID, name: 'Test Org' },
];
