/**
 * Medical Image RAG System
 * 
 * Retrieves accurate medical images (anatomy, diagrams, pathophysiology) 
 * using tag-based filtering and domain restrictions with scenario-aware filtering
 */

import { filterMedicalImagesForQuery } from './evidence/image-scenario-filter';
import { expandMedicalAbbreviations } from './evidence/medical-abbreviations';
import { searchAllOpenSources, type OpenMedicalImage } from './open-medical-images';
import { decomposeVignette, type TeachingPanel } from './vignette-decomposer';
import { searchOpenI, type OpenIImage } from './open-i-client';

interface MedicalImageCandidate {
  url: string;
  title: string;
  snippet: string;
  sourceDomain: string;
  score: number;
  attribution?: string;
  thumbnail?: string;
  panelId?: string; // Track which teaching panel this image belongs to
}

interface MedicalImageQuery {
  query: string;
  mode: 'doctor' | 'general';
  diseaseTags: string[];
  decisionTags: string[];
}

/**
 * Build targeted image queries from medical tags
 */
function buildImageQueries(tags: { disease_tags: string[], decision_tags: string[] }, mode: 'doctor' | 'general'): string[] {
  const { disease_tags, decision_tags } = tags;
  const queries: string[] = [];

  if (mode === 'doctor') {
    // Clinical diagrams and pathophysiology
    disease_tags.forEach(disease => {
      decision_tags.forEach(decision => {
        if (disease === 'HF' && decision === 'therapy') {
          queries.push('HFpEF pathophysiology diagram');
          queries.push('SGLT2 inhibitor heart failure mechanism figure');
          queries.push('HFpEF treatment algorithm ESC 2023');
        } else if (disease === 'VTE' && decision === 'anticoagulation') {
          queries.push('pulmonary embolism pathophysiology diagram');
          queries.push('anticoagulation mechanism figure');
          queries.push('VTE treatment algorithm');
        } else if (disease === 'CANCER' && decision === 'anticoagulation') {
          queries.push('cancer-associated thrombosis algorithm');
          queries.push('CAT anticoagulation platelet count flowchart');
          queries.push('cancer VTE LMWH vs DOAC diagram');
        } else if (disease === 'THROMBOCYTOPENIA' && decision === 'anticoagulation') {
          queries.push('thrombocytopenia anticoagulation algorithm');
          queries.push('platelet count bleeding risk chart');
          queries.push('low platelets VTE management flowchart');
        } else if (disease === 'AF' && decision === 'anticoagulation') {
          queries.push('atrial fibrillation pathophysiology diagram');
          queries.push('CHA2DS2-VASc score chart');
          queries.push('AF anticoagulation algorithm');
        } else if (disease === 'CAP' && decision === 'antiplatelet') {
          queries.push('pneumonia pathophysiology diagram');
          queries.push('lung anatomy alveoli infection');
          queries.push('CAP treatment algorithm IDSA');
        } else if (disease === 'DIABETES' && decision === 'therapy') {
          queries.push('diabetes pathophysiology insulin resistance');
          queries.push('pancreatic beta cell anatomy');
          queries.push('diabetes management algorithm ADA');
        } else if (disease === 'CKD' && decision === 'therapy') {
          // CRITICAL FIX: For CKD therapy questions, prioritize drug-specific diagrams
          // Generic kidney histology is NOT helpful for dosing/GDMT questions
          queries.push('SGLT2 inhibitor CKD mechanism diagram');
          queries.push('KDIGO CKD SGLT2i algorithm flowchart');
          queries.push('empagliflozin dapagliflozin CKD eGFR threshold');
        } else if (disease === 'CKD' && decision === 'dose') {
          // For dosing questions, show drug-specific flowcharts, NOT anatomy
          queries.push('SGLT2 inhibitor dosing CKD eGFR flowchart');
          queries.push('empagliflozin dose adjustment CKD algorithm');
          queries.push('KDIGO SGLT2i initiation criteria diagram');
        } else if ((disease === 'DIABETES' || disease === 'GLP1') && (decision === 'therapy' || decision === 'add_on_therapy')) {
          queries.push('GLP-1 receptor agonist mechanism diabetes');
          queries.push('SGLT2 inhibitor GLP-1 RA combination therapy');
          queries.push('diabetes kidney protection algorithm');
          queries.push('pancreatic beta cell GLP-1 action');
        } else {
          queries.push(`${disease} ${decision} diagram`);
          queries.push(`${disease} pathophysiology figure`);
        }
      });
    });

    // Add anatomy queries
    if (disease_tags.includes('HF')) queries.push('heart anatomy diagram medical textbook');
    if (disease_tags.includes('VTE')) queries.push('pulmonary circulation anatomy diagram');
    if (disease_tags.includes('CAP')) queries.push('lung anatomy respiratory system alveoli');
    if (disease_tags.includes('DIABETES')) queries.push('pancreas anatomy islets of langerhans');
    if (disease_tags.includes('CKD')) queries.push('kidney anatomy nephron glomerulus');
    if (disease_tags.includes('AF')) queries.push('heart electrical conduction system');
  } else {
    // Consumer-friendly anatomy and lifestyle
    disease_tags.forEach(disease => {
      queries.push(`${disease} anatomy simple diagram`);
      queries.push(`${disease} prevention infographic`);
    });
  }

  return queries.slice(0, 3); // Limit to 3 queries
}

