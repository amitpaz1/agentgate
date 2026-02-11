import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentGateHttpClient } from '../http-client.js';

describe('AgentGateHttpClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(response: Partial<Response>) {
    const fn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
      ...response,
    });
    globalThis.fetch = fn;
    return fn;
  }

  it('returns parsed JSON on success', async () => {
    const data = { id: '123', name: 'test' };
    mockFetch({ ok: true, status: 200, json: vi.fn().mockResolvedValue(data) });

    const client = new AgentGateHttpClient('http://localhost:3000', 'my-key');
    const result = await client.request('GET', '/api/foo');
    expect(result).toEqual(data);
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch({ ok: true, status: 204 });

    const client = new AgentGateHttpClient('http://localhost:3000');
    const result = await client.request('DELETE', '/api/foo/1');
    expect(result).toBeUndefined();
  });

  it('parses error JSON for error message', async () => {
    mockFetch({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'Bad input' })),
    });

    const client = new AgentGateHttpClient('http://localhost:3000');
    await expect(client.request('POST', '/api/foo', { x: 1 })).rejects.toThrow('Bad input');
  });

  it('falls back to default message when error body is not JSON', async () => {
    mockFetch({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    });

    const client = new AgentGateHttpClient('http://localhost:3000');
    await expect(client.request('GET', '/api/foo')).rejects.toThrow('AgentGate API error: 500');
  });

  it('respects timeout via AbortSignal', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException('The operation was aborted', 'AbortError')), 50);
      })
    );

    const client = new AgentGateHttpClient('http://localhost:3000', undefined, 1);
    await expect(client.request('GET', '/api/foo')).rejects.toThrow();
  });

  it('omits Authorization header when no apiKey', async () => {
    const fn = mockFetch({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) });

    const client = new AgentGateHttpClient('http://localhost:3000');
    await client.request('GET', '/api/foo');

    const headers = fn.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('includes Authorization header when apiKey is set', async () => {
    const fn = mockFetch({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) });

    const client = new AgentGateHttpClient('http://localhost:3000', 'secret');
    await client.request('GET', '/api/foo');

    const headers = fn.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer secret');
  });

  it('does not send Content-Type header on GET with no body', async () => {
    const fn = mockFetch({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) });

    const client = new AgentGateHttpClient('http://localhost:3000');
    await client.request('GET', '/api/foo');

    const headers = fn.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('Content-Type');
  });

  it('sends Content-Type header when body is provided', async () => {
    const fn = mockFetch({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) });

    const client = new AgentGateHttpClient('http://localhost:3000');
    await client.request('POST', '/api/foo', { data: 1 });

    const headers = fn.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBe('application/json');
  });
});
