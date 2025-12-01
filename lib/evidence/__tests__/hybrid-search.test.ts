/**
 * Unit tests for Hybrid Search with Reciprocal Rank Fusion
 * 
 * Tests RRF algorithm, deduplication, and result fusion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HybridSearch, getHybridSearch, fuseSearchResults } from '../hybrid-search';

interface TestArticle {
  id: string;
  title: string;
  score?: number;
}

describe('HybridSearch', () => {
  let hybridSearch: HybridSearch;

  beforeEach(() => {
    hybridSearch = new HybridSearch();
  });

  describe('Reciprocal Rank Fusion', () => {
    it('should fuse keyword and semantic results', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
        { id: '2', title: 'Article 2' },
        { id: '3', title: 'Article 3' },
      ];

      const semanticResults: TestArticle[] = [
        { id: '2', title: 'Article 2' },
        { id: '4', title: 'Article 4' },
        { id: '1', title: 'Article 1' },
      ];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id
      );

      expect(fused).toBeDefined();
      expect(fused.length).toBeGreaterThan(0);
      
      // Article 2 should rank high (appears in both at good positions)
      const article2 = fused.find(r => r.item.id === '2');
      expect(article2).toBeDefined();
      expect(article2!.sources).toContain('keyword');
      expect(article2!.sources).toContain('semantic');
    });

    it('should calculate RRF scores correctly', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];

      const semanticResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id,
        { k: 60 }
      );

      // Article 1 appears at rank 0 in both lists
      // Score should be: 1/(60+0+1) + 1/(60+0+1) = 2/61
      expect(fused.length).toBe(1);
      expect(fused[0].score).toBeCloseTo(2 / 61, 5);
    });

    it('should sort results by descending score', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
        { id: '2', title: 'Article 2' },
        { id: '3', title: 'Article 3' },
      ];

      const semanticResults: TestArticle[] = [
        { id: '3', title: 'Article 3' },
        { id: '2', title: 'Article 2' },
        { id: '4', title: 'Article 4' },
      ];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id
      );

      // Verify descending order
      for (let i = 0; i < fused.length - 1; i++) {
        expect(fused[i].score).toBeGreaterThanOrEqual(fused[i + 1].score);
      }
    });

    it('should handle items only in keyword results', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
        { id: '2', title: 'Article 2' },
      ];

      const semanticResults: TestArticle[] = [
        { id: '3', title: 'Article 3' },
      ];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id
      );

      expect(fused.length).toBe(3);
      
      const article1 = fused.find(r => r.item.id === '1');
      expect(article1!.sources).toEqual(['keyword']);
    });

    it('should handle items only in semantic results', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];

      const semanticResults: TestArticle[] = [
        { id: '2', title: 'Article 2' },
        { id: '3', title: 'Article 3' },
      ];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id
      );

      expect(fused.length).toBe(3);
      
      const article2 = fused.find(r => r.item.id === '2');
      expect(article2!.sources).toEqual(['semantic']);
    });

    it('should respect custom RRF constant', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];

      const semanticResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id,
        { k: 30 } // Custom k value
      );

      // Score should be: 1/(30+0+1) + 1/(30+0+1) = 2/31
      expect(fused[0].score).toBeCloseTo(2 / 31, 5);
    });

    it('should respect result weights', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];

      const semanticResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id,
        { k: 60, keywordWeight: 2.0, semanticWeight: 1.0 }
      );

      // Score should be: 2/(60+0+1) + 1/(60+0+1) = 3/61
      expect(fused[0].score).toBeCloseTo(3 / 61, 5);
    });
  });

  describe('Deduplication', () => {
    it('should remove duplicate items', () => {
      const results: TestArticle[] = [
        { id: '1', title: 'Article 1' },
        { id: '2', title: 'Article 2' },
        { id: '1', title: 'Article 1 (duplicate)' },
        { id: '3', title: 'Article 3' },
      ];

      const deduplicated = hybridSearch.deduplicate(results, (item) => item.id);

      expect(deduplicated.length).toBe(3);
      expect(deduplicated.map(r => r.id)).toEqual(['1', '2', '3']);
    });

    it('should keep first occurrence', () => {
      const results: TestArticle[] = [
        { id: '1', title: 'First' },
        { id: '1', title: 'Second' },
      ];

      const deduplicated = hybridSearch.deduplicate(results, (item) => item.id);

      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].title).toBe('First');
    });

    it('should handle empty array', () => {
      const results: TestArticle[] = [];
      const deduplicated = hybridSearch.deduplicate(results, (item) => item.id);

      expect(deduplicated.length).toBe(0);
    });
  });

  describe('Multiple List Fusion', () => {
    it('should fuse multiple ranked lists', () => {
      const list1: TestArticle[] = [
        { id: '1', title: 'Article 1' },
        { id: '2', title: 'Article 2' },
      ];

      const list2: TestArticle[] = [
        { id: '2', title: 'Article 2' },
        { id: '3', title: 'Article 3' },
      ];

      const list3: TestArticle[] = [
        { id: '1', title: 'Article 1' },
        { id: '3', title: 'Article 3' },
      ];

      const fused = hybridSearch.fuseMultiple(
        [list1, list2, list3],
        (item) => item.id
      );

      expect(fused.length).toBe(3);
      
      // All articles should appear
      expect(fused.map(r => r.item.id).sort()).toEqual(['1', '2', '3']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty keyword results', () => {
      const keywordResults: TestArticle[] = [];
      const semanticResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id
      );

      expect(fused.length).toBe(1);
      expect(fused[0].item.id).toBe('1');
    });

    it('should handle empty semantic results', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
      ];
      const semanticResults: TestArticle[] = [];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id
      );

      expect(fused.length).toBe(1);
      expect(fused[0].item.id).toBe('1');
    });

    it('should handle both empty', () => {
      const keywordResults: TestArticle[] = [];
      const semanticResults: TestArticle[] = [];

      const fused = hybridSearch.fuseResults(
        keywordResults,
        semanticResults,
        (item) => item.id
      );

      expect(fused.length).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getHybridSearch();
      const instance2 = getHybridSearch();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Convenience Function', () => {
    it('should fuse and return items only', () => {
      const keywordResults: TestArticle[] = [
        { id: '1', title: 'Article 1' },
        { id: '2', title: 'Article 2' },
      ];

      const semanticResults: TestArticle[] = [
        { id: '2', title: 'Article 2' },
        { id: '3', title: 'Article 3' },
      ];

      const fused = fuseSearchResults(
        keywordResults,
        semanticResults,
        (item) => item.id
      );

      expect(fused).toBeDefined();
      expect(fused.length).toBeGreaterThan(0);
      expect(fused[0].id).toBeDefined();
      // Should not have score property (just items)
      expect((fused[0] as any).score).toBeUndefined();
    });
  });
});
