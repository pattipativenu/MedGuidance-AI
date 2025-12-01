/**
 * Smart Image Query Generator using Gemini
 * 
 * Instead of trying to verify every image with vision (which is slow and often fails),
 * we use Gemini to generate the OPTIMAL search query for finding relevant medical images.
 * 
 * This approach:
 * 1. Analyzes the user's medical query
 * 2. Generates 2-3 highly targeted image search queries
 * 3. Specifies what type of image would be most helpful
 * 4. Returns queries that are more likely to find relevant images
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Use GEMINI_API_KEY (same as lib/gemini.ts)
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export interface SmartImageQuery {
  searchQuery: string;
  imageType: 'anatomy' | 'pathology' | 'mechanism' | 'diagram' | 'infographic' | 'chart';
  priority: number;
  rationale: string;
}

/**
 * Use Gemini to generate optimal image search queries for a medical question
 */
export async function generateSmartImageQueries(
  userQuery: string,
  mode: 'doctor' | 'general' = 'doctor'
): Promise<SmartImageQuery[]> {
  // Skip AI generation if no API key
  if (!apiKey) {
    console.log("⚠️  No Gemini API key found, using default query generation");
    return getDefaultQueries(userQuery, mode);
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are a medical image search expert. Given a medical question, generate 2-3 optimal Google Image search queries to find relevant, educational medical images.

**User's Medical Question:**
"${userQuery}"

**Mode:** ${mode === 'doctor' ? 'Doctor Mode (for medical professionals - prefer anatomical diagrams, pathophysiology, clinical images)' : 'General Mode (for patients - prefer simple infographics, easy-to-understand diagrams)'}

**Your Task:**
Generate search queries that will find images that DIRECTLY help answer this question.

**Rules:**
1. Be SPECIFIC - don't search for generic terms
2. Include "diagram", "medical", "anatomy", or "pathophysiology" in queries for doctor mode
3. Include "infographic", "simple", "explained" for general mode
4. Focus on the CORE medical concept, not the entire question
5. Avoid lifecycle diagrams unless the question is specifically about transmission/lifecycle
6. For dietary/nutrition questions, search for diet-related images, not pathogen images
7. For post-infectious symptoms, search for symptom management, not the original infection
8. For drug questions, search for mechanism of action diagrams
9. NEVER include ".gif" or ".svg" in search terms
10. Prefer PNG and JPG images

**Response Format (JSON array):**
[
  {
    "searchQuery": "specific search query for Google Images",
    "imageType": "anatomy|pathology|mechanism|diagram|infographic|chart",
    "priority": 1,
    "rationale": "why this image helps answer the question"
  }
]

**Examples:**

Question: "What are the complications of untreated Giardia in children?"
Good queries:
- "giardia intestinal damage malabsorption diagram" (pathology)
- "pediatric malnutrition complications infographic" (infographic)
NOT: "giardia lifecycle diagram" (wrong focus)

Question: "What is the role of dietary interventions after Giardia?"
Good queries:
- "post-infectious IBS dietary management diagram" (diagram)
- "intestinal recovery nutrition infographic" (infographic)
NOT: "giardia parasite lifecycle" (wrong focus)

Question: "How does metformin work in diabetes?"
Good queries:
- "metformin mechanism of action diagram" (mechanism)
- "glucose metabolism liver muscle diagram" (anatomy)

Now generate queries for the user's question:`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Failed to parse smart query response");
      return getDefaultQueries(userQuery, mode);
    }
    
    const queries: SmartImageQuery[] = JSON.parse(jsonMatch[0]);
    
    // Validate and clean queries
    return queries
      .filter(q => q.searchQuery && q.searchQuery.length > 5)
      .map(q => ({
        ...q,
        // Ensure no GIF/SVG in search
        searchQuery: q.searchQuery.replace(/\.gif|\.svg/gi, '').trim(),
      }))
      .slice(0, 3); // Max 3 queries
      
  } catch (error: any) {
    console.error("Smart query generation error:", error.message);
    return getDefaultQueries(userQuery, mode);
  }
}

/**
 * Fallback: Generate default queries based on keyword extraction
 */
