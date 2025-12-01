/**
 * NCBI E-utilities (PubMed) API Integration
 * Official documentation: https://www.ncbi.nlm.nih.gov/books/NBK25500/
 * 
 * Rate limits:
 * - Without API key: 3 requests/second
 * - With API key: 10 requests/second
 * 
 * IMPORTANT: Add delays between requests to avoid 429 errors
 */

import { getCachedEvidence, cacheEvidence } from './cache-manager';

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const API_KEY = process.env.NCBI_API_KEY || "";

// Rate limiting: 350ms delay = ~2.8 req/sec (safe for 3 req/sec limit)
const REQUEST_DELAY = API_KEY ? 100 : 350;

let lastRequestTime = 0;

/**
 * Rate-limited fetch with retry logic
 */
async function fetchWithRateLimit(url: string, retries = 3): Promise<Response> {
  // Enforce rate limit
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      
      // Handle rate limiting
      if (response.status === 429) {
        if (i === retries - 1) return response;
        
        const waitTime = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.warn(`PubMed rate limited (429), waiting ${Math.round(waitTime)}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      
      const waitTime = Math.pow(2, i) * 1000;
      console.warn(`PubMed error, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw new Error("PubMed API failed after retries");
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  abstract?: string;
  doi?: string;
  publicationType: string[];
  citationCount?: number;
  meshTerms?: string[];
}

export interface PubMedSearchResult {
  count: number;
  pmids: string[];
  webEnv?: string;
  queryKey?: string;
}

export interface PubMedFilters {
  articleTypes?: ('systematic-review' | 'meta-analysis' | 'rct' | 'guideline' | 'review')[];
  yearsBack?: number; // Last N years
  humansOnly?: boolean;
  freeFullText?: boolean;
  hasAbstract?: boolean;
}

/**
 * Build PubMed filter string from options
 */
function buildFilterString(filters?: PubMedFilters): string {
  if (!filters) return '';
  
  const filterParts: string[] = [];
  
  // Article type filters
  if (filters.articleTypes && filters.articleTypes.length > 0) {
    const typeFilters: string[] = [];
    for (const type of filters.articleTypes) {
      switch (type) {
        case 'systematic-review':
          typeFilters.push('systematic[sb]');
          break;
        case 'meta-analysis':
          typeFilters.push('meta-analysis[pt]');
          break;
        case 'rct':
          typeFilters.push('randomized controlled trial[pt]');
          break;
        case 'guideline':
          typeFilters.push('guideline[pt]');
          break;
        case 'review':
          typeFilters.push('review[pt]');
          break;
      }
    }
    if (typeFilters.length > 0) {
      filterParts.push(`(${typeFilters.join(' OR ')})`);
    }
  }
  
  // Date filter - last N years
  if (filters.yearsBack) {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - filters.yearsBack;
    filterParts.push(`${startYear}:${currentYear}[dp]`);
  }
  
  // Humans only
  if (filters.humansOnly) {
    filterParts.push('humans[mh]');
  }
  
  // Free full text
  if (filters.freeFullText) {
    filterParts.push('free full text[sb]');
  }
  
  // Has abstract
  if (filters.hasAbstract) {
    filterParts.push('hasabstract');
  }
  
  return filterParts.length > 0 ? ' AND ' + filterParts.join(' AND ') : '';
}

/**
 * Search PubMed using ESearch with advanced filters
 * Returns PMIDs matching the query
 */
export async function searchPubMed(
  query: string,
  maxResults: number = 20,
  useHistory: boolean = true,
  filters?: PubMedFilters
): Promise<PubMedSearchResult> {
  try {
    // Apply filters to query
    const filterString = buildFilterString(filters);
    const enhancedQuery = query + filterString;
    
    console.log(`🔍 PubMed search: "${query}"${filterString ? ` with filters: ${filterString}` : ''}`);
    
    const params = new URLSearchParams({
      db: "pubmed",
      term: enhancedQuery,
      retmode: "json",
      retmax: maxResults.toString(),
      usehistory: useHistory ? "y" : "n",
      sort: "relevance", // Sort by relevance
      ...(API_KEY && { api_key: API_KEY }),
    });

    const url = `${EUTILS_BASE}/esearch.fcgi?${params}`;
    const response = await fetchWithRateLimit(url);

    if (!response.ok) {
      console.error("PubMed ESearch error:", response.status);
      return { count: 0, pmids: [] };
    }

    const data = await response.json();
    const result = data.esearchresult;

    const count = parseInt(result.count || "0");
    console.log(`✅ Found ${count} PubMed articles`);

    return {
      count,
      pmids: result.idlist || [],
      webEnv: result.webenv,
      queryKey: result.querykey,
    };
  } catch (error) {
    console.error("Error searching PubMed:", error);
    return { count: 0, pmids: [] };
  }
}

/**
 * Fetch article summaries using ESummary
 * More efficient than EFetch for getting basic info
 */
export async function fetchPubMedSummaries(
  pmids: string[]
): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  try {
    const params = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "json",
      ...(API_KEY && { api_key: API_KEY }),
    });

    const url = `${EUTILS_BASE}/esummary.fcgi?${params}`;
    const response = await fetchWithRateLimit(url);

    if (!response.ok) {
      console.error("PubMed ESummary error:", response.status);
      return [];
    }

    const data = await response.json();
    const result = data.result;

    const articles: PubMedArticle[] = [];

    for (const pmid of pmids) {
      const article = result[pmid];
      if (!article || article.error) continue;

      articles.push({
        pmid: pmid,
        title: article.title || "",
        authors: (article.authors || []).map((a: any) => a.name || "").slice(0, 3),
        journal: article.fulljournalname || article.source || "",
        publicationDate: article.pubdate || "",
        doi: article.elocationid?.replace("doi: ", "") || article.articleids?.find((id: any) => id.idtype === "doi")?.value,
        publicationType: article.pubtype || [],
        meshTerms: undefined, // Not available in ESummary
      });
    }

    return articles;
  } catch (error) {
    console.error("Error fetching PubMed summaries:", error);
    return [];
  }
}

