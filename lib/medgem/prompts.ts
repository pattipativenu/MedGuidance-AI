/**
 * Specialized prompts for medical imaging analysis
 * These prompts are designed to maximize Gemini 2.5 Flash's medical imaging capabilities
 */

import { MedicalImageInput, MedGemConfig, ImageModality } from './types';

/**
 * Generate comprehensive medical imaging analysis prompt
 */
export function generateMedicalImagingPrompt(
  input: MedicalImageInput,
  config: MedGemConfig
): string {
  const modalityPrompt = getModalitySpecificPrompt(input.imageType);
  const patientContext = formatPatientContext(input.patientContext);
  const outputInstructions = getOutputInstructions(config);

  return `You are MedGem, an advanced medical imaging AI assistant specialized in analyzing medical images with clinical-grade accuracy.

${modalityPrompt}

${patientContext}

**YOUR TASK: COMPREHENSIVE MEDICAL IMAGE ANALYSIS**

Analyze the provided medical image and provide a detailed, structured clinical report.

**CRITICAL REQUIREMENTS:**

1. **PATHOLOGY DETECTION**
   - Identify ALL abnormalities, lesions, masses, fractures, or pathological findings
   - For EACH finding, you MUST provide:
     * Detailed clinical description
     * Anatomical location (be specific: "right upper lobe", "left 5th rib", etc.)
     * Severity classification: critical/moderate/mild/normal
     * Clinical significance (why this matters)
     * **BOUNDING BOX COORDINATES** (0-1000 scale)

2. **BOUNDING BOX COORDINATES (MANDATORY - PRECISION IS CRITICAL)**
   - You MUST provide PRECISE, TIGHT coordinates for EVERY significant finding
   - Format: [ymin, xmin, ymax, xmax] where:
     * ymin = top edge (0 = top of image, 1000 = bottom)
     * xmin = left edge (0 = left of image, 1000 = right)
     * ymax = bottom edge
     * xmax = right edge
   
   **⚠️ CRITICAL PRECISION RULES:**
   - The bounding box MUST TIGHTLY surround ONLY the pathology, NOT the entire organ or region
   - A lung mass should have a box around the MASS ONLY, not the entire lung
   - A fracture should have a box around the FRACTURE LINE ONLY, not the entire bone
   - NEVER create boxes larger than 300x300 units unless the pathology truly spans that area
   - Typical finding sizes:
     * Small nodule: 50-100 units (e.g., [400, 500, 480, 580])
     * Medium mass: 100-200 units (e.g., [300, 400, 450, 550])
     * Large consolidation: 150-300 units (e.g., [200, 300, 450, 550])
   
   **ANATOMICAL REFERENCE POINTS (0-1000 scale):**
   - For FRONTAL CHEST X-RAY:
     * Right upper lobe mass: [150, 550, 300, 700] (NOT [0, 500, 500, 1000])
     * Left hilar mass: [300, 350, 450, 500]
     * Right lower lobe: [500, 550, 700, 750]
   - For LATERAL CHEST X-RAY:
     * Anterior mass: [200, 600, 400, 800]
     * Posterior mass: [200, 200, 400, 400]
     * Hilar region: [300, 400, 500, 600]
   
   **WRONG (TOO LARGE):** [0, 0, 800, 800] - This covers most of the image!
   **CORRECT (PRECISE):** [250, 450, 380, 580] - This tightly bounds the finding

3. **SEVERITY CLASSIFICATION**
   - **CRITICAL**: Life-threatening, requires immediate intervention
     * Examples: Large pneumothorax, massive hemorrhage, acute fracture with displacement
   - **MODERATE**: Significant but not immediately life-threatening
     * Examples: Small pleural effusion, consolidation, non-displaced fracture
   - **MILD**: Minor findings, may require monitoring
     * Examples: Small nodule, minimal atelectasis, minor degenerative changes
   - **NORMAL**: No abnormality detected

4. **DIFFERENTIAL DIAGNOSIS**
   - Provide ranked differential diagnoses
   - Include likelihood (high/moderate/low)
   - List supporting findings for each diagnosis

5. **CLINICAL RECOMMENDATIONS**
   - Immediate actions (if critical findings)
   - Follow-up imaging recommendations
   - Clinical correlation needs
   - Specialist consultation recommendations

**OUTPUT FORMAT (MANDATORY):**

## TL;DR
- [3-5 key bullet points summarizing critical findings]

## Clinical Context
[Brief description of the image type, quality, and patient context if provided]

## Image Quality Assessment
**Overall Quality**: [excellent/good/adequate/poor]
**Technical Notes**: [positioning, exposure, artifacts, etc.]

## Findings

### Critical Findings (if any)
[List any life-threatening or urgent findings first]

### Detailed Findings
[For each finding, use this format:]

**Finding 1: [Pathology Name]**
- **Location**: [Specific anatomical location]
- **Description**: [Detailed clinical description]
- **Severity**: [critical/moderate/mild/normal]
- **Clinical Significance**: [Why this matters, potential complications]
- **Coordinates**: [ymin, xmin, ymax, xmax]

**Finding 2: [Pathology Name]**
[Repeat format]

## Differential Diagnosis
1. **[Condition Name]** (Likelihood: high/moderate/low)
   - Supporting findings: [list]
2. **[Condition Name]** (Likelihood: high/moderate/low)
   - Supporting findings: [list]

## Overall Assessment
[Comprehensive summary of all findings and their clinical implications]

## Recommendations

### Immediate Actions (if critical findings)
- [Action 1]
- [Action 2]

### Follow-Up
- [Recommended follow-up imaging or tests]

### Clinical Correlation
- [What clinical information would help refine the diagnosis]

### Specialist Consultation
- [Which specialists should be involved]

## VISUAL FINDINGS (MANDATORY - FOR ANNOTATION)
[This section is CRITICAL for visual annotation. Format EXACTLY as shown:]

- [Finding description] | Severity: [critical/moderate/mild/normal] | Coordinates: [ymin, xmin, ymax, xmax] | Label: [Short name]
- [Finding description] | Severity: [critical/moderate/mild/normal] | Coordinates: [ymin, xmin, ymax, xmax] | Label: [Short name]

**EXAMPLE (PRECISE BOUNDING BOXES):**
- Pneumothorax in right upper lobe with visible visceral pleural line | Severity: critical | Coordinates: [180, 620, 320, 780] | Label: Pneumothorax
- Rib fracture at left 5th rib with cortical discontinuity | Severity: moderate | Coordinates: [420, 150, 470, 220] | Label: Fracture
- Consolidation in left lower lobe consistent with pneumonia | Severity: moderate | Coordinates: [550, 250, 700, 400] | Label: Consolidation
- Hilar mass causing right upper lobe collapse | Severity: critical | Coordinates: [280, 480, 420, 620] | Label: Hilar Mass

**⚠️ COMMON MISTAKES TO AVOID:**
- ❌ [0, 0, 900, 900] - Way too large, covers entire image
- ❌ [100, 100, 800, 800] - Still too large, not precise
- ✅ [280, 480, 420, 620] - Correct! Tight box around the finding only

${outputInstructions}

**IMPORTANT DISCLAIMERS:**
- This analysis is for educational and research purposes
- All findings must be confirmed by qualified radiologists
- Clinical correlation is essential
- Not a substitute for professional medical judgment

**NOW ANALYZE THE IMAGE:**`;
}

