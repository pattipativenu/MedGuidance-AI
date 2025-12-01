/**
 * Citation Validation System
 * 
 * Validates that AI-generated citations actually exist in the provided evidence.
 * This prevents hallucinated references and ensures all citations are verifiable.
 */

export interface CitationValidationResult {
  isValid: boolean;
  totalCitations: number;
  validCitations: number;
  invalidCitations: number;
  hallucinations: Array<{
    citation: string;
    reason: string;
  }>;
  warnings: string[];
}

/**
 * Extract citations from AI response
 * Looks for patterns like ^[1]^, [1], (1), etc.
 */
function extractCitations(response: string): string[] {
  const citations: string[] = [];
  
  // Pattern 1: ^[1]^ format (preferred)
  const caretPattern = /\^\[(\d+)\]\^/g;
  let match;
  while ((match = caretPattern.exec(response)) !== null) {
    citations.push(match[1]);
  }
  
  // Pattern 2: [1] format (fallback)
  const bracketPattern = /\[(\d+)\]/g;
  while ((match = bracketPattern.exec(response)) !== null) {
    if (!citations.includes(match[1])) {
      citations.push(match[1]);
    }
  }
  
  return [...new Set(citations)].sort((a, b) => parseInt(a) - parseInt(b));
}

/**
 * Extract PMIDs and DOIs from evidence context
 */
function extractEvidenceIdentifiers(evidenceContext: string): {
  pmids: Set<string>;
  dois: Set<string>;
  nctIds: Set<string>;
} {
  const pmids = new Set<string>();
  const dois = new Set<string>();
  const nctIds = new Set<string>();
  
  // Extract PMIDs
  const pmidPattern = /PMID:?\s*(\d+)/gi;
  let match;
  while ((match = pmidPattern.exec(evidenceContext)) !== null) {
    pmids.add(match[1]);
  }
  
  // Extract DOIs
  const doiPattern = /DOI:?\s*(10\.\d{4,}\/[^\s]+)/gi;
  while ((match = doiPattern.exec(evidenceContext)) !== null) {
    dois.add(match[1].replace(/[.,;:]+$/, '')); // Remove trailing punctuation
  }
  
  // Extract NCT IDs (ClinicalTrials.gov)
  const nctPattern = /NCT:?\s*(NCT\d+)/gi;
  while ((match = nctPattern.exec(evidenceContext)) !== null) {
    nctIds.add(match[1]);
  }
  
  return { pmids, dois, nctIds };
}

/**
 * Extract references from AI response
 * Looks for the References section
 */
function extractReferences(response: string): Array<{
  number: string;
  text: string;
  pmid?: string;
  doi?: string;
  nctId?: string;
}> {
  const references: Array<{
    number: string;
    text: string;
    pmid?: string;
    doi?: string;
    nctId?: string;
  }> = [];
  
  // Find References section
  const refSectionMatch = response.match(/##?\s*References?\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (!refSectionMatch) {
    return references;
  }
  
  const refSection = refSectionMatch[1];
  
  // Extract individual references (numbered list)
  const refPattern = /(\d+)\.\s*([^\n]+(?:\n(?!\d+\.)[^\n]+)*)/g;
  let match;
  
  while ((match = refPattern.exec(refSection)) !== null) {
    const number = match[1];
    const text = match[2].trim();
    
    // Extract PMID
    const pmidMatch = text.match(/PMID:?\s*(\d+)/i);
    const pmid = pmidMatch ? pmidMatch[1] : undefined;
    
    // Extract DOI
    const doiMatch = text.match(/DOI:?\s*(10\.\d{4,}\/[^\s]+)/i);
    const doi = doiMatch ? doiMatch[1].replace(/[.,;:]+$/, '') : undefined;
    
    // Extract NCT ID
    const nctMatch = text.match(/NCT:?\s*(NCT\d+)/i);
    const nctId = nctMatch ? nctMatch[1] : undefined;
    
    references.push({
      number,
      text,
      pmid,
      doi,
      nctId,
    });
  }
  
  return references;
}

/**
 * Validate that all citations in the response exist in the provided evidence
 */
