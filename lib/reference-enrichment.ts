/**
 * Reference Metadata Enrichment
 * Uses Crossref and NCBI ECitMatch APIs to automatically attach DOIs and PMIDs
 * to references that may be missing them.
 */

export interface CitationMetadata {
  title: string;
  authors?: string;
  journal?: string;
  year?: string;
  volume?: string;
  firstPage?: string;
  doi?: string;
  pmid?: string;
}

export interface EnrichedCitation extends CitationMetadata {
  enriched: boolean;
  source: 'original' | 'crossref' | 'pubmed' | 'both';
}

/**
 * Lookup DOI using Crossref REST API
 * https://api.crossref.org/works?query.bibliographic=...
 */
export async function lookupDOI(citation: CitationMetadata): Promise<{
  doi: string | null;
  title?: string;
  journal?: string;
  year?: string;
}> {
  try {
    // Build query string from available metadata
    const queryParts = [
      citation.title,
      citation.authors,
      citation.year,
      citation.journal
    ].filter(Boolean);
    
    if (queryParts.length === 0) {
      return { doi: null };
    }
    
    const query = encodeURIComponent(queryParts.join(' '));
    const url = `https://api.crossref.org/works?query.bibliographic=${query}&rows=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MedGuidence-AI/1.0 (mailto:support@medguidence.ai)'
      }
    });
    
    if (!response.ok) {
      console.warn(`Crossref API error: ${response.status}`);
      return { doi: null };
    }
    
    const data = await response.json();
    const item = data.message?.items?.[0];
    
    if (!item) {
      return { doi: null };
    }
    
    // Calculate similarity score (basic check)
    const titleMatch = citation.title && item.title?.[0] 
      ? calculateSimilarity(citation.title.toLowerCase(), item.title[0].toLowerCase())
      : 0;
    
    // Only return if similarity is high enough (>0.7)
    if (titleMatch < 0.7) {
      console.warn(`Low title match (${titleMatch.toFixed(2)}) for: ${citation.title}`);
      return { doi: null };
    }
    
    return {
      doi: item.DOI || null,
      title: item.title?.[0],
      journal: item['container-title']?.[0],
      year: item['published-print']?.['date-parts']?.[0]?.[0]?.toString() || 
            item['published-online']?.['date-parts']?.[0]?.[0]?.toString()
    };
  } catch (error) {
    console.error('Crossref lookup error:', error);
    return { doi: null };
  }
}

/**
 * Lookup PMID using NCBI ECitMatch
 * https://eutils.ncbi.nlm.nih.gov/entrez/eutils/ecitmatch.cgi
 */
export async function lookupPMID(citation: CitationMetadata): Promise<string | null> {
  try {
    // ECitMatch requires: journal|year|volume|first_page|author|key|
    const { journal, year, volume, firstPage, authors } = citation;
    
    if (!journal || !year || !volume || !firstPage || !authors) {
      // Missing required fields for ECitMatch
      return null;
    }
    
    // Extract first author (last name)
    const firstAuthor = authors.split(',')[0].trim().split(' ')[0];
    
    const bdata = `${journal}|${year}|${volume}|${firstPage}|${firstAuthor}|key|`;
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/ecitmatch.cgi?db=pubmed&retmode=text&bdata=${encodeURIComponent(bdata)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`NCBI ECitMatch error: ${response.status}`);
      return null;
    }
    
    const text = await response.text();
    
    // Output format: journal|year|volume|page|author|key|PMID
    // PMID is -1 if not found
    const parts = text.trim().split('|');
    const pmid = parts[parts.length - 1];
    
    return pmid !== '-1' ? pmid : null;
  } catch (error) {
    console.error('NCBI ECitMatch error:', error);
    return null;
  }
}

/**
 * Enrich a citation with DOI and PMID if missing
 */
export async function enrichCitation(citation: CitationMetadata): Promise<EnrichedCitation> {
  let enriched = false;
  let source: EnrichedCitation['source'] = 'original';
  const result: EnrichedCitation = { ...citation, enriched, source };
  
  // If already has both DOI and PMID, no need to enrich
  if (citation.doi && citation.pmid) {
    return result;
  }
  
  // Try to get DOI from Crossref if missing
  if (!citation.doi) {
    console.log(`🔍 Looking up DOI for: ${citation.title?.substring(0, 50)}...`);
    const crossrefData = await lookupDOI(citation);
    
    if (crossrefData.doi) {
      result.doi = crossrefData.doi;
      enriched = true;
      source = 'crossref';
      console.log(`✅ Found DOI: ${crossrefData.doi}`);
      
      // Also update other fields if they were missing
      if (!result.journal && crossrefData.journal) result.journal = crossrefData.journal;
      if (!result.year && crossrefData.year) result.year = crossrefData.year;
    }
  }
  
  // Try to get PMID from NCBI if missing
  if (!citation.pmid && citation.journal && citation.year) {
    console.log(`🔍 Looking up PMID for: ${citation.title?.substring(0, 50)}...`);
    const pmid = await lookupPMID(citation);
    
    if (pmid) {
      result.pmid = pmid;
      enriched = true;
      source = source === 'crossref' ? 'both' : 'pubmed';
      console.log(`✅ Found PMID: ${pmid}`);
    }
  }
  
  result.enriched = enriched;
  result.source = source;
  
  return result;
}

/**
 * Enrich multiple citations in parallel (with rate limiting)
 */
export async function enrichCitations(
  citations: CitationMetadata[],
  options: { maxConcurrent?: number; delayMs?: number } = {}
): Promise<EnrichedCitation[]> {
  const { maxConcurrent = 3, delayMs = 500 } = options;
  const results: EnrichedCitation[] = [];
  
  console.log(`📚 Enriching ${citations.length} citations...`);
  
  // Process in batches to respect rate limits
  for (let i = 0; i < citations.length; i += maxConcurrent) {
    const batch = citations.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(citation => enrichCitation(citation))
    );
    results.push(...batchResults);
    
    // Delay between batches to respect API rate limits
    if (i + maxConcurrent < citations.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  const enrichedCount = results.filter(r => r.enriched).length;
  console.log(`✅ Enriched ${enrichedCount}/${citations.length} citations`);
  
  return results;
}

/**
 * Calculate string similarity (Levenshtein distance based)
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 1.0;
  }
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Parse a reference string into structured metadata
 * Handles various citation formats
 */
export function parseReferenceString(refString: string): CitationMetadata {
  // Remove leading numbers/bullets
  let cleaned = refString.replace(/^[\d\.\-\*\+]\s*/, '').trim();
  
  // Extract DOI if present
  const doiMatch = cleaned.match(/doi:?\s*(10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+)/i);
  const doi = doiMatch ? doiMatch[1].replace(/[.,;:)\]]+$/, '') : undefined;
  
  // Extract PMID if present
  const pmidMatch = cleaned.match(/PMID:?\s*(\d+)/i);
  const pmid = pmidMatch ? pmidMatch[1] : undefined;
  
  // Remove DOI and PMID from string
  cleaned = cleaned
    .replace(/doi:?\s*10\.\d{4,}\/[^\s]+/gi, '')
    .replace(/PMID:?\s*\d+/gi, '')
    .trim();
  
  // Extract year (4 digits)
  const yearMatch = cleaned.match(/\(?(19\d{2}|20\d{2})\)?/);
  const year = yearMatch ? yearMatch[1] : undefined;
  
  // Split by periods to get parts
  const parts = cleaned.split(/\.\s+/).filter(p => p.trim().length > 2);
  
  // First substantial part is usually the title
  const title = parts[0]?.trim() || cleaned;
  
  // Try to extract journal (usually after title, before year)
  let journal: string | undefined;
  let authors: string | undefined;
  
  if (parts.length > 1) {
    // Check if second part looks like authors (has "et al" or multiple commas)
    const secondPart = parts[1];
    if (secondPart.includes('et al') || secondPart.split(',').length >= 2) {
      authors = secondPart;
      journal = parts[2];
    } else {
      journal = secondPart;
      authors = parts[2];
    }
  }
  
  return {
    title,
    authors,
    journal,
    year,
    doi,
    pmid
  };
}
