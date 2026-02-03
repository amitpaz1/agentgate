// API client for AgentGate server

const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

export interface ApprovalRequest {
  id: string;
  action: string;
  params: Record<string, unknown>;
  context: Record<string, unknown>;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionReason: string | null;
  expiresAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  requestId: string;
  eventType: string;
  actor: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ListRequestsResponse {
  requests: ApprovalRequest[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  // List requests with optional filters
  async listRequests(params?: {
    status?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<ListRequestsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.action) searchParams.set('action', params.action);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    const url = `${baseUrl}/api/requests${query ? `?${query}` : ''}`;
    
    const response = await fetch(url);
    return handleResponse<ListRequestsResponse>(response);
  },

  // Get single request by ID
  async getRequest(id: string): Promise<ApprovalRequest> {
    const response = await fetch(`${baseUrl}/api/requests/${id}`);
    return handleResponse<ApprovalRequest>(response);
  },

  // Submit decision (approve or deny)
  async decide(
    id: string,
    decision: 'approved' | 'denied',
    decidedBy: string,
    reason?: string
  ): Promise<ApprovalRequest> {
    const response = await fetch(`${baseUrl}/api/requests/${id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, decidedBy, reason }),
    });
    return handleResponse<ApprovalRequest>(response);
  },

  // Get audit trail for a request
  async getAuditLog(id: string): Promise<AuditLogEntry[]> {
    const response = await fetch(`${baseUrl}/api/requests/${id}/audit`);
    return handleResponse<AuditLogEntry[]>(response);
  },
};