/**
 * Score image relevance based on medical tags
 */
function scoreImageRelevance(
  image: any,
  diseaseTags: string[],
  decisionTags: string[],
  mode: 'doctor' | 'general'
): number {
  let score = 0;
  const text = `${image.title} ${image.snippet}`.toLowerCase();

  // Disease tag matching
  diseaseTags.forEach(tag => {
    if (text.includes(tag.toLowerCase())) score += 30;
  });

  // Decision tag matching  
  decisionTags.forEach(tag => {
    if (text.includes(tag.toLowerCase())) score += 25;
  });

  // Mode-specific scoring
  if (mode === 'doctor') {
    // Prefer clinical diagrams
    const clinicalTerms = ['diagram', 'algorithm', 'guideline', 'mechanism', 'pathophysiology', 'anatomy', 'figure'];
    clinicalTerms.forEach(term => {
      if (text.includes(term)) score += 15;
    });

    // Penalize administrative/coding content
    const adminTerms = ['billing', 'icd', 'coding', 'administrative', 'phenotype algorithm', 'claims data'];
    adminTerms.forEach(term => {
      if (text.includes(term)) score -= 50;
    });
  } else {
    // Prefer simple educational content
    const educationalTerms = ['simple', 'basic', 'overview', 'infographic', 'prevention', 'lifestyle'];
    educationalTerms.forEach(term => {
      if (text.includes(term)) score += 15;
    });
  }

  // Domain scoring
  const trustedDomains = [
    'nejm.org', 'thelancet.com', 'jamanetwork.com', 'bmj.com',
    'escardio.org', 'acc.org', 'heart.org', 'who.int', 'cdc.gov',
    'nih.gov', 'ncbi.nlm.nih.gov', 'mayoclinic.org', 'clevelandclinic.org'
  ];

  if (trustedDomains.some(domain => image.link?.includes(domain))) {
    score += 20;
  }

  return Math.max(0, score);
}

/**
 * Retrieve medical images using Serper API with RAG filtering
 */
