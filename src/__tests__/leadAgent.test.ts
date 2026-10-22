import { describe, expect, it } from 'vitest';
import { LeadAgentOutputSchema } from '@/types/schemas';

describe('Lead agent output contract', () => {
  it('accepts only the supported verdict fields and enum values', () => {
    const result = LeadAgentOutputSchema.safeParse({
      state: 'tight',
      confidence: 'medium',
      reason: 'Leave by 08:12 for a safe arrival.',
    });

    expect(result.success).toBe(true);
  });

  it('rejects extra model fields and unsupported values', () => {
    const result = LeadAgentOutputSchema.safeParse({
      state: 'certain',
      confidence: 'very-high',
      reason: 'The route is fine.',
      departureTime: '08:12',
    });

    expect(result.success).toBe(false);
  });
});
