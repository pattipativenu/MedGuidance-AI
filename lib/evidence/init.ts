/**
 * Evidence System Initialization
 * 
 * Run configuration validation on first import.
 * This ensures configuration is validated when the evidence system is first used.
 */

import { validateAndLogConfig } from './config-validator';

// Run validation on module load (server-side only)
if (typeof window === 'undefined') {
  // Only validate in development or on first server start
  if (process.env.NODE_ENV === 'development' || !global.__evidenceConfigValidated) {
    validateAndLogConfig();
    global.__evidenceConfigValidated = true;
  }
}

// Extend global type
declare global {
  var __evidenceConfigValidated: boolean | undefined;
}

export { validateAndLogConfig };
