import { createApiKey } from './lib/api-keys.js';

async function bootstrap() {
  console.log('🚀 Bootstrapping AgentGate...\n');

  // Create initial admin API key
  console.log('Creating admin API key...');
  const { key } = await createApiKey('Admin (bootstrap)', ['admin', 'request:create', 'request:read', 'request:decide']);
  
  console.log('\n✅ Bootstrap complete!\n');
  console.log('Admin API Key (save this - shown once only):');
  console.log('━'.repeat(60));
  console.log(key);
  console.log('━'.repeat(60));
  console.log('\nSet this in your environment:');
  console.log(`export AGENTGATE_API_KEY="${key}"`);
  console.log('\nOr add to .env file:');
  console.log(`AGENTGATE_API_KEY=${key}`);
}

bootstrap().catch(console.error);
