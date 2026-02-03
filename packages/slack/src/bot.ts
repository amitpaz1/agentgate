// @agentgate/slack - Slack bot for human approvals

import { App, type BlockAction } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import type { ApprovalRequest } from '@agentgate/core';

export interface SlackBotOptions {
  /** Slack bot token (xoxb-...) */
  token: string;
  /** Slack signing secret */
  signingSecret: string;
  /** AgentGate server URL (e.g., http://localhost:3000) */
  agentgateUrl: string;
  /** Default channel for notifications */
  defaultChannel?: string;
  /** Port to listen on (default: 3001) */
  port?: number;
}

export interface SlackBot {
  /** The underlying Bolt app */
  app: App;
  /** Send an approval request notification to a channel */
  sendApprovalRequest: (request: ApprovalRequest, channel: string) => Promise<string>;
  /** Start the bot */
  start: () => Promise<void>;
  /** Stop the bot */
  stop: () => Promise<void>;
}

/**
 * Truncate a string to a max length, adding ellipsis if truncated
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Format a JSON object for display in Slack
 */
function formatJson(obj: Record<string, unknown>, maxLen = 500): string {
  const str = JSON.stringify(obj, null, 2);
  return truncate(str, maxLen);
}

/**
 * Get urgency emoji
 */
function getUrgencyEmoji(urgency: string): string {
  switch (urgency) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'normal': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

/**
 * Build Block Kit message for an approval request
 */
function buildApprovalBlocks(request: ApprovalRequest): KnownBlock[] {
  const createdAt = request.createdAt instanceof Date 
    ? request.createdAt.toISOString() 
    : request.createdAt;
  
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🔔 Approval Request',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Action:*\n\`${request.action}\``,
        },
        {
          type: 'mrkdwn',
          text: `*Urgency:*\n${getUrgencyEmoji(request.urgency)} ${request.urgency}`,
        },
        {
          type: 'mrkdwn',
          text: `*Request ID:*\n\`${request.id}\``,
        },
        {
          type: 'mrkdwn',
          text: `*Created:*\n${createdAt}`,
        },
      ],
    },
  ];

  // Add params if present
  if (request.params && Object.keys(request.params).length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Parameters:*\n\`\`\`${formatJson(request.params)}\`\`\``,
      },
    });
  }

  // Add context if present
  if (request.context && Object.keys(request.context).length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📋 Context: ${truncate(JSON.stringify(request.context), 200)}`,
        },
      ],
    });
  }

  // Add divider before buttons
  blocks.push({ type: 'divider' });

  // Add action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '✅ Approve',
          emoji: true,
        },
        style: 'primary',
        action_id: `approve_${request.id}`,
        value: request.id,
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '❌ Deny',
          emoji: true,
        },
        style: 'danger',
        action_id: `deny_${request.id}`,
        value: request.id,
      },
    ],
  });

  return blocks;
}

/**
 * Build Block Kit message for a decided request
 */
function buildDecidedBlocks(
  request: ApprovalRequest,
  decision: 'approved' | 'denied',
  userId: string
): KnownBlock[] {
  const emoji = decision === 'approved' ? '✅' : '❌';
  const verb = decision === 'approved' ? 'Approved' : 'Denied';
  
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} Request ${verb}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Action:*\n\`${request.action}\``,
        },
        {
          type: 'mrkdwn',
          text: `*Decision:*\n${verb} by <@${userId}>`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Request ID: \`${request.id}\``,
        },
      ],
    },
  ];
}

/**
 * Create a Slack bot for AgentGate approvals
 */
export function createSlackBot(options: SlackBotOptions): SlackBot {
  const { token, signingSecret, agentgateUrl, port = 3001 } = options;

  const app = new App({
    token,
    signingSecret,
  });

  /**
   * Handle approval button clicks
   */
  app.action<BlockAction>(/^approve_/, async ({ action, ack, body, client, logger }) => {
    await ack();

    if (!('value' in action)) {
      logger.error('Action missing value');
      return;
    }

    const requestId = action.value;
    const userId = body.user.id;

    try {
      // Call AgentGate API to approve
      const response = await fetch(`${agentgateUrl}/api/requests/${requestId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approved',
          decidedBy: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} ${error}`);
      }

      const request = await response.json() as ApprovalRequest;

      // Update the original message
      if (body.channel?.id && body.message?.ts) {
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          blocks: buildDecidedBlocks(request, 'approved', userId),
          text: `Request ${requestId} approved by <@${userId}>`,
        });
      }
    } catch (error) {
      logger.error('Failed to approve request:', error);
      
      // Send ephemeral error message
      if (body.channel?.id) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: `❌ Failed to approve request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  });

  /**
   * Handle deny button clicks
   */
  app.action<BlockAction>(/^deny_/, async ({ action, ack, body, client, logger }) => {
    await ack();

    if (!('value' in action)) {
      logger.error('Action missing value');
      return;
    }

    const requestId = action.value;
    const userId = body.user.id;

    try {
      // Call AgentGate API to deny
      const response = await fetch(`${agentgateUrl}/api/requests/${requestId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'denied',
          decidedBy: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} ${error}`);
      }

      const request = await response.json() as ApprovalRequest;

      // Update the original message
      if (body.channel?.id && body.message?.ts) {
        await client.chat.update({
          channel: body.channel.id,
          ts: body.message.ts,
          blocks: buildDecidedBlocks(request, 'denied', userId),
          text: `Request ${requestId} denied by <@${userId}>`,
        });
      }
    } catch (error) {
      logger.error('Failed to deny request:', error);
      
      // Send ephemeral error message
      if (body.channel?.id) {
        await client.chat.postEphemeral({
          channel: body.channel.id,
          user: userId,
          text: `❌ Failed to deny request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  });

  /**
   * Send an approval request notification to a channel
   */
  async function sendApprovalRequest(request: ApprovalRequest, channel: string): Promise<string> {
    const result = await app.client.chat.postMessage({
      channel,
      blocks: buildApprovalBlocks(request),
      text: `New approval request: ${request.action} (${request.urgency} urgency)`,
    });

    if (!result.ts) {
      throw new Error('Failed to send message: no timestamp returned');
    }

    return result.ts;
  }

  /**
   * Start the Slack bot
   */
  async function start(): Promise<void> {
    await app.start(port);
    console.log(`⚡️ Slack bot is running on port ${port}`);
  }

  /**
   * Stop the Slack bot
   */
  async function stop(): Promise<void> {
    await app.stop();
    console.log('Slack bot stopped');
  }

  return {
    app,
    sendApprovalRequest,
    start,
    stop,
  };
}
