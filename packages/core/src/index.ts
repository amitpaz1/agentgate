// @agentgate/core - Core types and policy engine

export const VERSION = '0.0.1';

// Types
export type {
  ApprovalStatus,
  ApprovalUrgency,
  DecisionType,
  ApprovalRequest,
  MatcherValue,
  PolicyRule,
  Policy,
  PolicyDecision,
} from './types.js';

// Policy engine
export { evaluatePolicy } from './policy-engine.js';
