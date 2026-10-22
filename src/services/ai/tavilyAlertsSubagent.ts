import { TransitAlert } from '@/types/schemas';
import { nebiusClient } from './nebiusClient';

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

export class TavilyAlertsSubagent {
  private static instance: TavilyAlertsSubagent;

  public static getInstance(): TavilyAlertsSubagent {
    if (!TavilyAlertsSubagent.instance) {
      TavilyAlertsSubagent.instance = new TavilyAlertsSubagent();
    }
    return TavilyAlertsSubagent.instance;
  }

  /**
   * Searches live transit incident news and official agency announcements via Tavily
   */
  public async searchAgencyIncidents(corridorQuery: string = 'PATH NJ Transit Hudson delays alerts'): Promise<TransitAlert[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return [];

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: `${corridorQuery} status today`,
          search_depth: 'basic',
          include_answer: false,
          max_results: 3,
        }),
      });

      if (!res.ok) {
        console.warn(`Tavily search returned status ${res.status}`);
        return [];
      }

      const data = await res.json();
      const results: TavilySearchResult[] = data.results || [];
      if (results.length === 0) return [];

      // If Nebius is configured, use Nemotron Nano to normalize alert text to structured TransitAlert format
      const client = nebiusClient.getClient();
      if (client) {
        const prompt = `You are a transit alert parsing subagent for NYC/NJ.
Extract active transit alerts from this search text. Return JSON matching this format:
[
  {
    "agency": "PATH" | "NJ Transit" | "MTA" | "NY Waterway" | "NYC DOT",
    "line": string,
    "severity": "low" | "moderate" | "severe",
    "title": string,
    "description": string,
    "timestamp": string
  }
]
Search excerpts:
${results.map((r) => `${r.title}: ${r.content.slice(0, 250)}`).join('\n\n')}

Output JSON only. If no active incidents are found, return [].`;

        try {
          const completion = await client.chat.completions.create({
            model: nebiusClient.getNanoModel(),
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
          });

          const rawText = completion.choices[0]?.message?.content || '[]';
          const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed)) {
            return parsed.map((item, index) => ({
              id: `tavily-alert-${Date.now()}-${index}`,
              agency: item.agency || 'System',
              line: item.line || 'Corridor',
              severity: item.severity || 'moderate',
              title: item.title || 'Transit Incident Reported',
              description: item.description || '',
              timestamp: 'Reported via Web telemetry',
            }));
          }
        } catch (llmErr) {
          console.warn('Nemotron Nano alert normalization fallback:', llmErr);
        }
      }

      // Simple fallback if LLM is not active
      return results.map((r, i) => ({
        id: `tavily-alert-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        agency: 'System',
        line: 'Regional Transit',
        severity: 'low',
        title: r.title.slice(0, 50),
        description: r.content.slice(0, 150),
        timestamp: 'Live Web Telemetry',
      }));
    } catch (err) {
      console.warn('Tavily alert subagent error:', err);
      return [];
    }
  }
}

export const tavilyAlertsSubagent = TavilyAlertsSubagent.getInstance();
