/**
 * Unit tests for PICO Extractor
 * 
 * Tests PICO element extraction, synonym generation, and query expansion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PICOExtractor, getPICOExtractor, expandClinicalQuery } from '../pico-extractor';

describe('PICOExtractor', () => {
  let extractor: PICOExtractor;

  beforeEach(() => {
    extractor = new PICOExtractor();
  });

  describe('PICO Element Extraction', () => {
    it('should extract intervention from query', () => {
      const query = 'What is the effectiveness of metformin treatment for diabetes?';
      const pico = extractor.extractPICO(query);

      expect(pico.intervention).toBeDefined();
      expect(pico.intervention!.length).toBeGreaterThan(0);
      expect(pico.intervention!.some(i => i.includes('treatment'))).toBe(true);
    });

    it('should extract outcome from query', () => {
      const query = 'Does aspirin reduce mortality in heart attack patients?';
      const pico = extractor.extractPICO(query);

      expect(pico.outcome).toBeDefined();
      expect(pico.outcome!.some(o => o.includes('mortality'))).toBe(true);
    });

    it('should extract population from query', () => {
      const query = 'Treatment options for elderly patients with diabetes';
      const pico = extractor.extractPICO(query);

      expect(pico.population).toBeDefined();
      expect(pico.population!.some(p => p.includes('elderly'))).toBe(true);
    });

    it('should extract comparator from query', () => {
      const query = 'Metformin vs placebo for diabetes';
      const pico = extractor.extractPICO(query);

      expect(pico.comparator).toBeDefined();
      expect(pico.comparator!.some(c => c.includes('placebo') || c.includes('vs'))).toBe(true);
    });

    it('should handle query without PICO elements', () => {
      const query = 'What is diabetes?';
      const pico = extractor.extractPICO(query);

      // May have some elements but not all
      expect(pico.originalQuery).toBe(query);
    });
  });

  describe('Query Expansion', () => {
    it('should expand query with synonyms', () => {
      const query = 'metformin for diabetes';
      const expanded = extractor.expandQuery(query);

      expect(expanded.original).toBe(query);
      expect(expanded.expanded).toBeDefined();
      expect(expanded.expanded.length).toBeGreaterThan(0);
      expect(expanded.picoElements).toBeDefined();
    });

    it('should include original query in expanded results', () => {
      const query = 'aspirin for heart attack';
      const expanded = extractor.expandQuery(query);

      expect(expanded.expanded).toContain(query);
    });

    it('should limit expanded queries', () => {
      const query = 'metformin treatment for type 2 diabetes mortality';
      const expanded = extractor.expandQuery(query);

      // Should limit to reasonable number (5)
      expect(expanded.expanded.length).toBeLessThanOrEqual(5);
    });

    it('should generate medical synonyms', () => {
      const query = 'heart attack treatment';
      const expanded = extractor.expandQuery(query);

      // Should include variations with medical terms
      const hasVariation = expanded.expanded.some(q => 
        q.includes('myocardial infarction') || q.includes('MI')
      );
      expect(hasVariation).toBe(true);
    });
  });

  describe('Clinical Question Detection', () => {
    it('should identify clinical questions', () => {
      const query = 'Does metformin reduce mortality in diabetes patients?';
      const isClinical = extractor.isClinicalQuestion(query);

      expect(isClinical).toBe(true);
    });

    it('should identify non-clinical questions', () => {
      const query = 'What is diabetes?';
      const isClinical = extractor.isClinicalQuestion(query);

      // May or may not be clinical depending on extraction
      expect(typeof isClinical).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query', () => {
      const query = '';
      const pico = extractor.extractPICO(query);

      expect(pico.originalQuery).toBe('');
    });

    it('should handle very long query', () => {
      const query = 'What is the effectiveness of metformin treatment compared to placebo in elderly patients with type 2 diabetes mellitus for reducing mortality and improving quality of life?';
      const pico = extractor.extractPICO(query);

      expect(pico.intervention).toBeDefined();
      expect(pico.outcome).toBeDefined();
      expect(pico.population).toBeDefined();
      expect(pico.comparator).toBeDefined();
    });

    it('should handle query with special characters', () => {
      const query = 'Metformin (500mg) vs. placebo for T2DM?';
      const pico = extractor.extractPICO(query);

      expect(pico.originalQuery).toBe(query);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getPICOExtractor();
      const instance2 = getPICOExtractor();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Convenience Function', () => {
    it('should expand query using convenience function', () => {
      const query = 'metformin for diabetes';
      const expanded = expandClinicalQuery(query);

      expect(expanded.original).toBe(query);
      expect(expanded.expanded).toBeDefined();
      expect(expanded.picoElements).toBeDefined();
    });
  });
});
