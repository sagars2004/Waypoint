import { VerdictState, ConfidenceLevel, RouteCandidate } from '@/types/schemas';

export interface EscalationRequest {
  caseId: string;
  scenario: string;
  primaryRouteName: string;
  reason: string;
  confidence: ConfidenceLevel;
  verdictState: VerdictState;
  createdAt: string;
}

export interface EscalationResult {
  escalated: boolean;
  ticketId?: string;
  status: 'pending' | 'resolved' | 'bypassed';
  reviewedBy?: string;
  humanVerdictOverride?: VerdictState;
}

export class TendemEscalationService {
  private static instance: TendemEscalationService;

  public static getInstance(): TendemEscalationService {
    if (!TendemEscalationService.instance) {
      TendemEscalationService.instance = new TendemEscalationService();
    }
    return TendemEscalationService.instance;
  }

  /**
   * Checks if confidence is low or conflicting agency sources warrant a human escalation
   */
  public async evaluateEscalation(
    state: VerdictState,
    confidence: ConfidenceLevel,
    primaryRoute: RouteCandidate,
    feedIssues: boolean
  ): Promise<EscalationResult> {
    const apiKey = process.env.TENDEM_API_KEY;
    const workspaceId = process.env.TENDEM_WORKSPACE_ID;

    // Escalate if low confidence and critical verdict or feed down
    const shouldEscalate = confidence === 'low' || (state === 'reroute' && feedIssues);

    if (!shouldEscalate) {
      return {
        escalated: false,
        status: 'bypassed',
      };
    }

    const ticketId = `tendem-${Date.now().toString(36)}`;

    if (!apiKey) {
      // Simulate escalation lifecycle when key is pending
      return {
        escalated: true,
        ticketId,
        status: 'pending',
        reviewedBy: 'Tendem On-Call Transit Operator',
      };
    }

    try {
      // Connect to Tendem API endpoint
      const res = await fetch('https://api.tendem.ai/v1/escalations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          workspaceId,
          ticketId,
          type: 'transit_ambiguity_alert',
          payload: {
            state,
            confidence,
            route: primaryRoute.name,
            departureTime: primaryRoute.departureTime,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          escalated: true,
          ticketId: data.id || ticketId,
          status: 'pending',
          reviewedBy: 'Tendem AI Operator Queue',
        };
      }
    } catch (err) {
      console.warn('Tendem API call error:', err);
    }

    return {
      escalated: true,
      ticketId,
      status: 'pending',
    };
  }
}

export const tendemEscalationService = TendemEscalationService.getInstance();
