/**
 * Evidence Engine - Coordinates all 20+ medical database evidence sources
 * This is the main interface for retrieving clinical evidence
 * Note: Google Search grounding is handled separately in the API route as fallback
 */

// Initialize evidence system and validate configuration
import './init';

import { searchClinicalTrials, ClinicalTrial } from "./clinical-trials";
import { searchDrugLabels, searchAdverseEvents, DrugLabel, AdverseEvent } from "./openfda";
import { searchLiterature, searchSystematicReviews, searchRecentLiterature, searchClinicalTrials as searchOpenAlexClinicalTrials, ScholarlyWork } from "./openalex";
import { comprehensivePubMedSearch, PubMedArticle } from "./pubmed";
import { comprehensiveSearch, EuropePMCArticle } from "./europepmc";
import { scoreEvidence, formatQualityScore, EvidenceScore } from "./quality-scorer";
import { formatCitation, CitationData } from "./citation-formatter";
import { searchSemanticScholar, searchHighlyCitedMedical, SemanticScholarPaper } from "./semantic-scholar";
import { comprehensiveMedlinePlusSearch, formatMedlinePlusForPrompt, MedlinePlusResult } from "./medlineplus";
import { comprehensivePMCSearch, formatPMCForPrompt, PMCArticle } from "./pmc";
import { comprehensiveCochraneSearch, formatCochraneForPrompt, CochraneReview } from "./cochrane";
import { comprehensiveDailyMedSearch, DailyMedDrug } from "./dailymed";
import { comprehensiveAAPSearch, formatAAPForPrompt, AAPGuideline, isPediatricQuery } from "./aap";
import { comprehensiveRxNormSearch, formatRxNormForPrompt, RxNormDrug, RxNormDrugClass, RxNormInteraction } from "./rxnorm";
// New international guideline sources
import { searchWHOGuidelines, formatWHOGuidelinesForPrompt, WHOGuideline } from "./who-guidelines";
import { searchCDCGuidelines, formatCDCGuidelinesForPrompt, CDCGuideline } from "./cdc-guidelines";
import { searchNICEGuidelines, formatNICEGuidelinesForPrompt, NICEGuideline } from "./nice-guidelines";
import { searchBMJBestPractice, formatBMJBestPracticeForPrompt, BMJBestPractice } from "./bmj-best-practice";
// Cardiovascular guidelines (ACC/AHA, ESC)
import { searchCardiovascularGuidelines, formatCardiovascularGuidelinesForPrompt, getLDLTargetComparison, CardiovascularGuideline } from "./cardiovascular-guidelines";
// Enhanced NCBI sources
import { searchStatPearls, formatNCBIBooksForPrompt, NCBIBook } from "./ncbi-books";
import { enhanceQueryWithMeSH, isLifestyleQuery, generateLifestyleSearchQueries } from "./mesh-mapper";
import { searchOMIM, isGeneticQuery, formatOMIMForPrompt, OMIMEntry } from "./omim";
import { comprehensivePubChemSearch, formatPubChemForPrompt, shouldUsePubChemFallback, extractDrugTermsFromQuery, PubChemCompound, PubChemBioAssay } from "./pubchem";
// Perplexity AI fallback for when primary databases return insufficient results
import { searchPerplexityMedical, formatPerplexityForPrompt, shouldTriggerPerplexityFallback, PerplexityCitation, PerplexitySearchResult } from "./perplexity";
// Phase 2: Semantic Enhancement
import { rerankPubMedArticles, rerankCochraneReviews } from "./semantic-reranker";

export interface ClinicalGuideline {
  source: string;
  type: string;
  title: string;
  url: string;
  journal: string;
  year: string;
  authors: string;
  summary: string;
}

export interface EvidencePackage {
  clinicalTrials: ClinicalTrial[];
  drugLabels: DrugLabel[];
  adverseEvents: AdverseEvent[];
  literature: ScholarlyWork[];
  systematicReviews: ScholarlyWork[];
  pubmedArticles: PubMedArticle[];
  pubmedReviews: PubMedArticle[];
  pubmedGuidelines: PubMedArticle[]; // NEW: Guidelines from PubMed
  europePMCRecent: EuropePMCArticle[];
  europePMCCited: EuropePMCArticle[];
  europePMCPreprints: EuropePMCArticle[];
  europePMCOpenAccess: EuropePMCArticle[];
  semanticScholarPapers: SemanticScholarPaper[];
  semanticScholarHighlyCited: SemanticScholarPaper[];
  medlinePlus: MedlinePlusResult;
  pmcArticles: PMCArticle[];
  pmcRecentArticles: PMCArticle[];
  pmcReviews: PMCArticle[];
  cochraneReviews: CochraneReview[];
  cochraneRecent: CochraneReview[];
  dailyMedDrugs: DailyMedDrug[];
  aapGuidelines: AAPGuideline[];
  aapPolicyStatements: AAPGuideline[];
  aapKeyResources: AAPGuideline[];
  rxnormDrugs: RxNormDrug[];
  rxnormClasses: RxNormDrugClass[];
  rxnormInteractions: RxNormInteraction[];
  rxnormPrescribable: RxNormDrug[];
  guidelines: ClinicalGuideline[];
  // International guidelines
  whoGuidelines: WHOGuideline[];
  cdcGuidelines: CDCGuideline[];
  niceGuidelines: NICEGuideline[];
  bmjBestPractice: BMJBestPractice[];
  // Cardiovascular guidelines (ACC/AHA, ESC)
  cardiovascularGuidelines: CardiovascularGuideline[];
  // Enhanced NCBI sources
  ncbiBooks: NCBIBook[];
  omimEntries: OMIMEntry[];
  // PubChem (fallback for DailyMed)
  pubChemCompounds: PubChemCompound[];
  pubChemBioAssays: PubChemBioAssay[];
  // Perplexity AI (fallback when primary sources insufficient)
  perplexityResult: PerplexitySearchResult | null;
  perplexityCitations: PerplexityCitation[];
  timestamp: string;
}

/**
 * Detect if query is diabetes-related
 */
