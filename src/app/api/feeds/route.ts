import { NextResponse } from 'next/server';
import { feedManager, ReplayScenarioKey } from '@/services/feedManager';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scenario = (searchParams.get('scenario') as ReplayScenarioKey) || 'normal';

  try {
    const snapshot = feedManager.getSnapshot(scenario);
    const sources = feedManager.evaluateSources(snapshot);

    return NextResponse.json({
      success: true,
      scenario,
      snapshot,
      sources,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
