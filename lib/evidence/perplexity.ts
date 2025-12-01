/**
 * Perplexity AI Integration for Medical Evidence Search
 * 
 * This module provides a FALLBACK evidence source when our primary databases
 * return insufficient results. Perplexity searches ONLY from trusted medical sources.
 * 
 * Key Features:
 * - Domain-filtered to authoritative medical sources only
 * - Citation extraction with PMID/DOI validation
 * - Integrates seamlessly with existing evidence engine
 * 
 * Usage: Only triggered when primary evidence sources return < 3 quality results
 */

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || "";
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

/**
 * Trusted medical domains that Perplexity is allowed to search
 * Limited to top 20 most authoritative sources (Perplexity API limit)
 */
export const TRUSTED_MEDICAL_DOMAINS = [
  // Primary Literature Databases (highest priority)
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "cochranelibrary.com",
  "europepmc.org",
  
  // Guidelines & Health Authorities
  "who.int",
  "cdc.gov",
  "nice.org.uk",
  "fda.gov",
  "nih.gov",
  "medlineplus.gov",
  
  // Leading Medical Journals (top tier)
  "nejm.org",
  "jamanetwork.com",
  "thelancet.com",
  "bmj.com",
  "nature.com",
  "cell.com",
  
  // Clinical Resources
  "clinicaltrials.gov",
  "mayoclinic.org",
  "annals.org",
  "ahajournals.org",
];

export interface PerplexityCitation {
  url: string;
  title?: string;
  snippet?: string;
  // Extracted identifiers
  pmid?: string;
  doi?: string;
  source?: string;
}

export interface PerplexitySearchResult {
  answer: string;
  citations: PerplexityCitation[];
  relatedQuestions?: string[];
  model: string;
  searchDomains: string[];
}

/**
 * Extract PMID from a URL
 */
