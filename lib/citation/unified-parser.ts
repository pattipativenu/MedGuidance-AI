/**
 * Unified Citation Parser
 * Consolidates all citation parsing logic for both Doctor and General modes
 * Supports PECS (Parse, Extract, Convert, Show) architecture
 */

import type { ParsedReference, CitationMode } from '@/lib/types/citation';

export interface UnifiedParsedResponse {
  mainContent: string;
  references: ParsedReference[];
  followUpQuestions: string[];
}

/**
 * Main parser - extracts content, references, and follow-up questions
 */
export function parseResponse(response: string, mode: CitationMode = 'doctor'): UnifiedParsedResponse {
  // Step 1: Extract follow-up questions (if present)
  const { content: contentWithoutFollowUp, followUpQuestions } = extractFollowUpQuestions(response);
  
  // Step 2: Extract references section
  const { mainContent, referencesText } = extractReferencesSection(contentWithoutFollowUp);
  
  // Step 3: Parse references into structured format
  const references = parseReferences(referencesText, mode);
  
  return {
    mainContent,
    references,
    followUpQuestions
  };
}

/**
 * Extract follow-up questions from response
 */
function extractFollowUpQuestions(response: string): {
  content: string;
  followUpQuestions: string[];
} {
  const followUpPatterns = [
    /##?\s*You Might Also Want to Know[:\s]*\n([\s\S]*?)(?=\n##|$)/i,
    /##?\s*Follow-?Up Questions?[:\s]*\n([\s\S]*?)(?=\n##|$)/i
  ];
  
  for (const pattern of followUpPatterns) {
    const match = response.match(pattern);
    if (match && match[1]) {
      const questions = match[1]
        .split('\n')
        .map(q => q.trim())
        .filter(q => {
          // Accept numbered (1., 2., 3.), bulleted (-, *), or plain questions
          return q.match(/^\d+\./) || q.startsWith('- ') || q.startsWith('* ') || q.endsWith('?');
        })
        .map(q => {
          // Remove numbering or bullets
          if (q.match(/^\d+\./)) {
            return q.replace(/^\d+\.\s*/, '').trim();
          }
          if (q.startsWith('- ') || q.startsWith('* ')) {
            return q.substring(2).trim();
          }
          return q.trim();
        })
        .filter(q => q.length > 0 && q.endsWith('?'));
      
      if (questions.length > 0) {
        const content = response.substring(0, match.index).trim();
        return { content, followUpQuestions: questions };
      }
    }
  }
  
  return { content: response, followUpQuestions: [] };
}

/**
 * Extract references section from content
 * Now also extracts Image References section
 */
