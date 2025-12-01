/**
 * Unit tests for Sentence Splitter with Provenance Tracking
 * 
 * Tests sentence splitting, provenance tracking, and context window creation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SentenceSplitter, getSentenceSplitter, createChunksFromArticles } from '../sentence-splitter';
import type { PubMedArticle } from '../pubmed';

describe('SentenceSplitter', () => {
  let splitter: SentenceSplitter;

  beforeEach(() => {
    splitter = new SentenceSplitter();
  });

  describe('Sentence Splitting', () => {
    it('should split text into sentences', () => {
      const text = 'This is the first sentence. This is the second sentence. This is the third sentence.';
      const sentences = splitter.splitIntoSentences(text);

      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('This is the first sentence.');
      expect(sentences[1]).toBe('This is the second sentence.');
      expect(sentences[2]).toBe('This is the third sentence.');
    });

    it('should handle abbreviations correctly', () => {
      const text = 'Dr. Smith conducted the study. The results were significant.';
      const sentences = splitter.splitIntoSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('Dr. Smith');
    });

    it('should handle medical abbreviations', () => {
      const text = 'The study by Jones et al. showed positive results. Further research is needed.';
      const sentences = splitter.splitIntoSentences(text);

      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toContain('et al.');
    });

    it('should handle empty text', () => {
      const sentences = splitter.splitIntoSentences('');
      expect(sentences).toHaveLength(0);
    });

    it('should handle single sentence', () => {
      const text = 'This is a single sentence.';
      const sentences = splitter.splitIntoSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toBe(text);
    });

    it('should handle text without periods', () => {
      const text = 'This is text without proper punctuation';
      const sentences = splitter.splitIntoSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toBe(text);
    });

    it('should handle exclamation and question marks', () => {
      const text = 'Is this a question? Yes it is! This is a statement.';
      const sentences = splitter.splitIntoSentences(text);

      expect(sentences).toHaveLength(3);
    });
  });

  describe('Chunk Creation', () => {
    const createTestArticle = (): PubMedArticle => ({
      pmid: '12345',
      title: 'Test Article',
      abstract: 'First sentence. Second sentence. Third sentence.',
      authors: ['Smith J', 'Jones A'],
      journal: 'Test Journal',
      publicationDate: '2023',
      publicationType: ['Journal Article'],
    });

    it('should create chunks with provenance', () => {
      const article = createTestArticle();
      const chunks = splitter.createChunks(article);

      expect(chunks).toHaveLength(3);
      
      // Check first chunk
      expect(chunks[0].id).toBe('PMID:12345:S:0');
      expect(chunks[0].pmid).toBe('12345');
      expect(chunks[0].sentenceIndex).toBe(0);
      expect(chunks[0].text).toBe('First sentence.');
      expect(chunks[0].metadata.title).toBe('Test Article');
    });

    it('should include context window', () => {
      const article = createTestArticle();
      const chunks = splitter.createChunks(article, true);

      // First chunk should have no 'before' context
      expect(chunks[0].context?.before).toBeUndefined();
      expect(chunks[0].context?.after).toBe('Second sentence.');

      // Middle chunk should have both contexts
      expect(chunks[1].context?.before).toBe('First sentence.');
      expect(chunks[1].context?.after).toBe('Third sentence.');

      // Last chunk should have no 'after' context
      expect(chunks[2].context?.before).toBe('Second sentence.');
      expect(chunks[2].context?.after).toBeUndefined();
    });

    it('should work without context window', () => {
      const article = createTestArticle();
      const chunks = splitter.createChunks(article, false);

      expect(chunks[0].context).toBeUndefined();
    });

    it('should handle article without abstract', () => {
      const article: PubMedArticle = {
        pmid: '12345',
        title: 'Test Article',
        authors: ['Smith J'],
        journal: 'Test Journal',
        publicationDate: '2023',
        publicationType: ['Journal Article'],
        // No abstract
      };

      const chunks = splitter.createChunks(article);
      expect(chunks).toHaveLength(0);
    });

    it('should preserve all metadata', () => {
      const article: PubMedArticle = {
        pmid: '12345',
        title: 'Test Article',
        abstract: 'Test sentence.',
        authors: ['Smith J', 'Jones A'],
        journal: 'Test Journal',
        publicationDate: '2023-01-01',
        doi: '10.1234/test',
        publicationType: ['Journal Article'],
      };

      const chunks = splitter.createChunks(article);
      
      expect(chunks[0].metadata.authors).toEqual(['Smith J', 'Jones A']);
      expect(chunks[0].metadata.journal).toBe('Test Journal');
      expect(chunks[0].metadata.publicationDate).toBe('2023-01-01');
      expect(chunks[0].metadata.doi).toBe('10.1234/test');
    });
  });

  describe('Multiple Articles', () => {
    it('should create chunks from multiple articles', () => {
      const articles: PubMedArticle[] = [
        {
          pmid: '1',
          title: 'Article 1',
          abstract: 'First sentence. Second sentence.',
          authors: ['Smith J'],
          journal: 'Journal 1',
          publicationDate: '2023',
          publicationType: ['Journal Article'],
        },
        {
          pmid: '2',
          title: 'Article 2',
          abstract: 'Third sentence. Fourth sentence.',
          authors: ['Jones A'],
          journal: 'Journal 2',
          publicationDate: '2023',
          publicationType: ['Journal Article'],
        },
      ];

      const chunks = splitter.createChunksFromArticles(articles);

      expect(chunks).toHaveLength(4);
      expect(chunks[0].pmid).toBe('1');
      expect(chunks[2].pmid).toBe('2');
    });
  });

  describe('Chunk Retrieval', () => {
    it('should get chunk by ID', () => {
      const article: PubMedArticle = {
        pmid: '12345',
        title: 'Test',
        abstract: 'First. Second. Third.',
        authors: [],
        journal: 'Test',
        publicationDate: '2023',
        publicationType: [],
      };

      const chunks = splitter.createChunks(article);
      const chunk = splitter.getChunkById(chunks, 'PMID:12345:S:1');

      expect(chunk).toBeDefined();
      expect(chunk!.text).toBe('Second.');
    });

    it('should get chunks by PMID', () => {
      const articles: PubMedArticle[] = [
        {
          pmid: '1',
          title: 'Article 1',
          abstract: 'First. Second.',
          authors: [],
          journal: 'Test',
          publicationDate: '2023',
          publicationType: [],
        },
        {
          pmid: '2',
          title: 'Article 2',
          abstract: 'Third. Fourth.',
          authors: [],
          journal: 'Test',
          publicationDate: '2023',
          publicationType: [],
        },
      ];

      const allChunks = splitter.createChunksFromArticles(articles);
      const pmid1Chunks = splitter.getChunksByPMID(allChunks, '1');

      expect(pmid1Chunks).toHaveLength(2);
      expect(pmid1Chunks.every(c => c.pmid === '1')).toBe(true);
    });
  });

  describe('Abstract Reconstruction', () => {
    it('should reconstruct abstract from chunks', () => {
      const originalAbstract = 'First sentence. Second sentence. Third sentence.';
      const article: PubMedArticle = {
        pmid: '12345',
        title: 'Test',
        abstract: originalAbstract,
        authors: [],
        journal: 'Test',
        publicationDate: '2023',
        publicationType: [],
      };

      const chunks = splitter.createChunks(article);
      const reconstructed = splitter.reconstructAbstract(chunks);

      expect(reconstructed).toBe(originalAbstract);
    });

    it('should handle out-of-order chunks', () => {
      const article: PubMedArticle = {
        pmid: '12345',
        title: 'Test',
        abstract: 'First. Second. Third.',
        authors: [],
        journal: 'Test',
        publicationDate: '2023',
        publicationType: [],
      };

      const chunks = splitter.createChunks(article);
      // Reverse the order
      const reversed = [...chunks].reverse();
      const reconstructed = splitter.reconstructAbstract(reversed);

      expect(reconstructed).toBe('First. Second. Third.');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getSentenceSplitter();
      const instance2 = getSentenceSplitter();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Convenience Function', () => {
    it('should create chunks using convenience function', () => {
      const articles: PubMedArticle[] = [
        {
          pmid: '1',
          title: 'Test',
          abstract: 'First. Second.',
          authors: [],
          journal: 'Test',
          publicationDate: '2023',
          publicationType: [],
        },
      ];

      const chunks = createChunksFromArticles(articles);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].id).toBe('PMID:1:S:0');
    });
  });
});
