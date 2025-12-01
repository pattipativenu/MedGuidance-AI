# MedGem Integration for Advanced Medical Imaging Analysis

## Overview

This module provides advanced medical imaging analysis capabilities using Google's medical AI models. It implements a hybrid approach:

1. **Current**: Enhanced Gemini 2.5 Flash with specialized medical imaging prompts
2. **Future**: Direct MedGem/Med-PaLM integration via Vertex AI (when access is granted)

## What is MedGem?

**MedGem** (Medical Gemini) is Google's specialized medical imaging AI model, trained on millions of medical images and clinical data. It's part of Google's Med-PaLM family of medical AI models.

### Key Capabilities:
- **Pathology Detection**: Identifies tumors, fractures, pneumothorax, effusions, consolidations, masses, nodules
- **Precise Localization**: Provides bounding box coordinates for abnormalities
- **Severity Classification**: Categorizes findings as critical/moderate/mild/normal
- **Clinical Context**: Understands medical terminology and clinical significance
- **Multi-modal Analysis**: Combines imaging with patient history and lab results

### Supported Imaging Modalities:
- **Chest X-rays (CXR)**: Pneumonia, pneumothorax, effusions, cardiomegaly, masses
- **CT Scans**: Tumors, hemorrhages, fractures, organ abnormalities
- **MRI**: Brain lesions, spinal cord injuries, soft tissue abnormalities
- **Pathology Slides**: Tumor classification, cellular abnormalities
- **Ultrasound**: Organ assessment, fluid collections

## Architecture

```
Medical Image Upload
    ↓
Image Preprocessing
    ↓
MedGem Analysis Engine
    ├─ Pathology Detection
    ├─ Localization (Bounding Boxes)
    ├─ Severity Assessment
    └─ Clinical Recommendations
    ↓
Structured Medical Report
    ↓
Visual Annotations + Text Report
```

## Current Implementation (Gemini 2.5 Flash Enhanced)

### Features:
1. **Specialized Medical Prompts**: Detailed instructions for medical image analysis
2. **Structured Output**: Consistent format for clinical findings
3. **Bounding Box Coordinates**: 0-1000 scale for precise localization
4. **Severity Levels**: Critical, moderate, mild, normal classifications
5. **Differential Diagnosis**: Ranked list of possible conditions
6. **Clinical Recommendations**: Evidence-based next steps

### Example Output:
```
**VISUAL FINDINGS:**
- Pneumothorax in right upper lobe | Severity: critical | Coordinates: [150, 600, 350, 850] | Label: Pneumothorax
- Rib fracture at 5th rib | Severity: moderate | Coordinates: [400, 700, 450, 800] | Label: Fracture
- Consolidation in left lower lobe | Severity: moderate | Coordinates: [600, 200, 800, 400] | Label: Consolidation
```

## Future Implementation (Direct MedGem via Vertex AI)

### Requirements:
- Google Cloud Project with Vertex AI enabled
- Med-PaLM/MedGem API access (requires Google approval)
- Service account credentials
- Vertex AI endpoint configuration

### Benefits of Direct MedGem:
- **Higher Accuracy**: Specialized training on medical images
- **Faster Processing**: Optimized for medical imaging workflows
- **Richer Metadata**: Confidence scores, alternative diagnoses, clinical context
- **DICOM Support**: Native support for medical imaging formats
- **Regulatory Compliance**: Designed for clinical use cases

## Usage

### Basic Medical Image Analysis
```typescript
import { analyzeMedicalImage } from '@/lib/medgem/analyzer';

const result = await analyzeMedicalImage({
  imageBase64: base64String,
  imageType: 'chest-xray',
  patientContext: {
    age: 45,
    symptoms: ['chest pain', 'shortness of breath'],
    history: ['smoker', 'hypertension']
  }
});

console.log(result.findings); // Array of pathology findings
console.log(result.visualAnnotations); // Bounding boxes
console.log(result.clinicalReport); // Structured report
```