export async function retrieveMedicalImages(
  query: string,
  mode: 'doctor' | 'general',
  tags: { disease_tags: string[], decision_tags: string[] }
): Promise<MedicalImageCandidate[]> {

  if (!process.env.SERPER_API_KEY) {
    console.log('⚠️ SERPER_API_KEY not set, skipping image search');
    return [];
  }

  console.log(`🖼️ Retrieving medical images for ${mode} mode...`);

  // CRITICAL FIX: For drug dosing/guideline queries, be VERY strict about image relevance
  // Generic anatomy/histology is NOT helpful - only show drug-specific diagrams or nothing
  const isDrugDosingQuery = tags.decision_tags.includes('dose') || 
                            tags.decision_tags.includes('drug_choice') ||
                            /dosing|dose|titration|initiation|starting dose|how to use|when to start/i.test(query);
  
  const isGuidelineQuery = /kdigo|guideline|recommendation|per.*guideline|according to/i.test(query);
  
  if (isDrugDosingQuery || isGuidelineQuery) {
    console.log('   🎯 Drug dosing/guideline query detected - will only show drug-specific diagrams or no images');
  }

  // Expand abbreviations in original query for better matching
  const expandedQuery = expandMedicalAbbreviations(query);
  console.log(`📝 Expanded query: ${expandedQuery}`);

  // NEW: Multi-panel approach for complex vignettes (Doctor Mode only)
  const allCandidates: MedicalImageCandidate[] = [];

  if (mode === 'doctor' || mode === 'general') {
    // Decompose vignette into teaching panels (works for both modes)
    const decomposition = decomposeVignette(query, mode);

    if (decomposition.panels.length > 0) {
      console.log(`📚 [${mode.toUpperCase()}] Decomposed into ${decomposition.panels.length} teaching panels`);

      // Search Open-i for each panel (limit to top 3 priority panels)
      const topPanels = decomposition.panels.slice(0, 3);

      for (const panel of topPanels) {
        console.log(`🔍 [${mode.toUpperCase()}] Panel "${panel.title}": ${panel.searchQuery}`);

        const openIImages = await searchOpenI({
          query: panel.searchQuery,
          maxResults: 2,
          // Map teaching panel types to Open-i valid types
          imageType: panel.imageType === 'photo' ? undefined : 'xg', // xg for graphics/diagrams
        });

        // Convert Open-i images to candidates with panel tracking
        openIImages.forEach((img: OpenIImage) => {
          allCandidates.push({
            url: img.imgLarge,
            title: img.title,
            snippet: img.abstract,
            sourceDomain: 'openi.nlm.nih.gov',
            score: 100 + panel.priority, // Highest score for Open-i + panel priority
            attribution: img.attribution,
            thumbnail: img.imgThumb,
            panelId: panel.id
          });
        });
      }
    }
  }

  // Build targeted queries (fallback for simple queries or General Mode)
  const imageQueries = buildImageQueries(tags, mode);

  // CRITICAL FIX: Add the actual user query FIRST for relevance
  // This ensures we search for images specific to the user's question
  const userSpecificQuery = mode === 'doctor'
    ? `${expandedQuery} medical diagram`
    : `${expandedQuery} simple illustration`;

  // Prioritize user query, then tag-based queries
  const allQueries = [userSpecificQuery, ...imageQueries].slice(0, 3);

  console.log(`📋 Image queries: ${allQueries.join(', ')}`);

  // Search for each query with improved error handling
  for (const imageQuery of allQueries) {
    try {
      const response = await fetch('https://google.serper.dev/images', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: imageQuery,
          num: 10,
          gl: 'us',
          hl: 'en'
        }),
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        console.warn(`Serper API returned ${response.status} for query: ${imageQuery}`);
        continue;
      }

      const data = await response.json();

      if (data.images && Array.isArray(data.images)) {
        // Apply scenario-based filtering BEFORE scoring
        const rawImages = data.images.map((img: any) => ({
          title: img.title || '',
          description: img.snippet || '',
          url: img.imageUrl,
          thumbnail: img.thumbnailUrl
        }));

        const filteredImages = filterMedicalImagesForQuery(
          rawImages,
          tags.disease_tags,
          tags.decision_tags
        );

        filteredImages.forEach((img: any) => {
          const score = scoreImageRelevance(img, tags.disease_tags, tags.decision_tags, mode);

          if (score >= 45) { // Lowered threshold for better coverage
            try {
              // Validate URL before adding
              const imageUrl = img.url;
              if (!imageUrl || !imageUrl.startsWith('http')) {
                console.warn(`Invalid image URL: ${imageUrl}`);
                return;
              }
              
              // Validate URL is accessible (basic check)
              new URL(imageUrl);
              
              const sourceDomain = new URL(data.images.find((orig: any) => orig.imageUrl === img.url)?.link || 'https://example.com').hostname;
              
              allCandidates.push({
                url: imageUrl,
                title: img.title || 'Medical Image',
                snippet: img.description || '',
                sourceDomain,
                score: Math.max(score, img.relevanceScore), // Use higher of two scores
                thumbnail: img.thumbnail || imageUrl // Fallback to main URL if no thumbnail
              });
            } catch (urlError) {
              // Skip images with invalid URLs
              console.warn(`Invalid URL for image: ${img.title} - ${urlError}`);
            }
          }
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`Image search timeout for "${imageQuery}"`);
      } else {
        console.error(`Error searching images for "${imageQuery}":`, error.message);
      }
    }
  }

  // INTELLIGENT IMAGE RETRIEVAL: Use new orchestrator for better source routing
  const { retrieveMedicalImagesIntelligent, formatMedicalImagesForResponse } = await import('@/lib/medical-image-orchestrator');
  const intelligentImages = await retrieveMedicalImagesIntelligent(query, mode, tags);
  
  const openCandidates: MedicalImageCandidate[] = intelligentImages.map(img => ({
    url: img.url,
    title: img.title,
    snippet: img.description,
    sourceDomain: img.source === 'Open-i' ? 'openi.nlm.nih.gov' :
      'injurymap.com',
    score: img.score, // Use orchestrator's score
    attribution: img.attribution,
    thumbnail: img.thumbnail
  }));

  console.log(`   🎯 Intelligent retrieval: ${openCandidates.length} images from orchestrator`);

  // Combine open sources with web search: Open Sources (100) > Web Search (45+)
  const combinedCandidates = [...openCandidates, ...allCandidates];
  
  // DEDUPLICATION: Remove duplicate images based on URL
  const seenUrls = new Set<string>();
  const uniqueCandidates = combinedCandidates.filter(img => {
    if (seenUrls.has(img.url)) {
      console.log(`   🔄 Skipping duplicate image: ${img.title}`);
      return false;
    }
    seenUrls.add(img.url);
    return true;
  });
  
  console.log(`   ✅ Deduplicated: ${combinedCandidates.length} → ${uniqueCandidates.length} unique images`);
  
  // MAJOR FIX: Increase limit to 6 images (was 4) and prioritize Open-i
  let topCandidates = uniqueCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 6); // Increased from 4 to 6 for better coverage

  // IMPROVED FALLBACK: If no images found, DON'T show generic images
  // Instead, return empty array - it's better to show no images than irrelevant ones
  if (topCandidates.length === 0) {
    console.log('⚠️ No relevant images found for this query - returning empty array');
    console.log('   This is intentional: better to show no images than generic/irrelevant ones');
    return [];
  }

  // CRITICAL QUALITY CHECK: For drug dosing/guideline questions, filter out generic anatomy/histology
  // Only show images that mention the drug or guideline - be VERY strict
  if (isDrugDosingQuery || isGuidelineQuery) {
    console.log('   🔍 Applying strict drug-specific image filter...');
    
    const drugSpecificImages = topCandidates.filter(img => {
      const text = `${img.title} ${img.snippet}`.toLowerCase();
      
      // Must have drug or guideline mention
      const hasDrugMention = text.includes('sglt2') || text.includes('empagliflozin') || 
                             text.includes('dapagliflozin') || text.includes('canagliflozin') ||
                             text.includes('kdigo') || text.includes('algorithm') || 
                             text.includes('flowchart') || text.includes('guideline') ||
                             text.includes('dosing') || text.includes('dose') ||
                             text.includes('treatment algorithm') || text.includes('management');
      
      // Must NOT be generic anatomy/histology
      const isGenericAnatomy = text.includes('histology') || text.includes('glomerulus') ||
                               text.includes('podocyte') || text.includes('immunofluorescence') ||
                               text.includes('microscopy') || text.includes('biopsy') ||
                               text.includes('staining') || text.includes('pathology') ||
                               text.includes('angiogenesis') || text.includes('pkc-alpha') ||
                               text.includes('vegf') || text.includes('cd34') ||
                               text.includes('semaphorin') || text.includes('propyl gallate');
      
      // Must NOT be about unrelated topics
      const isOffTopic = text.includes('murine') || text.includes('mouse') || 
                         text.includes('rat model') || text.includes('cell culture');
      
      return hasDrugMention && !isGenericAnatomy && !isOffTopic;
    });

    if (drugSpecificImages.length > 0) {
      console.log(`   ✅ Filtered to ${drugSpecificImages.length} drug-specific images (removed ${topCandidates.length - drugSpecificImages.length} generic/irrelevant)`);
      topCandidates = drugSpecificImages;
    } else {
      console.log('   ⚠️ No drug-specific images found - returning empty array');
      console.log('   💡 This is INTENTIONAL: better to show no images than generic kidney histology');
      return [];
    }
  }

  console.log(`✅ Found ${topCandidates.length} relevant medical images (${openCandidates.length} open sources, ${allCandidates.length} web results)`);

  return topCandidates;
}

/**
 * Format images for display
 */
export function formatMedicalImages(images: MedicalImageCandidate[]): any[] {
  return images.map(img => ({
    url: img.url,
    title: img.title,
    description: img.snippet,
    source: img.sourceDomain,
    relevanceScore: img.score,
    attribution: img.attribution,
    thumbnail: img.thumbnail
  }));
}