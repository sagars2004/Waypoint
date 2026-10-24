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

type McpResponse = {
  result?: {
    content?: { type: string; text?: string }[];
    structuredContent?: Record<string, unknown>;
    tools?: { name?: string; inputSchema?: { properties?: Record<string, unknown> } }[];
  };
  error?: { message?: string };
};

function parseMcpResponse(body: string, contentType: string): McpResponse {
  if (!contentType.includes('text/event-stream')) return JSON.parse(body) as McpResponse;

  const events = body
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  return JSON.parse(events.at(-1) ?? '{}') as McpResponse;
}

function findTaskId(response: McpResponse): string | undefined {
  const structured = response.result?.structuredContent;
  const text = response.result?.content?.map((item) => item.text ?? '').join(' ') ?? '';
  const structuredId = structured?.task_id ?? structured?.taskId ?? structured?.id;
  if (typeof structuredId === 'string') return structuredId;
  return text.match(/(?:task[_ -]?id|ticket[_ -]?id)\s*[:#]?\s*([\w-]+)/i)?.[1];
}

export class TendemEscalationService {
  private static instance: TendemEscalationService;

  public static getInstance(): TendemEscalationService {
    if (!TendemEscalationService.instance) {
      TendemEscalationService.instance = new TendemEscalationService();
    }
    return TendemEscalationService.instance;
  }

  private async callTendemMcp(
    method: string,
    params: Record<string, unknown>,
    apiKey: string,
    sessionId?: string
  ): Promise<{ response: McpResponse; sessionId?: string }> {
    const response = await fetch(process.env.TENDEM_MCP_URL || 'https://mcp.tendem.ai/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `ApiKey ${apiKey}`,
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) throw new Error(`Tendem MCP returned ${response.status}`);
    const body = await response.text();
    return {
      response: body.trim() ? parseMcpResponse(body, response.headers.get('content-type') ?? '') : {},
      sessionId: response.headers.get('mcp-session-id') ?? sessionId,
    };
  }

  /** Creates a non-spending Tendem task for low-confidence or feed-conflict verdicts. */
  public async evaluateEscalation(
    state: VerdictState,
    confidence: ConfidenceLevel,
    primaryRoute: RouteCandidate,
    feedIssues: boolean
  ): Promise<EscalationResult> {
    const apiKey = process.env.TENDEM_API_KEY;
    const shouldEscalate = confidence === 'low' || (state === 'reroute' && feedIssues);

    if (!shouldEscalate) return { escalated: false, status: 'bypassed' };

    const localTicketId = `tendem-${Date.now().toString(36)}`;
    if (!apiKey) {
      return {
        escalated: true,
        ticketId: localTicketId,
        status: 'pending',
        reviewedBy: 'Local escalation placeholder (configure Tendem API key)',
      };
    }

    try {
      const initialized = await this.callTendemMcp('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'waypoint', version: '0.1.0' },
      }, apiKey);
      const sessionId = initialized.sessionId;

      await this.callTendemMcp('notifications/initialized', {}, apiKey, sessionId);
      const listed = await this.callTendemMcp('tools/list', {}, apiKey, sessionId);
      const tools = (listed.response.result?.tools ?? listed.response.result?.structuredContent?.tools ?? []) as {
        name?: string;
        inputSchema?: { properties?: Record<string, unknown> };
      }[];
      const taskTool = tools.find((tool) => tool.name === 'create_task' || tool.name === 'create_human_task');
      if (!taskTool?.name) throw new Error('Tendem MCP does not expose a task-creation tool.');

      const description = `Waypoint transit review required. Verdict state: ${state}; confidence: ${confidence}; route: ${primaryRoute.name}; departure: ${primaryRoute.departureTime}. Verify whether the route recommendation is safe and identify a corrected recommendation if necessary.`;
      const properties = taskTool.inputSchema?.properties ?? {};
      const argumentsPayload: Record<string, unknown> = {};
      if ('description' in properties) argumentsPayload.description = description;
      if ('task' in properties) argumentsPayload.task = description;
      if ('prompt' in properties) argumentsPayload.prompt = description;
      if (Object.keys(argumentsPayload).length === 0) argumentsPayload.description = description;

      const created = await this.callTendemMcp('tools/call', {
        name: taskTool.name,
        arguments: argumentsPayload,
      }, apiKey, sessionId);
      if (created.response.error) throw new Error(created.response.error.message || 'Tendem task creation failed.');

      return {
        escalated: true,
        ticketId: findTaskId(created.response) ?? localTicketId,
        status: 'pending',
        reviewedBy: 'Tendem human expert queue',
      };
    } catch (error) {
      console.warn('Tendem MCP escalation failed:', error);
      return {
        escalated: false,
        status: 'bypassed',
        reviewedBy: 'Tendem MCP unavailable; no task was created',
      };
    }
  }
}

export const tendemEscalationService = TendemEscalationService.getInstance();
