/**
 * MedGem - Advanced Medical Imaging Analysis
 * 
 * Export all public APIs
 */

export * from './types';
export * from './analyzer';
export * from './prompts';
export * from './parser';
export * from './vertex-ai-connector';

// Re-export main functions for convenience
export { analyzeMedicalImage, analyzeMedicalImageBatch } from './analyzer';
export { parseVisualFindings, cleanFindings } from './parser';
export { generateMedicalImagingPrompt, generateComparisonPrompt } from './prompts';
export { 
  isMedGemmaAvailable, 
  analyzeMedicalImageWithMedGemma,
  testMedGemmaConnection 
} from './vertex-ai-connector';
