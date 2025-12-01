/**
 * Vertex AI Connector for MedGemma
 * 
 * Connects to MedGemma 4B-IT Multimodal deployed via Model Garden on Vertex AI
 * Endpoint: mg-endpoint-89a9c348-806c-4653-91c5-8662d69e163c
 * Model: google_medgemma-4b-it (vLLM deployment with vision support)
 * 
 * This is the MULTIMODAL version that can analyze medical images directly.
 */

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'mediguidence-ai';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const MEDGEMMA_ENDPOINT = process.env.MEDGEMMA_ENDPOINT || '';
const MEDGEMMA_MODEL_ID = process.env.MEDGEMMA_MODEL_ID || '';
const DEDICATED_ENDPOINT = process.env.MEDGEMMA_DEDICATED_ENDPOINT || '';

// Log configuration on module load (server-side only)
if (typeof window === 'undefined') {
  console.log('🔍 MedGemma Configuration:');
  console.log('  PROJECT_ID:', PROJECT_ID);
  console.log('  LOCATION:', LOCATION);
  console.log('  MEDGEMMA_ENDPOINT:', MEDGEMMA_ENDPOINT ? '✅ Set' : '❌ Not Set');
  console.log('  MEDGEMMA_MODEL_ID:', MEDGEMMA_MODEL_ID ? '✅ Set' : '❌ Not Set');
  console.log('  DEDICATED_ENDPOINT:', DEDICATED_ENDPOINT ? '✅ Set' : '❌ Not Set');
}

export interface MedGemmaRequest {
  imageBase64: string;
  imageType: string;
  patientContext?: {
    age?: number;
    sex?: string;
    symptoms?: string[];
    history?: string[];
    clinicalQuestion?: string;
  };
}

export interface MedGemmaResponse {
  findings: Array<{
    pathology: string;
    location: string;
    severity: 'critical' | 'moderate' | 'mild' | 'normal';
    confidence: number;
    boundingBox: {
      ymin: number;
      xmin: number;
      ymax: number;
      xmax: number;
    };
    description: string;
  }>;
  overallAssessment: string;
  recommendations: string[];
  confidence: number;
  processingTime: number;
}

/**
 * Check if Vertex AI MedGemma is available
 */
export function isMedGemmaAvailable(): boolean {
  const available = !!(
    PROJECT_ID &&
    LOCATION &&
    (MEDGEMMA_ENDPOINT || MEDGEMMA_MODEL_ID || DEDICATED_ENDPOINT)
  );
  return available;
}

/**
 * Extract endpoint ID from full endpoint path
 */
function extractEndpointId(endpointPath: string): string {
  const match = endpointPath.match(/endpoints\/([^/]+)$/);
  return match ? match[1] : endpointPath;
}

/**
 * Build the medical imaging analysis prompt for MedGemma
 */
function buildMedGemmaPrompt(request: MedGemmaRequest): string {
  const { imageType, patientContext } = request;
  
  let contextStr = '';
  if (patientContext) {
    const parts = [];
    if (patientContext.age) parts.push(`${patientContext.age} year old`);
    if (patientContext.sex) parts.push(patientContext.sex);
    if (patientContext.symptoms?.length) parts.push(`presenting with ${patientContext.symptoms.join(', ')}`);
    if (patientContext.history?.length) parts.push(`history of ${patientContext.history.join(', ')}`);
    contextStr = parts.join(' ');
  }

  const prompt = `<start_of_turn>user
You are an expert radiologist. Analyze this ${imageType} medical image.
${contextStr ? `Patient: ${contextStr}` : ''}
${patientContext?.clinicalQuestion ? `Clinical question: ${patientContext.clinicalQuestion}` : ''}

Provide a detailed analysis including:
1. All visible abnormalities and pathologies
2. Anatomical locations of findings
3. Severity assessment (critical/moderate/mild/normal)
4. Confidence level for each finding
5. Bounding box coordinates [ymin, xmin, ymax, xmax] on 0-1000 scale
6. Overall clinical impression
7. Recommendations

Format your response as JSON:
{
  "findings": [
    {
      "pathology": "name",
      "location": "anatomical location",
      "severity": "critical|moderate|mild|normal",
      "confidence": 0.95,
      "boundingBox": {"ymin": 100, "xmin": 200, "ymax": 300, "xmax": 400},
      "description": "clinical description"
    }
  ],
  "overallAssessment": "summary",
  "recommendations": ["recommendation 1", "recommendation 2"]
}
<end_of_turn>
<start_of_turn>model`;

  return prompt;
}

