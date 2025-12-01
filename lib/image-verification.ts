/**
 * Image Verification using Gemini 2.5 Flash Vision
 * 
 * This module uses AI vision to verify that fetched images are actually relevant
 * to the user's query before displaying them. This prevents showing irrelevant
 * images like brain anatomy for heart failure questions.
 * 
 * Quality Gate Process:
 * 1. Fetch candidate images from search APIs
 * 2. Use Gemini Vision to analyze each image
 * 3. Verify relevance to the query and mode (doctor/general)
 * 4. Only return images that pass verification
 * 5. If insufficient images pass, refine search and retry
 */

import { getGeminiVisionModel } from "./gemini";

export interface ImageVerificationResult {
  isRelevant: boolean;
  relevanceScore: number; // 0-100
  reason: string;
  suggestedUse?: string;
  warnings?: string[];
}

/**
 * Verify if an image is relevant to the medical query using Gemini Vision
 * 
 * @param imageUrl - URL of the image to verify
 * @param imageTitle - Title/description of the image
 * @param query - Original user query
 * @param mode - 'doctor' or 'general' mode
 * @returns Verification result with relevance score and reasoning
 */
export async function verifyImageRelevance(
  imageUrl: string,
  imageTitle: string,
  query: string,
  mode: 'doctor' | 'general'
): Promise<ImageVerificationResult> {
  try {
    const model = getGeminiVisionModel();
    
    // Fetch the image
    const imageResponse = await fetch(imageUrl, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!imageResponse.ok) {
      return {
        isRelevant: false,
        relevanceScore: 0,
        reason: "Failed to fetch image",
      };
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Check for unsupported MIME types - Gemini Vision doesn't support GIF, SVG, etc.
    const unsupportedMimeTypes = ['image/gif', 'image/svg+xml', 'image/webp', 'image/bmp', 'image/tiff'];
    if (unsupportedMimeTypes.some(type => mimeType.toLowerCase().includes(type.split('/')[1]))) {
      return {
        isRelevant: false,
        relevanceScore: 0,
        reason: `Unsupported image format: ${mimeType}. Only JPEG and PNG are supported.`,
      };
    }
    
    // Also check URL for common unsupported extensions
    const urlLower = imageUrl.toLowerCase();
    if (urlLower.endsWith('.gif') || urlLower.endsWith('.svg') || urlLower.includes('.svg?')) {
      return {
        isRelevant: false,
        relevanceScore: 0,
        reason: `Unsupported image format detected from URL. Only JPEG and PNG are supported.`,
      };
    }
    
    // Build verification prompt
    const verificationPrompt = `You are a medical image quality verifier. Your job is to determine if this image is relevant and helpful for answering the following medical query.

**User Query:** "${query}"

**Mode:** ${mode === 'doctor' ? 'Doctor Mode (for medical professionals)' : 'General Mode (for patients/public)'}

**Image Title:** "${imageTitle}"

**Your Task:**
1. Analyze the image carefully
2. Determine if it's relevant to the query
3. Check if it matches the mode (doctor mode needs medical diagrams/anatomy, general mode needs approachable health images)
4. Identify any issues (wrong organ, wrong condition, too generic, misleading, etc.)

**Respond in this EXACT JSON format:**
{
  "isRelevant": true/false,
  "relevanceScore": 0-100,
  "reason": "Brief explanation of why it is or isn't relevant",
  "imageContent": "What the image actually shows",
  "queryNeeds": "What the query is asking for",
  "mismatch": "If not relevant, what's the mismatch?",
  "suggestedUse": "If relevant, how should it be used?"
}

**Examples of IRRELEVANT images:**
- Brain anatomy for a heart failure question
- Generic stock photos for specific medical conditions
- Flowcharts when anatomy is needed
- Wrong organ (kidney for lung question)
- Too many algorithms/flowcharts (max 1 allowed)

**Examples of RELEVANT images:**
- Heart anatomy for heart failure questions
- Ejection fraction diagram for HFrEF questions
- Drug mechanism diagrams for pharmacology questions
- ONE treatment algorithm (if query asks about guidelines/treatment)

Be strict. Only approve images that truly help answer the query.`;

    const content = [
      { text: verificationPrompt },
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ];
    
    const result = await model.generateContent(content);
    const responseText = result.response.text();
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse verification response:", responseText);
      return {
        isRelevant: false,
        relevanceScore: 0,
        reason: "Failed to parse verification response",
      };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      isRelevant: parsed.isRelevant === true,
      relevanceScore: parsed.relevanceScore || 0,
      reason: parsed.reason || "No reason provided",
      suggestedUse: parsed.suggestedUse,
      warnings: parsed.mismatch ? [parsed.mismatch] : undefined,
    };
    
  } catch (error: any) {
    console.error("Image verification error:", error.message);
    // On error, be conservative and reject the image
    return {
      isRelevant: false,
      relevanceScore: 0,
      reason: `Verification failed: ${error.message}`,
    };
  }
}

/**
 * Verify multiple images in parallel
 * Returns only images that pass verification
 */