function extractPMID(url: string): string | null {
  // PubMed URL patterns
  const patterns = [
    /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/,
    /ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/,
    /PMID[:\s]*(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract DOI from a URL or text
 */
function extractDOI(url: string): string | null {
  // DOI patterns
  const patterns = [
    /doi\.org\/(10\.\d{4,}\/[^\s&]+)/,
    /doi[:\s]*(10\.\d{4,}\/[^\s&]+)/i,
    /(10\.\d{4,}\/[^\s&"'<>]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // Clean up the DOI
      let doi = match[1];
      // Remove trailing punctuation
      doi = doi.replace(/[.,;:)\]]+$/, '');
      return doi;
    }
  }
  return null;
}

/**
 * Detect source from URL
 */
function detectSource(url: string): string {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('pubmed') || urlLower.includes('ncbi.nlm.nih.gov')) return 'pubmed';
  if (urlLower.includes('cochrane')) return 'cochrane';
  if (urlLower.includes('who.int')) return 'who';
  if (urlLower.includes('cdc.gov')) return 'cdc';
  if (urlLower.includes('nice.org.uk')) return 'nice';
  if (urlLower.includes('fda.gov')) return 'fda';
  if (urlLower.includes('nejm.org')) return 'nejm';
  if (urlLower.includes('jamanetwork') || urlLower.includes('jama')) return 'jama';
  if (urlLower.includes('thelancet') || urlLower.includes('lancet')) return 'lancet';
  if (urlLower.includes('bmj.com')) return 'bmj';
  if (urlLower.includes('ahajournals') || urlLower.includes('circulation')) return 'aha';
  if (urlLower.includes('diabetesjournals') || urlLower.includes('diabetes.org')) return 'ada';
  if (urlLower.includes('europepmc')) return 'europepmc';
  if (urlLower.includes('clinicaltrials.gov')) return 'clinicaltrials';
  if (urlLower.includes('nature.com')) return 'nature';
  if (urlLower.includes('cell.com')) return 'cell';
  if (urlLower.includes('plos')) return 'plos';
  if (urlLower.includes('frontiersin')) return 'frontiers';
  
  return 'other';
}

/**
 * Build the medical search prompt for Perplexity
 */
function buildMedicalSearchPrompt(query: string): string {
  return `You are a medical research assistant. Answer the following medical question with evidence-based information.

IMPORTANT INSTRUCTIONS:
1. Provide specific, quantitative information when available (e.g., "150-300 minutes per week" not "regular exercise")
2. Cite specific studies, guidelines, and recommendations
3. Include information from major health organizations (WHO, CDC, AHA, etc.)
4. Mention specific journal articles with authors and years when relevant
5. Be comprehensive but concise
6. If there are conflicting findings, mention both perspectives

Medical Question: ${query}

Provide a thorough, evidence-based answer with specific citations.`;
}

/**
 * Search Perplexity for medical evidence
 * Only searches from trusted medical domains
 */
export async function searchPerplexityMedical(
  query: string,
  options: {
    maxCitations?: number;
    recencyFilter?: "day" | "week" | "month" | "year";
  } = {}
): Promise<PerplexitySearchResult> {
  const { maxCitations = 10, recencyFilter = "year" } = options;
  
  if (!PERPLEXITY_API_KEY) {
    console.warn("⚠️ PERPLEXITY_API_KEY not set, skipping Perplexity search");
    return {
      answer: "",
      citations: [],
      model: "none",
      searchDomains: [],
    };
  }
  
  console.log("🔍 Perplexity: Searching trusted medical sources...");
  console.log(`   Query: "${query.substring(0, 100)}..."`);
  
  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro", // Best model for research with citations
        messages: [
          {
            role: "system",
            content: "You are a medical research assistant that provides evidence-based answers with proper citations. Always cite your sources and provide specific, quantitative information when available."
          },
          {
            role: "user",
            content: buildMedicalSearchPrompt(query)
          }
        ],
        // Search configuration
        search_domain_filter: TRUSTED_MEDICAL_DOMAINS,
        search_recency_filter: recencyFilter,
        return_citations: true,
        return_related_questions: true,
        // Temperature for factual responses
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Perplexity API error: ${response.status}`, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the answer
    const answer = data.choices?.[0]?.message?.content || "";
    
    // Extract citations from the response
    const rawCitations: string[] = data.citations || [];
    
    console.log(`✅ Perplexity: Found ${rawCitations.length} citations`);
    
    // Process and validate citations
    const citations: PerplexityCitation[] = rawCitations
      .slice(0, maxCitations)
      .map((url: string) => {
        const pmid = extractPMID(url);
        const doi = extractDOI(url);
        const source = detectSource(url);
        
        return {
          url,
          pmid: pmid || undefined,
          doi: doi || undefined,
          source,
        };
      })
      // Filter to only include citations from trusted sources
      .filter((cite: PerplexityCitation) => {
        const isTrusted = TRUSTED_MEDICAL_DOMAINS.some(domain => 
          cite.url.toLowerCase().includes(domain.toLowerCase())
        );
        if (!isTrusted) {
          console.log(`   ⚠️ Filtered out untrusted source: ${cite.url}`);
        }
        return isTrusted;
      });
    
    console.log(`   📚 ${citations.length} citations from trusted sources`);
    console.log(`   Sources: ${[...new Set(citations.map(c => c.source))].join(', ')}`);
    
    return {
      answer,
      citations,
      relatedQuestions: data.related_questions || [],
      model: data.model || "sonar-pro",
      searchDomains: TRUSTED_MEDICAL_DOMAINS,
    };
    
  } catch (error: any) {
    console.error("❌ Perplexity search failed:", error.message);
    return {
      answer: "",
      citations: [],
      model: "error",
      searchDomains: TRUSTED_MEDICAL_DOMAINS,
    };
  }
}

/**
 * Validate and enrich citations by looking up PMIDs
 * For citations without PMID, try to find them via PubMed title search
 */
export async function enrichCitationsWithPMID(
  citations: PerplexityCitation[]
): Promise<PerplexityCitation[]> {
  // For now, return as-is. In future, we can add PubMed title lookup
  // to find PMIDs for citations that only have URLs
  return citations.filter(c => c.pmid || c.doi || c.source !== 'other');
}

/**
 * Format Perplexity results for inclusion in evidence prompt
 * 
 * IMPORTANT: Perplexity is just a search engine - we credit the ACTUAL SOURCES
 * (Mayo Clinic, CDC, WHO, PubMed, etc.), NOT Perplexity itself.
 * 
 * Think of Perplexity like a chef who gathers recipes from different restaurants.
 * We credit the restaurants (sources), not the chef (Perplexity).
 */
export function formatPerplexityForPrompt(result: PerplexitySearchResult): string {
  if (!result.answer || result.citations.length === 0) {
    return "";
  }
  
  // Don't mention "Perplexity" - just present as additional medical sources
  let formatted = "\n\n## ZONE 0: ADDITIONAL MEDICAL SOURCES\n";
  formatted += "**Supplementary evidence from trusted medical websites**\n\n";
  
  if (result.citations.length > 0) {
    result.citations.forEach((cite, i) => {
      const refNum = i + 1;
      // Get the actual source name (Mayo Clinic, CDC, etc.) - NOT "Perplexity"
      const sourceInfo = extractSourceInfo(cite.url);
      const title = cite.title || sourceInfo.title;
      
      formatted += `${refNum}. **${title}**\n`;
      formatted += `   URL: ${cite.url}\n`;
      // Use the actual source (Mayo Clinic, CDC, WHO, etc.) - NOT "Perplexity"
      formatted += `   SOURCE: ${sourceInfo.sourceName}`;
      if (cite.pmid) formatted += ` | PMID: ${cite.pmid}`;
      if (cite.doi) formatted += ` | DOI: ${cite.doi}`;
      formatted += "\n\n";
    });
  }
  
  return formatted;
}

/**
 * Extract source information from a URL
 * Returns the actual source name (Mayo Clinic, CDC, etc.) - NOT "Perplexity"
 */
function extractSourceInfo(url: string): { sourceName: string; title: string } {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    // Map domains to their proper source names and badges
    const sourceMap: Record<string, { name: string; badge: string }> = {
      'mayoclinic.org': { name: 'Mayo Clinic', badge: 'MAYO CLINIC' },
      'cdc.gov': { name: 'CDC', badge: 'CDC' },
      'who.int': { name: 'World Health Organization', badge: 'WHO' },
      'nih.gov': { name: 'National Institutes of Health', badge: 'NIH' },
      'niddk.nih.gov': { name: 'NIDDK (NIH)', badge: 'NIH' },
      'medlineplus.gov': { name: 'MedlinePlus (NIH)', badge: 'MEDLINEPLUS' },
      'pubmed.ncbi.nlm.nih.gov': { name: 'PubMed', badge: 'PUBMED' },
      'ncbi.nlm.nih.gov': { name: 'NCBI', badge: 'NCBI' },
      'pmc.ncbi.nlm.nih.gov': { name: 'PubMed Central', badge: 'PMC' },
      'cochranelibrary.com': { name: 'Cochrane Library', badge: 'COCHRANE' },
      'nice.org.uk': { name: 'NICE Guidelines', badge: 'NICE' },
      'fda.gov': { name: 'FDA', badge: 'FDA' },
      'nejm.org': { name: 'New England Journal of Medicine', badge: 'NEJM' },
      'jamanetwork.com': { name: 'JAMA Network', badge: 'JAMA' },
      'thelancet.com': { name: 'The Lancet', badge: 'LANCET' },
      'bmj.com': { name: 'BMJ', badge: 'BMJ' },
      'nature.com': { name: 'Nature', badge: 'NATURE' },
      'diabetesjournals.org': { name: 'American Diabetes Association', badge: 'ADA' },
      'diabetes.org': { name: 'American Diabetes Association', badge: 'ADA' },
      'ahajournals.org': { name: 'American Heart Association', badge: 'AHA' },
      'heart.org': { name: 'American Heart Association', badge: 'AHA' },
      'aap.org': { name: 'American Academy of Pediatrics', badge: 'AAP' },
      'acog.org': { name: 'ACOG', badge: 'ACOG' },
      'uptodate.com': { name: 'UpToDate', badge: 'UPTODATE' },
      'clevelandclinic.org': { name: 'Cleveland Clinic', badge: 'CLEVELAND CLINIC' },
      'hopkinsmedicine.org': { name: 'Johns Hopkins Medicine', badge: 'JOHNS HOPKINS' },
      'webmd.com': { name: 'WebMD', badge: 'WEBMD' },
      'healthline.com': { name: 'Healthline', badge: 'HEALTHLINE' },
    };
    
    // Find matching source
    let sourceInfo = { name: hostname, badge: hostname.toUpperCase() };
    for (const [domain, info] of Object.entries(sourceMap)) {
      if (hostname.includes(domain) || hostname.endsWith(domain)) {
        sourceInfo = { name: info.name, badge: info.badge };
        break;
      }
    }
    
    // Extract title from URL path
    let title = `${sourceInfo.name} Resource`;
    const pathParts = urlObj.pathname.split('/').filter(p => p && p.length > 2);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1]
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\.\w+$/, '');
      
      if (lastPart.length > 5 && lastPart.length < 100) {
        title = `${sourceInfo.name}: ${lastPart.charAt(0).toUpperCase() + lastPart.slice(1)}`;
      }
    }
    
    return { sourceName: sourceInfo.badge, title };
  } catch {
    return { sourceName: 'MEDICAL LITERATURE', title: 'Medical Resource' };
  }
}

/**
 * Check if Perplexity fallback should be triggered
 * Based on quality and quantity of primary evidence
 */
export function shouldTriggerPerplexityFallback(
  evidenceCounts: {
    guidelines: number;
    systematicReviews: number;
    pubmedArticles: number;
    cochraneReviews: number;
    clinicalTrials: number;
  }
): boolean {
  const totalHighQuality = 
    evidenceCounts.guidelines +
    evidenceCounts.systematicReviews +
    evidenceCounts.cochraneReviews;
  
  const totalEvidence = 
    totalHighQuality +
    evidenceCounts.pubmedArticles +
    evidenceCounts.clinicalTrials;
  
  // Trigger fallback if:
  // 1. Less than 3 high-quality sources (guidelines, systematic reviews, Cochrane)
  // 2. OR less than 5 total evidence items
  const shouldTrigger = totalHighQuality < 3 || totalEvidence < 5;
  
  if (shouldTrigger) {
    console.log(`📡 Perplexity fallback triggered: ${totalHighQuality} high-quality, ${totalEvidence} total evidence items`);
  }
  
  return shouldTrigger;
}
