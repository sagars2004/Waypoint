import { NextResponse } from 'next/server';
import { nebiusClient } from '@/services/ai/nebiusClient';
import { feedManager } from '@/services/feedManager';
import { RouteGenerator } from '@/services/routeGenerator';
import { CommuteProfileSchema } from '@/types/schemas';

export async function POST(request: Request) {
  try {
    const { message, scenario = 'normal', history = [], profile: rawProfile } = await request.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const profileResult = CommuteProfileSchema.safeParse(rawProfile);
    if (!profileResult.success) {
      return NextResponse.json(
        { error: 'A valid commute profile is required' },
        { status: 400 }
      );
    }

    const snapshot = feedManager.getSnapshot(scenario);
    const profile = profileResult.data;
    const candidates = RouteGenerator.generateCandidates(profile, snapshot);
    const primary = candidates[0];
    const planB = candidates[1];
    const feedStatuses = feedManager.evaluateSources(
      snapshot,
      new Date(snapshot.fetchedAt).getTime()
    );
    const unavailableSources = feedStatuses.filter((status) => status.status === 'offline');
    const staleSources = feedStatuses.filter((status) => status.status === 'stale');
    const uncertainty = unavailableSources.length > 0
      ? `Confidence is limited because ${unavailableSources.map((status) => status.source).join(', ')} is offline.`
      : staleSources.length > 0
        ? `Confidence is reduced because ${staleSources.map((status) => status.source).join(', ')} is stale.`
        : `Data is from the ${snapshot.source === 'REPLAY_FIXTURE' ? 'replay snapshot' : 'current feed snapshot'} at ${snapshot.fetchedAt}.`;
    const freshnessCitation = feedStatuses
      .map((status) => `${status.source}: ${status.status}, ${status.lastAgeSeconds}s old`)
      .join(' · ');
    const sharedCitations = [
      { source: 'Feed Freshness', metric: freshnessCitation },
      { source: 'Active Alerts', metric: snapshot.alerts.length > 0 ? `${snapshot.alerts.length} alert(s)` : 'None' },
    ];

    const client = nebiusClient.getClient();

    // If Nebius API key is not configured, fallback to grounded heuristics
    if (!client) {
      let reply = '';
      let citations: { source: string; metric: string }[] = [];

      const lower = message.toLowerCase();
      if (lower.includes('coffee')) {
        const coffeeStopMinutes = 5;
        const remainingBuffer = primary.bufferMinutes - coffeeStopMinutes;
        reply = remainingBuffer >= 0
          ? `Your recommended ${primary.name} departure is ${primary.departureTime} AM with a ${primary.bufferMinutes}-minute safety buffer. A 5-minute coffee stop would leave approximately ${remainingBuffer} minutes of buffer.`
          : `Your recommended ${primary.name} departure is ${primary.departureTime} AM with only a ${primary.bufferMinutes}-minute safety buffer. A 5-minute coffee stop would exceed that margin by ${Math.abs(remainingBuffer)} minutes.`;
        citations = [
          { source: 'Buffer Margin', metric: `+${primary.bufferMinutes}m buffer allocated` },
          { source: 'Target Arrival', metric: `${profile.arriveByTime} AM` },
          ...sharedCitations,
        ];
      } else if (lower.includes('ferry')) {
        const ferry = candidates.find((candidate) =>
          candidate.legs.some((leg) => leg.mode === 'ferry')
        );
        if (ferry) {
          reply = `${ferry.name} departs at ${ferry.departureTime} AM and takes ${ferry.totalDurationMinutes} minutes. It costs $${ferry.estimatedCost.toFixed(2)} and has ${ferry.reliabilityRate}% historical reliability.`;
          citations = [
            { source: 'Route Schedule', metric: `${ferry.departureTime} AM departure` },
            { source: 'Route Cost', metric: `$${ferry.estimatedCost.toFixed(2)}` },
            { source: 'Reliability OTP', metric: `${ferry.reliabilityRate}% on-time` },
            ...sharedCitations,
          ];
        } else {
          reply = `There is no ferry option in your current commute profile and replay scenario.`;
          citations = [{ source: 'Route Options', metric: 'No ferry candidate available' }, ...sharedCitations];
        }
      } else {
        reply = `Based on the current commute snapshot, ${primary.name} is scheduled to leave at ${primary.departureTime} AM with a ${primary.bufferMinutes}-minute buffer. Historical reliability on this line is ${primary.reliabilityRate}%.`;
        citations = [
          { source: 'Schedule Data', metric: `${primary.departureTime} AM departure` },
          { source: 'Reliability OTP', metric: `${primary.reliabilityRate}% on-time` },
          ...sharedCitations,
        ];
      }

      return NextResponse.json({
        reply,
        dataCitations: citations,
        uncertainty,
        modelUsed: 'Rule-Engine Fallback (Nebius key pending)',
      });
    }

    // Call Nemotron on Nebius Token Factory with grounded commute tools/context
    const systemInstruction = `You are Waypoint's NYC/NJ transit commute assistant powered by NVIDIA Nemotron on Nebius Token Factory.
Ground your response strictly in the following ${snapshot.source === 'REPLAY_FIXTURE' ? 'replay snapshot' : 'current feed snapshot'}. NEVER invent departure times or durations.

CURRENT TELEMETRY DATA:
- Corridor: ${profile.origin.name} to ${profile.destination.name}
- Target Arrival: ${profile.arriveByTime} AM
- Primary Option: ${primary.name} (Depart: ${primary.departureTime} AM, Travel: ${primary.totalDurationMinutes}m, Buffer: +${primary.bufferMinutes}m, OTP: ${primary.reliabilityRate}%, Fare: $${primary.estimatedCost.toFixed(2)})
- Plan B Option: ${planB ? `${planB.name} (Depart: ${planB.departureTime} AM, Travel: ${planB.totalDurationMinutes}m, Fare: $${planB.estimatedCost.toFixed(2)})` : 'None'}
- Active Incidents: ${snapshot.alerts.length > 0 ? snapshot.alerts.map((a) => a.title).join(', ') : 'None'}
- Weather: ${snapshot.weather ? `${snapshot.weather.temperatureF}°F, ${snapshot.weather.condition}, wind ${snapshot.weather.windSpeedMph}mph` : 'Normal'}
- Feed Status: ${freshnessCitation}
- Uncertainty: ${uncertainty}

Keep your reply concise (2-4 sentences), factual, directly answer the rider's question, and do not claim more certainty than the Uncertainty field allows.`;

    const completion = await client.chat.completions.create({
      model: nebiusClient.getUltraModel(),
      messages: [
        { role: 'system', content: systemInstruction },
        ...history.slice(-4),
        { role: 'user', content: message },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const reply = completion.choices[0]?.message?.content || 'Telemetry retrieved.';

    return NextResponse.json({
      reply,
      dataCitations: [
        { source: 'NVIDIA Nemotron', metric: nebiusClient.getUltraModel() },
        { source: 'Primary Schedule', metric: `${primary.departureTime} AM` },
        { source: 'Buffer Margin', metric: `+${primary.bufferMinutes}m` },
        ...sharedCitations,
      ],
      uncertainty,
      modelUsed: `NVIDIA Nemotron (${nebiusClient.getUltraModel()}) via Nebius`,
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