export function validateCitations(
  response: string,
  evidenceContext: string
): CitationValidationResult {
  const citations = extractCitations(response);
  const references = extractReferences(response);
  const evidenceIds = extractEvidenceIdentifiers(evidenceContext);
  
  const hallucinations: Array<{ citation: string; reason: string }> = [];
  const warnings: string[] = [];
  
  // Check if citation count matches reference count
  if (citations.length > references.length) {
    warnings.push(
      `Found ${citations.length} citations but only ${references.length} references. Some citations may be missing references.`
    );
  }
  
  // Validate each reference
  let validCount = 0;
  
  for (const ref of references) {
    let isValid = false;
    let reason = '';
    
    // Check if reference has any identifier
    // Allow FDA, guideline, and authoritative sources without PMID/DOI
    const refTextLower = ref.text.toLowerCase();
    const isFDASource = refTextLower.includes('fda faers') || 
                        refTextLower.includes('openfda') ||
                        refTextLower.includes('dailymed') ||
                        refTextLower.includes('fda/openfda') ||
                        refTextLower.includes('source: fda');
    
    const isGuidelineSource = refTextLower.includes('source: who') ||
                              refTextLower.includes('source: cdc') ||
                              refTextLower.includes('source: nice') ||
                              refTextLower.includes('source: bmj') ||
                              refTextLower.includes('source: ada') ||
                              refTextLower.includes('source: acc') ||
                              refTextLower.includes('source: aha') ||
                              refTextLower.includes('american diabetes association') ||
                              refTextLower.includes('who guidelines') ||
                              refTextLower.includes('nice guideline') ||
                              refTextLower.includes('bmj best practice') ||
                              refTextLower.includes('standards of care in diabetes');
    
    if (!ref.pmid && !ref.doi && !ref.nctId && !isFDASource && !isGuidelineSource) {
      reason = `Reference ${ref.number} has no PMID, DOI, or NCT ID`;
      hallucinations.push({
        citation: `[${ref.number}] ${ref.text.substring(0, 100)}...`,
        reason,
      });
      continue;
    }
    
    // FDA and guideline sources are valid without PMID/DOI
    if ((isFDASource || isGuidelineSource) && !ref.pmid && !ref.doi && !ref.nctId) {
      validCount++;
      continue;
    }
    
    // Validate PMID
    if (ref.pmid) {
      if (evidenceIds.pmids.has(ref.pmid)) {
        isValid = true;
        validCount++;
      } else {
        reason = `PMID:${ref.pmid} not found in provided evidence`;
        hallucinations.push({
          citation: `[${ref.number}] PMID:${ref.pmid}`,
          reason,
        });
      }
    }
    
    // Validate DOI
    if (ref.doi && !isValid) {
      if (evidenceIds.dois.has(ref.doi)) {
        isValid = true;
        validCount++;
      } else {
        reason = `DOI:${ref.doi} not found in provided evidence`;
        hallucinations.push({
          citation: `[${ref.number}] DOI:${ref.doi}`,
          reason,
        });
      }
    }
    
    // Validate NCT ID
    if (ref.nctId && !isValid) {
      if (evidenceIds.nctIds.has(ref.nctId)) {
        isValid = true;
        validCount++;
      } else {
        reason = `NCT:${ref.nctId} not found in provided evidence`;
        hallucinations.push({
          citation: `[${ref.number}] NCT:${ref.nctId}`,
          reason,
        });
      }
    }
  }
  
  // Additional warnings
  if (references.length === 0 && citations.length > 0) {
    warnings.push('Citations found in text but no References section detected');
  }
  
  if (evidenceContext.length > 0 && references.length === 0) {
    warnings.push('Evidence was provided but no references were cited');
  }
  
  return {
    isValid: hallucinations.length === 0,
    totalCitations: references.length,
    validCitations: validCount,
    invalidCitations: hallucinations.length,
    hallucinations,
    warnings,
  };
}

/**
 * Format validation results for logging
 */
export function formatValidationResults(result: CitationValidationResult): string {
  let output = '\n📊 CITATION VALIDATION RESULTS:\n';
  output += `   Total References: ${result.totalCitations}\n`;
  output += `   Valid: ${result.validCitations} ✅\n`;
  output += `   Invalid: ${result.invalidCitations} ❌\n`;
  
  if (result.warnings.length > 0) {
    output += '\n⚠️  WARNINGS:\n';
    result.warnings.forEach(w => {
      output += `   - ${w}\n`;
    });
  }
  
  if (result.hallucinations.length > 0) {
    output += '\n🚨 HALLUCINATED CITATIONS DETECTED:\n';
    result.hallucinations.forEach(h => {
      output += `   ❌ ${h.citation}\n`;
      output += `      Reason: ${h.reason}\n`;
    });
  }
  
  if (result.isValid) {
    output += '\n✅ All citations are valid and verifiable!\n';
  } else {
    output += '\n❌ VALIDATION FAILED - Some citations are not in the provided evidence\n';
  }
  
  return output;
}
