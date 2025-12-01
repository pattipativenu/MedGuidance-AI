/**
 * Citation Validator
 * 
 * Validates that generated citations match retrieved evidence.
 * Detects hallucinated citations and calculates precision scores.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.3
 */

import type { Chunk } from './sentence-splitter';

export interface Citation {
  pmid: string;
  sentenceIndex?: number;
  text: string; // The claim being cited
  position: number; // Position in generated text
  raw: string; // Raw citation string
}

export interface ValidationResult {
  totalCitations: number;
  validCitations: number;
  invalidCitations: Citation[];
  precision: number;
  details: {
    pmidValid: number;
    sentenceValid: number;
    pmidInvalid: number;
    sentenceInvalid: number;
  };
}

/**
 * Citation Validator
 */
export class CitationValidator {
  /**
   * Extract citations from generated text
   * Supports formats: [PMID:12345], [PMID:12345, S:2], [12345]
   */
  extractCitations(text: string): Citation[] {
    const citations: Citation[] = [];
    
    // Pattern 1: [PMID:12345, S:2] (with sentence index)
    const pattern1 = /\[PMID:(\d+),\s*S:(\d+)\]/g;
    let match;
    
    while ((match = pattern1.exec(text)) !== null) {
      citations.push({
        pmid: match[1],
        sentenceIndex: parseInt(match[2], 10),
        text: '', // Will be filled by context
        position: match.index,
        raw: match[0],
      });
    }
    
    // Pattern 2: [PMID:12345] (without sentence index)
    const pattern2 = /\[PMID:(\d+)\]/g;
    while ((match = pattern2.exec(text)) !== null) {
      // Skip if already matched by pattern1
      const alreadyMatched = citations.some(c => 
        c.position === match!.index
      );
      
      if (!alreadyMatched) {
        citations.push({
          pmid: match[1],
          text: '',
          position: match.index,
          raw: match[0],
        });
      }
    }
    
    // Pattern 3: [12345] (just PMID number)
    const pattern3 = /\[(\d{5,8})\]/g;
    while ((match = pattern3.exec(text)) !== null) {
      // Skip if already matched
      const alreadyMatched = citations.some(c => 
        c.position === match!.index
      );
      
      if (!alreadyMatched) {
        citations.push({
          pmid: match[1],
          text: '',
          position: match.index,
          raw: match[0],
        });
      }
    }
    
    return citations.sort((a, b) => a.position - b.position);
  }

  /**
   * Validate citations against retrieved evidence
   */
  validateCitations(citations: Citation[], evidence: Chunk[]): ValidationResult {
    const pmidSet = new Set(evidence.map(chunk => chunk.pmid));
    const chunkMap = new Map<string, Chunk>();
    
    // Build chunk lookup map
    evidence.forEach(chunk => {
      chunkMap.set(chunk.id, chunk);
    });
    
    let validCitations = 0;
    let pmidValid = 0;
    let sentenceValid = 0;
    let pmidInvalid = 0;
    let sentenceInvalid = 0;
    const invalidCitations: Citation[] = [];
    
    for (const citation of citations) {
      // Check if PMID exists
      if (!pmidSet.has(citation.pmid)) {
        pmidInvalid++;
        invalidCitations.push(citation);
        continue;
      }
      
      pmidValid++;
      
      // If sentence index is specified, validate it
      if (citation.sentenceIndex !== undefined) {
        const chunkId = `PMID:${citation.pmid}:S:${citation.sentenceIndex}`;
        const chunk = chunkMap.get(chunkId);
        
        if (!chunk) {
          sentenceInvalid++;
          invalidCitations.push(citation);
          continue;
        }
        
        sentenceValid++;
        validCitations++;
      } else {
        // PMID-only citation is valid if PMID exists
        validCitations++;
      }
    }
    
    const precision = citations.length > 0 
      ? validCitations / citations.length 
      : 1.0;
    
    return {
      totalCitations: citations.length,
      validCitations,
      invalidCitations,
      precision,
      details: {
        pmidValid,
        sentenceValid,
        pmidInvalid,
        sentenceInvalid,
      },
    };
  }

  /**
   * Calculate precision score
   */
  calculatePrecision(validationResult: ValidationResult): number {
    return validationResult.precision;
  }

  /**
   * Validate and return detailed report
   */
  validate(text: string, evidence: Chunk[]): ValidationResult {
    const citations = this.extractCitations(text);
    return this.validateCitations(citations, evidence);
  }
}

/**
 * Singleton instance
 */
let validatorInstance: CitationValidator | null = null;

/**
 * Get the singleton citation validator instance
 */
export function getCitationValidator(): CitationValidator {
  if (!validatorInstance) {
    validatorInstance = new CitationValidator();
  }
  return validatorInstance;
}

/**
 * Convenience function to validate citations
 */
export function validateCitations(text: string, evidence: Chunk[]): ValidationResult {
  const validator = getCitationValidator();
  return validator.validate(text, evidence);
}
