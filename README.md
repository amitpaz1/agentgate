# AgentGate

**Human-in-the-loop approval system for AI agents.**

AgentGate provides a standardized way for AI agents to request and receive approvals for sensitive actions. It bridges the gap between autonomous AI capabilities and human oversight.

## Features

- 🛡️ **Policy Engine** — Auto-approve, auto-deny, or route to humans based on configurable rules
- 👥 **Human Approvals** — Via Slack bot or web dashboard
- 📊 **Real-time Dashboard** — Monitor and manage approval requests
- 📝 **Audit Logging** — Complete history of all requests and decisions
- 🔌 **TypeScript SDK** — Easy integration for agents
- ⚡ **Fast & Lightweight** — Hono server with SQLite storage

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start the development environment

```bash
# Start server (port 3000) and dashboard (port 5173)
pnpm dev
```

### 3. Run the demo

In a new terminal:

```bash
pnpm demo
```

The demo shows the complete workflow:
- Agent requests approval via SDK
- Request appears in dashboard
- Human approves/denies
- Agent receives decision

### 4. Open the dashboard

Visit **http://localhost:5173** to view and manage approval requests.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Agents                                │
│  (use @agentgate/sdk to request approvals)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AgentGate Server                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Policy Engine│  │ Request Store│  │ Audit Logger │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────┐     ┌──────────────────────┐
│    Web Dashboard     │     │     Slack Bot        │
│  (React + Tailwind)  │     │  (approve in Slack)  │
└──────────────────────┘     └──────────────────────┘
              │                           │
              └───────────┬───────────────┘
                          ▼
                    ┌──────────┐
                    │  Humans  │
                    └──────────┘
```

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`@agentgate/core`](./packages/core) | Types, schemas, policy engine | - |
| [`@agentgate/server`](./packages/server) | Hono API server | - |
| [`@agentgate/sdk`](./packages/sdk) | TypeScript SDK for agents | [README](./packages/sdk/README.md) |
| [`@agentgate/slack`](./packages/slack) | Slack bot integration | [README](./packages/slack/README.md) |
| [`@agentgate/dashboard`](./packages/dashboard) | React web dashboard | - |

## SDK Usage

```typescript
import { AgentGateClient } from '@agentgate/sdk';

// Create client
const client = new AgentGateClient({
  baseUrl: 'http://localhost:3000',
});

// Request approval
const request = await client.request({
  action: 'send_email',
  params: {
    to: 'customer@example.com',
    subject: 'Order shipped!',
  },
  urgency: 'normal',
});

// Wait for human decision
const decided = await client.waitForDecision(request.id, {
  timeout: 60000, // 1 minute
});

if (decided.status === 'approved') {
  // Execute the action
  await sendEmail(decided.params);
  
  // Confirm execution (for audit trail)
  await client.confirm(decided.id);
} else {
  console.log('Action denied:', decided.decisionReason);
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/requests` | Create approval request |
| `GET` | `/api/requests` | List requests (with filters) |
| `GET` | `/api/requests/:id` | Get request by ID |
| `POST` | `/api/requests/:id/decide` | Submit approval/denial |
| `POST` | `/api/requests/:id/confirm` | Confirm action execution |
| `GET` | `/api/requests/:id/audit` | Get audit trail |
| `GET` | `/api/policies` | List policies |
| `POST` | `/api/policies` | Create policy |
| `GET` | `/health` | Health check |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | `./data/agentgate.db` | SQLite database path |
| `SLACK_BOT_TOKEN` | - | Slack bot token (for Slack integration) |
| `SLACK_SIGNING_SECRET` | - | Slack signing secret |

### Policy Configuration

Policies are stored in the database and can be managed via API:

```typescript
// Example: Auto-approve low-risk emails
{
  name: "auto-approve-emails",
  priority: 10,
  enabled: true,
  rules: [
    {
      match: { action: "send_email" },
      decision: "auto_approve"
    }
  ]
}
```

## Development

```bash
# Install dependencies
pnpm install

# Start development (server + dashboard)
pnpm dev

# Run tests
pnpm test

# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Lint
pnpm lint

# Format code
pnpm format
```

## Docker

Start Redis (for future queue/pub-sub features):

```bash
docker-compose up -d
```

## Project Structure

```
agentgate/
├── packages/
│   ├── core/           # Shared types, schemas, policy engine
│   ├── server/         # Hono API server
│   ├── sdk/            # TypeScript SDK
│   ├── slack/          # Slack bot
│   └── dashboard/      # React dashboard
├── apps/
│   └── demo/           # Demo application
├── docker-compose.yml  # Redis for queuing
└── package.json        # Monorepo root
```

## License

MIT
