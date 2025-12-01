/**
 * Smart Model Router
 * 
 * Routes requests to the appropriate AI model based on content:
 * - MedGemma: Only for medical image analysis (X-rays, CT, MRI, etc.)
 * - Gemini: For all text queries and non-medical content
 * 
 * This saves significant costs by avoiding expensive MedGemma calls
 * when they're not needed.
 * 
 * MedGemma Endpoint: mg-endpoint-8bf59e1a-269d-45da-806c-7d03f6f29543
 */

import { isMedGemmaAvailable } from './medgem/vertex-ai-connector';

export type MedicalImageType = 
  | 'xray' 
  | 'ct' 
  | 'mri' 
  | 'ultrasound' 
  | 'mammogram'
  | 'pathology' 
  | 'dermatology'
  | 'ophthalmology'
  | 'dental'
  | 'unknown_medical'
  | 'none';

export interface RoutingDecision {
  model: 'medgemma' | 'gemini';
  reason: string;
  imageType: MedicalImageType;
  estimatedCost: number;
  confidence: number;
}

// Cost constants (approximate)
const COSTS = {
  MEDGEMMA_PER_IMAGE: 0.001,    // ~$0.001 per image
  GEMINI_PER_QUERY: 0.00001,    // ~$0.00001 per query
  GEMINI_WITH_IMAGE: 0.0001,   // ~$0.0001 per image (vision)
};

// Medical imaging keywords for detection
const MEDICAL_IMAGE_PATTERNS = {
  xray: [
    'xray', 'x-ray', 'x_ray', 'radiograph', 'cxr', 'chest x', 
    'pa view', 'ap view', 'lateral view', 'frontal view'
  ],
  ct: [
    'ct', 'ct scan', 'computed tomography', 'cat scan', 
    'contrast ct', 'hrct', 'ctpa'
  ],
  mri: [
    'mri', 'magnetic resonance', 'mr imaging', 't1 weighted', 
    't2 weighted', 'flair', 'dwi', 'adc'
  ],
  ultrasound: [
    'ultrasound', 'sonogram', 'sonography', 'echo', 'doppler',
    'us scan', 'ultrasonography'
  ],
  mammogram: [
    'mammogram', 'mammography', 'breast imaging', 'breast scan'
  ],
  pathology: [
    'pathology', 'histology', 'biopsy', 'cytology', 'microscopy',
    'h&e', 'hematoxylin', 'immunohistochemistry'
  ],
  dermatology: [
    'dermoscopy', 'skin lesion', 'mole', 'melanoma', 'dermatoscope'
  ],
  ophthalmology: [
    'fundus', 'retina', 'oct', 'optical coherence', 'eye scan'
  ],
  dental: [
    'dental xray', 'panoramic', 'periapical', 'bitewing', 'orthopantomogram'
  ],
};

// DICOM and medical file extensions
const MEDICAL_FILE_EXTENSIONS = [
  '.dcm', '.dicom', '.nii', '.nii.gz', // DICOM and NIfTI
  '.ima', '.img', // Raw medical formats
];

/**
 * Detect if a file is a medical image based on filename and type
 */
export function detectMedicalImageType(file: File): MedicalImageType {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  
  // Check for medical file extensions (high confidence)
  for (const ext of MEDICAL_FILE_EXTENSIONS) {
    if (fileName.endsWith(ext)) {
      return 'unknown_medical';
    }
  }
  
  // Check filename against medical patterns
  for (const [type, patterns] of Object.entries(MEDICAL_IMAGE_PATTERNS)) {
    for (const pattern of patterns) {
      if (fileName.includes(pattern.replace(/\s+/g, '')) || 
          fileName.includes(pattern.replace(/\s+/g, '_')) ||
          fileName.includes(pattern.replace(/\s+/g, '-'))) {
        return type as MedicalImageType;
      }
    }
  }
  
  // If it's an image but we can't determine type, check if it looks medical
  if (mimeType.startsWith('image/')) {
    // Common medical image naming patterns
    const medicalPatterns = [
      /^img\d+/i,           // IMG001, img_001
      /^dcm/i,              // DCM files
      /^\d{8}/,             // Date-based naming (YYYYMMDD)
      /patient/i,           // Contains "patient"
      /study/i,             // Contains "study"
      /series/i,            // Contains "series"
      /scan/i,              // Contains "scan"
    ];
    
    for (const pattern of medicalPatterns) {
      if (pattern.test(fileName)) {
        return 'unknown_medical';
      }
    }
  }
  
  return 'none';
}

