/**
 * MedGem Medical Imaging Analyzer
 * 
 * Current: Enhanced Gemini 2.5 Flash with specialized medical prompts
 * With Vertex AI: Direct MedGemma integration for superior accuracy
 */

import { getGeminiVisionModel } from '@/lib/gemini';
import {
  MedicalImageInput,
  MedicalImageAnalysis,
  PathologyFinding,
  BoundingBox,
  SeverityLevel,
  MedGemConfig,
  MedicalImagingError,
  BatchAnalysisInput,
  BatchAnalysisResult,
} from './types';
import { parseVisualFindings } from './parser';
import { generateMedicalImagingPrompt } from './prompts';
import {
  isMedGemmaAvailable,
  analyzeMedicalImageWithMedGemma,
  MedGemmaResponse,
} from './vertex-ai-connector';

/**
 * Analyze a medical image using MedGem-enhanced capabilities
 * Automatically uses Vertex AI MedGemma if available, otherwise falls back to Gemini
 */
export async function analyzeMedicalImage(
  input: MedicalImageInput,
  config: MedGemConfig = {}
): Promise<MedicalImageAnalysis> {
  const startTime = Date.now();

  try {
    // Validate input
    validateImageInput(input);

    // Check if Vertex AI MedGemma is available and not explicitly disabled
    const useVertexAI = config.useVertexAI !== false && isMedGemmaAvailable();

    if (useVertexAI) {
      console.log('🚀 Using Vertex AI MedGemma for analysis...');
      try {
        const medgemmaResult = await analyzeMedicalImageWithMedGemma({
          imageBase64: input.imageBase64,
          imageType: input.imageType,
          patientContext: input.patientContext,
        });

        // Convert MedGemma response to our standard format
        const analysis = convertMedGemmaToAnalysis(medgemmaResult, input, startTime);
        console.log('✅ MedGemma analysis complete');
        return analysis;
      } catch (error: any) {
        console.warn('⚠️ MedGemma failed, falling back to Gemini:', error.message);
        
        // If fallback is disabled, throw the error
        if (config.fallbackToGemini === false) {
          throw error;
        }
        
        // Otherwise, continue to Gemini fallback below
      }
    }

    // Fallback to Gemini 2.5 Flash with enhanced prompts
    console.log('🔬 Using Gemini 2.5 Flash for analysis...');
    const model = getGeminiVisionModel();

    // Generate specialized medical imaging prompt
    const prompt = generateMedicalImagingPrompt(input, config);

    // Prepare content for Gemini
    const content = [
      { text: prompt },
      {
        inlineData: {
          mimeType: input.mimeType || 'image/jpeg',
          data: input.imageBase64,
        },
      },
    ];

    // Generate analysis
    const result = await model.generateContent(content);
    const responseText = result.response.text();
    console.log('✅ Gemini analysis complete');

    // Parse the response into structured format
    const analysis = parseAnalysisResponse(responseText, input, startTime);

    return analysis;
  } catch (error: any) {
    console.error('❌ Medical imaging analysis failed:', error);
    throw new MedicalImagingError(
      'Failed to analyze medical image',
      'PROCESSING_FAILED',
      error
    );
  }
}

/**
 * Analyze multiple medical images (batch processing)
 */