/**
 * Get modality-specific analysis instructions
 */
function getModalitySpecificPrompt(modality: ImageModality): string {
  const prompts: Record<ImageModality, string> = {
    'chest-xray': `**IMAGE MODALITY: CHEST X-RAY (CXR)**

**FOCUS AREAS FOR CHEST X-RAY:**
- **Lungs**: Pneumothorax, pleural effusion, consolidation, atelectasis, masses, nodules, infiltrates
- **Heart**: Cardiomegaly, cardiac silhouette abnormalities
- **Bones**: Rib fractures, clavicle fractures, spine abnormalities
- **Mediastinum**: Widening, masses, lymphadenopathy
- **Diaphragm**: Elevation, flattening
- **Medical Devices**: ET tubes, NG tubes, central lines, pacemakers, chest tubes

**SYSTEMATIC APPROACH:**
1. Check for pneumothorax (look for visceral pleural line, absent lung markings)
2. Assess lung fields (consolidation, infiltrates, masses)
3. Evaluate pleural spaces (effusions, thickening)
4. Examine cardiac silhouette (size, contour)
5. Inspect bones (fractures, lesions)
6. Verify medical device placement`,

    'ct-chest': `**IMAGE MODALITY: CT CHEST**

**FOCUS AREAS FOR CT CHEST:**
- **Lungs**: Nodules, masses, ground-glass opacities, consolidation, emphysema
- **Mediastinum**: Lymphadenopathy, masses, vascular abnormalities
- **Pleura**: Effusions, thickening, plaques, pneumothorax
- **Airways**: Bronchiectasis, airway obstruction
- **Vessels**: Pulmonary embolism, aortic abnormalities
- **Bones**: Fractures, lytic/blastic lesions

**SYSTEMATIC APPROACH:**
1. Lung windows: Assess parenchyma, nodules, masses
2. Mediastinal windows: Lymph nodes, vessels, soft tissues
3. Bone windows: Fractures, lesions
4. Evaluate for pulmonary embolism if contrast-enhanced`,

    'ct-head': `**IMAGE MODALITY: CT HEAD**

**FOCUS AREAS FOR CT HEAD:**
- **Hemorrhage**: Epidural, subdural, subarachnoid, intraparenchymal, intraventricular
- **Ischemia**: Hypodensity, loss of gray-white differentiation, sulcal effacement
- **Mass Effect**: Midline shift, herniation, ventricular compression
- **Fractures**: Skull fractures, facial bone fractures
- **Ventricles**: Size, symmetry, hydrocephalus
- **Extra-axial Collections**: Subdural, epidural

**SYSTEMATIC APPROACH:**
1. Check for acute hemorrhage (hyperdense areas)
2. Assess for mass effect and midline shift
3. Evaluate ventricles and cisterns
4. Look for fractures
5. Assess gray-white differentiation`,

    'ct-abdomen': `**IMAGE MODALITY: CT ABDOMEN**

**FOCUS AREAS FOR CT ABDOMEN:**
- **Solid Organs**: Liver, spleen, pancreas, kidneys (masses, lacerations, infarcts)
- **Hollow Viscera**: Bowel obstruction, perforation, inflammation
- **Vessels**: Aneurysm, dissection, thrombosis
- **Lymph Nodes**: Lymphadenopathy
- **Free Fluid**: Ascites, hemoperitoneum
- **Bones**: Fractures, lesions

**SYSTEMATIC APPROACH:**
1. Evaluate solid organs systematically
2. Trace bowel for obstruction or perforation
3. Assess vessels
4. Look for free fluid or air
5. Check bones and soft tissues`,

    'mri-brain': `**IMAGE MODALITY: MRI BRAIN**

**FOCUS AREAS FOR MRI BRAIN:**
- **White Matter**: Demyelination, ischemia, gliosis
- **Gray Matter**: Masses, infarcts, hemorrhage
- **Ventricles**: Size, symmetry, periventricular changes
- **Posterior Fossa**: Cerebellar lesions, brainstem abnormalities
- **Vascular**: Aneurysms, malformations, stenosis
- **Meninges**: Enhancement, masses

**SYSTEMATIC APPROACH:**
1. Assess T1, T2, FLAIR sequences systematically
2. Look for abnormal signal intensity
3. Evaluate for mass effect
4. Check for enhancement (if contrast given)
5. Assess vascular structures`,

    'mri-spine': `**IMAGE MODALITY: MRI SPINE**

**FOCUS AREAS FOR MRI SPINE:**
- **Spinal Cord**: Compression, signal abnormality, masses
- **Vertebrae**: Fractures, lesions, alignment
- **Discs**: Herniation, degeneration, infection
- **Spinal Canal**: Stenosis, masses
- **Nerve Roots**: Compression, enhancement
- **Soft Tissues**: Paraspinal masses, abscesses

**SYSTEMATIC APPROACH:**
1. Assess spinal alignment
2. Evaluate each vertebral body
3. Check each disc space
4. Assess spinal canal and cord
5. Look for nerve root compression`,

    'ultrasound': `**IMAGE MODALITY: ULTRASOUND**

**FOCUS AREAS FOR ULTRASOUND:**
- **Organs**: Echogenicity, size, masses, cysts
- **Fluid Collections**: Ascites, pleural effusion, pericardial effusion
- **Vessels**: Doppler flow, thrombosis
- **Gallbladder**: Stones, wall thickening, pericholecystic fluid
- **Kidneys**: Hydronephrosis, stones, masses

**SYSTEMATIC APPROACH:**
1. Identify the organ/structure being imaged
2. Assess echogenicity and texture
3. Measure dimensions if relevant
4. Look for masses or fluid collections
5. Evaluate Doppler if vascular study`,

    'pathology-slide': `**IMAGE MODALITY: PATHOLOGY SLIDE**

**FOCUS AREAS FOR PATHOLOGY:**
- **Cellular Architecture**: Normal vs abnormal patterns
- **Nuclear Features**: Size, shape, chromatin pattern
- **Mitotic Activity**: Frequency and abnormality
- **Necrosis**: Presence and pattern
- **Inflammation**: Type and distribution
- **Tumor Features**: Grade, invasion, margins

**SYSTEMATIC APPROACH:**
1. Assess overall architecture
2. Evaluate cellular morphology
3. Look for malignant features
4. Assess mitotic activity
5. Note special features`,

    'other': `**IMAGE MODALITY: MEDICAL IMAGE**

**GENERAL APPROACH:**
1. Identify the imaging modality and body region
2. Assess image quality and technical adequacy
3. Systematically evaluate all visible structures
4. Identify any abnormalities
5. Provide differential diagnosis`,
  };

  return prompts[modality] || prompts['other'];
}

