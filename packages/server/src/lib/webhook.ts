import crypto from 'crypto';
import { db } from '../db/index.js';
import { webhooks, webhookDeliveries } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Sign payload with HMAC-SHA256
export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Deliver webhook to all matching endpoints
export async function deliverWebhook(event: string, data: unknown): Promise<void> {
  // Find enabled webhooks that subscribe to this event
  const matchingWebhooks = await db.select().from(webhooks)
    .where(eq(webhooks.enabled, 1));
  
  const filtered = matchingWebhooks.filter(wh => {
    const events = JSON.parse(wh.events) as string[];
    return events.includes(event) || events.includes('*');
  });

  for (const webhook of filtered) {
    await deliverToWebhook(webhook, event, data);
  }
}

async function deliverToWebhook(webhook: typeof webhooks.$inferSelect, event: string, data: unknown) {
  const payload = JSON.stringify({ event, data, timestamp: Date.now() });
  const signature = signPayload(payload, webhook.secret);
  
  // Create delivery record
  const deliveryId = nanoid();
  await db.insert(webhookDeliveries).values({
    id: deliveryId,
    webhookId: webhook.id,
    event,
    payload,
    status: 'pending',
    attempts: 0,
  });

  // Attempt delivery (with retry)
  await attemptDelivery(deliveryId, webhook.url, payload, signature);
}

async function attemptDelivery(deliveryId: string, url: string, payload: string, signature: string, attempt = 1) {
  const maxAttempts = 3;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentGate-Signature': signature,
      },
      body: payload,
    });

    const responseBody = await response.text().catch(() => null);

    await db.update(webhookDeliveries)
      .set({
        status: response.ok ? 'success' : 'failed',
        attempts: attempt,
        lastAttemptAt: Date.now(),
        responseCode: response.status,
        responseBody,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    if (!response.ok && attempt < maxAttempts) {
      // Retry with exponential backoff
      setTimeout(() => attemptDelivery(deliveryId, url, payload, signature, attempt + 1), 
        Math.pow(2, attempt) * 1000);
    }
  } catch (error) {
    await db.update(webhookDeliveries)
      .set({
        status: 'failed',
        attempts: attempt,
        lastAttemptAt: Date.now(),
        responseBody: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    if (attempt < maxAttempts) {
      setTimeout(() => attemptDelivery(deliveryId, url, payload, signature, attempt + 1),
        Math.pow(2, attempt) * 1000);
    }
  }
}
