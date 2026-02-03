# AgentGate

An approval workflow system for AI agents.

## Overview

AgentGate provides a standardized way for AI agents to request and receive approvals for sensitive actions. It supports:

- **Policy Engine**: Auto-approve, auto-deny, or route to humans based on configurable rules
- **Human Approvals**: Via Slack or web dashboard
- **Audit Logging**: Complete history of all requests and decisions
- **TypeScript SDK**: Easy integration for agents

## Packages

| Package | Description |
|---------|-------------|
| `@agentgate/core` | Core types and policy engine |
| `@agentgate/server` | Hono API server |
| `@agentgate/sdk` | TypeScript SDK for agents |
| `@agentgate/slack` | Slack bot integration |
| `@agentgate/dashboard` | React web dashboard |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development environment
pnpm dev

# Run tests
pnpm test

# Build all packages
pnpm build
```

## License

MIT
