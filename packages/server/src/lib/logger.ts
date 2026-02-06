// @agentgate/server - Structured logging with pino

import pino from 'pino';
import { getConfig } from '../config.js';

let _logger: pino.Logger | null = null;

/**
 * Initialize the global logger from config.
 * Call once at startup after config is available.
 */
export function initLogger(): pino.Logger {
  const config = getConfig();
  _logger = pino({
    level: config.logLevel || 'info',
    transport:
      config.logFormat === 'pretty'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
  return _logger;
}

/**
 * Get the global logger instance (lazy-initialized if needed).
 */
export function getLogger(): pino.Logger {
  if (!_logger) {
    _logger = initLogger();
  }
  return _logger;
}