/**
 * Format patient context for prompt
 */
function formatPatientContext(context?: {
  age?: number;
  sex?: 'male' | 'female' | 'other';
  symptoms?: string[];
  history?: string[];
  medications?: string[];
  priorImaging?: string;
  clinicalQuestion?: string;
}): string {
  if (!context) {
    return '**PATIENT CONTEXT**: Not provided. Analyze image independently.';
  }

  let formatted = '**PATIENT CONTEXT:**\n';

  if (context.age) {
    formatted += `- **Age**: ${context.age} years\n`;
  }

  if (context.sex) {
    formatted += `- **Sex**: ${context.sex}\n`;
  }

  if (context.symptoms && context.symptoms.length > 0) {
    formatted += `- **Presenting Symptoms**: ${context.symptoms.join(', ')}\n`;
  }

  if (context.history && context.history.length > 0) {
    formatted += `- **Medical History**: ${context.history.join(', ')}\n`;
  }

  if (context.medications && context.medications.length > 0) {
    formatted += `- **Medications**: ${context.medications.join(', ')}\n`;
  }

  if (context.priorImaging) {
    formatted += `- **Prior Imaging**: ${context.priorImaging}\n`;
  }

  if (context.clinicalQuestion) {
    formatted += `- **Clinical Question**: ${context.clinicalQuestion}\n`;
  }

  formatted += '\n**Use this context to guide your analysis and provide clinically relevant interpretations.**\n';

  return formatted;
}