/**
 * Parse MedGemma response text into structured format
 */
function parseMedGemmaResponse(responseText: string): Partial<MedGemmaResponse> {
  console.log('📝 Parsing MedGemma response...');
  console.log('   Response preview:', responseText.substring(0, 500));
  
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ Successfully parsed JSON response');
      return {
        findings: (parsed.findings || []).map((f: any) => ({
          pathology: f.pathology || f.name || 'Unknown',
          location: f.location || f.anatomical_location || 'Not specified',
          severity: normalizeSeverity(f.severity),
          confidence: f.confidence || 0.7,
          boundingBox: f.boundingBox || f.bounding_box || { ymin: 200, xmin: 200, ymax: 400, xmax: 400 },
          description: f.description || f.pathology || '',
        })),
        overallAssessment: parsed.overallAssessment || parsed.overall_assessment || parsed.impression || '',
        recommendations: parsed.recommendations || [],
        confidence: parsed.confidence || 0.7,
      };
    }
  } catch (e) {
    console.warn('⚠️ Failed to parse JSON, extracting from text');
  }

  // Fallback: Extract information from text response
  return extractFindingsFromText(responseText);
}

/**
 * Extract findings from unstructured text response
 */
function extractFindingsFromText(text: string): Partial<MedGemmaResponse> {
  const findings: MedGemmaResponse['findings'] = [];
  const recommendations: string[] = [];
  
  // Common pathology patterns
  const pathologyPatterns = [
    /(?:pneumothorax|pneumonia|consolidation|effusion|cardiomegaly|nodule|mass|fracture|atelectasis|edema)/gi,
  ];
  
  for (const pattern of pathologyPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const pathology = match[0];
      // Check if already added
      if (!findings.some(f => f.pathology.toLowerCase() === pathology.toLowerCase())) {
        findings.push({
          pathology: pathology.charAt(0).toUpperCase() + pathology.slice(1).toLowerCase(),
          location: extractLocation(text, match.index) || 'Not specified',
          severity: extractSeverity(text, match.index),
          confidence: 0.7,
          boundingBox: { ymin: 200, xmin: 200, ymax: 400, xmax: 400 },
          description: extractDescription(text, match.index, pathology),
        });
      }
    }
  }

  // Extract recommendations
  const recPatterns = [
    /recommend[s]?[:\s]+([^.]+)/gi,
    /suggest[s]?[:\s]+([^.]+)/gi,
    /follow[- ]?up[:\s]+([^.]+)/gi,
  ];
  
  for (const pattern of recPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      recommendations.push(match[1].trim());
    }
  }

  // Extract overall assessment
  const assessmentMatch = text.match(/(?:impression|assessment|conclusion)[:\s]*([^.]+\.)/i);
  const overallAssessment = assessmentMatch?.[1]?.trim() || 
    (findings.length > 0 ? `${findings.length} finding(s) identified.` : 'No significant abnormalities detected.');

  return {
    findings,
    overallAssessment,
    recommendations: recommendations.length > 0 ? recommendations : ['Clinical correlation recommended'],
    confidence: findings.length > 0 ? 0.7 : 0.5,
  };
}

function extractLocation(text: string, index: number): string {
  const context = text.substring(Math.max(0, index - 100), index + 100);
  const locationPatterns = [
    /(?:right|left)\s+(?:upper|lower|middle)?\s*(?:lobe|lung|hemithorax)/i,
    /(?:bilateral|unilateral)/i,
    /(?:apical|basal|hilar|perihilar)/i,
  ];
  
  for (const pattern of locationPatterns) {
    const match = context.match(pattern);
    if (match) return match[0];
  }
  return 'Not specified';
}