function isDiabetesQuery(query: string): boolean {
  const diabetesKeywords = [
    'diabetes', 'diabetic', 'dm', 't1d', 't2d', 'type 1', 'type 2',
    'insulin', 'metformin', 'hba1c', 'glucose', 'glycemic',
    'hyperglycemia', 'hypoglycemia', 'dka', 'diabetic ketoacidosis'
  ];
  
  const lowerQuery = query.toLowerCase();
  return diabetesKeywords.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Get relevant clinical guidelines based on query
 */
function getRelevantGuidelines(query: string): ClinicalGuideline[] {
  const guidelines: ClinicalGuideline[] = [];
  
  // ADA Standards of Care for diabetes queries
  if (isDiabetesQuery(query)) {
    guidelines.push({
      source: 'ADA Standards',
      type: 'Guideline',
      title: 'Standards of Care in Diabetes—2024',
      url: 'https://diabetesjournals.org/care/issue/47/Supplement_1',
      journal: 'Diabetes Care',
      year: '2024',
      authors: 'American Diabetes Association Professional Practice Committee',
      summary: 'The American Diabetes Association (ADA) Standards of Medical Care in Diabetes provides comprehensive, evidence-based recommendations for diabetes diagnosis, treatment, and management. Updated annually, these guidelines represent the gold standard for diabetes care.',
    });
  }
  
  return guidelines;
}

/**
 * Main evidence retrieval function
 * Coordinates searches across all evidence sources
 */
export async function gatherEvidence(
  clinicalQuery: string,
  drugNames: string[] = []
): Promise<EvidencePackage> {
  console.log("🔍 Gathering evidence for:", clinicalQuery);
  
  // STEP 1: Detect if this is a lifestyle/prevention query
  const isLifestyle = isLifestyleQuery(clinicalQuery);
  if (isLifestyle) {
    console.log("🏃 Lifestyle/prevention query detected - using enhanced search strategy");
  }
  
  // STEP 2: Enhance query with MeSH terms for better PubMed results
  const enhancedQuery = enhanceQueryWithMeSH(clinicalQuery);
  if (enhancedQuery !== clinicalQuery) {
    console.log(`🔍 Enhanced query with MeSH: "${enhancedQuery}"`);
  }
  
  // STEP 3: Generate additional search queries for lifestyle topics
  const additionalQueries = isLifestyle ? generateLifestyleSearchQueries(clinicalQuery) : [];
  if (additionalQueries.length > 1) {
    console.log(`📋 Generated ${additionalQueries.length} search variations for better coverage`);
  }
  
  // Get relevant clinical guidelines
  const guidelines = getRelevantGuidelines(clinicalQuery);
  
  // Search international guidelines (synchronous, from curated database)
  const whoGuidelines = searchWHOGuidelines(clinicalQuery, 3);
  const cdcGuidelines = searchCDCGuidelines(clinicalQuery, 3);
  const niceGuidelines = searchNICEGuidelines(clinicalQuery, 3);
  const bmjBestPractice = searchBMJBestPractice(clinicalQuery, 3);
  // Search cardiovascular guidelines (ACC/AHA, ESC) - important for lipid/CV queries
  const cardiovascularGuidelines = searchCardiovascularGuidelines(clinicalQuery, 5);
  
  console.log("📋 International guidelines found:", {
    WHO: whoGuidelines.length,
    CDC: cdcGuidelines.length,
    NICE: niceGuidelines.length,
    BMJ: bmjBestPractice.length,
    "ACC/AHA/ESC": cardiovascularGuidelines.length,
  });

  // Run all searches in parallel for speed (including Perplexity for maximum coverage)
  const [
    clinicalTrials,
    literature,
    systematicReviews,
    pubmedData,
    europePMCData,
    pmcData,
    cochraneData,
    semanticScholarPapers,
    semanticScholarHighlyCited,
    medlinePlusData,
    dailyMedData,
    aapData,
    rxnormData,
    ncbiBooks,
    omimData,
    perplexityResult, // NEW: Run Perplexity in parallel with all other sources
    ...drugData
  ] = await Promise.all([
    // Clinical trials
    searchClinicalTrials(clinicalQuery, 5),
    
    // General literature (OpenAlex)
    searchLiterature(clinicalQuery, 5),
    
    // Systematic reviews (OpenAlex)
    searchSystematicReviews(clinicalQuery, 2),
    
    // PubMed comprehensive search (articles + reviews) - with MeSH enhancement
    comprehensivePubMedSearch(enhancedQuery),
    
    // Europe PMC comprehensive search (recent, cited, preprints, open access)
    comprehensiveSearch(clinicalQuery),
    
    // PMC full-text search (articles, recent, reviews)
    comprehensivePMCSearch(clinicalQuery),
    
    // Cochrane Library systematic reviews (gold standard)
    comprehensiveCochraneSearch(clinicalQuery),
    
    // Semantic Scholar search (general + highly cited)
    searchSemanticScholar(clinicalQuery, 5),
    searchHighlyCitedMedical(clinicalQuery, 5),
    
    // MedlinePlus consumer health information
    comprehensiveMedlinePlusSearch(clinicalQuery, drugNames),
    
    // DailyMed FDA drug labels
    comprehensiveDailyMedSearch(clinicalQuery),
    
    // American Academy of Pediatrics (AAP) guidelines - for pediatric queries
    comprehensiveAAPSearch(clinicalQuery),
    
    // RxNorm drug information (NLM standardized drug nomenclature)
    comprehensiveRxNormSearch(clinicalQuery, drugNames),
    
    // NCBI Books (StatPearls and medical textbooks)
    searchStatPearls(clinicalQuery, 3),
    
    // OMIM (genetic disorders - only if genetic query detected)
    isGeneticQuery(clinicalQuery) ? searchOMIM(clinicalQuery, 3) : Promise.resolve([]),
    
    // Perplexity AI (real-time search from trusted medical sources - runs in parallel)
    searchPerplexityMedical(clinicalQuery, {
      maxCitations: 10,
      recencyFilter: "year",
    }),
    
    // Drug-specific data (if drug names provided)
    ...drugNames.flatMap(drug => [
      searchDrugLabels(drug, 2),
      searchAdverseEvents(drug, 5),
    ]),
  ]);
  
  // Organize drug data
  const drugLabels: DrugLabel[] = [];
  const adverseEvents: AdverseEvent[] = [];
  
  for (let i = 0; i < drugData.length; i += 2) {
    drugLabels.push(...(drugData[i] as DrugLabel[]));
    adverseEvents.push(...(drugData[i + 1] as AdverseEvent[]));
  }
  
  // PubChem fallback (if DailyMed has insufficient results)
  let pubChemCompounds: PubChemCompound[] = [];
  let pubChemBioAssays: PubChemBioAssay[] = [];
  
  // Get drug terms - either from provided drugNames or extract from query
  let drugTermsForPubChem = drugNames.length > 0 ? drugNames : extractDrugTermsFromQuery(clinicalQuery);
  
  if (shouldUsePubChemFallback(dailyMedData.drugs.length, clinicalQuery) && drugTermsForPubChem.length > 0) {
    console.log(`💊 DailyMed has ${dailyMedData.drugs.length} results, using PubChem fallback for: ${drugTermsForPubChem.join(', ')}...`);
    
    try {
      for (const drugName of drugTermsForPubChem.slice(0, 2)) { // Limit to 2 drugs
        const pubChemResult = await comprehensivePubChemSearch(drugName);
        pubChemCompounds.push(...pubChemResult.compounds);
        pubChemBioAssays.push(...pubChemResult.bioAssays);
      }
      console.log(`🧪 PubChem: ${pubChemCompounds.length} compounds, ${pubChemBioAssays.length} bioassays`);
    } catch (error: any) {
      console.error("PubChem fallback error:", error.message);
    }
  } else if (dailyMedData.drugs.length === 0 && drugTermsForPubChem.length === 0) {
    console.log(`ℹ️  No drug terms detected in query, skipping PubChem search`);
  }
  
  // PHASE 2 ENHANCEMENT: Apply semantic reranking to improve relevance
  console.log("🔄 Applying semantic reranking to improve relevance...");
  let rerankedPubMedArticles = pubmedData.articles;
  let rerankedPubMedReviews = pubmedData.systematicReviews;
  let rerankedCochraneReviews = cochraneData.allReviews;
  let rerankedCochraneRecent = cochraneData.recentReviews;
  
  try {
    // Rerank PubMed articles if we have enough results
    if (pubmedData.articles.length >= 10) {
      rerankedPubMedArticles = await rerankPubMedArticles(clinicalQuery, pubmedData.articles, {
        topK: 50,
        minSimilarity: 0.0,
        skipIfFewResults: 10,
      });
      console.log(`✅ Reranked ${rerankedPubMedArticles.length} PubMed articles`);
    }
    
    // Rerank PubMed reviews
    if (pubmedData.systematicReviews.length >= 5) {
      rerankedPubMedReviews = await rerankPubMedArticles(clinicalQuery, pubmedData.systematicReviews, {
        topK: 20,
        minSimilarity: 0.0,
        skipIfFewResults: 5,
      });
      console.log(`✅ Reranked ${rerankedPubMedReviews.length} PubMed reviews`);
    }
    
    // Rerank Cochrane reviews
    if (cochraneData.allReviews.length >= 3) {
      rerankedCochraneReviews = await rerankCochraneReviews(clinicalQuery, cochraneData.allReviews, {
        topK: 10,
        minSimilarity: 0.0,
        skipIfFewResults: 3,
      });
      console.log(`✅ Reranked ${rerankedCochraneReviews.length} Cochrane reviews`);
    }
    
    if (cochraneData.recentReviews.length >= 2) {
      rerankedCochraneRecent = await rerankCochraneReviews(clinicalQuery, cochraneData.recentReviews, {
        topK: 5,
        minSimilarity: 0.0,
        skipIfFewResults: 2,
      });
      console.log(`✅ Reranked ${rerankedCochraneRecent.length} recent Cochrane reviews`);
    }
  } catch (error: any) {
    console.error("⚠️ Semantic reranking error, using original order:", error.message);
    // Graceful degradation - use original results
  }

  const evidence: EvidencePackage = {
    clinicalTrials,
    drugLabels,
    adverseEvents,
    literature,
    systematicReviews,
    pubmedArticles: rerankedPubMedArticles,
    pubmedReviews: rerankedPubMedReviews,
    pubmedGuidelines: pubmedData.guidelines || [], // NEW: Guidelines from PubMed
    europePMCRecent: europePMCData.recent,
    europePMCCited: europePMCData.cited,
    europePMCPreprints: europePMCData.preprints,
    europePMCOpenAccess: europePMCData.openAccess,
    pmcArticles: pmcData.articles,
    pmcRecentArticles: pmcData.recentArticles,
    pmcReviews: pmcData.reviews,
    cochraneReviews: rerankedCochraneReviews,
    cochraneRecent: rerankedCochraneRecent,
    semanticScholarPapers,
    semanticScholarHighlyCited,
    medlinePlus: medlinePlusData,
    dailyMedDrugs: dailyMedData.drugs,
    aapGuidelines: aapData.guidelines,
    aapPolicyStatements: aapData.policyStatements,
    aapKeyResources: aapData.keyResources,
    rxnormDrugs: rxnormData.drugs,
    rxnormClasses: rxnormData.classes,
    rxnormInteractions: rxnormData.interactions,
    rxnormPrescribable: rxnormData.prescribable,
    guidelines,
    // International guidelines
    whoGuidelines,
    cdcGuidelines,
    niceGuidelines,
    bmjBestPractice,
    // Cardiovascular guidelines
    cardiovascularGuidelines,
    // Enhanced NCBI sources
    ncbiBooks: ncbiBooks as NCBIBook[],
    omimEntries: omimData as OMIMEntry[],
    // PubChem (fallback for DailyMed)
    pubChemCompounds,
    pubChemBioAssays,
    // Perplexity (real-time search - now runs in parallel with all sources)
    perplexityResult: perplexityResult as PerplexitySearchResult,
    perplexityCitations: (perplexityResult as PerplexitySearchResult)?.citations || [],
    timestamp: new Date().toISOString(),
  };
  
  console.log("✅ Evidence gathered:", {
    trials: clinicalTrials.length,
    labels: drugLabels.length,
    events: adverseEvents.length,
    dailyMedDrugs: dailyMedData.drugs.length,
    aapGuidelines: aapData.guidelines.length,
    aapPolicyStatements: aapData.policyStatements.length,
    rxnormDrugs: rxnormData.drugs.length,
    rxnormClasses: rxnormData.classes.length,
    rxnormInteractions: rxnormData.interactions.length,
    openAlexPapers: literature.length,
    openAlexReviews: systematicReviews.length,
    pubmedArticles: pubmedData.articles.length,
    pubmedReviews: pubmedData.systematicReviews.length,
    pubmedGuidelines: (pubmedData.guidelines || []).length, // NEW
    pmcArticles: pmcData.articles.length,
    pmcRecentArticles: pmcData.recentArticles.length,
    pmcReviews: pmcData.reviews.length,
    cochraneReviews: cochraneData.allReviews.length,
    cochraneRecent: cochraneData.recentReviews.length,
    europePMCRecent: europePMCData.recent.length,
    europePMCCited: europePMCData.cited.length,
    europePMCPreprints: europePMCData.preprints.length,
    europePMCOpenAccess: europePMCData.openAccess.length,
    semanticScholarPapers: semanticScholarPapers.length,
    semanticScholarHighlyCited: semanticScholarHighlyCited.length,
    medlinePlusTopics: medlinePlusData.healthTopics.length,
    medlinePlusDrugs: medlinePlusData.drugInfo.length,
    guidelines: guidelines.length,
    whoGuidelines: whoGuidelines.length,
    cdcGuidelines: cdcGuidelines.length,
    niceGuidelines: niceGuidelines.length,
    bmjBestPractice: bmjBestPractice.length,
    cardiovascularGuidelines: cardiovascularGuidelines.length,
    ncbiBooks: (ncbiBooks as NCBIBook[]).length,
    omimEntries: (omimData as OMIMEntry[]).length,
    pubChemCompounds: pubChemCompounds.length,
    pubChemBioAssays: pubChemBioAssays.length,
    perplexityCitations: evidence.perplexityCitations.length,
  });
  
  return evidence;
}

/**
 * Format evidence package for inclusion in AI prompt
 * 
 * IMPORTANT: This function organizes evidence into 21 medical knowledge zones:
 * 1. Clinical Guidelines Zone - Authoritative practice guidelines
 * 2. Systematic Reviews Zone - Cochrane and other systematic reviews
 * 3. Meta-Analysis Zone - Pooled analysis studies
 * 4. Clinical Trials Zone - RCTs and ongoing trials
 * 5. Drug Information Zone - FDA labels, DailyMed, drug safety
 * 6. Drug Interactions Zone - Drug-drug interactions
 * 7. Adverse Events Zone - FDA FAERS data
 * 8. Treatment Protocols Zone - Standard treatment approaches
 * 9. Diagnostic Criteria Zone - Diagnostic guidelines
 * 10. Pathophysiology Zone - Disease mechanisms
 * 11. Epidemiology Zone - Disease prevalence and risk factors
 * 12. Prognosis Zone - Outcomes and survival data
 * 13. Prevention Zone - Preventive measures
 * 14. Pediatric Zone - Age-specific considerations
 * 15. Geriatric Zone - Elderly patient considerations
 * 16. Pregnancy Zone - Maternal-fetal medicine
 * 17. Genetics Zone - Genetic factors and pharmacogenomics
 * 18. Imaging Zone - Radiology and imaging findings
 * 19. Laboratory Zone - Lab values and interpretation
 * 20. Patient Education Zone - Consumer health information
 * 21. Emerging Research Zone - Preprints and recent findings
 * 
 * Each evidence item includes its SOURCE for proper citation.
 */
export function formatEvidenceForPrompt(evidence: EvidencePackage): string {
  let formatted = "\n\n--- EVIDENCE RETRIEVED FROM MULTIPLE DATABASES ---\n\n";
  
  // CRITICAL WARNING about zone numbers
  formatted += "⚠️ **CITATION WARNING - READ CAREFULLY:**\n";
  formatted += "The evidence below is organized into ZONES (Zone 0, Zone 1, Zone 21, etc.) for internal organization ONLY.\n";
  formatted += "**DO NOT use zone numbers as citation numbers!**\n";
  formatted += "- ❌ WRONG: [[1B.1]], [[21.3]], [[22.3]], [[P1]]\n";
  formatted += "- ✅ CORRECT: [[1]], [[2]], [[3]], [[4]], [[5]]\n";
  formatted += "When you cite sources, renumber them sequentially starting from 1.\n\n";
  
  formatted += "**IMPORTANT: Each evidence item includes its SOURCE. Use this to cite properly.**\n";
  formatted += "**Available sources: PubMed, Cochrane, Europe PMC, Semantic Scholar, ClinicalTrials.gov, OpenAlex, PMC, DailyMed, MedlinePlus, FDA, WHO, CDC, NICE, Mayo Clinic, ADA, AHA**\n\n";
  
  // PHASE 1 ENHANCEMENT: Calculate and display evidence sufficiency score
  // Error handling: If scoring fails, continue without it (graceful degradation)
  try {
    const { scoreEvidenceSufficiency, formatSufficiencyForPrompt, formatSufficiencyWarning } = require('./sufficiency-scorer');
    const sufficiencyScore = scoreEvidenceSufficiency(evidence);
    formatted += formatSufficiencyForPrompt(sufficiencyScore);
    
    // Add warning if evidence is limited or insufficient
    const warning = formatSufficiencyWarning(sufficiencyScore);
    if (warning) {
      formatted += warning;
    }
    
    // Log sufficiency metrics
    console.log(`📊 Evidence Sufficiency: ${sufficiencyScore.level.toUpperCase()} (${sufficiencyScore.score}/100)`);
  } catch (error: any) {
    console.error('❌ Evidence sufficiency scoring failed:', error.message);
    console.error('Continuing without sufficiency score (graceful degradation)');
    // Continue without sufficiency score - backward compatible
  }
  
  // PHASE 1 ENHANCEMENT: Detect and display conflicts between authoritative sources
  // Error handling: If conflict detection fails, continue without it (graceful degradation)
  try {
    const { detectConflicts, formatConflictsForPrompt } = require('./conflict-detector');
    const conflicts = detectConflicts(evidence);
    if (conflicts.length > 0) {
      formatted += formatConflictsForPrompt(conflicts);
    }
  } catch (error: any) {
    console.error('❌ Conflict detection failed:', error.message);
    console.error('Continuing without conflict detection (graceful degradation)');
    // Continue without conflict detection - backward compatible
  }
  
  // Additional Medical Sources (from real-time search - sources like Mayo Clinic, CDC, WHO, etc.)
  if (evidence.perplexityResult && evidence.perplexityResult.answer) {
    formatted += formatPerplexityForPrompt(evidence.perplexityResult);
  }
  
  // Clinical Guidelines (highest priority - authoritative recommendations)
  if (evidence.guidelines.length > 0) {
    formatted += "## ZONE 1: CLINICAL PRACTICE GUIDELINES (Authoritative)\n";
    evidence.guidelines.forEach((guideline, i) => {
      formatted += `${i + 1}. ${guideline.title}\n`;
      formatted += `   SOURCE: ${guideline.source} | Type: ${guideline.type}\n`;
      formatted += `   Authors: ${guideline.authors}\n`;
      formatted += `   Journal: ${guideline.journal} (${guideline.year})\n`;
      formatted += `   Summary: ${guideline.summary}\n`;
      formatted += `   URL: ${guideline.url}\n`;
      formatted += `   ⭐ PRIORITY: Use these evidence-based guidelines as the foundation for clinical recommendations.\n\n`;
    });
  }
  
  // PubMed Guidelines (from authoritative sources like JAMA, Lancet, Circulation)
  if (evidence.pubmedGuidelines && evidence.pubmedGuidelines.length > 0) {
    formatted += "## ZONE 1B: PUBMED CLINICAL GUIDELINES & POSITION STATEMENTS\n";
    formatted += "**Guidelines from major medical journals and organizations**\n\n";
    evidence.pubmedGuidelines.forEach((article, i) => {
      formatted += `${i + 1}. ${article.title}\n`;
      formatted += `   SOURCE: PubMed | PMID: ${article.pmid}\n`;
      formatted += `   Authors: ${article.authors.slice(0, 3).join(", ")}${article.authors.length > 3 ? " et al." : ""}\n`;
      formatted += `   Journal: ${article.journal} (${article.publicationDate})\n`;
      if (article.abstract) formatted += `   Abstract: ${article.abstract}\n`;
      if (article.publicationType && article.publicationType.length > 0) {
        formatted += `   Type: ${article.publicationType.join(", ")}\n`;
      }
      if (article.doi) formatted += `   DOI: ${article.doi}\n`;
      formatted += `   ⭐ PRIORITY: Authoritative guideline - cite this for evidence-based recommendations.\n\n`;
    });
  }
  
  // Cochrane Reviews (gold standard systematic reviews)
  if (evidence.cochraneRecent.length > 0 || evidence.cochraneReviews.length > 0) {
    formatted += "## ZONE 2: COCHRANE SYSTEMATIC REVIEWS (Gold Standard)\n";
    if (evidence.cochraneRecent.length > 0) {
      formatted += "**Recent Cochrane Reviews (Last 2 Years):**\n";
      evidence.cochraneRecent.forEach((review, i) => {
        formatted += `${i + 1}. ${review.title}\n`;
        formatted += `   SOURCE: Cochrane Library | PMID: ${review.pmid}\n`;
        formatted += `   Authors: ${review.authors.slice(0, 3).join(", ")}${review.authors.length > 3 ? " et al." : ""}\n`;
        formatted += `   Published: ${review.publicationDate}\n`;
        if (review.abstract) formatted += `   Abstract: ${review.abstract}\n`;
        if (review.doi) formatted += `   DOI: ${review.doi}\n`;
        formatted += "\n";
      });
    }
    if (evidence.cochraneReviews.length > 0) {
      formatted += "**All Cochrane Reviews:**\n";
      evidence.cochraneReviews.forEach((review, i) => {
        formatted += `${i + 1}. ${review.title}\n`;
        formatted += `   SOURCE: Cochrane Library | PMID: ${review.pmid}\n`;
        formatted += `   Authors: ${review.authors.slice(0, 3).join(", ")}${review.authors.length > 3 ? " et al." : ""}\n`;
        formatted += `   Published: ${review.publicationDate}\n`;
        if (review.doi) formatted += `   DOI: ${review.doi}\n`;
        formatted += "\n";
      });
    }
  }
  
  // PMC Systematic Reviews (full-text access)
  if (evidence.pmcReviews.length > 0) {
    formatted += "## ZONE 3: PMC SYSTEMATIC REVIEWS (Full-Text Access)\n";
    evidence.pmcReviews.forEach((article, i) => {
      formatted += `${i + 1}. ${article.title}\n`;
      formatted += `   SOURCE: PMC | PMCID: ${article.pmcId}`;
      if (article.articleIds?.pmid) formatted += ` | PMID: ${article.articleIds.pmid}`;
      formatted += "\n";
      formatted += `   Authors: ${article.authors?.slice(0, 3).join(", ") || "N/A"}${(article.authors?.length || 0) > 3 ? " et al." : ""}\n`;
      formatted += `   Journal: ${article.journal} (${article.pubDate})\n`;
      if (article.articleIds?.doi) formatted += `   DOI: ${article.articleIds.doi}\n`;
      formatted += "\n";
    });
  }
  
  // PubMed Systematic Reviews (highest priority - from PubMed)
  if (evidence.pubmedReviews.length > 0) {
    formatted += "## ZONE 4: PUBMED SYSTEMATIC REVIEWS & META-ANALYSES\n";
    evidence.pubmedReviews.forEach((article, i) => {
      formatted += `${i + 1}. ${article.title}\n`;
      formatted += `   SOURCE: PubMed | PMID: ${article.pmid}\n`;
      formatted += `   Authors: ${article.authors.slice(0, 3).join(", ")}${article.authors.length > 3 ? " et al." : ""}\n`;
      formatted += `   Journal: ${article.journal} (${article.publicationDate})\n`;
      if (article.abstract) formatted += `   Abstract: ${article.abstract}\n`;
      if (article.meshTerms) formatted += `   MeSH: ${article.meshTerms.join(", ")}\n`;
      if (article.doi) formatted += `   DOI: ${article.doi}\n`;
      formatted += "\n";
    });
  }
  
  // OpenAlex Systematic Reviews (supplementary)
  if (evidence.systematicReviews.length > 0) {
    formatted += "## ZONE 5: OPENALEX SYSTEMATIC REVIEWS\n";
    evidence.systematicReviews.forEach((work, i) => {
      formatted += `${i + 1}. ${work.title}\n`;
      formatted += `   SOURCE: OpenAlex | Citations: ${work.citationCount}\n`;
      formatted += `   Authors: ${work.authors.join(", ")}\n`;
      formatted += `   Journal: ${work.journal} (${work.publicationYear})\n`;
      if (work.abstract) formatted += `   Abstract: ${work.abstract}\n`;
      formatted += "\n";
    });
  }
  
  // Clinical Trials
  if (evidence.clinicalTrials.length > 0) {
    formatted += "## ZONE 6: CLINICAL TRIALS (ClinicalTrials.gov)\n";
    evidence.clinicalTrials.forEach((trial, i) => {
      formatted += `${i + 1}. ${trial.briefTitle}\n`;
      formatted += `   SOURCE: ClinicalTrials.gov | NCT ID: ${trial.nctId}\n`;
      formatted += `   Status: ${trial.overallStatus} | Phase: ${trial.phases.join(", ") || "N/A"}\n`;
      formatted += `   Study Type: ${trial.studyType} | Has Results: ${trial.hasResults ? "Yes" : "No"}\n`;
      formatted += `   Conditions: ${trial.conditions.slice(0, 3).join(", ")}${trial.conditions.length > 3 ? "..." : ""}\n`;
      formatted += `   Interventions: ${trial.interventions.slice(0, 3).join(", ")}${trial.interventions.length > 3 ? "..." : ""}\n`;
      if (trial.enrollment) formatted += `   Enrollment: ${trial.enrollment} participants\n`;
      if (trial.leadSponsor) formatted += `   Sponsor: ${trial.leadSponsor}\n`;
      if (trial.briefSummary) formatted += `   Summary: ${trial.briefSummary.substring(0, 200)}...\n`;
      formatted += "\n";
    });
  }
  
  // Drug Labels (FDA)
  if (evidence.drugLabels.length > 0) {
    formatted += "## ZONE 7: FDA DRUG LABELS (OpenFDA)\n";
    evidence.drugLabels.forEach((label, i) => {
      formatted += `${i + 1}. ${label.brandName} (${label.genericName})\n`;
      formatted += `   SOURCE: FDA/OpenFDA\n`;
      if (label.contraindications) formatted += `   Contraindications: ${label.contraindications.substring(0, 200)}...\n`;
      if (label.warnings) formatted += `   Warnings: ${label.warnings.substring(0, 200)}...\n`;
      formatted += "\n";
    });
  }
  
  // DailyMed FDA Drug Labels
  if (evidence.dailyMedDrugs.length > 0) {
    formatted += "## ZONE 8: DAILYMED DRUG INFORMATION (Official FDA Labels)\n";
    evidence.dailyMedDrugs.forEach((drug, i) => {
      formatted += `${i + 1}. ${drug.title}\n`;
      formatted += `   SOURCE: DailyMed (NLM) | SetID: ${drug.setId}\n`;
      if (drug.genericName) formatted += `   Generic: ${drug.genericName}\n`;
      if (drug.brandName) formatted += `   Brand: ${drug.brandName}\n`;
      if (drug.manufacturer) formatted += `   Manufacturer: ${drug.manufacturer}\n`;
      if (drug.dosageForm) formatted += `   Form: ${drug.dosageForm} | Route: ${drug.route || 'N/A'}\n`;
      formatted += `   URL: ${drug.url}\n\n`;
    });
  }
  
  // Adverse Events
  if (evidence.adverseEvents.length > 0) {
    formatted += "## ZONE 9: ADVERSE EVENTS (FDA FAERS Database)\n";
    evidence.adverseEvents.slice(0, 5).forEach((event, i) => {
      formatted += `${i + 1}. ${event.reaction} - ${event.count} reports\n`;
      formatted += `   SOURCE: FDA FAERS\n`;
    });
    formatted += "\n";
  }
  
  // PMC Full-Text Articles (recent and general)
  if (evidence.pmcRecentArticles.length > 0 || evidence.pmcArticles.length > 0) {
    formatted += "## ZONE 10: PMC FULL-TEXT ARTICLES\n";
    formatted += "⚠️ CITATION FORMAT: Use [ARTICLE_TITLE](URL) - NOT author names!\n\n";
    if (evidence.pmcRecentArticles.length > 0) {
      formatted += "**Recent PMC Articles:**\n";
      evidence.pmcRecentArticles.slice(0, 3).forEach((article, i) => {
        const pmcUrl = `https://pmc.ncbi.nlm.nih.gov/articles/${article.pmcId}`;
        formatted += `${i + 1}. ARTICLE_TITLE: "${article.title}"\n`;
        formatted += `   READY-TO-CITE: [${article.title}](${pmcUrl})\n`;
        formatted += `   SOURCE: PMC | PMCID: ${article.pmcId}`;
        if (article.articleIds?.pmid) formatted += ` | PMID: ${article.articleIds.pmid}`;
        formatted += "\n";
        formatted += `   AUTHORS: ${article.authors?.slice(0, 2).join(", ") || "N/A"}${(article.authors?.length || 0) > 2 ? " et al." : ""}\n`;
        formatted += `   JOURNAL: ${article.journal} (${article.pubDate})\n`;
        if (article.articleIds?.doi) formatted += `   DOI: ${article.articleIds.doi}\n`;
        formatted += "\n";
      });
    }
    if (evidence.pmcArticles.length > 0) {
      formatted += "**General PMC Articles:**\n";
      evidence.pmcArticles.slice(0, 3).forEach((article, i) => {
        const pmcUrl = `https://pmc.ncbi.nlm.nih.gov/articles/${article.pmcId}`;
        formatted += `${i + 1}. ARTICLE_TITLE: "${article.title}"\n`;
        formatted += `   READY-TO-CITE: [${article.title}](${pmcUrl})\n`;
        formatted += `   SOURCE: PMC | PMCID: ${article.pmcId}`;
        if (article.articleIds?.pmid) formatted += ` | PMID: ${article.articleIds.pmid}`;
        formatted += "\n";
        formatted += `   JOURNAL: ${article.journal} (${article.pubDate})\n`;
        if (article.articleIds?.doi) formatted += `   DOI: ${article.articleIds.doi}\n`;
        formatted += "\n";
      });
    }
  }
  
  // PubMed Articles (peer-reviewed, indexed)
  if (evidence.pubmedArticles.length > 0) {
    formatted += "## ZONE 11: PUBMED LITERATURE (Peer-Reviewed)\n";
    formatted += "⚠️ CITATION FORMAT: Use [ARTICLE_TITLE](URL) - NOT author names!\n\n";
    evidence.pubmedArticles.slice(0, 5).forEach((article, i) => {
      const pubmedUrl = `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}`;
      formatted += `${i + 1}. ARTICLE_TITLE: "${article.title}"\n`;
      formatted += `   READY-TO-CITE: [${article.title}](${pubmedUrl})\n`;
      formatted += `   SOURCE: PubMed | PMID: ${article.pmid}\n`;
      formatted += `   AUTHORS: ${article.authors.slice(0, 2).join(", ")}${article.authors.length > 2 ? " et al." : ""}\n`;
      formatted += `   JOURNAL: ${article.journal} (${article.publicationDate})\n`;
      if (article.doi) formatted += `   DOI: ${article.doi}\n`;
      formatted += "\n";
    });
  }
  
  // OpenAlex Literature (supplementary)
  if (evidence.literature.length > 0) {
    formatted += "## ZONE 12: OPENALEX LITERATURE\n";
    evidence.literature.slice(0, 3).forEach((work, i) => {
      formatted += `${i + 1}. ${work.title}\n`;
      formatted += `   SOURCE: OpenAlex | Citations: ${work.citationCount}\n`;
      formatted += `   Authors: ${work.authors.slice(0, 2).join(", ")}${work.authors.length > 2 ? " et al." : ""}\n`;
      formatted += `   Journal: ${work.journal} (${work.publicationYear})\n`;
      formatted += "\n";
    });
  }
  
  // Europe PMC Recent Articles
  if (evidence.europePMCRecent.length > 0) {
    formatted += "## ZONE 13: EUROPE PMC RECENT RESEARCH\n";
    evidence.europePMCRecent.slice(0, 3).forEach((article, i) => {
      formatted += `${i + 1}. ${article.title}\n`;
      formatted += `   SOURCE: Europe PMC`;
      if (article.pmid) formatted += ` | PMID: ${article.pmid}`;
      if (article.doi) formatted += ` | DOI: ${article.doi}`;
      formatted += "\n";
      if (article.authorString) formatted += `   Authors: ${article.authorString}\n`;
      if (article.journalTitle) formatted += `   Journal: ${article.journalTitle} (${article.pubYear})\n`;
      formatted += "\n";
    });
  }
  
  // Europe PMC Highly Cited
  if (evidence.europePMCCited.length > 0) {
    formatted += "## ZONE 14: HIGHLY CITED RESEARCH (Europe PMC)\n";
    evidence.europePMCCited.slice(0, 3).forEach((article, i) => {
      formatted += `${i + 1}. ${article.title}\n`;
      formatted += `   SOURCE: Europe PMC | Citations: ${article.citedByCount || 0}`;
      if (article.pmid) formatted += ` | PMID: ${article.pmid}`;
      if (article.doi) formatted += ` | DOI: ${article.doi}`;
      formatted += "\n";
      if (article.authorString) formatted += `   Authors: ${article.authorString} (${article.pubYear})\n`;
      formatted += "\n";
    });
  }
  
  // Europe PMC Preprints (cutting-edge, not yet peer-reviewed)
  if (evidence.europePMCPreprints.length > 0) {
    formatted += "## ZONE 15: PREPRINTS (Europe PMC - Not Yet Peer-Reviewed)\n";
    evidence.europePMCPreprints.slice(0, 3).forEach((article, i) => {
      formatted += `${i + 1}. ${article.title}\n`;
      formatted += `   SOURCE: Europe PMC (Preprint)`;
      if (article.doi) formatted += ` | DOI: ${article.doi}`;
      if (article.firstPublicationDate) formatted += ` | Published: ${article.firstPublicationDate}`;
      formatted += "\n";
      if (article.authorString) formatted += `   Authors: ${article.authorString}\n`;
      formatted += "\n";
    });
  }
  
  // Semantic Scholar Papers
  if (evidence.semanticScholarPapers.length > 0) {
    formatted += "## ZONE 16: SEMANTIC SCHOLAR RESEARCH\n";
    evidence.semanticScholarPapers.slice(0, 3).forEach((paper, i) => {
      formatted += `${i + 1}. ${paper.title}\n`;
      formatted += `   SOURCE: Semantic Scholar | Citations: ${paper.citationCount}`;
      if (paper.doi) formatted += ` | DOI: ${paper.doi}`;
      formatted += "\n";
      formatted += `   Authors: ${paper.authors.slice(0, 2).join(", ")}${paper.authors.length > 2 ? " et al." : ""} (${paper.year})\n`;
      if (paper.journal) formatted += `   Journal: ${paper.journal}\n`;
      formatted += "\n";
    });
  }
  
  // Semantic Scholar Highly Cited (influential papers)
  if (evidence.semanticScholarHighlyCited.length > 0) {
    formatted += "## ZONE 17: HIGHLY CITED RESEARCH (Semantic Scholar)\n";
    evidence.semanticScholarHighlyCited.slice(0, 3).forEach((paper, i) => {
      formatted += `${i + 1}. ${paper.title}\n`;
      formatted += `   SOURCE: Semantic Scholar (Highly Cited) | Citations: ${paper.citationCount}`;
      if (paper.doi) formatted += ` | DOI: ${paper.doi}`;
      formatted += "\n";
      formatted += `   Authors: ${paper.authors.join(", ")}${paper.authors.length > 3 ? " et al." : ""} (${paper.year})\n`;
      if (paper.journal) formatted += `   Journal: ${paper.journal}\n`;
      formatted += "\n";
    });
  }
  
  // MedlinePlus Consumer Health Information
  if (evidence.medlinePlus.totalResults > 0) {
    formatted += "## ZONE 18: MEDLINEPLUS CONSUMER HEALTH INFORMATION\n";
    formatted += formatMedlinePlusForPrompt(evidence.medlinePlus);
  }
  
  // Europe PMC Open Access
  if (evidence.europePMCOpenAccess.length > 0) {
    formatted += "## ZONE 19: OPEN ACCESS ARTICLES (Europe PMC)\n";
    evidence.europePMCOpenAccess.slice(0, 3).forEach((article, i) => {
      formatted += `${i + 1}. ${article.title}\n`;
      formatted += `   SOURCE: Europe PMC (Open Access)`;
      if (article.pmid) formatted += ` | PMID: ${article.pmid}`;
      if (article.doi) formatted += ` | DOI: ${article.doi}`;
      formatted += "\n";
      if (article.authorString) formatted += `   Authors: ${article.authorString} (${article.pubYear})\n`;
      formatted += "\n";
    });
  }
  
  // American Academy of Pediatrics (AAP) Guidelines - for pediatric queries
  const totalAAP = evidence.aapGuidelines.length + evidence.aapPolicyStatements.length + evidence.aapKeyResources.length;
  if (totalAAP > 0) {
    formatted += formatAAPForPrompt(evidence.aapGuidelines, evidence.aapPolicyStatements, evidence.aapKeyResources);
  }
  
  // RxNorm Drug Information (NLM standardized nomenclature)
  const totalRxNorm = evidence.rxnormDrugs.length + evidence.rxnormInteractions.length;
  if (totalRxNorm > 0) {
    formatted += formatRxNormForPrompt({
      drugs: evidence.rxnormDrugs,
      classes: evidence.rxnormClasses,
      interactions: evidence.rxnormInteractions,
      prescribable: evidence.rxnormPrescribable
    });
  }
  
  // WHO Guidelines (World Health Organization)
  if (evidence.whoGuidelines && evidence.whoGuidelines.length > 0) {
    formatted += formatWHOGuidelinesForPrompt(evidence.whoGuidelines);
  }
  
  // CDC Guidelines (Centers for Disease Control)
  if (evidence.cdcGuidelines && evidence.cdcGuidelines.length > 0) {
    formatted += formatCDCGuidelinesForPrompt(evidence.cdcGuidelines);
  }
  
  // NICE Guidelines (UK National Institute for Health and Care Excellence)
  if (evidence.niceGuidelines && evidence.niceGuidelines.length > 0) {
    formatted += formatNICEGuidelinesForPrompt(evidence.niceGuidelines);
  }
  
  // BMJ Best Practice (Clinical Decision Support)
  if (evidence.bmjBestPractice && evidence.bmjBestPractice.length > 0) {
    formatted += formatBMJBestPracticeForPrompt(evidence.bmjBestPractice);
  }
  
  // Cardiovascular Guidelines (ACC/AHA, ESC) - Critical for lipid/CV queries
  if (evidence.cardiovascularGuidelines && evidence.cardiovascularGuidelines.length > 0) {
    formatted += formatCardiovascularGuidelinesForPrompt(evidence.cardiovascularGuidelines);
    
    // If this looks like a guideline comparison query, add the comparison table
    const hasLipidGuidelines = evidence.cardiovascularGuidelines.some(g => 
      g.category === "Lipid Management" || g.ldlTargets
    );
    if (hasLipidGuidelines && evidence.cardiovascularGuidelines.length >= 2) {
      formatted += "\n## ACC/AHA vs ESC GUIDELINE COMPARISON\n";
      formatted += getLDLTargetComparison();
      formatted += "\n";
    }
  }
  
  // NCBI Books (StatPearls and medical textbooks)
  if (evidence.ncbiBooks && evidence.ncbiBooks.length > 0) {
    formatted += formatNCBIBooksForPrompt(evidence.ncbiBooks);
  }
  
  // OMIM (Genetic disorders - only if genetic query)
  if (evidence.omimEntries && evidence.omimEntries.length > 0) {
    formatted += formatOMIMForPrompt(evidence.omimEntries);
  }
  
  // PubChem (Chemical data - fallback for DailyMed)
  if (evidence.pubChemCompounds && evidence.pubChemCompounds.length > 0) {
    formatted += formatPubChemForPrompt(evidence.pubChemCompounds, evidence.pubChemBioAssays || []);
  }
  
  formatted += "--- END EVIDENCE ---\n\n";
  formatted += `**CRITICAL INSTRUCTIONS FOR USING THIS EVIDENCE:**

1. **SYNTHESIZE, DON'T COPY**: Read all the evidence above and create a coherent, flowing answer in your own words. Do NOT list every study or copy abstracts verbatim.

2. **WRITE LIKE AN EXPERT**: Imagine you're a senior clinician explaining this topic to a colleague. Use clear, professional prose with well-structured paragraphs.

3. **CITE WITH SOURCE INFORMATION**: When creating references, ALWAYS include:
   - The SOURCE database (PubMed, Cochrane, Europe PMC, Semantic Scholar, ClinicalTrials.gov, etc.)
   - PMID if available (e.g., PMID:12345678)
   - DOI if available (e.g., doi:10.xxxx/xxxxx)
   - This allows proper linking and verification

4. **USE DIVERSE SOURCES**: The evidence comes from 19+ databases. Use evidence from MULTIPLE sources, not just PubMed:
   - Cochrane Library for systematic reviews (gold standard)
   - ClinicalTrials.gov for trial data
   - Europe PMC for European research
   - Semantic Scholar for highly cited papers
   - DailyMed/FDA for drug information
   - MedlinePlus for patient education

5. **PRIORITIZE BY ZONE**: Focus on evidence from these zones in order:
   - Zone 1: Clinical Guidelines (highest priority)
   - Zone 2-5: Systematic Reviews (Cochrane, PMC, PubMed, OpenAlex)
   - Zone 6: Clinical Trials
   - Zone 7-9: Drug Information (FDA, DailyMed, FAERS)
   - Zone 10-17: Primary Literature
   - Zone 18-19: Consumer Health & Open Access

6. **REFERENCE FORMAT**: In your References section, format as:
   Author et al. Title. Journal. Year. SOURCE: [Database] | PMID:xxxxx or DOI:10.xxxx/xxxxx

Remember: You are a clinical expert synthesizing evidence from MULTIPLE databases, not just PubMed!\n\n`;
  
  return formatted;
}