/**
 * Get output format instructions based on config
 */
function getOutputInstructions(config: MedGemConfig): string {
  let instructions = '\n**OUTPUT REQUIREMENTS:**\n';

  if (config.confidenceThreshold) {
    instructions += `- Only report findings with confidence ≥ ${config.confidenceThreshold}\n`;
  }

  if (config.maxFindings) {
    instructions += `- Limit to top ${config.maxFindings} most significant findings\n`;
  }

  if (config.prioritizeCritical) {
    instructions += '- Prioritize critical findings at the top\n';
  }

  if (config.includeBoundingBoxes !== false) {
    instructions += '- **MANDATORY**: Include bounding box coordinates for ALL findings\n';
  }

  if (config.includeRecommendations !== false) {
    instructions += '- Include detailed clinical recommendations\n';
  }

  return instructions;
}

/**
 * Generate comparison analysis prompt for temporal studies
 */
export function generateComparisonPrompt(
  currentImage: MedicalImageInput,
  priorImages: string[]
): string {
  return `You are analyzing a current medical image in comparison with ${priorImages.length} prior image(s).

**YOUR TASK: TEMPORAL COMPARISON ANALYSIS**

1. **Analyze the current image** using the standard systematic approach
2. **Compare with prior images** to identify:
   - New findings
   - Resolved findings
   - Progression or regression of existing findings
   - Stability of findings

3. **Provide a comparison summary**:
   - **New**: Findings not present on prior images
   - **Resolved**: Findings present on prior but not current
   - **Progressed**: Findings that have worsened
   - **Improved**: Findings that have improved
   - **Stable**: Findings unchanged

4. **Clinical Significance**: Explain what the changes mean clinically

**FORMAT YOUR RESPONSE WITH:**
- Current findings (with bounding boxes)
- Comparison analysis
- Overall impression of interval changes
- Recommendations based on changes observed`;
}