/**
 * Fetch full article details using EFetch (XML format)
 * Use this when you need abstracts and MeSH terms
 */
export async function fetchPubMedDetails(
  pmids: string[]
): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  try {
    const params = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "xml",
      rettype: "abstract",
      ...(API_KEY && { api_key: API_KEY }),
    });

    const url = `${EUTILS_BASE}/efetch.fcgi?${params}`;
    const response = await fetchWithRateLimit(url);

    if (!response.ok) {
      console.error("PubMed EFetch error:", response.status);
      return [];
    }

    const xmlText = await response.text();
    return parsePubMedXML(xmlText);
  } catch (error) {
    console.error("Error fetching PubMed details:", error);
    return [];
  }
}

/**
 * Parse PubMed XML response
 * Extracts title, authors, abstract, MeSH terms, etc.
 */
function parsePubMedXML(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];

  try {
    // Simple XML parsing - split by article tags
    const articleSections = xml.split(/<\/?PubmedArticle>/g).filter(s => s.trim());

    for (const articleXml of articleSections) {
      if (!articleXml.includes("<PMID")) continue;

      // Extract PMID
      const pmidMatch = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/);
      const pmid = pmidMatch ? pmidMatch[1] : "";

      // Extract title
      const titleMatch = articleXml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "") : "";

      // Extract authors
      const authors: string[] = [];
      const authorSections = articleXml.split(/<\/?Author[^>]*>/g);
      for (const section of authorSections) {
        const lastNameMatch = section.match(/<LastName>(.*?)<\/LastName>/);
        const foreNameMatch = section.match(/<ForeName>(.*?)<\/ForeName>/);
        if (lastNameMatch && foreNameMatch) {
          authors.push(`${foreNameMatch[1]} ${lastNameMatch[1]}`);
          if (authors.length >= 3) break;
        }
      }

      // Extract journal
      const journalMatch = articleXml.match(/<Title>(.*?)<\/Title>/);
      const journal = journalMatch ? journalMatch[1] : "";

      // Extract publication date
      const yearMatch = articleXml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
      const monthMatch = articleXml.match(/<PubDate>[\s\S]*?<Month>(\w+)<\/Month>/);
      const publicationDate = yearMatch ? `${yearMatch[1]}${monthMatch ? " " + monthMatch[1] : ""}` : "";

      // Extract abstract
      const abstractMatch = articleXml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
      const abstract = abstractMatch ? abstractMatch[1].replace(/<[^>]+>/g, "").substring(0, 500) : undefined;

      // Extract DOI
      const doiMatch = articleXml.match(/<ArticleId IdType="doi">(.*?)<\/ArticleId>/);
      const doi = doiMatch ? doiMatch[1] : undefined;

      // Extract publication types
      const publicationType: string[] = [];
      const pubTypeSections = articleXml.split(/<\/?PublicationType[^>]*>/g);
      for (const section of pubTypeSections) {
        const trimmed = section.trim();
        if (trimmed && !trimmed.includes("<") && trimmed.length < 100) {
          publicationType.push(trimmed);
        }
      }

      // Extract MeSH terms
      const meshTerms: string[] = [];
      const meshSections = articleXml.split(/<\/?DescriptorName[^>]*>/g);
      for (const section of meshSections) {
        const trimmed = section.trim();
        if (trimmed && !trimmed.includes("<") && trimmed.length < 100) {
          meshTerms.push(trimmed);
          if (meshTerms.length >= 5) break;
        }
      }

      if (pmid && title) {
        articles.push({
          pmid,
          title,
          authors,
          journal,
          publicationDate,
          abstract,
          doi,
          publicationType,
          meshTerms: meshTerms.length > 0 ? meshTerms : undefined,
        });
      }
    }
  } catch (error) {
    console.error("Error parsing PubMed XML:", error);
  }

  return articles;
}

