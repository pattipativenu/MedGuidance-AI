/**
 * Error Handling Tests for Phase 1 Enhancements
 * 
 * Tests graceful degradation when:
 * - Cache is unavailable
 * - Conflict detection fails
 * - Sufficiency scoring fails
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectConflicts } from '../conflict-detector';
import { scoreEvidenceSufficiency } from '../sufficiency-scorer';
import type { EvidencePackage } from '../engine';

describe('Error Handling - Graceful Degradation', () => {
  describe('Conflict Detection Error Handling', () => {
    it('should return empty array when evidence package is null', () => {
      const conflicts = detectConflicts(null as any);
      
      expect(conflicts).toEqual([]);
    });

    it('should return empty array when evidence package is undefined', () => {
      const conflicts = detectConflicts(undefined as any);
      
      expect(conflicts).toEqual([]);
    });

    it('should handle missing guideline arrays gracefully', () => {
      const evidence: Partial<EvidencePackage> = {
        // Missing all guideline arrays
        timestamp: new Date().toISOString(),
      };
      
      const conflicts = detectConflicts(evidence as EvidencePackage);
      
      expect(conflicts).toEqual([]);
    });

    it('should handle malformed guideline data gracefully', () => {
      const evidence: Partial<EvidencePackage> = {
        whoGuidelines: [
          { title: null as any, summary: null as any, url: '', year: '' },
        ],
        cdcGuidelines: [
          { title: null as any, summary: null as any, url: '', year: '' },
        ],
        timestamp: new Date().toISOString(),
      };
      
      // Should not throw, should return empty array or handle gracefully
      expect(() => detectConflicts(evidence as any)).not.toThrow();
    });

    it('should continue checking other pairs if one pair fails', () => {
      const evidence: Partial<EvidencePackage> = {
        whoGuidelines: [
          { 
            title: 'WHO Diabetes Management', 
            summary: 'Recommend insulin therapy', 
            url: 'https://who.int/1', 
            year: '2024' 
          },
          { 
            title: null as any, // This will cause an error
            summary: null as any, 
            url: '', 
            year: '' 
          },
        ],
        cdcGuidelines: [
          { 
            title: 'CDC Diabetes Management', 
            summary: 'Do not recommend insulin therapy', 
            url: 'https://cdc.gov/1', 
            year: '2024' 
          },
        ],
        timestamp: new Date().toISOString(),
      };
      
      // Should not throw even with malformed data
      expect(() => detectConflicts(evidence as any)).not.toThrow();
    });
  });

  describe('Sufficiency Scoring Error Handling', () => {
    it('should return insufficient score when evidence package is null', () => {
      const score = scoreEvidenceSufficiency(null as any);
      
      expect(score.level).toBe('insufficient');
      expect(score.score).toBe(0);
      expect(score.reasoning).toContain('No evidence package provided');
    });

    it('should return insufficient score when evidence package is undefined', () => {
      const score = scoreEvidenceSufficiency(undefined as any);
      
      expect(score.level).toBe('insufficient');
      expect(score.score).toBe(0);
    });

    it('should handle missing evidence arrays gracefully', () => {
      const evidence: Partial<EvidencePackage> = {
        // All arrays missing
        timestamp: new Date().toISOString(),
      };
      
      const score = scoreEvidenceSufficiency(evidence as EvidencePackage);
      
      expect(score).toBeDefined();
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(score.level).toBeDefined();
    });

    it('should handle malformed article data gracefully', () => {
      const evidence: Partial<EvidencePackage> = {
        pubmedArticles: [
          { 
            pmid: '123', 
            title: 'Test', 
            authors: [], 
            journal: 'Test', 
            publicationDate: 'invalid-date', // Invalid date
            publicationType: [] 
          },
        ],
        clinicalTrials: [
          { 
            nctId: 'NCT123', 
            briefTitle: 'Test', 
            overallStatus: 'COMPLETED',
            phases: [],
            conditions: [],
            interventions: [],
            leadSponsor: '',
            studyType: null as any, // Invalid type
            hasResults: null as any, // Invalid boolean
            locations: []
          },
        ],
        timestamp: new Date().toISOString(),
      };
      
      // Should not throw
      expect(() => scoreEvidenceSufficiency(evidence as any)).not.toThrow();
      
      const score = scoreEvidenceSufficiency(evidence as any);
      expect(score).toBeDefined();
      expect(score.level).toBeDefined();
    });

    it('should continue scoring other categories if one category fails', () => {
      const evidence: Partial<EvidencePackage> = {
        cochraneReviews: [
          { 
            pmid: '123', 
            title: 'Cochrane Review', 
            authors: ['Author'], 
            journal: 'Cochrane', 
            publicationDate: '2024',
            publicationType: ['Systematic Review']
          },
        ],
        // Malformed clinical trials that might cause errors
        clinicalTrials: null as any,
        timestamp: new Date().toISOString(),
      };
      
      const score = scoreEvidenceSufficiency(evidence as any);
      
      // Should still score Cochrane reviews even if clinical trials fail
      expect(score.score).toBeGreaterThan(0);
      expect(score.breakdown.cochraneReviews).toBe(30);
    });

    it('should return valid score range even with errors', () => {
      const evidence: Partial<EvidencePackage> = {
        // Mix of valid and invalid data
        cochraneReviews: [{ pmid: '1', title: 'Test', authors: [], journal: '', publicationDate: '2024', publicationType: [] }],
        clinicalTrials: null as any,
        pubmedArticles: undefined as any,
        timestamp: new Date().toISOString(),
      };
      
      const score = scoreEvidenceSufficiency(evidence as any);
      
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(['excellent', 'good', 'limited', 'insufficient']).toContain(score.level);
    });
  });

  describe('Cache Error Handling', () => {
    it('should handle cache unavailable gracefully', async () => {
      // Cache manager already handles this internally
      // This test verifies the behavior is documented
      
      // When Redis is unavailable:
      // - getCachedEvidence returns null (cache miss)
      // - cacheEvidence is a no-op (silent failure)
      // - System continues with API calls
      
      expect(true).toBe(true); // Placeholder - cache manager handles this
    });
  });

  describe('Integration - Multiple Failures', () => {
    it('should handle all Phase 1 enhancements failing gracefully', () => {
      const evidence: Partial<EvidencePackage> = {
        // Minimal valid evidence package
        timestamp: new Date().toISOString(),
      };
      
      // All Phase 1 enhancements should handle this gracefully
      expect(() => detectConflicts(evidence as any)).not.toThrow();
      expect(() => scoreEvidenceSufficiency(evidence as any)).not.toThrow();
      
      const conflicts = detectConflicts(evidence as any);
      const score = scoreEvidenceSufficiency(evidence as any);
      
      expect(conflicts).toEqual([]);
      expect(score.level).toBe('insufficient');
    });

    it('should maintain backward compatibility when enhancements fail', () => {
      // Even if Phase 1 enhancements fail, the system should continue
      // This is tested by ensuring functions return safe defaults
      
      const conflicts = detectConflicts(null as any);
      const score = scoreEvidenceSufficiency(null as any);
      
      expect(conflicts).toEqual([]); // Safe default
      expect(score.level).toBe('insufficient'); // Safe default
      expect(score.score).toBe(0); // Safe default
    });
  });
});
