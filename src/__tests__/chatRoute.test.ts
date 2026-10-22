import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { SAMPLE_PROFILES } from '@/data/mockCorridors';

describe('POST /api/chat profile context', () => {
  beforeEach(() => {
    vi.stubEnv('NEBIUS_API_KEY', '');
  });

  it('rejects requests without a valid commute profile', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'What should I take?' }),
      })
    );

    expect(response.status).toBe(400);
  });

  it('uses the supplied profile instead of a hardcoded corridor', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'What should I take?',
          profile: SAMPLE_PROFILES[1],
          scenario: 'jc_normal',
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.reply).toContain('PATH Direct to WTC');
    expect(payload.latencyMs).toEqual(expect.any(Number));
    expect(response.headers.get('server-timing')).toMatch(/^waypoint;dur=/);
  });

  it('reports degraded confidence when a replay source is offline', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'What should I take?',
          profile: SAMPLE_PROFILES[0],
          scenario: 'outage',
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.uncertainty).toContain('NJ Transit Rail & Bus');
    expect(payload.dataCitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'Feed Freshness' }),
      ])
    );
  });
});
