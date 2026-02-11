# @agentgate/sdk

TypeScript SDK for agents to request human approvals via AgentGate.

## Installation

```bash
npm install @agentgate/sdk
# or
pnpm add @agentgate/sdk
```

## Quick Start

```typescript
import { AgentGateClient } from '@agentgate/sdk'

const client = new AgentGateClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key' // optional
})

// Request approval for an action
const request = await client.request({
  action: 'send_email',
  params: { to: 'customer@example.com' },
  context: { dealValue: 50000 }
})

console.log(`Request ${request.id} created, waiting for approval...`)

// Wait for human decision (polls until decided or timeout)
const decided = await client.waitForDecision(request.id, {
  timeout: 5 * 60 * 1000, // 5 minutes (default)
  pollInterval: 2000      // 2 seconds (default)
})

if (decided.status === 'approved') {
  // Execute the action
  console.log('Approved! Sending email...')
} else if (decided.status === 'denied') {
  console.log('Request denied:', decided.decisionReason)
} else if (decided.status === 'expired') {
  console.log('Request expired before decision')
}
```

## API Reference

### `AgentGateClient`

#### Constructor

```typescript
new AgentGateClient({
  baseUrl: string,    // Required: URL of your AgentGate server
  apiKey?: string     // Optional: API key for authentication
})
```

#### Methods

##### `request(options): Promise<ApprovalRequest>`

Submit an approval request. Returns immediately with the created request.

```typescript
const request = await client.request({
  action: 'send_email',           // Required: action identifier
  params: { to: 'user@email.com' }, // Optional: action parameters
  context: { reason: 'Follow up' }, // Optional: contextual info
  urgency: 'high',                // Optional: 'low' | 'normal' | 'high' | 'critical'
  expiresAt: new Date(Date.now() + 3600000) // Optional: expiration time
})
```

##### `getRequest(id): Promise<ApprovalRequest>`

Get an approval request by ID.

```typescript
const request = await client.getRequest('req_123')
```

##### `waitForDecision(id, options?): Promise<ApprovalRequest>`

Poll until a decision is made or timeout is reached.

```typescript
const decided = await client.waitForDecision('req_123', {
  timeout: 300000,     // 5 minutes (default)
  pollInterval: 2000   // 2 seconds (default)
})
```

Throws `TimeoutError` if timeout is reached.

##### `listRequests(options?): Promise<ApprovalRequest[]>`

List approval requests with optional filters.

```typescript
const requests = await client.listRequests({
  status: 'pending',  // Filter by status
  action: 'send_email', // Filter by action
  limit: 10,          // Max results
  offset: 0           // Pagination offset
})
```

### Error Handling

```typescript
import { AgentGateError, TimeoutError } from '@agentgate/sdk'

try {
  await client.waitForDecision(id)
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Timed out waiting for decision')
  } else if (error instanceof AgentGateError) {
    console.log(`API error: ${error.message} (${error.statusCode})`)
  }
}
```

### Types

All types from `@agentgate/core` are re-exported for convenience:

```typescript
import type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalUrgency,
  DecisionType,
  Policy,
  PolicyRule,
  PolicyDecision
} from '@agentgate/sdk'
```

## License

MIT
