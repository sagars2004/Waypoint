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

    const client = nebiusClient.getClient();

    // If Nebius API key is not configured, fallback to grounded heuristics
    if (!client) {
      let reply = '';
      let citations: { source: string; metric: string }[] = [];

      const lower = message.toLowerCase();
      if (lower.includes('coffee')) {
        reply = `You have an allocated safety buffer of ${primary.bufferMinutes} minutes before your recommended ${primary.departureTime} AM departure. A brief 4-5 minute coffee stop leaves you safely on schedule.`;
        citations = [
          { source: 'Buffer Margin', metric: `+${primary.bufferMinutes}m buffer allocated` },
          { source: 'Target Arrival', metric: `${profile.arriveByTime} AM` },
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
          ];
        } else {
          reply = `There is no ferry option in your current commute profile and replay scenario.`;
          citations = [{ source: 'Route Options', metric: 'No ferry candidate available' }];
        }
      } else {
        reply = `Based on live feed telemetry, ${primary.name} is scheduled to leave at ${primary.departureTime} AM with a ${primary.bufferMinutes}-minute buffer. Historical reliability on this line is ${primary.reliabilityRate}%.`;
        citations = [
          { source: 'Schedule Data', metric: `${primary.departureTime} AM departure` },
          { source: 'Reliability OTP', metric: `${primary.reliabilityRate}% on-time` },
        ];
      }

      return NextResponse.json({
        reply,
        dataCitations: citations,
        modelUsed: 'Rule-Engine Fallback (Nebius key pending)',
      });
    }

    // Call Nemotron on Nebius Token Factory with grounded commute tools/context
    const systemInstruction = `You are Waypoint's live NYC/NJ transit commute assistant powered by NVIDIA Nemotron on Nebius Token Factory.
Ground your response strictly in the following live transit telemetry. NEVER invent departure times or durations.

CURRENT TELEMETRY DATA:
- Corridor: ${profile.origin.name} to ${profile.destination.name}
- Target Arrival: ${profile.arriveByTime} AM
- Primary Option: ${primary.name} (Depart: ${primary.departureTime} AM, Travel: ${primary.totalDurationMinutes}m, Buffer: +${primary.bufferMinutes}m, OTP: ${primary.reliabilityRate}%, Fare: $${primary.estimatedCost.toFixed(2)})
- Plan B Option: ${planB ? `${planB.name} (Depart: ${planB.departureTime} AM, Travel: ${planB.totalDurationMinutes}m, Fare: $${planB.estimatedCost.toFixed(2)})` : 'None'}
- Active Incidents: ${snapshot.alerts.length > 0 ? snapshot.alerts.map((a) => a.title).join(', ') : 'None'}
- Weather: ${snapshot.weather ? `${snapshot.weather.temperatureF}°F, ${snapshot.weather.condition}, wind ${snapshot.weather.windSpeedMph}mph` : 'Normal'}

Keep your reply concise (2-4 sentences), factual, and directly answering the rider's question.`;

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
      ],
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
