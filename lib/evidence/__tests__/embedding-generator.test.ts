/**
 * Unit tests for Biomedical Embedding Generator
 * 
 * Tests embedding generation, normalization, caching, and error handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  BioBERTEmbeddingGenerator, 
  getEmbeddingGenerator,
  cosineSimilarity 
} from '../embedding-generator';

describe('BioBERTEmbeddingGenerator', () => {
  let generator: BioBERTEmbeddingGenerator;

  beforeAll(() => {
    generator = new BioBERTEmbeddingGenerator();
  });

  describe('Model Loading', () => {
    it('should load model successfully', async () => {
      const embedding = await generator.generateEmbedding('test');
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    }, 60000); // 60s timeout for model loading

    it('should report ready status after loading', async () => {
      await generator.generateEmbedding('test');
      expect(generator.isReady()).toBe(true);
    }, 60000);

    it('should return correct dimension', () => {
      expect(generator.getDimension()).toBe(384);
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embedding for medical term', async () => {
      const embedding = await generator.generateEmbedding('myocardial infarction');
      
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    }, 30000);

    it('should generate embedding for longer medical text', async () => {
      const text = 'Metformin is the first-line treatment for type 2 diabetes mellitus. It works by reducing hepatic glucose production and improving insulin sensitivity.';
      const embedding = await generator.generateEmbedding(text);
      
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
    }, 30000);

    it('should handle empty string', async () => {
      const embedding = await generator.generateEmbedding('');
      
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
    }, 30000);

    it('should truncate very long text', async () => {
      const longText = 'word '.repeat(1000); // ~5000 chars, exceeds 512 tokens
      const embedding = await generator.generateEmbedding(longText);
      
      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(384);
    }, 30000);
  });

  describe('Batch Embedding Generation', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'heart attack',
        'myocardial infarction',
        'diabetes mellitus'
      ];
      
      const embeddings = await generator.generateEmbeddings(texts);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(3);
      expect(embeddings.every(emb => emb.length === 384)).toBe(true);
    }, 60000);

    it('should handle empty array', async () => {
      const embeddings = await generator.generateEmbeddings([]);
      
      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(0);
    }, 30000);

    it('should handle large batches', async () => {
      const texts = Array(20).fill('medical term');
      const embeddings = await generator.generateEmbeddings(texts);
      
      expect(embeddings.length).toBe(20);
    }, 90000);
  });

  describe('Normalization', () => {
    it('should generate normalized embeddings', async () => {
      const embedding = await generator.generateEmbedding('test');
      
      // Calculate magnitude
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );
      
      // Normalized vectors should have magnitude ≈ 1
      expect(magnitude).toBeCloseTo(1.0, 5);
    }, 30000);
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getEmbeddingGenerator();
      const instance2 = getEmbeddingGenerator();
      
      expect(instance1).toBe(instance2);
    });
  });
});

describe('cosineSimilarity', () => {
  it('should calculate similarity between identical vectors', () => {
    const vec = [0.5, 0.5, 0.5, 0.5];
    const similarity = cosineSimilarity(vec, vec);
    
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should calculate similarity between different vectors', () => {
    const vec1 = [1, 0, 0];
    const vec2 = [0, 1, 0];
    const similarity = cosineSimilarity(vec1, vec2);
    
    expect(similarity).toBeCloseTo(0.0, 5);
  });

  it('should calculate similarity for medical terms', async () => {
    const generator = getEmbeddingGenerator();
    
    const embedding1 = await generator.generateEmbedding('heart attack');
    const embedding2 = await generator.generateEmbedding('myocardial infarction');
    const embedding3 = await generator.generateEmbedding('diabetes');
    
    const similarity12 = cosineSimilarity(embedding1, embedding2);
    const similarity13 = cosineSimilarity(embedding1, embedding3);
    
    // Heart attack and myocardial infarction should be more similar
    // than heart attack and diabetes
    expect(similarity12).toBeGreaterThan(similarity13);
  }, 60000);

  it('should throw error for mismatched dimensions', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2];
    
    expect(() => cosineSimilarity(vec1, vec2)).toThrow();
  });
});