function extractReferencesSection(content: string): {
  mainContent: string;
  referencesText: string;
} {
  // First, try to find both References and Image References sections
  const referencePatterns = [
    /##?\s*References?\s*\n([\s\S]+?)(?=##?\s*Image References?|$)/i,
    /\*\*References?\*\*\s*\n([\s\S]+?)(?=##?\s*Image References?|$)/i,
    /References?:?\s*\n([\s\S]+?)(?=##?\s*Image References?|$)/i,
    /\n\s*References?\s*\n([\s\S]+?)(?=##?\s*Image References?|$)/i
  ];
  
  const imageReferencePatterns = [
    /##?\s*Image References?\s*\n([\s\S]+)$/i,
    /\*\*Image References?\*\*\s*\n([\s\S]+)$/i,
    /Image References?:?\s*\n([\s\S]+)$/i
  ];
  
  let mainContent = content;
  let referencesText = '';
  let imageReferencesText = '';
  
  // Extract regular references
  for (const pattern of referencePatterns) {
    const match = content.match(pattern);
    if (match) {
      mainContent = content.substring(0, match.index).trim();
      referencesText = match[1].trim();
      break;
    }
  }
  
  // Extract image references
  for (const pattern of imageReferencePatterns) {
    const match = content.match(pattern);
    if (match) {
      imageReferencesText = match[1].trim();
      // If we haven't found mainContent yet, extract it
      if (mainContent === content) {
        mainContent = content.substring(0, match.index).trim();
      }
      break;
    }
  }
  
  // Combine both reference sections
  const combinedReferences = [referencesText, imageReferencesText]
    .filter(text => text.length > 0)
    .join('\n\n');
  
  return { mainContent, referencesText: combinedReferences };
}

/**
 * Parse references from text into structured format
 */
function parseReferences(referencesText: string, mode: CitationMode): ParsedReference[] {
  if (!referencesText) return [];
  
  const references: ParsedReference[] = [];
  
  // Split by numbered lines (1., 2., 3., etc.)
  const refLines = referencesText.split(/\n(?=\d+\.)/);
  
  refLines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Extract reference number
    const numberMatch = trimmed.match(/^(\d+)\./);
    const number = numberMatch ? parseInt(numberMatch[1]) : index + 1;
    
    // Parse reference metadata
    const parsed = parseReferenceMetadata(trimmed, number);
    
    if (parsed.isValid) {
      references.push(parsed);
    }
  });
  
  return references;
}

/**
 * Parse individual reference metadata
 */
function parseReferenceMetadata(refString: string, number: number): ParsedReference {
  let title = '';
  let url = '';
  let authors: string[] = [];
  let journal = '';
  let year = '';
  let doi: string | undefined;
  let pmid: string | undefined;
  let pmcid: string | undefined;
  const badges: string[] = [];
  let imageSource: 'Open-i' | 'InjuryMap' | undefined;
  let imageUrl: string | undefined;
  
  // Check if this is an image reference
  const refLower = refString.toLowerCase();
  if (refLower.includes('image from open-i') || 
      refLower.includes('image from open-i, national library') ||
      refLower.includes('open-i, national library of medicine') ||
      refLower.includes('openi.nlm.nih.gov')) {
    imageSource = 'Open-i';
  } else if (refLower.includes('image from injurymap') || 
             refLower.includes('injurymap free human anatomy')) {
    imageSource = 'InjuryMap';
  }
  
  // Extract title and URL from markdown link format: [Title](URL)
  const markdownMatch = refString.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (markdownMatch) {
    title = markdownMatch[1].trim();
    url = markdownMatch[2].trim();
    if (imageSource) {
      imageUrl = url;
    }
  } else {
    // Extract title from plain text (first line or sentence)
    const titleMatch = refString.match(/^\d+\.\s*(.+?)(?:\.|$)/);
    title = titleMatch ? titleMatch[1].trim() : refString.replace(/^\d+\.\s*/, '').trim();
    
    // For image references, try to extract URL from text
    if (imageSource) {
      const urlMatch = refString.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        url = urlMatch[1].trim();
        imageUrl = url;
      }
    }
  }
  
  // Special handling for image references - extract title from the reference text
  if (imageSource) {
    // Try to extract article/image title before "Image from"
    const imageTitleMatch = refString.match(/^\d+\.\s*(.+?)\.\s*Image from/i);
    if (imageTitleMatch) {
      title = imageTitleMatch[1].trim();
    } else {
      // If no title found, use a generic title
      title = title || `Medical Image from ${imageSource}`;
    }
  }
  
  // Extract PMCID first (prefer full-text over abstract)
  const pmcMatch = refString.match(/PMC(ID)?:?\s*(PMC\d+)/i);
  if (pmcMatch) {
    pmcid = pmcMatch[2];
    // PMC has priority - full text available
    if (!url) {
      url = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`;
    }
  }
  
  // Extract PMID
  const pmidMatch = refString.match(/PMID:?\s*(\d+)/i);
  if (pmidMatch) {
    pmid = pmidMatch[1];
    // Only use PMID URL if no PMC URL exists
    if (!url && !pmcid) {
      url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
    }
  }
  
  // Extract DOI
  const doiMatch = refString.match(/doi:?\s*(10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+)/i);
  if (doiMatch) {
    doi = doiMatch[1].replace(/[.,;:)\]]+$/, ''); // Clean trailing punctuation
    // Only use DOI if no PMC or PMID URL exists
    if (!url && !pmcid && !pmid) {
      url = `https://doi.org/${doi}`;
    }
  }
  
  // Extract NCBI Bookshelf ID
  const bookshelfMatch = refString.match(/NBK(\d+)/i);
  if (bookshelfMatch && !url) {
    url = `https://www.ncbi.nlm.nih.gov/books/NBK${bookshelfMatch[1]}/`;
  }
  
  // Extract Europe PMC ID
  const europePMCMatch = refString.match(/europepmc\.org\/article\/MED\/(\d+)/i);
  if (europePMCMatch && !url) {
    url = `https://europepmc.org/article/MED/${europePMCMatch[1]}`;
  }
  
  // Validate URL format
  if (url) {
    try {
      new URL(url);
    } catch (e) {
      console.warn(`Invalid URL detected: ${url}`);
      url = ''; // Clear invalid URL
    }
  }
  
  // Extract authors (look for pattern: "Authors: Name1, Name2, Name3")
  const authorsMatch = refString.match(/Authors?:\s*([^.]+)/i);
  if (authorsMatch) {
    authors = authorsMatch[1]
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0)
      .slice(0, 3); // Limit to first 3 authors
  }
  
  // Extract journal
  const journalMatch = refString.match(/Journal:\s*([^.]+)/i);
  if (journalMatch) {
    journal = journalMatch[1].trim();
  } else {
    // Try to extract journal from common patterns
    const journalPatterns = [
      /\.\s+([A-Z][^.]+)\.\s+\d{4}/,  // ". Journal Name. 2025"
      /\.\s+([A-Z][^.]+)\s+\(\d{4}\)/, // ". Journal Name (2025)"
    ];
    
    for (const pattern of journalPatterns) {
      const match = refString.match(pattern);
      if (match) {
        journal = match[1].trim();
        break;
      }
    }
  }
  
  // Extract year
  const yearMatch = refString.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    year = yearMatch[0];
  }
  
  // Detect quality badges
  // (refLower already declared above for image detection)
  
  // Image Reference - Add badge first if it's an image
  if (imageSource) {
    // Don't add other badges for image references
    // The component will show the image badge separately
  } else {
    // PMCID Badge - Add first if PMC article (full-text available)
    if (pmcid) {
      badges.push('PMCID');
    }
    
    // Practice Guideline
    if (refLower.includes('guideline') || refLower.includes('practice guideline') || 
        refLower.includes('clinical practice') || refLower.includes('standards of care')) {
      badges.push('Practice Guideline');
    }
    
    // Systematic Review / Meta-Analysis
    if (refLower.includes('systematic review') || refLower.includes('meta-analysis') || 
        refLower.includes('cochrane')) {
      badges.push('Systematic Review');
    }
    
    // Recent (≤3 years)
    const currentYear = new Date().getFullYear();
    if (year && parseInt(year) >= currentYear - 3) {
      badges.push('Recent');
    }
    
    // Leading Journal
    const leadingJournals = [
      'new england journal', 'nejm', 'lancet', 'jama', 'bmj', 'british medical journal',
      'nature', 'science', 'cell', 'circulation', 'annals of internal medicine'
    ];
    if (leadingJournals.some(j => refLower.includes(j))) {
      badges.push('Leading Journal');
    }
  }
  
  // Validate reference
  const isValid = title.length > 5 && (url.length > 0 || pmid !== undefined || doi !== undefined || imageSource !== undefined);
  
  return {
    id: `ref-${number}`,
    number,
    title,
    authors,
    journal,
    year,
    doi,
    pmid,
    pmcid,
    url,
    badges: badges as any[],
    isValid,
    imageSource,
    imageUrl
  };
}