export async function verifyImages(
  images: Array<{ url: string; title: string }>,
  query: string,
  mode: 'doctor' | 'general',
  minRelevanceScore: number = 70
): Promise<Array<{ url: string; title: string; verificationResult: ImageVerificationResult }>> {
  console.log(`🔍 Verifying ${images.length} images with Gemini Vision...`);
  
  const verificationPromises = images.map(async (img) => {
    const result = await verifyImageRelevance(img.url, img.title, query, mode);
    return {
      url: img.url,
      title: img.title,
      verificationResult: result,
    };
  });
  
  const verifiedImages = await Promise.all(verificationPromises);
  
  // Filter to only relevant images
  const relevantImages = verifiedImages.filter(
    (img) => img.verificationResult.isRelevant && img.verificationResult.relevanceScore >= minRelevanceScore
  );
  
  console.log(`✅ ${relevantImages.length}/${images.length} images passed verification`);
  
  // Log rejected images for debugging
  const rejectedImages = verifiedImages.filter(
    (img) => !img.verificationResult.isRelevant || img.verificationResult.relevanceScore < minRelevanceScore
  );
  
  if (rejectedImages.length > 0) {
    console.log(`❌ Rejected images:`);
    rejectedImages.forEach((img) => {
      console.log(`   - "${img.title.substring(0, 50)}..."`);
      console.log(`     Reason: ${img.verificationResult.reason}`);
      console.log(`     Score: ${img.verificationResult.relevanceScore}/100`);
    });
  }
  
  return relevantImages;
}

/**
 * Extract key medical terms from query for refined search
 * Used when initial images fail verification
 */
export function extractRefinedSearchTerms(
  query: string,
  rejectedReasons: string[]
): string[] {
  const queryLower = query.toLowerCase();
  const refinedTerms: string[] = [];
  
  // FIRST: Check for specific query types that need different image approaches
  
  // Dietary/nutrition queries - need food/diet images, not pathogen images
  if (queryLower.includes('dietary') || queryLower.includes('diet') || queryLower.includes('nutrition') || queryLower.includes('food')) {
    if (queryLower.includes('giardia') || queryLower.includes('post-infectious')) {
      refinedTerms.push('post-infectious IBS diet FODMAP diagram');
      refinedTerms.push('intestinal malabsorption dietary management');
    } else {
      refinedTerms.push('therapeutic diet medical nutrition diagram');
    }
  }
  
  // Post-infectious symptoms - need symptom/management images
  if (queryLower.includes('post-infectious') || queryLower.includes('post infectious')) {
    refinedTerms.push('post-infectious irritable bowel syndrome diagram');
    refinedTerms.push('gut microbiome restoration diagram');
  }
  
  // If we already have dietary/post-infectious terms, return early
  if (refinedTerms.length > 0) {
    return refinedTerms;
  }
  
  // Extract specific pathogens/infections (only if not a dietary query)
  const pathogens: Record<string, string> = {
    'giardia': 'giardia intestinal damage malabsorption diagram',
    'giardiasis': 'giardiasis intestinal pathology complications diagram',
    'h pylori': 'helicobacter pylori stomach infection diagram',
    'helicobacter': 'helicobacter pylori gastric infection diagram',
    'e coli': 'escherichia coli bacterial infection diagram',
    'salmonella': 'salmonella food poisoning infection diagram',
    'streptococcus': 'streptococcal infection pathophysiology diagram',
    'staphylococcus': 'staphylococcal infection pathophysiology diagram',
    'tuberculosis': 'tuberculosis lung infection diagram',
    'malaria': 'malaria plasmodium lifecycle diagram',
    'covid': 'coronavirus SARS-CoV-2 infection diagram',
  };
  
  for (const [pathogen, searchTerm] of Object.entries(pathogens)) {
    if (queryLower.includes(pathogen)) {
      refinedTerms.push(searchTerm);
      break;
    }
  }
  
  // Extract organ/body part
  const organs = ['heart', 'lung', 'brain', 'kidney', 'liver', 'pancreas', 'stomach', 'intestine', 'colon', 'bone', 'muscle', 'skin'];
  for (const organ of organs) {
    if (queryLower.includes(organ)) {
      refinedTerms.push(`${organ} anatomy medical diagram`);
      break;
    }
  }
  
  // If query mentions children/pediatric, add pediatric-specific term
  if (queryLower.includes('child') || queryLower.includes('pediatric') || queryLower.includes('infant')) {
    const mainCondition = extractMainCondition(queryLower);
    if (mainCondition) {
      refinedTerms.push(`pediatric ${mainCondition} diagram`);
    }
  }
  
  // Extract condition
  const conditions = [
    'heart failure', 'hfref', 'diabetes', 'hypertension', 'copd', 'asthma',
    'stroke', 'cancer', 'infection', 'arrhythmia', 'atherosclerosis',
    'diarrhea', 'malabsorption', 'dehydration', 'malnutrition'
  ];
  for (const condition of conditions) {
    if (queryLower.includes(condition)) {
      refinedTerms.push(`${condition} pathophysiology diagram`);
      break;
    }
  }
  
  // Extract drug/treatment
  const drugs = [
    'arni', 'sacubitril', 'valsartan', 'ace inhibitor', 'beta blocker',
    'statin', 'sglt2', 'glp-1', 'insulin', 'metformin', 'metronidazole',
    'antibiotic', 'antiparasitic'
  ];
  for (const drug of drugs) {
    if (queryLower.includes(drug)) {
      refinedTerms.push(`${drug} mechanism of action diagram`);
      break;
    }
  }
  
  // If no specific terms found, try to extract the main topic
  if (refinedTerms.length === 0) {
    const mainCondition = extractMainCondition(queryLower);
    if (mainCondition) {
      refinedTerms.push(`${mainCondition} medical diagram`);
    }
  }
  
  return refinedTerms;
}

/**
 * Helper to extract the main medical condition from a query
 */
function extractMainCondition(queryLower: string): string | null {
  // Common medical conditions
  const conditionPatterns = [
    'giardia', 'giardiasis', 'infection', 'diarrhea', 'malabsorption',
    'heart failure', 'diabetes', 'hypertension', 'stroke', 'cancer',
    'pneumonia', 'bronchitis', 'asthma', 'copd', 'arthritis'
  ];
  
  for (const condition of conditionPatterns) {
    if (queryLower.includes(condition)) {
      return condition;
    }
  }
  
  return null;
}
