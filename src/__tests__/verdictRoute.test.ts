import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/verdict/route';

describe('POST /api/verdict replay mode', () => {
  beforeEach(() => {
    vi.stubEnv('USE_LIVE_FEEDS', 'false');
    vi.stubEnv('TAVILY_API_KEY', '');
    vi.stubEnv('NEBIUS_API_KEY', '');
  });

  it('does not access external feeds when live mode is disabled', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('Replay mode attempted a network request');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await POST(
      new Request('http://localhost/api/verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'delay' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.mode).toBe('replay');
    expect(payload.latencyMs).toEqual(expect.any(Number));
    expect(response.headers.get('server-timing')).toMatch(/^waypoint;dur=/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
