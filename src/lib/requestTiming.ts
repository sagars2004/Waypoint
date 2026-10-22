import { NextResponse } from 'next/server';

export function timedJson<T extends Record<string, unknown>>(
  route: string,
  startedAt: number,
  payload: T,
  status = 200
): NextResponse {
  const latencyMs = Math.round(performance.now() - startedAt);
  const response = NextResponse.json({ ...payload, latencyMs }, { status });
  response.headers.set('Server-Timing', `waypoint;dur=${latencyMs}`);

  console.info(JSON.stringify({
    event: 'waypoint_request',
    route,
    latencyMs,
    status,
  }));

  return response;
}