export async function analyzeMedicalImageBatch(
  input: BatchAnalysisInput,
  config: MedGemConfig = {}
): Promise<BatchAnalysisResult> {
  const startTime = Date.now();

  try {
    // Analyze each image in parallel
    const analysisPromises = input.images.map((image) =>
      analyzeMedicalImage(image, config)
    );

    const individualResults = await Promise.all(analysisPromises);

    // Perform comparison analysis if requested
    let comparisonAnalysis;
    if (input.compareAcrossImages && individualResults.length > 1) {
      comparisonAnalysis = performComparisonAnalysis(individualResults);
    }

    const totalProcessingTime = Date.now() - startTime;

    return {
      individualResults,
      comparisonAnalysis,
      metadata: {
        totalProcessingTime,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error('❌ Batch analysis failed:', error);
    throw new MedicalImagingError(
      'Failed to analyze medical images in batch',
      'PROCESSING_FAILED',
      error
    );
  }
}

/**
 * Validate image input
 */
function validateImageInput(input: MedicalImageInput): void {
  if (!input.imageBase64) {
    throw new MedicalImagingError(
      'Image data is required',
      'INVALID_IMAGE'
    );
  }

  if (!input.imageType) {
    throw new MedicalImagingError(
      'Image type/modality is required',
      'INVALID_IMAGE'
    );
  }

  // Check if base64 is valid
  try {
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(input.imageBase64)) {
      throw new Error('Invalid base64 format');
    }
  } catch (error) {
    throw new MedicalImagingError(
      'Invalid image data format',
      'INVALID_IMAGE',
      error
    );
  }
}

/**
 * Parse AI response into structured analysis
 */
function parseAnalysisResponse(
  responseText: string,
  input: MedicalImageInput,
  startTime: number
): MedicalImageAnalysis {
  // Parse visual findings with bounding boxes
  const findings = parseVisualFindings(responseText);

  // Extract critical findings
  const criticalFindings = findings.filter(
    (f: PathologyFinding) => f.severity === 'critical'
  );

  // Extract overall impression
  const impressionMatch = responseText.match(
    /\*\*Overall Assessment\*\*:?\s*([^\n]+)/i
  );
  const overallImpression =
    impressionMatch?.[1]?.trim() ||
    'Medical image analysis completed. See findings below.';

  // Extract differential diagnosis
  const differentialDiagnosis = extractDifferentialDiagnosis(responseText);

  // Extract recommendations
  const recommendations = extractRecommendations(responseText);

  // Assess image quality
  const imageQuality = assessImageQuality(responseText);

  // Generate structured report
  const structuredReport = generateStructuredReport(
    responseText,
    findings,
    overallImpression
  );

  // Calculate overall confidence
  const overallConfidence =
    findings.length > 0
      ? findings.reduce((sum: number, f: PathologyFinding) => sum + f.confidence, 0) / findings.length
      : 0.5;

  const processingTime = Date.now() - startTime;

  return {
    findings,
    overallImpression,
    criticalFindings,
    recommendations,
    differentialDiagnosis,
    imageQuality,
    metadata: {
      modelUsed: 'gemini-2.5-flash',
      processingTime,
      timestamp: new Date().toISOString(),
      confidence: overallConfidence,
    },
    structuredReport,
  };
}

/**
 * Extract differential diagnosis from response
 */
function extractDifferentialDiagnosis(responseText: string): Array<{
  condition: string;
  likelihood: 'high' | 'moderate' | 'low';
  supportingFindings: string[];
}> {
  const differentials: Array<{
    condition: string;
    likelihood: 'high' | 'moderate' | 'low';
    supportingFindings: string[];
  }> = [];

  // Look for differential diagnosis section
  const diffMatch = responseText.match(
    /\*\*Differential Diagnosis[:\s]*\*\*([\s\S]*?)(?=\n\n\*\*|$)/i
  );

  if (diffMatch) {
    const diffText = diffMatch[1];
    const lines = diffText.split('\n').filter((line) => line.trim());

    lines.forEach((line) => {
      // Parse format: "1. Condition (likelihood): findings"
      const match = line.match(
        /^\d+\.\s*([^(]+)\s*\(([^)]+)\):?\s*(.*)$/i
      );
      if (match) {
        const condition = match[1].trim();
        const likelihoodText = match[2].toLowerCase();
        const findings = match[3]
          .split(',')
          .map((f) => f.trim())
          .filter((f) => f);

        let likelihood: 'high' | 'moderate' | 'low' = 'moderate';
        if (likelihoodText.includes('high') || likelihoodText.includes('likely')) {
          likelihood = 'high';
        } else if (likelihoodText.includes('low') || likelihoodText.includes('unlikely')) {
          likelihood = 'low';
        }

        differentials.push({
          condition,
          likelihood,
          supportingFindings: findings,
        });
      }
    });
  }

  return differentials;
}

/**
 * Extract clinical recommendations from response
 */
function extractRecommendations(responseText: string): {
  immediateActions?: string[];
  followUp?: string[];
  clinicalCorrelation?: string[];
  specialistConsult?: string[];
} {
  const recommendations: {
    immediateActions?: string[];
    followUp?: string[];
    clinicalCorrelation?: string[];
    specialistConsult?: string[];
  } = {};

  // Extract immediate actions
  const immediateMatch = responseText.match(
    /\*\*Immediate Actions?\*\*:?\s*([\s\S]*?)(?=\n\n\*\*|$)/i
  );
  if (immediateMatch) {
    recommendations.immediateActions = extractBulletPoints(immediateMatch[1]);
  }

  // Extract follow-up recommendations
  const followUpMatch = responseText.match(
    /\*\*Follow[- ]?Up\*\*:?\s*([\s\S]*?)(?=\n\n\*\*|$)/i
  );
  if (followUpMatch) {
    recommendations.followUp = extractBulletPoints(followUpMatch[1]);
  }

  // Extract clinical correlation needs
  const correlationMatch = responseText.match(
    /\*\*Clinical Correlation\*\*:?\s*([\s\S]*?)(?=\n\n\*\*|$)/i
  );
  if (correlationMatch) {
    recommendations.clinicalCorrelation = extractBulletPoints(
      correlationMatch[1]
    );
  }

  // Extract specialist consultation recommendations
  const specialistMatch = responseText.match(
    /\*\*Specialist Consult\*\*:?\s*([\s\S]*?)(?=\n\n\*\*|$)/i
  );
  if (specialistMatch) {
    recommendations.specialistConsult = extractBulletPoints(
      specialistMatch[1]
    );
  }

  return recommendations;
}

/**
 * Extract bullet points from text
 */
function extractBulletPoints(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * Assess image quality from response
 */
function assessImageQuality(responseText: string): {
  overall: 'excellent' | 'good' | 'adequate' | 'poor';
  issues?: string[];
  positioning?: string;
} {
  const qualityMatch = responseText.match(
    /\*\*Image Quality\*\*:?\s*([^\n]+)/i
  );

  let overall: 'excellent' | 'good' | 'adequate' | 'poor' = 'good';
  const issues: string[] = [];

  if (qualityMatch) {
    const qualityText = qualityMatch[1].toLowerCase();
    if (qualityText.includes('excellent')) overall = 'excellent';
    else if (qualityText.includes('poor')) overall = 'poor';
    else if (qualityText.includes('adequate')) overall = 'adequate';

    // Extract issues
    if (qualityText.includes('motion')) issues.push('motion artifact');
    if (qualityText.includes('underexposed')) issues.push('underexposed');
    if (qualityText.includes('overexposed')) issues.push('overexposed');
    if (qualityText.includes('rotated')) issues.push('rotated');
  }

  return {
    overall,
    issues: issues.length > 0 ? issues : undefined,
  };
}

/**
 * Generate structured report for display
 */
function generateStructuredReport(
  responseText: string,
  findings: PathologyFinding[],
  overallImpression: string
): {
  tldr: string[];
  clinicalContext: string;
  findings: string;
  impression: string;
  recommendations: string;
} {
  // Extract TL;DR
  const tldrMatch = responseText.match(
    /\*\*TL;DR\*\*:?\s*([\s\S]*?)(?=\n\n\*\*|$)/i
  );
  const tldr = tldrMatch
    ? extractBulletPoints(tldrMatch[1])
    : [`${findings.length} findings identified`];

  // Extract clinical context
  const contextMatch = responseText.match(
    /\*\*Clinical Context\*\*:?\s*([\s\S]*?)(?=\n\n\*\*|$)/i
  );
  const clinicalContext =
    contextMatch?.[1]?.trim() || 'Medical image analysis performed.';

  // Format findings
  const findingsText =
    findings.length > 0
      ? findings
          .map(
            (f, i) =>
              `${i + 1}. ${f.description} (${f.severity.toUpperCase()})`
          )
          .join('\n')
      : 'No significant abnormalities detected.';

  // Extract recommendations
  const recMatch = responseText.match(
    /\*\*Recommendations?\*\*:?\s*([\s\S]*?)(?=\n\n\*\*|$)/i
  );
  const recommendations =
    recMatch?.[1]?.trim() || 'Clinical correlation recommended.';

  return {
    tldr,
    clinicalContext,
    findings: findingsText,
    impression: overallImpression,
    recommendations,
  };
}

/**
 * Perform comparison analysis across multiple images
 */
function performComparisonAnalysis(
  results: MedicalImageAnalysis[]
): {
  changes: string[];
  progression: 'improved' | 'stable' | 'worsened' | 'new-findings';
  summary: string;
} {
  const changes: string[] = [];
  let progression: 'improved' | 'stable' | 'worsened' | 'new-findings' = 'stable';

  // Compare number of critical findings
  const criticalCounts = results.map((r) => r.criticalFindings.length);
  if (criticalCounts[criticalCounts.length - 1] > criticalCounts[0]) {
    progression = 'worsened';
    changes.push('Increase in critical findings');
  } else if (criticalCounts[criticalCounts.length - 1] < criticalCounts[0]) {
    progression = 'improved';
    changes.push('Decrease in critical findings');
  }

  // Compare total findings
  const totalCounts = results.map((r) => r.findings.length);
  if (totalCounts[totalCounts.length - 1] > totalCounts[0]) {
    if (progression === 'stable') progression = 'new-findings';
    changes.push('New findings detected');
  }

  const summary =
    changes.length > 0
      ? `Comparison shows: ${changes.join(', ')}`
      : 'No significant changes observed between images';

  return {
    changes,
    progression,
    summary,
  };
}

/**
 * Convert MedGemma response to our standard MedicalImageAnalysis format
 */
function convertMedGemmaToAnalysis(
  medgemmaResult: MedGemmaResponse,
  input: MedicalImageInput,
  startTime: number
): MedicalImageAnalysis {
  // Convert MedGemma findings to our PathologyFinding format
  const findings: PathologyFinding[] = medgemmaResult.findings.map((finding) => {
    // Determine pathology type
    const type = determinePathologyTypeFromName(finding.pathology);

    return {
      id: `medgemma-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      description: finding.description,
      severity: finding.severity,
      location: finding.location,
      boundingBox: {
        ...finding.boundingBox,
        label: finding.pathology,
        confidence: finding.confidence,
      },
      confidence: finding.confidence,
      clinicalSignificance: generateClinicalSignificanceFromSeverity(
        finding.pathology,
        finding.severity
      ),
    };
  });

  // Extract critical findings
  const criticalFindings = findings.filter((f) => f.severity === 'critical');

  // Generate differential diagnosis (MedGemma may not provide this, so we generate it)
  const differentialDiagnosis = generateDifferentialFromFindings(findings);

  // Parse recommendations
  const recommendations = {
    immediateActions: criticalFindings.length > 0 
      ? ['Immediate clinical correlation required for critical findings']
      : undefined,
    followUp: medgemmaResult.recommendations.filter(r => 
      r.toLowerCase().includes('follow') || r.toLowerCase().includes('repeat')
    ),
    clinicalCorrelation: medgemmaResult.recommendations.filter(r => 
      r.toLowerCase().includes('correlat') || r.toLowerCase().includes('clinical')
    ),
    specialistConsult: medgemmaResult.recommendations.filter(r => 
      r.toLowerCase().includes('consult') || r.toLowerCase().includes('specialist')
    ),
  };

  // Generate structured report
  const structuredReport = {
    tldr: [
      `${findings.length} findings identified`,
      criticalFindings.length > 0 
        ? `${criticalFindings.length} critical finding(s) requiring immediate attention`
        : 'No critical findings',
      medgemmaResult.overallAssessment.substring(0, 100),
    ],
    clinicalContext: `MedGemma analysis of ${input.imageType} image`,
    findings: findings
      .map((f, i) => `${i + 1}. ${f.description} (${f.severity.toUpperCase()})`)
      .join('\n'),
    impression: medgemmaResult.overallAssessment,
    recommendations: medgemmaResult.recommendations.join('\n'),
  };

  const processingTime = Date.now() - startTime;

  return {
    findings,
    overallImpression: medgemmaResult.overallAssessment,
    criticalFindings,
    recommendations,
    differentialDiagnosis,
    imageQuality: {
      overall: 'good', // MedGemma doesn't provide this, default to good
    },
    metadata: {
      modelUsed: 'medgem',
      processingTime,
      timestamp: new Date().toISOString(),
      confidence: medgemmaResult.confidence,
    },
    structuredReport,
  };
}

/**
 * Determine pathology type from MedGemma pathology name
 */
function determinePathologyTypeFromName(pathologyName: string): any {
  const name = pathologyName.toLowerCase();
  
  if (name.includes('pneumothorax')) return 'pneumothorax';
  if (name.includes('effusion')) return 'pleural-effusion';
  if (name.includes('consolidation')) return 'consolidation';
  if (name.includes('atelectasis')) return 'atelectasis';
  if (name.includes('cardiomegaly')) return 'cardiomegaly';
  if (name.includes('fracture')) return 'fracture';
  if (name.includes('mass')) return 'mass';
  if (name.includes('nodule')) return 'nodule';
  if (name.includes('edema')) return 'edema';
  if (name.includes('pneumonia')) return 'pneumonia';
  if (name.includes('hemorrhage')) return 'hemorrhage';
  if (name.includes('tumor')) return 'tumor';
  
  return 'other';
}

/**
 * Generate clinical significance from pathology and severity
 */
function generateClinicalSignificanceFromSeverity(
  pathology: string,
  severity: SeverityLevel
): string {
  const severityDescriptions = {
    critical: 'Critical finding requiring immediate clinical attention and intervention.',
    moderate: 'Significant finding requiring further evaluation and management.',
    mild: 'Minor finding that may require monitoring or clinical correlation.',
    normal: 'No significant abnormality detected.',
  };

  return `${pathology}: ${severityDescriptions[severity]}`;
}

/**
 * Generate differential diagnosis from findings
 */
function generateDifferentialFromFindings(findings: PathologyFinding[]): Array<{
  condition: string;
  likelihood: 'high' | 'moderate' | 'low';
  supportingFindings: string[];
}> {
  const differentials: Array<{
    condition: string;
    likelihood: 'high' | 'moderate' | 'low';
    supportingFindings: string[];
  }> = [];

  // Group findings by type
  const findingsByType = findings.reduce((acc, finding) => {
    if (!acc[finding.type]) acc[finding.type] = [];
    acc[finding.type].push(finding);
    return acc;
  }, {} as Record<string, PathologyFinding[]>);

  // Generate differentials based on finding patterns
  Object.entries(findingsByType).forEach(([type, typeFindings]) => {
    const condition = generateConditionFromType(type);
    const likelihood = typeFindings.some(f => f.severity === 'critical') 
      ? 'high' 
      : typeFindings.some(f => f.severity === 'moderate') 
      ? 'moderate' 
      : 'low';
    
    differentials.push({
      condition,
      likelihood,
      supportingFindings: typeFindings.map(f => f.description),
    });
  });

  return differentials;
}

/**
 * Generate condition name from pathology type
 */
function generateConditionFromType(type: string): string {
  const conditionMap: Record<string, string> = {
    'pneumothorax': 'Pneumothorax',
    'pleural-effusion': 'Pleural Effusion',
    'consolidation': 'Pneumonia or Consolidative Process',
    'atelectasis': 'Atelectasis',
    'cardiomegaly': 'Cardiomegaly / Heart Failure',
    'fracture': 'Fracture',
    'mass': 'Mass / Neoplasm',
    'nodule': 'Pulmonary Nodule',
    'edema': 'Pulmonary Edema',
    'pneumonia': 'Pneumonia',
    'hemorrhage': 'Hemorrhage',
    'tumor': 'Tumor / Neoplasm',
  };

  return conditionMap[type] || 'Abnormal Finding';
}