/**
 * Clean citation markers from text for display
 */
export function cleanCitationMarkers(text: string): string {
  let result = text;
  
  // Remove [[N]](url) format
  result = result.replace(/\[\[(\d+)\]\]\((https?:\/\/[^\s\)]+)\)/g, '');
  
  // Remove [[N]] format
  result = result.replace(/\[\[(\d+(?:,\s*\d+)*)\]\]/g, '');
  
  // Remove [N] format (but not markdown links)
  result = result.replace(/(?<!\[)\[(\d+(?:,\s*\d+)*)\](?!\()/g, '');
  
  // Remove ^[N]^ format
  result = result.replace(/\^\[(\d+(?:,\s*\d+)*)\]\^/g, '');
  
  // Remove standalone ^ symbols
  result = result.replace(/\^+/g, '');
  
  // Remove citation numbers in parentheses: ([1], ), ([1]), (1, 2), etc.
  result = result.replace(/\(\[?\d+(?:,\s*\d+)*\]?(?:,\s*)?\)/g, '');
  
  // Remove citation numbers with brackets followed by comma and space: [[1], ], [1], 
  result = result.replace(/\[?\[?\d+(?:,\s*\d+)*\]?\]?(?:,\s*)+/g, '');
  
  // Remove trailing commas and spaces that might be left over
  result = result.replace(/,\s*\./g, '.');
  result = result.replace(/\s+,/g, ',');
  result = result.replace(/,\s*,/g, ',');
  
  // Remove standalone closing brackets ] that aren't part of markdown links
  // This fixes the stray ] appearing at end of sentences in General Mode
  result = result.replace(/\s+\]\s*/g, ' ');
  result = result.replace(/\]\s*\./g, '.');
  result = result.replace(/\]\s*,/g, ',');
  result = result.replace(/\]\s*$/gm, '');
  
  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, ' ');
  
  return result.trim();
}

/**
 * Extract citation numbers from text
 */
export function extractCitationNumbers(text: string): number[] {
  const numbers: number[] = [];
  
  const patterns = [
    /\[\[(\d+(?:,\s*\d+)*)\]\]\((https?:\/\/[^\s\)]+)\)/g,  // [[1]](url)
    /\[\[(\d+(?:,\s*\d+)*)\]\]/g,                           // [[1]]
    /(?<!\[)\[(\d+(?:,\s*\d+)*)\](?!\()/g,                  // [1]
    /\^\[(\d+(?:,\s*\d+)*)\]\^/g                            // ^[1]^
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const numberStr = match[1];
      const nums = numberStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      numbers.push(...nums);
    }
  });
  
  // Remove duplicates and sort
  return [...new Set(numbers)].sort((a, b) => a - b);
}
