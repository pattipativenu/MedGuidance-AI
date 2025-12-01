/**
 * Unit tests for Semantic Reranker
 * 
 * Tests reranking logic, similarity calculation, metadata preservation, and error handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  SemanticReranker, 
  getSemanticReranker, 
  rerankPubMedArticles,
  rerankCochraneReviews,
  rerankEuropePMCArticles 
} from '../semantic-reranker';
import type { PubMedArticle } from '../pubmed';

describe('SemanticReranker', () => {
  let reranker: SemanticReranker;

  beforeAll(() => {
    reranker = new SemanticReranker();
  });

  // Sample test articles
  const createTestArticles = (): PubMedArticle[] => [
    {
      pmid: '1',
      title: 'Metformin treatment for type 2 diabetes mellitus',
      abstract: 'Metformin is the first-line treatment for type 2 diabetes. It reduces hepatic glucose production and improves insulin sensitivity.',
      authors: ['Smith J'],
      journal: 'Diabetes Care',
      publicationDate: '2023',
      publicationType: ['Journal Article'],
    },
    {
      pmid: '2',
      title: 'Cardiovascular effects of exercise in heart failure patients',
      abstract: 'Regular exercise improves cardiovascular outcomes in patients with heart failure. This study examines the mechanisms.',
      authors: ['Jones A'],
      journal: 'Circulation',
      publicationDate: '2023',
      publicationType: ['Journal Article'],
    },
    {
      pmid: '3',
      title: 'Insulin therapy in diabetes management',
      abstract: 'Insulin therapy is essential for type 1 diabetes and advanced type 2 diabetes. This review covers insulin types and administration.',
      authors: ['Brown K'],
      journal: 'Endocrine Reviews',
      publicationDate: '2023',
      publicationType: ['Review'],
    },
    {
      pmid: '4',
      title: 'Hypertension treatment guidelines',
      abstract: 'Updated guidelines for managing hypertension in adults. Includes lifestyle modifications and pharmacological interventions.',
      authors: ['Davis M'],
      journal: 'JAMA',
      publicationDate: '2023',
      publicationType: ['Guideline'],
    },
  ];

  describe('Basic Reranking', () => {
    it('should rerank articles based on semantic similarity', async () => {
      const articles = createTestArticles();
      const query = 'diabetes treatment metformin';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0, // Force reranking even with few articles
      });

      expect(rankedArticles).toBeDefined();
      expect(rankedArticles.length).toBeGreaterThan(0);
      
      // First article should be most relevant (about metformin and diabetes)
      expect(rankedArticles[0].article.pmid).toBe('1');
      
      // Check similarity scores are present
      expect(rankedArticles[0].similarity).toBeGreaterThan(0);
      expect(rankedArticles[0].similarity).toBeLessThanOrEqual(1);
    }, 30000);

    it('should sort results by descending similarity', async () => {
      const articles = createTestArticles();
      const query = 'heart failure exercise';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
      });

      // Verify descending order
      for (let i = 0; i < rankedArticles.length - 1; i++) {
        expect(rankedArticles[i].similarity).toBeGreaterThanOrEqual(
          rankedArticles[i + 1].similarity
        );
      }
    }, 30000);

    it('should preserve article metadata', async () => {
      const articles = createTestArticles();
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
      });

      // Check that all metadata is preserved
      for (const ranked of rankedArticles) {
        expect(ranked.article.pmid).toBeDefined();
        expect(ranked.article.title).toBeDefined();
        expect(ranked.article.authors).toBeDefined();
        expect(ranked.article.journal).toBeDefined();
        expect(ranked.article.publicationDate).toBeDefined();
      }
    }, 30000);

    it('should include original rank', async () => {
      const articles = createTestArticles();
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
      });

      // Check that original ranks are preserved
      for (const ranked of rankedArticles) {
        expect(ranked.originalRank).toBeGreaterThanOrEqual(0);
        expect(ranked.originalRank).toBeLessThan(articles.length);
      }
    }, 30000);
  });

  describe('Options Handling', () => {
    it('should respect topK parameter', async () => {
      const articles = createTestArticles();
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        topK: 2,
        skipIfFewResults: 0,
      });

      // Should only rerank top 2 articles
      expect(rankedArticles.length).toBeLessThanOrEqual(2);
    }, 30000);

    it('should filter by minimum similarity', async () => {
      const articles = createTestArticles();
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        minSimilarity: 0.5,
        skipIfFewResults: 0,
      });

      // All results should meet minimum similarity
      for (const ranked of rankedArticles) {
        expect(ranked.similarity).toBeGreaterThanOrEqual(0.5);
      }
    }, 30000);

    it('should skip reranking for few results', async () => {
      const articles = createTestArticles().slice(0, 2); // Only 2 articles
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 10,
      });

      // Should return original order with default similarity
      expect(rankedArticles.length).toBe(2);
      expect(rankedArticles[0].similarity).toBe(1.0);
      expect(rankedArticles[0].originalRank).toBe(0);
      expect(rankedArticles[1].originalRank).toBe(1);
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle empty article list', async () => {
      const articles: PubMedArticle[] = [];
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles);

      expect(rankedArticles).toBeDefined();
      expect(rankedArticles.length).toBe(0);
    }, 30000);

    it('should handle articles without abstracts', async () => {
      const articles: PubMedArticle[] = [
        {
          pmid: '1',
          title: 'Diabetes treatment',
          authors: ['Smith J'],
          journal: 'Test Journal',
          publicationDate: '2023',
          publicationType: ['Journal Article'],
          // No abstract
        },
        {
          pmid: '2',
          title: 'Heart disease management',
          authors: ['Jones A'],
          journal: 'Test Journal',
          publicationDate: '2023',
          publicationType: ['Journal Article'],
          // No abstract
        },
      ];
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
      });

      expect(rankedArticles).toBeDefined();
      expect(rankedArticles.length).toBeGreaterThan(0);
      // Should still rank based on title
      expect(rankedArticles[0].article.pmid).toBe('1');
    }, 30000);

    it('should handle empty query', async () => {
      const articles = createTestArticles();
      const query = '';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
      });

      expect(rankedArticles).toBeDefined();
      expect(rankedArticles.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should gracefully degrade on embedding failure', async () => {
      const articles = createTestArticles();
      // Use a very long query that might cause issues
      const query = 'x'.repeat(10000);

      const rankedArticles = await reranker.rerankArticles(query, articles);

      // Should return original order on failure
      expect(rankedArticles).toBeDefined();
      expect(rankedArticles.length).toBe(articles.length);
    }, 30000);
  });

  describe('PubMed-Specific Methods', () => {
    it('should rerank PubMed articles', async () => {
      const articles = createTestArticles();
      const query = 'diabetes metformin';

      const rankedArticles = await reranker.rerankPubMedArticles(query, articles, {
        skipIfFewResults: 0,
      });

      expect(rankedArticles).toBeDefined();
      expect(rankedArticles.length).toBeGreaterThan(0);
      expect(rankedArticles[0].article.pmid).toBe('1');
    }, 30000);
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getSemanticReranker();
      const instance2 = getSemanticReranker();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Convenience Function', () => {
    it('should rerank and return articles only', async () => {
      const articles = createTestArticles();
      const query = 'diabetes';

      const rerankedArticles = await rerankPubMedArticles(query, articles, {
        skipIfFewResults: 0,
      });

      expect(rerankedArticles).toBeDefined();
      expect(rerankedArticles.length).toBeGreaterThan(0);
      expect(rerankedArticles[0].pmid).toBeDefined();
      // Should not have similarity scores (just articles)
      expect((rerankedArticles[0] as any).similarity).toBeUndefined();
    }, 30000);
  });

  describe('Caching Integration', () => {
    it('should support caching option', async () => {
      const articles = createTestArticles();
      const query = 'diabetes';

      // First call - should cache
      const rankedArticles1 = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
        useCache: true,
      });

      expect(rankedArticles1).toBeDefined();
      expect(rankedArticles1.length).toBeGreaterThan(0);

      // Second call - may use cache (if Redis available)
      const rankedArticles2 = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
        useCache: true,
      });

      expect(rankedArticles2).toBeDefined();
      expect(rankedArticles2.length).toBe(rankedArticles1.length);
    }, 30000);

    it('should work without caching', async () => {
      const articles = createTestArticles();
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
        useCache: false,
      });

      expect(rankedArticles).toBeDefined();
      expect(rankedArticles.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Chunk-Level Search', () => {
    it('should rerank chunks at sentence level', async () => {
      const chunks = [
        {
          id: 'PMID:1:S:0',
          pmid: '1',
          sentenceIndex: 0,
          text: 'Metformin is the first-line treatment for type 2 diabetes.',
          metadata: {
            title: 'Diabetes Treatment',
            source: 'pubmed',
          },
        },
        {
          id: 'PMID:1:S:1',
          pmid: '1',
          sentenceIndex: 1,
          text: 'Exercise is beneficial for cardiovascular health.',
          metadata: {
            title: 'Diabetes Treatment',
            source: 'pubmed',
          },
        },
        {
          id: 'PMID:2:S:0',
          pmid: '2',
          sentenceIndex: 0,
          text: 'Insulin therapy is used for advanced diabetes.',
          metadata: {
            title: 'Insulin Study',
            source: 'pubmed',
          },
        },
      ];

      const query = 'metformin diabetes treatment';
      const rankedChunks = await reranker.rerankChunks(query, chunks as any, {
        skipIfFewResults: 0,
      });

      expect(rankedChunks).toBeDefined();
      expect(rankedChunks.length).toBeGreaterThan(0);
      // First chunk should be most relevant (about metformin)
      expect(rankedChunks[0].article.id).toBe('PMID:1:S:0');
    }, 30000);

    it('should preserve chunk provenance', async () => {
      const chunks = [
        {
          id: 'PMID:1:S:0',
          pmid: '1',
          sentenceIndex: 0,
          text: 'Test sentence.',
          metadata: {
            title: 'Test',
            source: 'pubmed',
          },
        },
      ];

      const query = 'test';
      const rankedChunks = await reranker.rerankChunks(query, chunks as any, {
        skipIfFewResults: 0,
      });

      expect(rankedChunks[0].article.pmid).toBe('1');
      expect(rankedChunks[0].article.sentenceIndex).toBe(0);
    }, 30000);
  });

  describe('Multi-Source Support', () => {
    it('should rerank Cochrane reviews', async () => {
      const reviews = createTestArticles().map(article => ({
        ...article,
        cochraneId: `CD${article.pmid}`,
        reviewType: 'Intervention' as const,
        qualityRating: 'High' as const,
      }));
      const query = 'diabetes metformin';

      const rankedReviews = await reranker.rerankCochraneReviews(query, reviews, {
        skipIfFewResults: 0,
      });

      expect(rankedReviews).toBeDefined();
      expect(rankedReviews.length).toBeGreaterThan(0);
      expect(rankedReviews[0].article.cochraneId).toBeDefined();
    }, 30000);

    it('should rerank Europe PMC articles', async () => {
      const articles = createTestArticles().map(article => ({
        id: article.pmid,
        source: 'MED',
        pmid: article.pmid,
        title: article.title,
        abstractText: article.abstract,
        authorString: article.authors.join(', '),
        journalTitle: article.journal,
        pubYear: article.publicationDate,
      }));
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankEuropePMCArticles(query, articles, {
        skipIfFewResults: 0,
      });

      expect(rankedArticles).toBeDefined();
      expect(rankedArticles.length).toBeGreaterThan(0);
      expect(rankedArticles[0].article.id).toBeDefined();
    }, 30000);

    it('should skip reranking for sources with few results', async () => {
      const articles = createTestArticles(); // 4 articles
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 10, // Skip if < 10
      });

      // Should return original order
      expect(rankedArticles.length).toBe(4);
      expect(rankedArticles[0].similarity).toBe(1.0);
    }, 30000);

    it('should maintain source attribution', async () => {
      const articles = createTestArticles();
      const query = 'diabetes';

      const rankedArticles = await reranker.rerankArticles(query, articles, {
        skipIfFewResults: 0,
      });

      // All metadata should be preserved
      for (const ranked of rankedArticles) {
        expect(ranked.article.journal).toBeDefined();
        expect(ranked.article.publicationType).toBeDefined();
      }
    }, 30000);
  });
});