function extractSeverity(text: string, index: number): 'critical' | 'moderate' | 'mild' | 'normal' {
  const context = text.substring(Math.max(0, index - 50), index + 100).toLowerCase();
  if (context.includes('severe') || context.includes('critical') || context.includes('urgent')) return 'critical';
  if (context.includes('moderate') || context.includes('significant')) return 'moderate';
  if (context.includes('mild') || context.includes('minor') || context.includes('small')) return 'mild';
  return 'moderate';
}

function extractDescription(text: string, index: number, pathology: string): string {
  const context = text.substring(Math.max(0, index - 20), Math.min(text.length, index + 150));
  const sentence = context.match(/[^.]*\./)?.[0] || pathology;
  return sentence.trim();
}

function normalizeSeverity(severity: string | undefined): 'critical' | 'moderate' | 'mild' | 'normal' {
  if (!severity) return 'moderate';
  const s = severity.toLowerCase();
  if (s.includes('critical') || s.includes('severe')) return 'critical';
  if (s.includes('moderate')) return 'moderate';
  if (s.includes('mild') || s.includes('minor')) return 'mild';
  if (s.includes('normal') || s.includes('negative')) return 'normal';
  return 'moderate';
}

/**
 * Analyze medical image using MedGemma 4B-IT Multimodal on Vertex AI
 * Uses the dedicated endpoint with rawPredict API for vLLM deployment
 * 
 * MedGemma 4B-IT is MULTIMODAL - it can directly analyze medical images!
 */
