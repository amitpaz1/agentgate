import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildListParams,
  formatResult,
  formatError,
  handleToolCall,
  toolDefinitions,
  normalizeDecidedBy,
} from './tools.js';
import type { ApiConfig } from './types.js';

describe('buildListParams', () => {
  it('returns empty string when no filters provided', () => {
    expect(buildListParams({})).toBe('');
  });

  it('includes status filter', () => {
    const result = buildListParams({ status: 'pending' });
    expect(result).toBe('status=pending');
  });

  it('includes limit filter', () => {
    const result = buildListParams({ limit: 5 });
    expect(result).toBe('limit=5');
  });

  it('includes both status and limit', () => {
    const result = buildListParams({ status: 'approved', limit: 10 });
    expect(result).toContain('status=approved');
    expect(result).toContain('limit=10');
    expect(result).toContain('&');
  });
});

describe('formatResult', () => {
  it('formats object result as JSON', () => {
    const data = { id: '123', status: 'pending' };
    const result = formatResult(data);
    
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe('text');
    expect(JSON.parse(result.content[0]!.text)).toEqual(data);
    expect(result.isError).toBeUndefined();
  });

  it('formats array result as JSON', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const result = formatResult(data);
    
    expect(JSON.parse(result.content[0]!.text)).toEqual(data);
  });

  it('formats null result', () => {
    const result = formatResult(null);
    expect(result.content[0]!.text).toBe('null');
  });
});

describe('formatError', () => {
  it('formats Error instance', () => {
    const error = new Error('Something went wrong');
    const result = formatError(error);
    
    expect(result.content[0]!.text).toBe('Error: Something went wrong');
    expect(result.isError).toBe(true);
  });

  it('formats non-Error value', () => {
    const result = formatError('string error');
    
    expect(result.content[0]!.text).toBe('Error: Unknown error');
    expect(result.isError).toBe(true);
  });

  it('formats undefined value', () => {
    const result = formatError(undefined);
    
    expect(result.content[0]!.text).toBe('Error: Unknown error');
    expect(result.isError).toBe(true);
  });
});

describe('toolDefinitions', () => {
  it('contains exactly 4 tools', () => {
    expect(toolDefinitions).toHaveLength(4);
  });

  it('has agentgate_request tool with required action', () => {
    const tool = toolDefinitions.find((t) => t.name === 'agentgate_request');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.required).toContain('action');
  });

  it('has agentgate_get tool with required id', () => {
    const tool = toolDefinitions.find((t) => t.name === 'agentgate_get');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.required).toContain('id');
  });

  it('has agentgate_list tool with no required fields', () => {
    const tool = toolDefinitions.find((t) => t.name === 'agentgate_list');
    expect(tool).toBeDefined();
    // agentgate_list has no required fields (all filters are optional)
    expect('required' in tool!.inputSchema).toBe(false);
  });

  it('has agentgate_decide tool with required id and decision', () => {
    const tool = toolDefinitions.find((t) => t.name === 'agentgate_decide');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.required).toContain('id');
    expect(tool!.inputSchema.required).toContain('decision');
  });
});

describe('normalizeDecidedBy', () => {
  it('returns mcp:user for undefined', () => {
    expect(normalizeDecidedBy(undefined)).toBe('mcp:user');
  });

  it('returns mcp:user for empty string', () => {
    expect(normalizeDecidedBy('')).toBe('mcp:user');
  });

  it('preserves valid namespaced values', () => {
    expect(normalizeDecidedBy('mcp:custom-agent')).toBe('mcp:custom-agent');
    expect(normalizeDecidedBy('slack:U12345')).toBe('slack:U12345');
    expect(normalizeDecidedBy('dashboard:admin')).toBe('dashboard:admin');
  });

  it('prefixes with mcp: when no known namespace', () => {
    expect(normalizeDecidedBy('some-user')).toBe('mcp:some-user');
    expect(normalizeDecidedBy('admin')).toBe('mcp:admin');
  });

  it('prefixes with mcp: when namespace is unknown', () => {
    expect(normalizeDecidedBy('unknown:user')).toBe('mcp:unknown:user');
  });
});

describe('handleToolCall', () => {
  const config: ApiConfig = {
    baseUrl: 'http://localhost:3000',
    apiKey: 'test-key',
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns error for unknown tool', async () => {
    const result = await handleToolCall(config, 'unknown_tool', {});

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Unknown tool: unknown_tool');
  });

  it('calls POST /api/requests for agentgate_request', async () => {
    const responseData = { id: 'req-123', status: 'pending' };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    const result = await handleToolCall(config, 'agentgate_request', {
      action: 'send_email',
      params: { to: 'test@example.com' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/requests',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]!.text)).toEqual(responseData);
  });

  it('calls GET /api/requests/:id for agentgate_get', async () => {
    const responseData = { id: 'req-123', status: 'approved' };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    const result = await handleToolCall(config, 'agentgate_get', {
      id: 'req-123',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/requests/req-123',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.isError).toBeUndefined();
  });

  it('calls GET /api/requests with query params for agentgate_list', async () => {
    const responseData = { requests: [] };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    await handleToolCall(config, 'agentgate_list', {
      status: 'pending',
      limit: 5,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/requests\?.*status=pending.*limit=5/),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('calls POST /api/requests/:id/decide for agentgate_decide', async () => {
    const responseData = { id: 'req-123', status: 'approved' };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    const result = await handleToolCall(config, 'agentgate_decide', {
      id: 'req-123',
      decision: 'approved',
      reason: 'Looks good',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/requests/req-123/decide',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"decision":"approved"'),
      })
    );
    expect(result.isError).toBeUndefined();
  });

  it('uses mcp:user as default decidedBy for agentgate_decide', async () => {
    const responseData = { id: 'req-123', status: 'approved' };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    await handleToolCall(config, 'agentgate_decide', {
      id: 'req-123',
      decision: 'approved',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"decidedBy":"mcp:user"'),
      })
    );
  });

  it('preserves custom decidedBy when provided for agentgate_decide', async () => {
    const responseData = { id: 'req-123', status: 'approved' };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    });

    await handleToolCall(config, 'agentgate_decide', {
      id: 'req-123',
      decision: 'approved',
      decidedBy: 'mcp:custom-agent',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"decidedBy":"mcp:custom-agent"'),
      })
    );
  });

  it('handles API errors gracefully', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve(JSON.stringify({ error: 'Invalid API key' })),
    });

    const result = await handleToolCall(config, 'agentgate_get', {
      id: 'req-123',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Invalid API key');
  });

  it('handles network errors gracefully', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const result = await handleToolCall(config, 'agentgate_request', {
      action: 'test',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Network error');
  });
});
