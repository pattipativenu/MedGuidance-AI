/**
 * Radiology Triage API Route
 * 
 * Server-side endpoint for analyzing chest X-rays using Gemini 2.5 Flash.
 * This provides an alternative to client-side processing for:
 * - Better security (API keys stay server-side)
 * - Larger file handling
 * - Consistent processing environment
 */

import { NextRequest, NextResponse } from "next/server";
import { getGeminiVisionModel } from "@/lib/gemini";

// Radiology analysis prompt
const RADIOLOGY_TRIAGE_PROMPT = `You are an Expert Thoracic Radiologist AI performing automated triage analysis.

## ROLE
You are analyzing chest X-ray images to detect complex thoracic pathologies using systematic chain-of-thought reasoning.

## TASK
Analyze the provided chest X-ray image(s) following this exact protocol:

### PHASE 1: INITIALIZATION
- Identify image type (PA, AP, Lateral)
- Assess image quality and exposure
- Note any technical limitations

### PHASE 2: ANATOMICAL LANDMARKS
Identify and verify:
- Trachea position (midline or deviated)
- Carina location
- Both hemidiaphragms
- Cardiac silhouette
- Mediastinal borders
- Costophrenic angles

### PHASE 3: SYSTEMATIC ANALYSIS
For each lung zone (RUL, RML, RLL, LUL, Lingula, LLL):
1. Assess lung parenchyma density
2. Check for opacities, masses, or nodules
3. Evaluate vascular markings
4. Look for volume loss signs

### PHASE 4: SPECIFIC PATHOLOGY CHECKS
Evaluate for these specific signs:

**Golden's S Sign (RUL Collapse + Hilar Mass):**
- Dense opacity in right upper zone
- Horizontal fissure with "S" shape (concave lateral, convex medial)
- Tracheal deviation to the right
- Elevated right hemidiaphragm
- Compensatory hyperlucency in lower zones

**Other Critical Findings:**
- Pneumothorax (absent lung markings, visible pleural line)
- Tension pneumothorax (mediastinal shift away from affected side)
- Large pleural effusion (meniscus sign, costophrenic angle blunting)
- Cardiomegaly (cardiothoracic ratio > 0.5)
- Widened mediastinum (>8cm at aortic knob level)
- Pulmonary edema (bat-wing pattern, Kerley B lines)

### PHASE 5: CORRELATION
If multiple views provided:
- Correlate findings between PA and Lateral views
- Confirm location of abnormalities
- Assess depth/extent of lesions

## OUTPUT FORMAT
Respond with a valid JSON object (no markdown, no code blocks):

{
  "chainOfThought": [
    {
      "step": 1,
      "phase": "initialization",
      "message": "Initializing vision encoder...",
      "status": "complete"
    }
  ],
  "findings": [
    {
      "id": "finding_1",
      "type": "opacity",
      "location": {
        "zone": "RUL",
        "side": "right",
        "description": "Right upper lobe"
      },
      "description": "Dense opacity obscuring right upper mediastinal border",
      "severity": "critical",
      "confidence": 0.95,
      "boundingBox": {
        "xmin": 100,
        "ymin": 50,
        "xmax": 400,
        "ymax": 350,
        "label": "RUL Opacity"
      }
    }
  ],
  "report": {
    "primaryFinding": "Right Upper Lobe Collapse",
    "etiology": "Hilar Mass (Golden's S Sign)",
    "confidence": 0.992,
    "urgency": "emergent",
    "recommendations": [
      "Urgent CT chest with contrast",
      "Bronchoscopy for tissue diagnosis"
    ],
    "differentialDiagnosis": [
      "Central bronchogenic carcinoma",
      "Lymphoma with hilar involvement"
    ],
    "clinicalNotes": "Note hyperlucency of lower zones indicating compensatory hyperexpansion."
  },
  "viewType": "PA",
  "imageQuality": "diagnostic"
}

## IMPORTANT RULES
1. Always provide bounding boxes for significant findings (0-1000 scale)
2. Be specific about anatomical locations
3. Include confidence scores for all findings
4. Chain of thought should show your reasoning process
5. If no abnormalities found, report as "normal" with appropriate confidence
6. Always consider clinical urgency for triage purposes`;

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const formData = await request.formData();
    const files = formData.getAll("images") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    // Convert files to base64
    const imageParts: any[] = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      
      imageParts.push({
        inlineData: {
          mimeType: file.type || "image/png",
          data: base64,
        },
      });
    }

    // Call Gemini
    const model = getGeminiVisionModel();
    const result = await model.generateContent([
      RADIOLOGY_TRIAGE_PROMPT,
      ...imageParts,
    ]);

    const responseText = result.response.text();
    
    // Parse JSON response
    let parsedResponse: any;
    try {
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.slice(7);
      }
      if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.slice(3);
      }
      if (cleanedResponse.endsWith("```")) {
        cleanedResponse = cleanedResponse.slice(0, -3);
      }
      
      parsedResponse = JSON.parse(cleanedResponse.trim());
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      return NextResponse.json(
        { error: "Failed to parse AI response", rawResponse: responseText },
        { status: 500 }
      );
    }

    const processingTimeMs = performance.now() - startTime;
    const analysisId = `triage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build response
    const triageResult = {
      analysisId,
      timestamp: new Date().toISOString(),
      processingTimeMs,
      chainOfThought: (parsedResponse.chainOfThought || []).map(
        (step: any, index: number) => ({
          ...step,
          timestamp: Math.round((processingTimeMs / (parsedResponse.chainOfThought?.length || 1)) * (index + 1)),
        })
      ),
      findings: parsedResponse.findings || [],
      report: parsedResponse.report || {
        primaryFinding: "Analysis incomplete",
        etiology: "Unknown",
        confidence: 0,
        urgency: "routine",
        recommendations: ["Manual review required"],
        differentialDiagnosis: [],
        clinicalNotes: "Automated analysis could not be completed.",
      },
      viewType: parsedResponse.viewType || "Unknown",
      imageQuality: parsedResponse.imageQuality || "Unknown",
    };

    return NextResponse.json(triageResult);
    
  } catch (error: any) {
    console.error("Radiology triage error:", error);
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "radiology-triage",
    model: "gemini-2.5-flash",
    capabilities: [
      "chest-xray-analysis",
      "golden-s-sign-detection",
      "pneumothorax-detection",
      "cardiomegaly-assessment",
      "chain-of-thought-reasoning"
    ]
  });
}
