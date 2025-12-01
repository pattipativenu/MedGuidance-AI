/**
 * CXR Foundation Integration for Chest X-ray Analysis
 * Uses Google Cloud Vertex AI's CXR Foundation model
 */

import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { protos } from '@google-cloud/aiplatform';

const PROJECT_ID = 'mediguidence-ai';
const LOCATION = 'us-central1';
const CXR_MODEL_ID = 'google/cxr-foundation'; // Model Garden ID

// Initialize Vertex AI client
const predictionClient = new PredictionServiceClient({
  apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
});

export interface CXRFinding {
  pathology: string;
  confidence: number;
  severity: 'critical' | 'moderate' | 'mild' | 'normal';
  region?: string;
  description: string;
}

export interface CXRAnalysisResult {
  findings: CXRFinding[];
  embeddings: number[];
  overallAssessment: string;
  confidence: number;
  processingTime: number;
}

/**
 * Analyze a chest X-ray image using CXR Foundation
 * @param imageBase64 - Base64 encoded X-ray image
 * @returns Structured analysis results
 */
export async function analyzeCXR(imageBase64: string): Promise<CXRAnalysisResult> {
  const startTime = Date.now();
  
  try {
    console.log('🔬 Starting CXR Foundation analysis...');
    
    // For now, we'll use the Vertex AI Prediction API
    // The actual endpoint will depend on how you deployed the model
    
    // Prepare the request
    const endpoint = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${CXR_MODEL_ID}`;
    
    const instance = {
      content: imageBase64,
    };
    
    const parameters = {
      // CXR Foundation parameters
      confidenceThreshold: 0.5,
      maxPredictions: 10,
    };
    
    const request = {
      endpoint,
      instances: [instance],
      parameters,
    };
    
    // Make prediction
    console.log('📡 Calling CXR Foundation endpoint...');
    const [response] = await predictionClient.predict(request as any);
    
    // Parse response
    const predictions = response.predictions;
    if (!predictions || predictions.length === 0) {
      throw new Error('No predictions returned from CXR Foundation');
    }
    
    const prediction = predictions[0];
    
    // Extract findings from prediction
    const findings = parseCXRFindings(prediction);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ CXR analysis completed in ${processingTime}ms`);
    
    return {
      findings,
      embeddings: (prediction as any).embeddings || [],
      overallAssessment: generateOverallAssessment(findings),
      confidence: calculateOverallConfidence(findings),
      processingTime,
    };
    
  } catch (error: any) {
    console.error('❌ CXR Foundation analysis failed:', error);
    
    // Fallback: Return empty analysis
    return {
      findings: [],
      embeddings: [],
      overallAssessment: 'CXR Foundation analysis unavailable. Using Gemini vision analysis.',
      confidence: 0,
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Parse CXR Foundation predictions into structured findings
 */
function parseCXRFindings(prediction: any): CXRFinding[] {
  const findings: CXRFinding[] = [];
  
  // Common pathologies that CXR Foundation can detect
  const pathologyMap: Record<string, string> = {
    'pneumothorax': 'Pneumothorax (collapsed lung)',
    'pleural_effusion': 'Pleural effusion (fluid around lung)',
    'consolidation': 'Consolidation (lung tissue filled with fluid)',
    'atelectasis': 'Atelectasis (collapsed lung tissue)',
    'cardiomegaly': 'Cardiomegaly (enlarged heart)',
    'fracture': 'Rib or clavicle fracture',
    'pneumonia': 'Pneumonia',
    'edema': 'Pulmonary edema',
    'mass': 'Mass or nodule',
    'device': 'Medical device placement',
  };
  
  // Parse predictions
  if (prediction.pathologies) {
    for (const [key, value] of Object.entries(prediction.pathologies)) {
      const confidence = value as number;
      
      if (confidence > 0.3) { // Threshold for reporting
        findings.push({
          pathology: pathologyMap[key] || key,
          confidence,
          severity: getSeverity(key, confidence),
          region: prediction.regions?.[key],
          description: getPathologyDescription(key, confidence),
        });
      }
    }
  }
  
  // Sort by confidence (highest first)
  findings.sort((a, b) => b.confidence - a.confidence);
  
  return findings;
}

/**
 * Determine severity based on pathology type and confidence
 */
function getSeverity(pathology: string, confidence: number): 'critical' | 'moderate' | 'mild' | 'normal' {
  const criticalPathologies = ['pneumothorax', 'mass', 'fracture'];
  const moderatePathologies = ['pleural_effusion', 'consolidation', 'pneumonia'];
  
  if (confidence < 0.5) return 'mild';
  
  if (criticalPathologies.includes(pathology) && confidence > 0.7) {
    return 'critical';
  }
  
  if (moderatePathologies.includes(pathology) && confidence > 0.6) {
    return 'moderate';
  }
  
  return confidence > 0.7 ? 'moderate' : 'mild';
}

/**
 * Get clinical description for pathology
 */
function getPathologyDescription(pathology: string, confidence: number): string {
  const descriptions: Record<string, string> = {
    'pneumothorax': 'Air in the pleural space causing lung collapse. Requires immediate clinical correlation.',
    'pleural_effusion': 'Fluid accumulation in the pleural space. May indicate infection, heart failure, or malignancy.',
    'consolidation': 'Lung tissue filled with fluid or inflammatory material. Often seen in pneumonia.',
    'atelectasis': 'Partial or complete collapse of lung tissue. May be due to obstruction or compression.',
    'cardiomegaly': 'Enlarged cardiac silhouette. May indicate heart failure or cardiomyopathy.',
    'fracture': 'Bone discontinuity in ribs or clavicle. Assess for associated complications.',
    'pneumonia': 'Lung infection with inflammatory infiltrates. Clinical correlation recommended.',
    'edema': 'Fluid in lung tissue. Often associated with heart failure.',
    'mass': 'Abnormal density that may represent tumor, infection, or other pathology. Further imaging recommended.',
    'device': 'Medical device detected. Verify appropriate positioning.',
  };
  
  const confidenceText = confidence > 0.8 ? 'High confidence' : confidence > 0.6 ? 'Moderate confidence' : 'Low confidence';
  return `${descriptions[pathology] || 'Abnormal finding detected.'} (${confidenceText}: ${(confidence * 100).toFixed(1)}%)`;
}

/**
 * Generate overall assessment from findings
 */
function generateOverallAssessment(findings: CXRFinding[]): string {
  if (findings.length === 0) {
    return 'No significant abnormalities detected by CXR Foundation.';
  }
  
  const critical = findings.filter(f => f.severity === 'critical');
  const moderate = findings.filter(f => f.severity === 'moderate');
  
  if (critical.length > 0) {
    return `Critical findings detected: ${critical.map(f => f.pathology).join(', ')}. Immediate clinical correlation recommended.`;
  }
  
  if (moderate.length > 0) {
    return `Moderate findings detected: ${moderate.map(f => f.pathology).join(', ')}. Clinical correlation recommended.`;
  }
  
  return `Mild findings detected: ${findings.map(f => f.pathology).join(', ')}. Consider clinical context.`;
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(findings: CXRFinding[]): number {
  if (findings.length === 0) return 0;
  
  const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;
  return avgConfidence;
}

/**
 * Format CXR findings for Gemini prompt
 */
export function formatCXRFindingsForPrompt(result: CXRAnalysisResult): string {
  if (result.findings.length === 0) {
    return `\n\n--- CXR FOUNDATION ANALYSIS ---\n${result.overallAssessment}\n--- END CXR ANALYSIS ---\n\n`;
  }
  
  let prompt = '\n\n--- CXR FOUNDATION EXPERT ANALYSIS ---\n\n';
  prompt += `**Overall Assessment**: ${result.overallAssessment}\n`;
  prompt += `**Analysis Confidence**: ${(result.confidence * 100).toFixed(1)}%\n\n`;
  prompt += '**Detected Pathologies**:\n';
  
  result.findings.forEach((finding, idx) => {
    prompt += `${idx + 1}. **${finding.pathology}** (${finding.severity.toUpperCase()})\n`;
    prompt += `   - Confidence: ${(finding.confidence * 100).toFixed(1)}%\n`;
    if (finding.region) {
      prompt += `   - Region: ${finding.region}\n`;
    }
    prompt += `   - ${finding.description}\n\n`;
  });
  
  prompt += '**Instructions for Clinical Analysis**:\n';
  prompt += '- Use these CXR Foundation findings as expert-level imaging analysis\n';
  prompt += '- Correlate with clinical presentation and patient history\n';
  prompt += '- Provide differential diagnosis based on these findings\n';
  prompt += '- Recommend appropriate next steps and management\n';
  prompt += '\n--- END CXR ANALYSIS ---\n\n';
  
  return prompt;
}
