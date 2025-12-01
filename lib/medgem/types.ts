/**
 * Type definitions for MedGem medical imaging analysis
 */

export type ImageModality = 
  | 'chest-xray'
  | 'ct-chest'
  | 'ct-head'
  | 'ct-abdomen'
  | 'mri-brain'
  | 'mri-spine'
  | 'ultrasound'
  | 'pathology-slide'
  | 'other';

export type SeverityLevel = 'critical' | 'moderate' | 'mild' | 'normal';

export type PathologyType =
  // Chest X-ray pathologies
  | 'pneumothorax'
  | 'pleural-effusion'
  | 'consolidation'
  | 'atelectasis'
  | 'cardiomegaly'
  | 'fracture'
  | 'mass'
  | 'nodule'
  | 'edema'
  | 'pneumonia'
  | 'device'
  // CT/MRI pathologies
  | 'hemorrhage'
  | 'tumor'
  | 'laceration'
  | 'vascular-abnormality'
  | 'lymphadenopathy'
  | 'lesion'
  | 'compression'
  | 'malformation'
  // General
  | 'other';

/**
 * Bounding box coordinates (0-1000 normalized scale)
 */
export interface BoundingBox {
  ymin: number; // Top edge (0 = top, 1000 = bottom)
  xmin: number; // Left edge (0 = left, 1000 = right)
  ymax: number; // Bottom edge
  xmax: number; // Right edge
  label: string; // Short label for the finding
  confidence?: number; // 0-1 confidence score (optional)
}

/**
 * A single pathology finding from image analysis
 */
export interface PathologyFinding {
  id: string; // Unique identifier
  type: PathologyType;
  description: string; // Detailed clinical description
  severity: SeverityLevel;
  location: string; // Anatomical location (e.g., "right upper lobe")
  boundingBox: BoundingBox;
  confidence: number; // 0-1 confidence score
  clinicalSignificance: string; // Why this matters clinically
  differentialDiagnosis?: string[]; // Possible alternative diagnoses
}

/**
 * Patient context for more accurate analysis
 */
export interface PatientContext {
  age?: number;
  sex?: 'male' | 'female' | 'other';
  symptoms?: string[]; // e.g., ['chest pain', 'shortness of breath']
  history?: string[]; // e.g., ['smoker', 'hypertension', 'diabetes']
  medications?: string[];
  priorImaging?: string; // Description of previous imaging
  clinicalQuestion?: string; // Specific question from ordering physician
}

/**
 * Input for medical image analysis
 */
export interface MedicalImageInput {
  imageBase64: string; // Base64 encoded image
  mimeType?: string; // e.g., 'image/jpeg', 'image/png'
  imageType: ImageModality;
  patientContext?: PatientContext;
  comparisonImages?: string[]; // Base64 of previous images for temporal analysis
}

/**
 * Complete analysis result
 */
export interface MedicalImageAnalysis {
  // Core findings
  findings: PathologyFinding[];
  
  // Overall assessment
  overallImpression: string;
  criticalFindings: PathologyFinding[]; // Urgent findings requiring immediate attention
  
  // Clinical recommendations
  recommendations: {
    immediateActions?: string[]; // Urgent actions needed
    followUp?: string[]; // Follow-up imaging or tests
    clinicalCorrelation?: string[]; // What to correlate with clinically
    specialistConsult?: string[]; // Which specialists to involve
  };
  
  // Differential diagnosis
  differentialDiagnosis: {
    condition: string;
    likelihood: 'high' | 'moderate' | 'low';
    supportingFindings: string[];
  }[];
  
  // Technical quality
  imageQuality: {
    overall: 'excellent' | 'good' | 'adequate' | 'poor';
    issues?: string[]; // e.g., ['motion artifact', 'underexposed']
    positioning?: string; // e.g., 'adequate', 'rotated'
  };
  
  // Metadata
  metadata: {
    modelUsed: 'gemini-2.5-flash' | 'medgem' | 'med-palm';
    processingTime: number; // milliseconds
    timestamp: string;
    confidence: number; // Overall confidence 0-1
  };
  
  // Structured report (for display)
  structuredReport: {
    tldr: string[];
    clinicalContext: string;
    findings: string;
    impression: string;
    recommendations: string;
  };
}

/**
 * Batch analysis input
 */
export interface BatchAnalysisInput {
  images: MedicalImageInput[];
  compareAcrossImages?: boolean; // Enable temporal/comparison analysis
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  individualResults: MedicalImageAnalysis[];
  comparisonAnalysis?: {
    changes: string[]; // Changes observed across images
    progression: 'improved' | 'stable' | 'worsened' | 'new-findings';
    summary: string;
  };
  metadata: {
    totalProcessingTime: number;
    timestamp: string;
  };
}

/**
 * Configuration for MedGem analyzer
 */
export interface MedGemConfig {
  // Model selection
  useVertexAI?: boolean; // Use Vertex AI MedGem if available
  fallbackToGemini?: boolean; // Fallback to Gemini if MedGem unavailable
  
  // Analysis parameters
  confidenceThreshold?: number; // Minimum confidence to report (0-1)
  maxFindings?: number; // Maximum findings to return
  includeLowConfidence?: boolean; // Include low-confidence findings
  
  // Output preferences
  generateReport?: boolean; // Generate structured report
  includeBoundingBoxes?: boolean; // Include bounding box coordinates
  includeVisualization?: boolean; // Generate annotated image
  
  // Clinical context
  prioritizeCritical?: boolean; // Prioritize critical findings
  includeRecommendations?: boolean; // Include clinical recommendations
}

/**
 * Error types for medical imaging analysis
 */
export class MedicalImagingError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_IMAGE' | 'PROCESSING_FAILED' | 'API_ERROR' | 'UNSUPPORTED_MODALITY',
    public details?: any
  ) {
    super(message);
    this.name = 'MedicalImagingError';
  }
}
