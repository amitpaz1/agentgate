import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.js';
import { apiKeys } from '../db/schema.js';
import { createApiKey, revokeApiKey } from '../lib/api-keys.js';
import { requireScope } from '../middleware/auth.js';

const router = new Hono();

// All routes require admin scope
router.use('*', requireScope('admin'));

// Create new API key
const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
});

router.post('/', zValidator('json', createKeySchema), async (c) => {
  const { name, scopes } = c.req.valid('json');
  const { id, key } = await createApiKey(name, scopes);
  
  // Return key ONCE - it won't be shown again
  return c.json({ 
    id, 
    key,  // Only returned on creation!
    name, 
    scopes,
    message: 'Save this key - it will not be shown again'
  }, 201);
});

// List API keys (without the actual key)
router.get('/', async (c) => {
  const keys = await db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    scopes: apiKeys.scopes,
    createdAt: apiKeys.createdAt,
    lastUsedAt: apiKeys.lastUsedAt,
    revokedAt: apiKeys.revokedAt,
  }).from(apiKeys);
  
  return c.json({ 
    keys: keys.map(k => ({
      ...k,
      scopes: JSON.parse(k.scopes),
      active: k.revokedAt === null,
    }))
  });
});

// Revoke API key
router.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await revokeApiKey(id);
  return c.json({ success: true, message: 'API key revoked' });
});

export default router;
