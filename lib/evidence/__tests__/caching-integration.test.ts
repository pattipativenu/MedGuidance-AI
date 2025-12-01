/**
 * Caching Integration Tests
 * Tests that caching is properly integrated into evidence retrieval functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetCacheStats, getCacheStats } from '../cache-manager';

describe('Caching Integration', () => {
  beforeEach(() => {
    resetCacheStats();
  });

  describe('Cache Integration Verification', () => {
    it('should have cache manager available', () => {
      const stats = getCacheStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should track cache operations', async () => {
      // Import one of the cached functions
      const { comprehensivePubMedSearch } = await import('../pubmed');
      
      // This will be a cache miss (no Redis in test environment)
      // But it verifies the integration doesn't break the function
      const result = await comprehensivePubMedSearch('diabetes');
      
      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('systematicReviews');
      expect(result).toHaveProperty('guidelines');
      
      // Verify cache was checked (will be a miss without Redis)
      const stats = getCacheStats();
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should not break when cache is unavailable', async () => {
      const { comprehensivePubMedSearch } = await import('../pubmed');
      
      // Should work fine without Redis
      await expect(
        comprehensivePubMedSearch('test query')
      ).resolves.toBeDefined();
    });
  });

  describe('Multiple Source Caching', () => {
    it('should cache each source independently', async () => {
      // Import multiple cached functions
      const { comprehensivePubMedSearch } = await import('../pubmed');
      const { comprehensiveCochraneSearch } = await import('../cochrane');
      
      resetCacheStats();
      
      // Make calls to different sources
      await comprehensivePubMedSearch('diabetes');
      await comprehensiveCochraneSearch('diabetes');
      
      // Both should register cache operations
      const stats = getCacheStats();
      expect(stats.misses).toBeGreaterThanOrEqual(2); // At least 2 cache checks
    });
  });
});
