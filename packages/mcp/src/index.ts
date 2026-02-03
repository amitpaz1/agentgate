#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const AGENTGATE_URL = process.env.AGENTGATE_URL || 'http://localhost:3000';
const AGENTGATE_API_KEY = process.env.AGENTGATE_API_KEY || '';

async function apiCall(method: string, path: string, body?: any) {
  const response = await fetch(`${AGENTGATE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENTGATE_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
    throw new Error(errorBody.error || `API error: ${response.status}`);
  }
  
  return response.json();
}

const server = new Server(
  { name: 'agentgate', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'agentgate_request',
      description: 'Submit an approval request. Returns request ID and initial status.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'Action being requested (e.g., "send_email", "make_purchase")' },
          params: { type: 'object', description: 'Action parameters (e.g., { to: "user@example.com", subject: "..." })' },
          context: { type: 'object', description: 'Additional context for the approver' },
          urgency: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Request urgency' },
        },
        required: ['action'],
      },
    },
    {
      name: 'agentgate_get',
      description: 'Get the current status of an approval request by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Request ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'agentgate_list',
      description: 'List approval requests with optional filters.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'denied', 'expired'], description: 'Filter by status' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
      },
    },
    {
      name: 'agentgate_decide',
      description: 'Approve or deny a pending request. Use when you are the designated approver.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Request ID' },
          decision: { type: 'string', enum: ['approved', 'denied'], description: 'Your decision' },
          reason: { type: 'string', description: 'Reason for decision (optional)' },
        },
        required: ['id', 'decision'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    let result;
    
    switch (name) {
      case 'agentgate_request':
        result = await apiCall('POST', '/api/requests', args);
        break;
        
      case 'agentgate_get':
        result = await apiCall('GET', `/api/requests/${(args as any).id}`);
        break;
        
      case 'agentgate_list':
        const params = new URLSearchParams();
        if ((args as any).status) params.set('status', (args as any).status);
        if ((args as any).limit) params.set('limit', String((args as any).limit));
        result = await apiCall('GET', `/api/requests?${params}`);
        break;
        
      case 'agentgate_decide':
        result = await apiCall('POST', `/api/requests/${(args as any).id}/decide`, {
          decision: (args as any).decision,
          reason: (args as any).reason,
        });
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { 
      content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AgentGate MCP server running');
}

main().catch(console.error);