/**
 * Analyze query text for medical imaging context
 */
export function analyzeQueryForMedicalImaging(query: string): {
  mentionsImaging: boolean;
  imageTypes: MedicalImageType[];
  confidence: number;
} {
  const queryLower = query.toLowerCase();
  const detectedTypes: MedicalImageType[] = [];
  
  for (const [type, patterns] of Object.entries(MEDICAL_IMAGE_PATTERNS)) {
    for (const pattern of patterns) {
      if (queryLower.includes(pattern)) {
        if (!detectedTypes.includes(type as MedicalImageType)) {
          detectedTypes.push(type as MedicalImageType);
        }
        break;
      }
    }
  }
  
  // Additional imaging-related keywords
  const generalImagingKeywords = [
    'image', 'scan', 'radiologist', 'radiology', 'imaging',
    'findings', 'opacity', 'lesion', 'mass', 'nodule',
    'fracture', 'consolidation', 'effusion'
  ];
  
  const mentionsGeneral = generalImagingKeywords.some(kw => queryLower.includes(kw));
  
  return {
    mentionsImaging: detectedTypes.length > 0 || mentionsGeneral,
    imageTypes: detectedTypes,
    confidence: detectedTypes.length > 0 ? 0.9 : (mentionsGeneral ? 0.5 : 0.1),
  };
}

/**
 * Main routing function - determines which model to use
 */
export async function routeToModel(
  query: string,
  files: File[] = []
): Promise<RoutingDecision> {
  // Check daily limits
  const dailyLimit = parseInt(process.env.MEDGEMMA_DAILY_LIMIT || '0');
  const currentCount = getMedGemmaCallCount();
  
  if (dailyLimit > 0 && currentCount >= dailyLimit) {
    console.log(`⚠️ MedGemma daily limit reached (${currentCount}/${dailyLimit})`);
    return {
      model: 'gemini',
      reason: `MedGemma daily limit reached (${dailyLimit}). Using Gemini as fallback.`,
      imageType: 'none',
      estimatedCost: files.length > 0 ? COSTS.GEMINI_WITH_IMAGE * files.length : COSTS.GEMINI_PER_QUERY,
      confidence: 1.0,
    };
  }
  
  // Detect medical images in uploaded files
  const medicalImages: { file: File; type: MedicalImageType }[] = [];
  
  for (const file of files) {
    const imageType = detectMedicalImageType(file);
    if (imageType !== 'none') {
      medicalImages.push({ file, type: imageType });
    }
  }
  
  // If medical images detected, use MedGemma
  if (medicalImages.length > 0) {
    const primaryType = medicalImages[0].type;
    const fileNames = medicalImages.map(m => m.file.name).join(', ');
    
    console.log(`🏥 Medical image detected: ${primaryType} (${fileNames})`);
    
    return {
      model: 'medgemma',
      reason: `Medical image detected: ${fileNames}`,
      imageType: primaryType,
      estimatedCost: COSTS.MEDGEMMA_PER_IMAGE * medicalImages.length,
      confidence: 0.95,
    };
  }
  
  // Analyze query for medical imaging context
  const queryAnalysis = analyzeQueryForMedicalImaging(query);
  
  // If query mentions imaging AND has image files, use MedGemma
  if (queryAnalysis.mentionsImaging && files.length > 0 && queryAnalysis.confidence > 0.7) {
    console.log(`🏥 Query mentions medical imaging with files attached`);
    
    return {
      model: 'medgemma',
      reason: 'Query mentions medical imaging and files are attached',
      imageType: queryAnalysis.imageTypes[0] || 'unknown_medical',
      estimatedCost: COSTS.MEDGEMMA_PER_IMAGE * files.length,
      confidence: queryAnalysis.confidence,
    };
  }
  
  // Default: Use Gemini (much cheaper)
  const hasImages = files.some(f => f.type.startsWith('image/'));
  
  console.log(`💰 Using cost-effective Gemini (no medical images detected)`);
  
  return {
    model: 'gemini',
    reason: 'No medical images detected - using cost-effective Gemini',
    imageType: 'none',
    estimatedCost: hasImages ? COSTS.GEMINI_WITH_IMAGE * files.length : COSTS.GEMINI_PER_QUERY,
    confidence: 1.0 - queryAnalysis.confidence,
  };
}

