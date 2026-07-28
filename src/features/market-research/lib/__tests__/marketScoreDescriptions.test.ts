// Spec 15 §3.3 — characterization for src/lib/marketScoreDescriptions.ts.
//
// Note: spec §3.3 phrasing implies a score-band lookup; the actual function
// is a report-column → description-text lookup via REPORT_KEY_TO_DESCRIPTION_LABEL.
// This test characterizes the actual behavior. Spec drift logged for post-merge.
import { describe, expect, it } from 'vitest';

import {
  REPORT_KEY_TO_DESCRIPTION_LABEL,
  getDescriptionTextForColumn,
  type MarketScoreDescriptionsResponse,
} from '../marketScoreDescriptions';

describe('REPORT_KEY_TO_DESCRIPTION_LABEL', () => {
  it('contains the 5 expected report column keys', () => {
    expect(Object.keys(REPORT_KEY_TO_DESCRIPTION_LABEL).sort()).toEqual([
      'competitor-landscape',
      'industry-trends',
      'market-entry',
      'market-size',
      'regulatory-compliance',
    ]);
  });

  it('maps each key to its canonical lowercase description label', () => {
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['market-size']).toBe('market size & opportunity');
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['industry-trends']).toBe('industry trends report');
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['competitor-landscape']).toBe('competitor landscape');
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['regulatory-compliance']).toBe('regulatory & compliance highlights');
    expect(REPORT_KEY_TO_DESCRIPTION_LABEL['market-entry']).toBe('market entry & growth strategy');
  });
});

describe('getDescriptionTextForColumn', () => {
  const fullResponse: MarketScoreDescriptionsResponse = {
    lead_id: 'lead_1',
    org_id: 'org_1',
    combined_score: 75,
    scored_at: '2026-05-08T10:00:00Z',
    descriptions: {
      'market size & opportunity': 'A large addressable market.',
      'industry trends report': 'Trends are favorable.',
      'competitor landscape': 'Three major competitors identified.',
      'regulatory & compliance highlights': 'GDPR compliance required.',
      'market entry & growth strategy': 'Direct sales recommended.',
    },
  };

  it('returns the canonical description for each known column key', () => {
    expect(getDescriptionTextForColumn(fullResponse, 'market-size'))
      .toBe('A large addressable market.');
    expect(getDescriptionTextForColumn(fullResponse, 'industry-trends'))
      .toBe('Trends are favorable.');
    expect(getDescriptionTextForColumn(fullResponse, 'competitor-landscape'))
      .toBe('Three major competitors identified.');
    expect(getDescriptionTextForColumn(fullResponse, 'regulatory-compliance'))
      .toBe('GDPR compliance required.');
    expect(getDescriptionTextForColumn(fullResponse, 'market-entry'))
      .toBe('Direct sales recommended.');
  });

  it('returns undefined when response is undefined', () => {
    expect(getDescriptionTextForColumn(undefined, 'market-size')).toBeUndefined();
  });

  it('returns undefined when response.descriptions is missing', () => {
    // @ts-expect-error — intentionally simulating a partially-formed response
    expect(getDescriptionTextForColumn({ lead_id: 'x', org_id: 'y', combined_score: 0 }, 'market-size')).toBeUndefined();
  });

  it('returns undefined for an unknown column key', () => {
    expect(getDescriptionTextForColumn(fullResponse, 'not-a-real-key')).toBeUndefined();
  });

  it('falls back to case-insensitive lookup when the canonical key is not exact', () => {
    const oddCaseResponse: MarketScoreDescriptionsResponse = {
      lead_id: 'lead_1',
      org_id: 'org_1',
      combined_score: 50,
      descriptions: {
        'Market Size & Opportunity': 'Title-cased key with matching label.',
        '  industry trends report  ': 'Padded with whitespace.',
      },
    };
    expect(getDescriptionTextForColumn(oddCaseResponse, 'market-size'))
      .toBe('Title-cased key with matching label.');
    expect(getDescriptionTextForColumn(oddCaseResponse, 'industry-trends'))
      .toBe('Padded with whitespace.');
  });

  it('returns undefined when neither exact nor case-insensitive match exists', () => {
    const partial: MarketScoreDescriptionsResponse = {
      lead_id: 'lead_1',
      org_id: 'org_1',
      combined_score: 0,
      descriptions: { 'market size & opportunity': 'Only this one is present.' },
    };
    expect(getDescriptionTextForColumn(partial, 'competitor-landscape')).toBeUndefined();
  });
});
