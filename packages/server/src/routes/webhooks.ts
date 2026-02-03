import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { webhooks, webhookDeliveries } from '../db/schema.js';
import { requireScope } from '../middleware/auth.js';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { validateWebhookUrl } from '../lib/url-validator.js';

const router = new Hono();

// All routes require admin scope
router.use('*', requireScope('admin'));

// Create webhook
const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1), // e.g., ["request.approved", "request.denied"]
  secret: z.string().min(32).optional(), // Auto-generate if not provided
});

router.post('/', zValidator('json', createWebhookSchema), async (c) => {
  const { url, events, secret } = c.req.valid('json');
  
  // SSRF protection: validate URL before accepting
  const validation = await validateWebhookUrl(url);
  if (!validation.valid) {
    return c.json({ error: `Invalid webhook URL: ${validation.error}` }, 400);
  }
  
  const id = nanoid();
  const webhookSecret = secret || crypto.randomBytes(32).toString('hex');
  
  await db.insert(webhooks).values({
    id,
    url,
    events: JSON.stringify(events),
    secret: webhookSecret,
    createdAt: Date.now(),
    enabled: 1,
  });
  
  return c.json({ 
    id, 
    url, 
    events, 
    secret: webhookSecret, // Only shown once on creation
    enabled: true,
    message: 'Save this secret - it will not be shown again'
  }, 201);
});

// List webhooks (without secrets)
router.get('/', async (c) => {
  const result = await db.select({
    id: webhooks.id,
    url: webhooks.url,
    events: webhooks.events,
    createdAt: webhooks.createdAt,
    enabled: webhooks.enabled,
  }).from(webhooks);
  
  return c.json({ 
    webhooks: result.map(w => ({
      ...w,
      events: JSON.parse(w.events),
      enabled: w.enabled === 1,
    }))
  });
});

// Get webhook with recent deliveries
router.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  const webhook = await db.select({
    id: webhooks.id,
    url: webhooks.url,
    events: webhooks.events,
    createdAt: webhooks.createdAt,
    enabled: webhooks.enabled,
  }).from(webhooks).where(eq(webhooks.id, id)).limit(1);
  
  const webhookRecord = webhook[0];
  if (!webhookRecord) {
    return c.json({ error: 'Webhook not found' }, 404);
  }
  
  // Get recent deliveries
  const deliveries = await db.select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, id))
    .orderBy(desc(webhookDeliveries.lastAttemptAt))
    .limit(20);
  
  return c.json({
    ...webhookRecord,
    events: JSON.parse(webhookRecord.events),
    enabled: webhookRecord.enabled === 1,
    deliveries,
  });
});

// Update webhook
const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  enabled: z.boolean().optional(),
});

router.patch('/:id', zValidator('json', updateWebhookSchema), async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');
  
  // SSRF protection: validate URL if being updated
  if (updates.url) {
    const validation = await validateWebhookUrl(updates.url);
    if (!validation.valid) {
      return c.json({ error: `Invalid webhook URL: ${validation.error}` }, 400);
    }
  }
  
  const updateData: Record<string, unknown> = {};
  if (updates.url) updateData.url = updates.url;
  if (updates.events) updateData.events = JSON.stringify(updates.events);
  if (updates.enabled !== undefined) updateData.enabled = updates.enabled ? 1 : 0;
  
  await db.update(webhooks).set(updateData).where(eq(webhooks.id, id));
  
  return c.json({ success: true });
});

// Delete webhook
router.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(webhooks).where(eq(webhooks.id, id));
  return c.json({ success: true });
});

// Test webhook
router.post('/:id/test', async (c) => {
  const id = c.req.param('id');
  
  const webhook = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  const webhookRecord = webhook[0];
  if (!webhookRecord) {
    return c.json({ error: 'Webhook not found' }, 404);
  }
  
  // SSRF protection: re-validate URL (DNS rebinding defense)
  const validation = await validateWebhookUrl(webhookRecord.url);
  if (!validation.valid) {
    return c.json({ error: `Webhook URL no longer valid: ${validation.error}` }, 400);
  }
  
  const testPayload = {
    event: 'test',
    data: { message: 'This is a test webhook from AgentGate' },
    timestamp: Date.now(),
  };
  
  const payloadStr = JSON.stringify(testPayload);
  const signature = crypto.createHmac('sha256', webhookRecord.secret).update(payloadStr).digest('hex');
  
  try {
    const response = await fetch(webhookRecord.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AgentGate-Signature': signature,
      },
      body: payloadStr,
    });
    
    return c.json({ 
      success: response.ok, 
      status: response.status,
      message: response.ok ? 'Test delivered successfully' : 'Delivery failed'
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Connection failed'
    }, 500);
  }
});

export default router;