/**
 * Search for systematic reviews and meta-analyses specifically
 */
export async function searchSystematicReviews(
  query: string,
  maxResults: number = 10
): Promise<PubMedArticle[]> {
  const enhancedQuery = `${query} AND (systematic[sb] OR meta-analysis[pt])`;
  const searchResult = await searchPubMed(enhancedQuery, maxResults, false);
  
  if (searchResult.pmids.length === 0) return [];
  
  return fetchPubMedDetails(searchResult.pmids);
}

/**
 * Search for randomized controlled trials
 */
export async function searchRCTs(
  query: string,
  maxResults: number = 10
): Promise<PubMedArticle[]> {
  const enhancedQuery = `${query} AND randomized controlled trial[pt]`;
  const searchResult = await searchPubMed(enhancedQuery, maxResults, false);
  
  if (searchResult.pmids.length === 0) return [];
  
  return fetchPubMedDetails(searchResult.pmids);
}

/**
 * Detect if query is about lifestyle, prevention, or general health topics
 * These queries benefit from guideline-focused searches
 */
function isLifestyleOrPreventionQuery(query: string): boolean {
  const lifestyleKeywords = [
    // Physical activity
    'exercise', 'physical activity', 'fitness', 'workout', 'aerobic', 'strength training',
    'walking', 'running', 'swimming', 'yoga', 'stretching', 'sedentary', 'active',
    // Nutrition
    'diet', 'nutrition', 'healthy eating', 'food', 'vitamin', 'supplement', 'protein',
    'carbohydrate', 'fat', 'fiber', 'calorie', 'weight loss', 'weight gain', 'obesity',
    'mediterranean', 'vegetarian', 'vegan', 'fasting', 'sugar', 'salt', 'sodium',
    // Sleep
    'sleep', 'insomnia', 'rest', 'fatigue', 'tired', 'energy',
    // Lifestyle
    'healthy', 'wellness', 'wellbeing', 'lifestyle', 'prevention', 'longevity',
    'aging', 'stress', 'relaxation', 'meditation', 'mindfulness',
    // Substances
    'alcohol', 'smoking', 'tobacco', 'caffeine',
    // General health
    'stay healthy', 'be healthy', 'improve health', 'maintain health', 'good health',
    'how much', 'how often', 'recommended', 'guidelines', 'should i',
  ];
  
  const lowerQuery = query.toLowerCase();
  return lifestyleKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Search for clinical practice guidelines specifically
 */
export async function searchGuidelines(
  query: string,
  maxResults: number = 10
): Promise<PubMedArticle[]> {
  // Search for guidelines and position statements
  const guidelineQuery = `${query} AND (guideline[pt] OR practice guideline[pt] OR consensus[tiab] OR recommendation[tiab] OR "position statement"[tiab])`;
  const searchResult = await searchPubMed(guidelineQuery, maxResults, false, {
    humansOnly: true,
    yearsBack: 10,
  });
  
  if (searchResult.pmids.length === 0) return [];
  
  return fetchPubMedDetails(searchResult.pmids);
}

/**
 * Search for authoritative sources (major medical organizations)
 */
export async function searchAuthoritativeSources(
  query: string,
  maxResults: number = 10
): Promise<PubMedArticle[]> {
  // Search from major medical organizations
  const orgQuery = `${query} AND (
    "American Heart Association"[Affiliation] OR 
    "American College of Cardiology"[Affiliation] OR
    "American Diabetes Association"[Affiliation] OR
    "World Health Organization"[Affiliation] OR
    "Centers for Disease Control"[Affiliation] OR
    "American College of Sports Medicine"[Affiliation] OR
    "American Medical Association"[Affiliation] OR
    "National Institutes of Health"[Affiliation] OR
    JAMA[Journal] OR
    "New England Journal of Medicine"[Journal] OR
    Lancet[Journal] OR
    Circulation[Journal] OR
    "Diabetes Care"[Journal]
  )`;
  
  const searchResult = await searchPubMed(orgQuery, maxResults, false, {
    humansOnly: true,
    yearsBack: 10,
    hasAbstract: true,
  });
  
  if (searchResult.pmids.length === 0) return [];
  
  return fetchPubMedSummaries(searchResult.pmids);
}

/**
 * Combined search: Get high-quality articles + systematic reviews
 * Uses advanced filters for better results
 * Enhanced to include guidelines for lifestyle/prevention queries
 * 
 * NOW WITH CACHING: Checks Redis cache before hitting PubMed API
 */
export async function comprehensivePubMedSearch(
  query: string
): Promise<{ articles: PubMedArticle[]; systematicReviews: PubMedArticle[]; guidelines: PubMedArticle[] }> {
  // PHASE 1 ENHANCEMENT: Check cache first
  // Error handling: If cache fails, continue with API call (graceful degradation)
  try {
    const cached = await getCachedEvidence<{ articles: PubMedArticle[]; systematicReviews: PubMedArticle[]; guidelines: PubMedArticle[] }>(
      query,
      'pubmed'
    );

    if (cached) {
      console.log(`📬 Using cached PubMed results for query`);
      return cached.data;
    }
  } catch (error: any) {
    console.error('❌ Cache read error in PubMed, falling back to API:', error.message);
    // Continue to API call
  }

  // Cache miss - fetch from API
  const isLifestyle = isLifestyleOrPreventionQuery(query);
  
  // Build search promises
  const searchPromises: Promise<any>[] = [
    // General search with quality filters
    searchPubMed(query, 10, false, {
      humansOnly: true,
      yearsBack: 10,
      hasAbstract: true,
    }),
    // Systematic reviews
    searchSystematicReviews(query, 5),
  ];
  
  // Add guideline search for lifestyle/prevention queries
  if (isLifestyle) {
    console.log("🏃 Lifestyle/prevention query detected - adding guideline search");
    searchPromises.push(searchGuidelines(query, 8));
    searchPromises.push(searchAuthoritativeSources(query, 5));
  }
  
  const results = await Promise.all(searchPromises);
  
  const [generalSearch, reviewsSearch, guidelinesSearch, authoritativeSearch] = results;

  const articles = generalSearch.pmids.length > 0 
    ? await fetchPubMedSummaries(generalSearch.pmids)
    : [];
  
  // Combine guidelines from both searches if available
  let guidelines: PubMedArticle[] = [];
  if (isLifestyle) {
    guidelines = [
      ...(guidelinesSearch || []),
      ...(authoritativeSearch || []),
    ];
    // Remove duplicates by PMID
    const seenPmids = new Set<string>();
    guidelines = guidelines.filter(g => {
      if (seenPmids.has(g.pmid)) return false;
      seenPmids.add(g.pmid);
      return true;
    });
    console.log(`📋 Found ${guidelines.length} guideline articles`);
  }

  const result = {
    articles,
    systematicReviews: reviewsSearch,
    guidelines,
  };

  // PHASE 1 ENHANCEMENT: Cache the result
  // Error handling: If caching fails, continue anyway (graceful degradation)
  try {
    await cacheEvidence(query, 'pubmed', result);
  } catch (error: any) {
    console.error('❌ Cache write error in PubMed:', error.message);
    // Continue - result is still returned
  }

  return result;
}