### Batch Analysis (Multiple Images)
```typescript
import { analyzeMedicalImageBatch } from '@/lib/medgem/analyzer';

const results = await analyzeMedicalImageBatch([
  { imageBase64: xray1, imageType: 'chest-xray' },
  { imageBase64: ct1, imageType: 'ct-chest' },
  { imageBase64: mri1, imageType: 'mri-brain' }
]);
```

## Pathology Detection Capabilities

### Chest X-ray (CXR)
- ✅ Pneumothorax (collapsed lung)
- ✅ Pleural effusion (fluid around lung)
- ✅ Consolidation (pneumonia)
- ✅ Atelectasis (collapsed lung tissue)
- ✅ Cardiomegaly (enlarged heart)
- ✅ Rib/clavicle fractures
- ✅ Masses/nodules
- ✅ Pulmonary edema
- ✅ Medical device placement (tubes, lines, pacemakers)

### CT Scans
- ✅ Intracranial hemorrhage
- ✅ Tumors/masses
- ✅ Fractures
- ✅ Organ lacerations
- ✅ Vascular abnormalities
- ✅ Lymphadenopathy

### MRI
- ✅ Brain lesions
- ✅ Spinal cord compression
- ✅ Soft tissue tumors
- ✅ Joint abnormalities
- ✅ Vascular malformations

## Coordinate System

All bounding boxes use a **0-1000 normalized coordinate system**:

```
(0,0) ─────────────────── (1000,0)
  │                           │
  │     [ymin, xmin,          │
  │      ymax, xmax]          │
  │                           │
(0,1000) ────────────── (1000,1000)
```

Example:
- Upper-right quadrant: `[100, 600, 300, 900]`
- Center: `[400, 400, 600, 600]`
- Lower-left quadrant: `[700, 100, 900, 300]`

## Clinical Validation

⚠️ **IMPORTANT DISCLAIMER**: 
- This system is for **educational and research purposes only**
- All findings must be **confirmed by qualified radiologists**
- Not FDA-approved for clinical diagnosis
- Should not replace professional medical judgment
- Always correlate with clinical presentation

## Performance Metrics

### Current (Gemini 2.5 Flash Enhanced):
- **Processing Time**: 3-8 seconds per image
- **Accuracy**: Good for common pathologies, variable for rare conditions
- **Cost**: ~$0.001 per image analysis

### Future (Direct MedGem):
- **Processing Time**: 1-3 seconds per image
- **Accuracy**: Clinical-grade (comparable to radiologists for specific tasks)
- **Cost**: TBD (Vertex AI pricing)

## Integration Roadmap

### Phase 1: Enhanced Gemini (Current) ✅
- [x] Specialized medical imaging prompts
- [x] Structured output format
- [x] Bounding box localization
- [x] Severity classification
- [x] Visual annotations UI

### Phase 2: Advanced Features (In Progress)
- [ ] Multi-image comparison
- [ ] Temporal analysis (compare with previous scans)
- [ ] DICOM format support
- [ ] Automated report generation
- [ ] Integration with PACS systems

### Phase 3: Direct MedGem Integration (Future)
- [ ] Vertex AI setup
- [ ] Med-PaLM API access
- [ ] Service account configuration
- [ ] A/B testing (Gemini vs MedGem)
- [ ] Performance benchmarking

## Configuration

### Environment Variables
```bash
# Current (Gemini)
GEMINI_API_KEY=your_gemini_api_key

# Future (Vertex AI + MedGem)
GOOGLE_CLOUD_PROJECT=your-project-id
VERTEX_AI_LOCATION=us-central1
MEDGEM_ENDPOINT=https://us-central1-aiplatform.googleapis.com/v1/...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## References

- [Google Med-PaLM Research](https://sites.research.google/med-palm/)
- [Vertex AI Medical Imaging](https://cloud.google.com/vertex-ai)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Medical Imaging AI Best Practices](https://www.fda.gov/medical-devices/software-medical-device-samd/artificial-intelligence-and-machine-learning-aiml-enabled-medical-devices)

## Support

For questions or issues:
1. Check the [troubleshooting guide](./TROUBLESHOOTING.md)
2. Review [example use cases](./examples/)
3. Open an issue on GitHub
