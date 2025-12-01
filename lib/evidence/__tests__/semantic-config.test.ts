/**
 * Unit tests for Semantic Search Configuration
 * 
 * Tests configuration management, validation, and safe defaults
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSemanticConfig,
  updateSemanticConfig,
  resetSemanticConfig,
  getDefaultConfig,
} from '../semantic-config';

describe('SemanticSearchConfig', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    resetSemanticConfig();
  });

  describe('Default Configuration', () => {
    it('should have valid default values', () => {
      const config = getSemanticConfig();

      expect(config.topK).toBe(50);
      expect(config.minSimilarity).toBe(0.0);
      expect(config.skipIfFewResults).toBe(10);
      expect(config.enableReranking).toBe(true);
      expect(config.useCache).toBe(true);
      expect(config.rrfConstant).toBe(60);
      expect(config.keywordWeight).toBe(1.0);
      expect(config.semanticWeight).toBe(1.0);
      expect(config.enablePICO).toBe(true);
      expect(config.maxExpandedQueries).toBe(5);
    });

    it('should return copy of config', () => {
      const config1 = getSemanticConfig();
      const config2 = getSemanticConfig();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same values
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration values', () => {
      updateSemanticConfig({
        topK: 100,
        minSimilarity: 0.5,
      });

      const config = getSemanticConfig();
      expect(config.topK).toBe(100);
      expect(config.minSimilarity).toBe(0.5);
    });

    it('should preserve unchanged values', () => {
      updateSemanticConfig({
        topK: 100,
      });

      const config = getSemanticConfig();
      expect(config.topK).toBe(100);
      expect(config.minSimilarity).toBe(0.0); // Unchanged
    });

    it('should handle boolean updates', () => {
      updateSemanticConfig({
        enableReranking: false,
        useCache: false,
      });

      const config = getSemanticConfig();
      expect(config.enableReranking).toBe(false);
      expect(config.useCache).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should enforce topK bounds', () => {
      updateSemanticConfig({ topK: 2000 }); // Too high
      expect(getSemanticConfig().topK).toBe(1000); // Clamped to max

      updateSemanticConfig({ topK: -10 }); // Too low
      expect(getSemanticConfig().topK).toBe(1); // Clamped to min
    });

    it('should enforce minSimilarity bounds', () => {
      updateSemanticConfig({ minSimilarity: 1.5 }); // Too high
      expect(getSemanticConfig().minSimilarity).toBe(1.0); // Clamped to max

      updateSemanticConfig({ minSimilarity: -0.5 }); // Too low
      expect(getSemanticConfig().minSimilarity).toBe(0.0); // Clamped to min
    });

    it('should enforce non-negative values', () => {
      updateSemanticConfig({
        skipIfFewResults: -5,
        cacheTTL: -100,
      });

      const config = getSemanticConfig();
      expect(config.skipIfFewResults).toBeGreaterThanOrEqual(0);
      expect(config.cacheTTL).toBeGreaterThanOrEqual(0);
    });

    it('should enforce rrfConstant minimum', () => {
      updateSemanticConfig({ rrfConstant: 0 });
      expect(getSemanticConfig().rrfConstant).toBeGreaterThanOrEqual(1);
    });

    it('should enforce weight non-negativity', () => {
      updateSemanticConfig({
        keywordWeight: -1.0,
        semanticWeight: -2.0,
      });

      const config = getSemanticConfig();
      expect(config.keywordWeight).toBeGreaterThanOrEqual(0);
      expect(config.semanticWeight).toBeGreaterThanOrEqual(0);
    });

    it('should enforce maxExpandedQueries bounds', () => {
      updateSemanticConfig({ maxExpandedQueries: 100 }); // Too high
      expect(getSemanticConfig().maxExpandedQueries).toBe(20); // Clamped to max

      updateSemanticConfig({ maxExpandedQueries: 0 }); // Too low
      expect(getSemanticConfig().maxExpandedQueries).toBe(1); // Clamped to min
    });
  });

  describe('Reset Configuration', () => {
    it('should reset to defaults', () => {
      // Modify config
      updateSemanticConfig({
        topK: 100,
        minSimilarity: 0.8,
        enableReranking: false,
      });

      // Reset
      resetSemanticConfig();

      // Should match defaults
      const config = getSemanticConfig();
      const defaults = getDefaultConfig();
      expect(config).toEqual(defaults);
    });
  });

  describe('Get Default Config', () => {
    it('should return default configuration', () => {
      const defaults = getDefaultConfig();

      expect(defaults.topK).toBe(50);
      expect(defaults.enableReranking).toBe(true);
    });

    it('should not be affected by updates', () => {
      updateSemanticConfig({ topK: 100 });

      const defaults = getDefaultConfig();
      expect(defaults.topK).toBe(50); // Still default value
    });
  });
});