function getDefaultQueries(query: string, mode: 'doctor' | 'general'): SmartImageQuery[] {
  const queryLower = query.toLowerCase();
  const queries: SmartImageQuery[] = [];
  
  // Extract key medical terms
  const medicalTerms: Record<string, string[]> = {
    // Conditions
    'giardia': ['giardia intestinal infection diagram', 'intestinal malabsorption pathophysiology'],
    'diabetes': ['diabetes pathophysiology diagram', 'glucose metabolism diagram'],
    'heart failure': ['heart failure pathophysiology diagram', 'cardiac anatomy labeled'],
    'hypertension': ['hypertension pathophysiology diagram', 'blood pressure regulation'],
    'stroke': ['stroke pathophysiology brain diagram', 'cerebral circulation anatomy'],
    'asthma': ['asthma pathophysiology airway diagram', 'bronchial anatomy'],
    'copd': ['COPD lung pathology diagram', 'emphysema alveoli damage'],
    
    // Dietary/Nutrition
    'dietary': ['therapeutic diet nutrition diagram', 'intestinal absorption nutrients'],
    'diet': ['medical nutrition therapy diagram', 'digestive system absorption'],
    'nutrition': ['nutrient absorption intestine diagram', 'malnutrition effects body'],
    'fodmap': ['low FODMAP diet food chart', 'IBS dietary management'],
    
    // Post-infectious
    'post-infectious': ['post-infectious IBS pathophysiology', 'gut microbiome recovery diagram'],
    'post infectious': ['intestinal recovery after infection', 'gut flora restoration'],
    
    // Drugs - with side effects patterns
    'metformin side effect': ['metformin gastrointestinal side effects diagram', 'metformin lactic acidosis mechanism'],
    'metformin': ['metformin mechanism action glucose diagram', 'metformin AMPK pathway liver muscle'],
    'statin': ['statin mechanism cholesterol diagram', 'LDL receptor pathway'],
    'antibiotic': ['antibiotic mechanism action diagram', 'bacterial cell wall target'],
  };
  
  // Find matching terms
  for (const [term, searchQueries] of Object.entries(medicalTerms)) {
    if (queryLower.includes(term)) {
      searchQueries.forEach((sq, i) => {
        queries.push({
          searchQuery: mode === 'doctor' ? sq : sq.replace('diagram', 'infographic simple'),
          imageType: i === 0 ? 'pathology' : 'anatomy',
          priority: i + 1,
          rationale: `Related to ${term} in query`,
        });
      });
      break; // Only use first matching term
    }
  }
  
  // If no specific match, use generic medical diagram
  if (queries.length === 0) {
    const words = queryLower
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['what', 'how', 'why', 'the', 'are', 'is', 'for', 'with'].includes(w))
      .slice(0, 3);
    
    if (words.length > 0) {
      queries.push({
        searchQuery: `${words.join(' ')} medical diagram`,
        imageType: 'diagram',
        priority: 1,
        rationale: 'Extracted key terms from query',
      });
    }
  }
  
  return queries.slice(0, 3);
}

/**
 * Simple relevance check based on title matching (no vision API)
 * Much faster than vision verification
 */
export function isImageRelevantByTitle(
  imageTitle: string,
  searchQuery: string,
  userQuery: string
): { relevant: boolean; score: number; reason: string } {
  const titleLower = imageTitle.toLowerCase();
  const searchLower = searchQuery.toLowerCase();
  const userLower = userQuery.toLowerCase();
  
  // Extract key terms from search query
  const searchTerms = searchLower
    .split(/\s+/)
    .filter(t => t.length > 3 && !['diagram', 'medical', 'anatomy', 'pathology', 'infographic', 'chart', 'mechanism', 'action'].includes(t));
  
  // Count matching terms
  const matchingTerms = searchTerms.filter(term => titleLower.includes(term));
  const matchRatio = searchTerms.length > 0 ? matchingTerms.length / searchTerms.length : 0;
  
  // Check for completely unrelated topics
  const unrelatedPatterns = [
    { query: 'giardia', exclude: ['stroke', 'heart attack', 'brain', 'cardiac', 'pulmonary'] },
    { query: 'dietary', exclude: ['lifecycle', 'transmission', 'parasite lifecycle'] },
    { query: 'heart', exclude: ['giardia', 'parasite', 'intestinal infection'] },
    { query: 'diabetes', exclude: ['stroke symptoms', 'heart attack', 'giardia'] },
  ];
  
  for (const pattern of unrelatedPatterns) {
    if (userLower.includes(pattern.query)) {
      if (pattern.exclude.some(ex => titleLower.includes(ex))) {
        return {
          relevant: false,
          score: 0,
          reason: `Image about "${pattern.exclude.find(ex => titleLower.includes(ex))}" is unrelated to "${pattern.query}" query`,
        };
      }
    }
  }
  
  // Score based on match ratio
  const score = Math.round(matchRatio * 100);
  
  return {
    relevant: score >= 20, // Lower threshold - 20% match is acceptable for medical images
    score,
    reason: score >= 20 
      ? `Matches ${matchingTerms.length}/${searchTerms.length} search terms`
      : `Low relevance: only ${matchingTerms.length}/${searchTerms.length} terms match`,
  };
}
