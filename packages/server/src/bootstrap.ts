import { createApiKey } from './lib/api-keys.js';
import { getLogger } from './lib/logger.js';

async function bootstrap() {
  const log = getLogger();
  log.info('🚀 Bootstrapping AgentGate...');

  // Create initial admin API key
  log.info('Creating admin API key...');
  const { key } = await createApiKey('Admin (bootstrap)', ['admin', 'request:create', 'request:read', 'request:decide']);
  
  log.info('✅ Bootstrap complete!');
  log.info('Admin API Key (save this - shown once only):');
  log.info('━'.repeat(60));
  log.info(key);
  log.info('━'.repeat(60));
  log.info('Set this in your environment:');
  log.info(`export AGENTGATE_API_KEY="${key}"`);
  log.info('Or add to .env file:');
  log.info(`AGENTGATE_API_KEY=${key}`);
}

bootstrap().catch((err) => getLogger().error({ err }, 'Bootstrap failed'));