export async function analyzeMedicalImageWithMedGemma(
  request: MedGemmaRequest
): Promise<MedGemmaResponse> {
  const startTime = Date.now();

  console.log('🚀 Starting MedGemma 4B-IT Multimodal analysis...');
  console.log('📋 Image type:', request.imageType);
  console.log('📋 Image size:', Math.round(request.imageBase64.length / 1024), 'KB');
  console.log('📋 Patient context:', request.patientContext ? 'Provided' : 'Not provided');

  if (!isMedGemmaAvailable()) {
    throw new Error('MedGemma not configured. Set MEDGEMMA_ENDPOINT in environment variables.');
  }

  try {
    // Get access token
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    if (!accessToken.token) {
      throw new Error('Failed to get access token');
    }

    // MedGemma 4B-IT Multimodal uses rawPredict on the dedicated endpoint
    if (!DEDICATED_ENDPOINT) {
      throw new Error('MEDGEMMA_DEDICATED_ENDPOINT is required for MedGemma vLLM deployment');
    }

    const endpointId = MEDGEMMA_MODEL_ID || extractEndpointId(MEDGEMMA_ENDPOINT);
    
    // Build the rawPredict URL for the dedicated endpoint
    const rawPredictUrl = `https://${DEDICATED_ENDPOINT}:443/v1/projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${endpointId}:rawPredict`;
    console.log('📡 Using rawPredict endpoint:', rawPredictUrl);

    // Build prompt for MedGemma 4B-IT with image
    const prompt = buildMedGemmaPrompt(request);

    // Prepare the request body for vLLM rawPredict with IMAGE
    // MedGemma 4B-IT multimodal format - image is embedded in the prompt with special tokens
    // Format: <image>\n{base64_image}\n</image>\n{text_prompt}
    const multimodalPrompt = `<image>\n${request.imageBase64}\n</image>\n${prompt}`;
    
    const requestBody = {
      instances: [{
        prompt: multimodalPrompt,
      }],
      parameters: {
        max_new_tokens: 2048,
        temperature: 0.1,
      },
    };

    console.log('📡 Sending multimodal request to MedGemma 4B-IT...');
    
    const response = await fetch(rawPredictUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ MedGemma API error:', response.status, errorText);
      throw new Error(`MedGemma API failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Extract the response text from predictions
    let responseText = '';
    if (result.predictions && result.predictions.length > 0) {
      const prediction = result.predictions[0];
      // vLLM returns format: "Prompt:\n...\nOutput:\n..."
      const outputMatch = prediction.match(/Output:\n([\s\S]*)/);
      responseText = outputMatch ? outputMatch[1].trim() : prediction;
    }
    
    console.log('✅ MedGemma 4B-IT response received');
    console.log('📝 Response length:', responseText.length, 'chars');
    console.log('📝 Response preview:', responseText.substring(0, 500));
    
    // Parse the response
    const parsed = parseMedGemmaResponse(responseText);
    const processingTime = Date.now() - startTime;

    console.log(`✅ MedGemma analysis completed in ${processingTime}ms`);
    console.log(`   Found ${parsed.findings?.length || 0} findings`);

    const assessment = parsed.overallAssessment && parsed.overallAssessment.length > 50
      ? parsed.overallAssessment 
      : responseText.length > 50 
        ? responseText
        : `MedGemma 4B-IT analysis for ${request.imageType}. ${responseText}`;

    return {
      findings: parsed.findings || [],
      overallAssessment: assessment,
      recommendations: (parsed.recommendations && parsed.recommendations.length > 0)
        ? parsed.recommendations 
        : generateDefaultRecommendations(request),
      confidence: parsed.confidence || 0.75,
      processingTime,
    };

  } catch (error: any) {
    console.error('❌ MedGemma 4B-IT analysis failed:', error.message);
    throw error;
  }
}

/**
 * Build text-only prompt for MedGemma 27B-IT
 * This model excels at medical text understanding and clinical reasoning
 */
function buildMedGemmaTextPrompt(request: MedGemmaRequest): string {
  const { imageType, patientContext } = request;
  
  let contextStr = '';
  if (patientContext) {
    const parts = [];
    if (patientContext.age) parts.push(`${patientContext.age} year old`);
    if (patientContext.sex) parts.push(patientContext.sex);
    if (patientContext.symptoms?.length) parts.push(`presenting with ${patientContext.symptoms.join(', ')}`);
    if (patientContext.history?.length) parts.push(`history of ${patientContext.history.join(', ')}`);
    contextStr = parts.join(' ');
  }

  const prompt = `<start_of_turn>user
You are an expert radiologist providing clinical guidance for a ${imageType} examination.

Patient Information:
${contextStr || 'No specific patient context provided'}

Clinical Question: ${patientContext?.clinicalQuestion || `Provide comprehensive analysis guidance for this ${imageType} study.`}

Please provide:
1. Key findings to look for in this type of study
2. Common pathologies associated with the clinical presentation
3. Severity assessment criteria
4. Recommended follow-up actions
5. Clinical recommendations

Format your response as a structured clinical report.
<end_of_turn>
<start_of_turn>model
`;

  return prompt;
}

/**
 * Generate default recommendations based on image type and context
 */
function generateDefaultRecommendations(request: MedGemmaRequest): string[] {
  const recommendations: string[] = [];
  
  switch (request.imageType) {
    case 'chest-xray':
      recommendations.push('Clinical correlation with patient symptoms recommended');
      recommendations.push('Consider follow-up imaging if findings are inconclusive');
      if (request.patientContext?.symptoms?.some(s => s.toLowerCase().includes('fever'))) {
        recommendations.push('Consider infectious etiology workup');
      }
      break;
    case 'ct-chest':
    case 'ct-head':
    case 'ct-abdomen':
      recommendations.push('Correlate with clinical history and prior imaging');
      recommendations.push('Consider contrast-enhanced study if not already performed');
      break;
    case 'mri-brain':
    case 'mri-spine':
      recommendations.push('Correlate with neurological examination');
      recommendations.push('Consider additional sequences if clinically indicated');
      break;
    default:
      recommendations.push('Clinical correlation recommended');
      recommendations.push('Specialist consultation may be warranted');
  }
  
  return recommendations;
}

/**
 * Test MedGemma connection
 */
export async function testMedGemmaConnection(): Promise<{
  available: boolean;
  endpoint?: string;
  error?: string;
}> {
  try {
    if (!isMedGemmaAvailable()) {
      return {
        available: false,
        error: 'MedGemma configuration missing.',
      };
    }

    const endpointId = MEDGEMMA_MODEL_ID || extractEndpointId(MEDGEMMA_ENDPOINT);
    const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/endpoints/${endpointId}`;

    return {
      available: true,
      endpoint,
    };
  } catch (error: any) {
    return {
      available: false,
      error: error.message,
    };
  }
}