/**
 * Check if MedGemma should be used (quick check)
 */
export function shouldUseMedGemma(files: File[]): boolean {
  // First check if MedGemma is available
  if (!isMedGemmaAvailable()) {
    console.log('⚠️ MedGemma not available, using Gemini');
    return false;
  }
  
  if (!process.env.ENABLE_SMART_ROUTING || process.env.ENABLE_SMART_ROUTING === 'true') {
    // Smart routing enabled - check for medical images
    const hasMedicalImages = files.some(f => detectMedicalImageType(f) !== 'none');
    if (hasMedicalImages) {
      console.log('🏥 Medical images detected, routing to MedGemma');
    }
    return hasMedicalImages;
  }
  
  // Smart routing disabled - always use MedGemma for images
  return files.some(f => f.type.startsWith('image/'));
}

/**
 * Check if MedGemma endpoint is configured and available
 */
export function checkMedGemmaStatus(): {
  available: boolean;
  endpoint: string | null;
  reason: string;
} {
  const available = isMedGemmaAvailable();
  const endpoint = process.env.MEDGEMMA_ENDPOINT || process.env.MEDGEMMA_MODEL_ID || null;
  
  if (!available) {
    return {
      available: false,
      endpoint: null,
      reason: 'MedGemma endpoint not configured. Set MEDGEMMA_ENDPOINT or MEDGEMMA_MODEL_ID.',
    };
  }
  
  return {
    available: true,
    endpoint,
    reason: 'MedGemma is configured and ready.',
  };
}

// Simple in-memory counter (use Redis/DB in production)
let medgemmaCallCount = 0;
let lastResetDate = new Date().toDateString();

function getMedGemmaCallCount(): number {
  // Reset daily
  if (lastResetDate !== new Date().toDateString()) {
    medgemmaCallCount = 0;
    lastResetDate = new Date().toDateString();
  }
  return medgemmaCallCount;
}

export function incrementMedGemmaCallCount(): void {
  if (lastResetDate !== new Date().toDateString()) {
    medgemmaCallCount = 0;
    lastResetDate = new Date().toDateString();
  }
  medgemmaCallCount++;
  console.log(`📊 MedGemma calls today: ${medgemmaCallCount}`);
}

/**
 * Calculate estimated monthly cost
 */
export function calculateMonthlyCost(
  totalQueries: number,
  medicalImageQueries: number,
  useScaleToZero: boolean = true
): {
  medgemmaEndpoint: number;
  medgemmaInference: number;
  geminiQueries: number;
  total: number;
  savings: number;
} {
  const MEDGEMMA_ENDPOINT_HOURLY = 0.85;
  
  const textQueries = totalQueries - medicalImageQueries;
  
  let endpointCost = 0;
  if (!useScaleToZero) {
    endpointCost = MEDGEMMA_ENDPOINT_HOURLY * 24 * 30;
  } else {
    const activeHoursPerDay = Math.min(8, (medicalImageQueries / 30) * 0.5);
    endpointCost = MEDGEMMA_ENDPOINT_HOURLY * activeHoursPerDay * 30;
  }
  
  const inferencesCost = medicalImageQueries * COSTS.MEDGEMMA_PER_IMAGE;
  const geminiCost = textQueries * COSTS.GEMINI_PER_QUERY;
  
  const total = endpointCost + inferencesCost + geminiCost;
  
  const allMedGemmaCost = (MEDGEMMA_ENDPOINT_HOURLY * 24 * 30) + 
                          (totalQueries * COSTS.MEDGEMMA_PER_IMAGE);
  const savings = allMedGemmaCost - total;
  
  return {
    medgemmaEndpoint: endpointCost,
    medgemmaInference: inferencesCost,
    geminiQueries: geminiCost,
    total,
    savings,
  };
}
