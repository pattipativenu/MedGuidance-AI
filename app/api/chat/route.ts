import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel, getGeminiVisionModel, getGeminiWithSearch, genAIClient } from "@/lib/gemini";
import { getAnchorGuidelines, formatAnchorGuidelinesForPrompt } from "@/lib/evidence/guideline-anchors";
import { checkDrugInteractions, formatInteractionResults } from "@/lib/drug-interactions";
// Removed: fetchMedicalImages from medical-images.ts (file deleted - using medical-image-retriever.ts)
import { analyzeClinicalContext, needsClinicalDecisionSupport } from "@/lib/clinical-decision-support";
import { getDoctorModePromptSimplified } from "@/lib/prompts/doctor-mode-prompt-simplified";
import { getGeneralModePrompt } from "@/lib/prompts/general-mode-prompt";
import {
  extractDrugNames,
  processUploadedFiles,
  hasSelfHarmIntent,
  getCrisisResponse
} from "@/lib/api/chat-helpers";
import {
  analyzeQueryWithIntent,
  getIntentBasedEvidenceConfig,
  logIntentRouting,
  validateIntentRouting
} from "@/lib/evidence/intent-router";
import {
  generateIntentBasedPromptEnhancement
} from "@/lib/evidence/response-enhancer";
import type { Tool, GenerateContentConfig } from "@google/genai";
// CXR Foundation integration disabled - requires special Vertex AI access
// import { analyzeCXR, formatCXRFindingsForPrompt } from "@/lib/cxr-foundation";

/**
 * Authoritative Medical Textbooks & Guidelines Library
 * This comprehensive library grounds the AI in evidence-based medical sources
 */
const AUTHORITATIVE_BOOKS = `
**General & Internal Medicine (Advanced)**:
- Harrison's Principles of Internal Medicine (Full, multi-volume sets)
- Oxford Textbook of Medicine
- Cecil's Textbook of Medicine (research-focused)
- Goldman's Cecil Medicine
- Principles and Practice of Infectious Diseases (Mandell, Douglas, Bennett)
- Sleisenger and Fordtran's Gastrointestinal and Liver Disease

**Endocrinology & Diabetes (Primary Focus for Metabolic)**:
- **American Diabetes Association Standards of Care (diabetesjournals.org)**
- Williams Textbook of Endocrinology
- Joslin's Diabetes Mellitus

**Subspecialty/Organ-System References (Ph.D./Clinician-Research Level)**:
- Kelley and Firestein's Textbook of Rheumatology
- Braunwald's Heart Disease: A Textbook of Cardiovascular Medicine
- DeVita, Hellman, and Rosenberg's Cancer: Principles & Practice of Oncology
- Brenner and Rector's The Kidney (Nephrology)
- Fitzpatrick's Dermatology (multi-volume)
- Rook's Textbook of Dermatology (4-volume set)
- Murray & Nadel's Textbook of Respiratory Medicine

**Pathology/Biomedical Science**:
- Robbins & Cotran Pathologic Basis of Disease (professional edition)
- Sternberg's Diagnostic Surgical Pathology

**Neuroscience (Ph.D.-Level & Clinical)**:
- Principles of Neural Science (Kandel, Schwartz & Jessell)—the neuroscience "bible"
- Fundamental Neuroscience (Squire et al.)
- The Synaptic Organization of the Brain (Shepherd)
- Ion Channels of Excitable Membranes (Bertil Hille)
- Behavioral Neurobiology (Zupanc)
- Research Methods for Cognitive Neuroscience (Aaron Newman)
- Netter's Atlas of Neuroscience
- Brain's Diseases of the Nervous System
- Adams and Victor's Principles of Neurology
- Progress in Brain Research (serial)

**Immunology/Microbiology/Genetics**:
- Janeway's Immunobiology (Garland Science)
- Abbas: Cellular and Molecular Immunology (professional/advanced editions)
- Clinical Microbiology and Infectious Diseases (Greenwood)
- Thompson & Thompson Genetics in Medicine
- Principles of Medical Biochemistry (Meisenberg & Simmons)

**Pharmacology/Therapeutics**:
- Goodman & Gilman's The Pharmacological Basis of Therapeutics

**Surgery & Surgical Sciences**:
- Sabiston Textbook of Surgery
- Schwartz's Principles of Surgery
- Campbell's Operative Orthopaedics
- Greenfield's Surgery: Scientific Principles & Practice

**Specialized Research**:
- The Handbook of Clinical Neurology (series)
- Annual Review of Medicine (journal series)
- Comprehensive Physiology
- Molecular Biology of the Cell (Alberts)
- Kaplan and Sadock's Comprehensive Textbook of Psychiatry

**Instructions**: When providing medical advice, reference these authoritative sources. Cite specific guidelines, chapters, or recommendations when applicable. Format citations as: "Harrison's 21st Ed, Chapter X" or "ADA Standards 2025, Section Y" or "Goodman & Gilman, Chapter Z".
`;

/**
 * Format image references for inclusion in the response
 * Creates properly formatted references for Open-i and InjuryMap images
 */
function formatImageReferences(images: any[]): string {
  if (!images || images.length === 0) return '';
  
  const imageRefs: string[] = [];
  
  images.forEach((img, index) => {
    const refNum = index + 1;
    let refText = '';
    
    if (img.source === 'Open-i' || img.source?.includes('Open-i') || img.source?.includes('NLM')) {
      // Open-i image reference - format for parser detection
      const imageUrl = img.url || 'https://openi.nlm.nih.gov';
      const imageTitle = img.title || 'Medical Image';
      refText = `${refNum}. ${imageTitle}. Image from Open-i, National Library of Medicine. ${imageUrl}`;
    } else if (img.source === 'InjuryMap' || img.source?.includes('InjuryMap')) {
      // InjuryMap image reference - format for parser detection
      const imageUrl = img.url || 'https://www.injurymap.com/free-human-anatomy-illustrations';
      const imageTitle = img.title || 'Anatomy Illustration';
      refText = `${refNum}. ${imageTitle}. Image from InjuryMap. Licensed under CC BY 4.0. ${imageUrl}`;
    }
    
    if (refText) {
      imageRefs.push(refText);
    }
  });
  
  if (imageRefs.length === 0) return '';
  
  return '\n\n## Image References\n\n' + imageRefs.join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is not set");
      return NextResponse.json(
        { error: "Gemini API key is not configured. Please set GEMINI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    console.log("✅ API Key is present (length:", process.env.GEMINI_API_KEY.length, ")");

    const { message, mode, files, history } = await request.json();

    if (!message && (!files || files.length === 0)) {
      return NextResponse.json(
        { error: "Message or files are required" },
        { status: 400 }
      );
    }

    // 🚨 CRITICAL SAFETY PRE-CHECK (GENERAL MODE ONLY)
    // Detect self-harm/suicide intent BEFORE evidence gathering
    // This saves precious time in crisis situations
    if (mode === "general" && message) {
      const messageLower = message.toLowerCase();

      // Level 1: Explicit self-harm phrases (immediate crisis response)
      const explicitSelfHarmPhrases = [
        "kill myself", "end my life", "commit suicide", "want to die",
        "how to die", "ways to die", "painless way to die", "how can i die",
        "going to kill", "planning to kill", "end it all",
        "cut myself", "hurt myself", "harm myself",
        "overdose", "pills to die", "hang myself",
        "better off dead", "world without me", "goodbye forever",
        "suicide method", "how to commit", "easiest way to die"
      ];

      const hasSelfHarmIntent = explicitSelfHarmPhrases.some(phrase =>
        messageLower.includes(phrase)
      );

      if (hasSelfHarmIntent) {
        console.log("🚨 CRISIS DETECTED - Returning immediate safety response");

        // Return immediate safety response WITHOUT evidence gathering
        const crisisResponse = `**This sounds very serious. Your safety is the most important thing right now.**

**Please stop reading this and take these steps immediately:**

1. **Call emergency services** or a crisis line in your country right away:
   - **US**: National Suicide Prevention Lifeline: 988 or 1-800-273-8255
   - **UK**: Samaritans: 116 123
   - **International**: Find your local crisis line at findahelpline.com

2. **Don't stay alone**: Sit with or call someone you trust right now - a parent, partner, friend, family member, or roommate. Tell them exactly how you're feeling.

3. **Go to your nearest emergency room** if you feel you might act on these thoughts.

**You deserve help and you are not alone.** These feelings can get better with support, and there are people who want to help you through this.

If you are in immediate danger, please call emergency services (911 in US, 999 in UK, 112 in EU) right now.`;

        // Return crisis response immediately in the same format as normal responses
        return NextResponse.json({
          response: crisisResponse,
          model: "crisis-safety-response",
          mode: mode,
        });
      }
    }

    // Select appropriate model based on mode and files
    let model: any;

    if (files && files.length > 0) {
      model = getGeminiVisionModel();
    } else {
      model = getGeminiModel();
    }

    let modelName = "gemini-2.5-flash + Simplified Evidence System";

    // Check if any files (images or documents) are included
    const hasFiles = files && files.length > 0;
    const hasImages = hasFiles && files.some((f: string) => f.startsWith("data:image/"));

    // Build the prompt based on mode and whether files are attached
    const systemPrompt = mode === "doctor"
      ? getDoctorModePromptSimplified(hasFiles, hasImages)
      : getGeneralModePrompt();

    // Simplified evidence gathering
    let evidenceContext = "";
    console.log(`🔬 ${mode === "doctor" ? "Doctor" : "General"} Mode: Gathering evidence...`);

    // Extract potential drug names from query (simple keyword extraction)
    const drugKeywords = extractDrugNames(message);

    // Check for drug interactions if multiple drugs mentioned (Doctor Mode only)
    if (mode === "doctor" && drugKeywords.length >= 2) {
      console.log(`💊 Checking interactions between: ${drugKeywords.join(", ")}`);
      const interactionCheck = await checkDrugInteractions(drugKeywords);
      evidenceContext += formatInteractionResults(interactionCheck);
    }
    // Clinical Decision Support for psychiatric emergencies (Doctor Mode only)
    if (mode === "doctor" && needsClinicalDecisionSupport(message)) {
      console.log("🧠 Analyzing clinical context for decision support...");
      const clinicalSupport = analyzeClinicalContext(message, drugKeywords);

      if (clinicalSupport.flags.hasSuicideRisk) {
        console.log(`   ⚠️ Suicide risk detected: ${clinicalSupport.suicideRisk?.riskLevel.toUpperCase()} risk`);
      }
      if (clinicalSupport.flags.hasQTRisk) {
        console.log(`   💊 QT risk detected: ${clinicalSupport.qtRisk?.totalRisk.toUpperCase()} risk`);
      }

      evidenceContext += clinicalSupport.promptInjection;
    }

    // Comprehensive evidence gathering - ALL SOURCES
    let ragEvidence: any = null; // Store for citation validation
    try {
      const { gatherEvidence } = await import('@/lib/evidence/engine');
      const evidence = await gatherEvidence(message, drugKeywords);
      ragEvidence = evidence; // Store for later validation

      // Format comprehensive evidence for prompt
      const { formatEvidenceForPrompt } = await import('@/lib/evidence/engine');
      evidenceContext += await formatEvidenceForPrompt(ragEvidence, message, ragEvidence.picoTags);

      const evidenceCount = getTotalComprehensiveEvidenceCount(ragEvidence);
      console.log(`✅ ${mode} Mode: Found ${evidenceCount} evidence items from comprehensive RAG engine`);
    } catch (evidenceError: any) {
      console.error('❌ Evidence gathering failed:', evidenceError.message);
      evidenceContext += '\n\nEvidence gathering encountered an error. Proceeding with general medical knowledge.\n\n';
    }

    // Helper to count evidence from comprehensive package
    function getTotalComprehensiveEvidenceCount(evidence: any): number {
      return (evidence.guidelines?.length || 0) +
        (evidence.landmarkTrials?.length || 0) +
        (evidence.cochraneReviews?.length || 0) +
        (evidence.pubmedArticles?.length || 0) +
        (evidence.pubmedReviews?.length || 0) +
        (evidence.clinicalTrials?.length || 0) +
        (evidence.europePMCRecent?.length || 0) +
        (evidence.semanticScholarPapers?.length || 0) +
        (evidence.whoGuidelines?.length || 0) +
        (evidence.cdcGuidelines?.length || 0) +
        (evidence.niceGuidelines?.length || 0) +
        (evidence.cardiovascularGuidelines?.length || 0) +
        (evidence.dailyMedDrugs?.length || 0) +
        (evidence.rxnormDrugs?.length || 0) +
        (evidence.aapGuidelines?.length || 0) +
        (evidence.ncbiBooks?.length || 0) +
        (evidence.omimEntries?.length || 0) +
        (evidence.pubChemCompounds?.length || 0) +
        (evidence.bmjBestPractice?.length || 0);
    }

    if (evidenceContext.length > 0) {
      // ACCESSIBILITY ENFORCEMENT: Only allow citations to readable articles
      const { filterValidEvidence } = await import("@/lib/evidence/quality-enforcer");
      const { filterOpenAccessOnly, generateAccessibleCitationInstruction } = await import("@/lib/evidence/open-access-filter");

      const validEvidence = filterValidEvidence(evidenceContext);
      const accessibleEvidence = filterOpenAccessOnly(validEvidence);
      const citationInstruction = generateAccessibleCitationInstruction(accessibleEvidence);

      console.log(`🔓 Access check: ${accessibleEvidence.length}/${validEvidence.length} sources are freely accessible`);

      evidenceContext = `

--- EVIDENCE FROM MEDICAL DATABASES (VERIFIED SOURCES ONLY) ---

${evidenceContext}

--- END EVIDENCE ---

${citationInstruction}

🚨 **CRITICAL EVIDENCE & CITATION RULES** 🚨

**1. CITATION NUMBERING - SIMPLE SEQUENTIAL NUMBERS ONLY**
   ✅ CORRECT: [[1]], [[2]], [[3]], [[4]], [[5]], etc.
   ❌ WRONG: [[1B.1]], [[21.3]], [[22.3]], [[P1]], [[P2]]
   
   The evidence above is organized into "ZONES" for your reference, but DO NOT use zone numbers in citations!
   - ZONE 0, ZONE 1, ZONE 2, etc. are just organizational labels
   - Your citations should be [[1]], [[2]], [[3]] - simple sequential numbers
   - Renumber all sources you use starting from 1

**2. CITATION FORMAT - ONLY REAL WORKING LINKS FROM EVIDENCE**
   - **CRITICAL RULE: NEVER FABRICATE PMIDS, DOIS, OR URLS**
   - **ONLY cite sources that have REAL identifiers in the evidence above**
   - Format: [[N]](URL) where URL is EXTRACTED from evidence
   - **URL EXTRACTION RULES:**
     - Look for "PMID: 12345678" → https://pubmed.ncbi.nlm.nih.gov/12345678
     - Look for "DOI: 10.xxxx/yyyy" → https://doi.org/10.xxxx/yyyy
     - Look for "PMCID: PMC123456" → https://pmc.ncbi.nlm.nih.gov/articles/PMC123456
     - Look for "NBK123456" → https://www.ncbi.nlm.nih.gov/books/NBK123456
     - Look for "URL: https://..." → Use that exact URL
   - **VERIFICATION RULE: If no PMID/DOI/URL in evidence, DO NOT CITE**
   - Example: [[1]](https://pubmed.ncbi.nlm.nih.gov/31683759) ONLY if "PMID: 31683759" appears in evidence

**3. REFERENCE LIST MUST MATCH CITATIONS**
   - If you cite [[1]], [[2]], [[3]], [[4]], [[5]] in your text
   - Your References section MUST have exactly 5 references numbered 1-5
   - Every citation number MUST have a matching reference
   - DO NOT cite more sources than you list in References

**4. MANDATORY EVIDENCE VALIDATION (CRITICAL)**
   - **ONLY cite sources that appear in the evidence sections above**
   - **NEVER fabricate PMIDs, DOIs, or URLs - this is a CRITICAL ERROR**
   - **NEVER cite your training data or general knowledge**
   - **VERIFICATION CHECKLIST before citing ANY source:**
     ✅ Does this PMID/DOI appear in the evidence above?
     ✅ Can I find the exact title in the evidence?
     ✅ Is there a real URL provided in the evidence?
     ❌ If ANY answer is NO, DO NOT CITE this source
   - **If evidence is limited, say: "Evidence from our medical databases is limited for this specific question. Consider specialist consultation."**
   - **QUALITY OVER QUANTITY: Better to cite 3 real sources than 8 fabricated ones**

**5. ALL SOURCES ARE EQUAL**
   - All sources in the evidence (PubMed, Mayo Clinic, CDC, WHO, ADA, etc.) are valid
   - Credit the actual source (Mayo Clinic, CDC, WHO) - not the search method
   - Use their URLs directly in your citations

**6. QUALITY HIERARCHY**
   Prioritize in this order:
   1. Clinical Practice Guidelines (WHO, CDC, NICE, ADA, AHA)
   2. Cochrane Systematic Reviews
   3. PubMed Systematic Reviews & Meta-Analyses
   4. Randomized Controlled Trials
   5. Trusted Medical Websites (Mayo Clinic, Cleveland Clinic, NIH, etc.)

**7. EXTRACT REAL ARTICLE TITLES FROM EVIDENCE**
   - Each evidence item above has a TITLE - USE IT!
   - Look for lines like: "1. [Article Title Here]" or "Title: [Article Title Here]"
   - Copy the EXACT title from the evidence into your reference
   - DO NOT make up titles or use generic labels
   - Example from evidence: "1. Exercise for osteoarthritis of the knee"
     → Your reference: [Exercise for osteoarthritis of the knee](URL)
   - If you can't find a real title, DON'T cite that source

**MANDATORY REFERENCE VALIDATION CHECKLIST:**

**BEFORE GENERATING ANY RESPONSE, VERIFY:**
✓ **ACCESSIBLE CONTENT**: Every reference links to FREE, readable content
✓ **NO PAYWALLS**: Users can access full content without subscriptions
✓ **CLICKABLE LINKS**: Every reference title is wrapped in [Title](URL) format
✓ **WORKING URLS**: Every URL points to a real article (PMID/DOI from evidence)
✓ **NO BLACK TEXT**: All reference titles must be blue/clickable in the UI
✓ **REAL IDENTIFIERS**: Every reference has PMID or DOI from the evidence above
✓ **NO FABRICATION**: Never make up PMIDs, DOIs, or URLs
✓ **DIRECT LINKS**: URLs go directly to articles, not search pages
✓ **CITATION MATCH**: Citation count matches reference count exactly
✓ **SIMPLE NUMBERS**: Use [[1]], [[2]], [[3]] - no zone numbers

**OPEN ACCESS PRIORITY:**
- ✓ PMC articles (pmc.ncbi.nlm.nih.gov) - HIGHEST PRIORITY
- ✓ Government sources (CDC, WHO, FDA, NICE) - FREE
- ✓ NCBI Books - FREE textbooks
- ✓ PubMed abstracts - FREE (when full text unavailable)
- ❌ Oxford Academic, NEJM, JAMA, Lancet - RESTRICTED (avoid)

**REFERENCE QUALITY STANDARDS:**
- ✓ GOOD: [Pulmonary Embolism](https://pubmed.ncbi.nlm.nih.gov/35767191)
- ❌ BAD: Pulmonary Embolism (no link, black text)
- ❌ BAD: [Pulmonary Embolism](https://pubmed.ncbi.nlm.nih.gov/?term=pe) (search URL)
- ❌ BAD: [Study on PE](https://pubmed.ncbi.nlm.nih.gov/99999999) (fake PMID)

**IF ANY REFERENCE FAILS VALIDATION, REMOVE IT FROM THE LIST**

`;
    }

    // Process uploaded files if present
    let fileContent = "";
    let fileParts: any[] = [];
    let medgemAnalysis = "";

    if (files && files.length > 0) {
      console.log(`📎 Processing ${files.length} uploaded file(s)...`);
      const processed = await processUploadedFiles(files);
      fileParts = processed.parts;
      fileContent = processed.textContent;

      // DEBUG: Check conditions for MedGemma
      console.log('🔍 DEBUG - Upload Analysis:');
      console.log('  files.length:', files?.length);
      console.log('  hasFiles:', hasFiles);
      console.log('  hasImages:', hasImages);
      console.log('  mode:', mode);
      console.log('  Should trigger MedGemma:', hasImages && mode === "doctor");
      console.log('  MEDGEMMA_ENDPOINT:', process.env.MEDGEMMA_ENDPOINT ? 'Set ✅' : 'Not Set ❌');
      console.log('  GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT || 'Not Set ❌');

      // ADVANCED VISION ANALYSIS for Doctor Mode
      if (hasImages && mode === "doctor") {
        try {
          console.log('🔬 Starting ADVANCED VISION ANALYSIS for medical images...');
          
          // Step 1: Try MedGemma if available (highest accuracy)
          let usedMedGemma = false;
          try {
            console.log('🚀 Attempting MedGemma analysis (expert-level)...');
            const medgemModule = await import('@/lib/medgem');
            const { analyzeMedicalImage } = medgemModule;

            // Analyze each image with MedGemma
            const analysisPromises = files
              .filter((f: string) => f.startsWith('data:image/'))
              .map(async (fileData: string, index: number) => {
                const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
                if (!matches) return null;

                const mimeType = matches[1];
                const base64Data = matches[2];

                // Extract patient context from message
                const patientAge = message.match(/(\d+)\s*(?:years?\s*old|yo|y\/o)/i)?.[1];
                const patientSex = message.match(/\b(male|female|man|woman)\b/i)?.[1];
                const symptoms = message.match(/(?:pain|chest pain|shortness of breath|cough|fever)/gi) || [];

                return await analyzeMedicalImage({
                  imageBase64: base64Data,
                  mimeType,
                  imageType: 'chest-xray',
                  patientContext: {
                    age: patientAge ? parseInt(patientAge) : undefined,
                    sex: patientSex?.toLowerCase() as any,
                    symptoms: symptoms.length > 0 ? symptoms : undefined,
                    clinicalQuestion: message,
                  },
                });
              });

            const results = await Promise.all(analysisPromises);
            const validResults = results.filter((r: any) => r !== null);

            if (validResults.length > 0) {
              console.log(`✅ MedGemma analyzed ${validResults.length} image(s)`);
              usedMedGemma = true;

              // Format MedGemma results for the prompt
              medgemAnalysis = "\n\n--- MEDGEMMA MEDICAL IMAGING ANALYSIS ---\n\n";
              validResults.forEach((result: any, idx: number) => {
                medgemAnalysis += `**Image ${idx + 1} Analysis (MedGemma ${result.metadata.modelUsed}):**\n\n`;
                medgemAnalysis += `**Processing Time:** ${result.metadata.processingTime}ms\n`;
                medgemAnalysis += `**Overall Confidence:** ${(result.metadata.confidence * 100).toFixed(1)}%\n\n`;

                if (result.criticalFindings.length > 0) {
                  medgemAnalysis += `**🚨 CRITICAL FINDINGS (${result.criticalFindings.length}):**\n`;
                  result.criticalFindings.forEach((f: any) => {
                    medgemAnalysis += `- ${f.description} (Location: ${f.location})\n`;
                    medgemAnalysis += `  Coordinates: [${f.boundingBox.ymin}, ${f.boundingBox.xmin}, ${f.boundingBox.ymax}, ${f.boundingBox.xmax}]\n`;
                  });
                  medgemAnalysis += '\n';
                }

                medgemAnalysis += `**Overall Impression:** ${result.overallImpression}\n\n`;

                if (result.findings.length > 0) {
                  medgemAnalysis += `**Detailed Findings (${result.findings.length}):**\n`;
                  result.findings.forEach((f: any, i: number) => {
                    medgemAnalysis += `${i + 1}. **${f.boundingBox.label}** (${f.severity.toUpperCase()})\n`;
                    medgemAnalysis += `   - Description: ${f.description}\n`;
                    medgemAnalysis += `   - Location: ${f.location}\n`;
                    medgemAnalysis += `   - Confidence: ${(f.confidence * 100).toFixed(1)}%\n`;
                    medgemAnalysis += `   - Coordinates: [${f.boundingBox.ymin}, ${f.boundingBox.xmin}, ${f.boundingBox.ymax}, ${f.boundingBox.xmax}]\n`;
                    medgemAnalysis += `   - Clinical Significance: ${f.clinicalSignificance}\n`;
                  });
                  medgemAnalysis += '\n';
                }

                if (result.differentialDiagnosis.length > 0) {
                  medgemAnalysis += `**Differential Diagnosis:**\n`;
                  result.differentialDiagnosis.forEach((diff: any, i: number) => {
                    medgemAnalysis += `${i + 1}. ${diff.condition} (${diff.likelihood} likelihood)\n`;
                    if (diff.supportingFindings.length > 0) {
                      medgemAnalysis += `   Supporting: ${diff.supportingFindings.join(', ')}\n`;
                    }
                  });
                  medgemAnalysis += '\n';
                }

                if (result.recommendations.immediateActions || result.recommendations.followUp) {
                  medgemAnalysis += `**Recommendations:**\n`;
                  if (result.recommendations.immediateActions) {
                    medgemAnalysis += `- Immediate Actions: ${result.recommendations.immediateActions.join('; ')}\n`;
                  }
                  if (result.recommendations.followUp) {
                    medgemAnalysis += `- Follow-Up: ${result.recommendations.followUp.join('; ')}\n`;
                  }
                  medgemAnalysis += '\n';
                }
              });

              medgemAnalysis += "--- END MEDGEMMA ANALYSIS ---\n\n";
              medgemAnalysis += "**INSTRUCTIONS FOR YOUR RESPONSE:**\n";
              medgemAnalysis += "- Use the MedGemma analysis above as expert-level imaging interpretation\n";
              medgemAnalysis += "- Include the VISUAL FINDINGS section with the exact coordinates provided\n";
              medgemAnalysis += "- Correlate findings with the patient's clinical presentation\n";
              medgemAnalysis += "- Provide comprehensive clinical recommendations\n\n";
            }
          } catch (medgemError: any) {
            console.warn('⚠️ MedGemma not available, using advanced vision system');
          }
          
          // Step 2: If MedGemma not available, use Advanced Vision System
          if (!usedMedGemma) {
            console.log('🩺 Using Advanced Expert Vision System...');
            
            const { analyzeWithAdvancedVision } = await import('@/lib/vision/advanced-medical-vision');
            const { detectImageType } = await import('@/lib/prompts/doctor-mode-vision-prompt');
            
            // Detect image type from clinical question
            const imageType = detectImageType(message);
            console.log(`📋 Detected image type: ${imageType}`);
            
            // Analyze each image
            const visionPromises = files
              .filter((f: string) => f.startsWith('data:image/'))
              .map(async (fileData: string, index: number) => {
                const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
                if (!matches) return null;

                const mimeType = matches[1];
                const base64Data = matches[2];

                // Extract clinical context
                const patientAge = message.match(/(\d+)\s*(?:years?\s*old|yo|y\/o)/i)?.[1];
                const symptoms = message.match(/(?:pain|chest pain|shortness of breath|cough|fever|headache|weakness)/gi) || [];

                return await analyzeWithAdvancedVision(base64Data, mimeType, {
                  patientAge: patientAge ? parseInt(patientAge) : undefined,
                  symptoms,
                  clinicalQuestion: message,
                });
              });

            const visionResults = await Promise.all(visionPromises);
            const validVisionResults = visionResults.filter((r: any) => r !== null);

            if (validVisionResults.length > 0) {
              console.log(`✅ Advanced vision analyzed ${validVisionResults.length} image(s)`);

              medgemAnalysis = "\n\n--- ADVANCED EXPERT VISION ANALYSIS ---\n\n";
              validVisionResults.forEach((result: any, idx: number) => {
                medgemAnalysis += `**Image ${idx + 1} Analysis (Advanced Vision System):**\n\n`;
                medgemAnalysis += `**Processing Time:** ${result.processingTimeMs.toFixed(0)}ms\n`;
                medgemAnalysis += `**Image Quality:** ${result.imageQuality}\n`;
                medgemAnalysis += `**Analysis Confidence:** ${(result.analysisConfidence * 100).toFixed(1)}%\n\n`;

                if (result.landmarks.length > 0) {
                  medgemAnalysis += `**Anatomical Landmarks (${result.landmarks.length}):**\n`;
                  result.landmarks.forEach((l: any) => {
                    medgemAnalysis += `- ${l.name}: (${l.location.x}, ${l.location.y}) - ${l.description}\n`;
                  });
                  medgemAnalysis += '\n';
                }

                if (result.findings.length > 0) {
                  medgemAnalysis += `**Pathological Findings (${result.findings.length}):**\n`;
                  result.findings.forEach((f: any, i: number) => {
                    medgemAnalysis += `${i + 1}. **${f.boundingBox.label}** (${f.severity.toUpperCase()})\n`;
                    medgemAnalysis += `   - Zone: ${f.anatomicalZone}\n`;
                    medgemAnalysis += `   - Description: ${f.description}\n`;
                    medgemAnalysis += `   - Confidence: ${(f.confidence * 100).toFixed(1)}%\n`;
                    medgemAnalysis += `   - Bounding Box: [${f.boundingBox.xmin}, ${f.boundingBox.ymin}, ${f.boundingBox.xmax}, ${f.boundingBox.ymax}]\n`;
                    medgemAnalysis += `   - Heatmap: Center (${f.heatmapRegion.centerX}, ${f.heatmapRegion.centerY}), Radius ${f.heatmapRegion.radius}\n`;
                    medgemAnalysis += `   - Clinical Significance: ${f.clinicalSignificance}\n`;
                    if (f.differentialDiagnosis && f.differentialDiagnosis.length > 0) {
                      medgemAnalysis += `   - Differential: ${f.differentialDiagnosis.join(', ')}\n`;
                    }
                  });
                  medgemAnalysis += '\n';
                }

                medgemAnalysis += `**Overall Impression:** ${result.overallImpression}\n`;
                medgemAnalysis += `**Urgency:** ${result.urgency.toUpperCase()}\n\n`;

                if (result.recommendations && result.recommendations.length > 0) {
                  medgemAnalysis += `**Recommendations:**\n`;
                  result.recommendations.forEach((rec: string) => {
                    medgemAnalysis += `- ${rec}\n`;
                  });
                  medgemAnalysis += '\n';
                }
              });

              medgemAnalysis += "--- END ADVANCED VISION ANALYSIS ---\n\n";
              medgemAnalysis += "**INSTRUCTIONS FOR YOUR RESPONSE:**\n";
              medgemAnalysis += "- Use the advanced vision analysis above as expert-level interpretation\n";
              medgemAnalysis += "- Include VISUAL FINDINGS section with precise coordinates\n";
              medgemAnalysis += "- Correlate anatomical landmarks with pathological findings\n";
              medgemAnalysis += "- Provide evidence-based differential diagnoses\n";
              medgemAnalysis += "- Include specific, actionable clinical recommendations\n\n";
            }
          }
          
        } catch (error: any) {
          console.error('❌ Advanced vision analysis failed');
          console.error('   Error type:', error.constructor?.name);
          console.error('   Error message:', error.message);
          console.warn('⚠️ Falling back to standard Gemini vision analysis');
          // Continue with standard Gemini vision analysis
        }
      }

      // Note: CXR Foundation integration is available but requires special Vertex AI access
      // MedGemma provides clinical-grade analysis when available, with automatic fallback to Gemini
    }

    // Build conversation history context
    let historyContext = "";
    if (history && history.length > 0) {
      historyContext = "\n\n--- CONVERSATION HISTORY ---\n\n";
      history.slice(-6).forEach((msg: any, i: number) => {
        historyContext += `${msg.role === "user" ? "Doctor" : "AI"}: ${msg.content}\n\n`;
      });
      historyContext += "--- END HISTORY ---\n\n";
    }

    // Extract key medical terms from the query to emphasize
    const keyTermsHint = mode === "doctor" && !hasFiles
      ? `\n\n**IMPORTANT**: The user's question contains key medical terms. Identify the main topics (treatments, conditions, drugs, procedures) and **bold them** in your opening paragraph. For example, if the question mentions "immunotherapy and targeted therapy for metastatic melanoma", your opening should bold: **immunotherapy**, **targeted therapy**, and **metastatic melanoma**.\n\n`
      : "";

    // Prepare the content for Gemini
    let content: any[] = [
      { text: systemPrompt },
      { text: keyTermsHint }, // Hint to bold key terms
      { text: historyContext }, // Include conversation history
      { text: evidenceContext }, // Include evidence if available
      { text: medgemAnalysis }, // Include MedGemma analysis if available
      { text: fileContent }, // Include file content if available
      { text: `\n\nUser Query: ${message}` },
      ...fileParts, // Add image parts for vision analysis
    ];

    // Generate response with Gemini 2.5 Flash
    let result;
    let responseText;
    const useGoogleSearch = false; // Disabled - using simplified evidence system instead
    try {
      console.log("🤖 Generating content with model:", modelName);
      console.log("📝 Content parts:", content.length, "parts");
      console.log("📚 Evidence items available:", evidenceContext.length > 0 ? "Yes" : "No");

      // Monitor content length to prevent overflow
      const totalContentLength = content
        .filter((part: any) => part.text)
        .reduce((sum: number, part: any) => sum + (part.text?.length || 0), 0);

      console.log("📏 Total content length:", totalContentLength, "characters");

      if (totalContentLength > 1000000) { // 1MB limit
        console.warn("⚠️ Content length exceeds 1MB, truncating evidence to prevent errors");

        // Truncate evidence context to prevent API failures
        const maxEvidenceLength = 500000; // 500KB for evidence
        if (evidenceContext.length > maxEvidenceLength) {
          evidenceContext = evidenceContext.substring(0, maxEvidenceLength) + "\n\n[Evidence truncated due to length limits]";
          console.log("📏 Evidence truncated to prevent API overflow");
        }

        // Rebuild content with truncated evidence
        content = [
          { text: systemPrompt },
          { text: keyTermsHint },
          { text: historyContext },
          { text: evidenceContext },
          { text: medgemAnalysis },
          { text: fileContent },
          { text: `\n\nUser Query: ${message}` },
          ...fileParts,
        ];

        const newTotalLength = content
          .filter((part: any) => part.text)
          .reduce((sum: number, part: any) => sum + (part.text?.length || 0), 0);
        console.log("📏 New content length after truncation:", newTotalLength, "characters");
      }

      if (useGoogleSearch) {
        // Use new SDK with Google Search grounding
        const googleSearchTool: Tool = { googleSearch: {} };
        const config: GenerateContentConfig = {
          tools: [googleSearchTool]
        };

        // Combine all text content
        const combinedContent = content
          .filter((part: any) => part.text)
          .map((part: any) => part.text)
          .join('\n');

        const response = await model.models.generateContent({
          model: "gemini-2.5-flash",
          contents: combinedContent,
          config
        });

        responseText = response.text;
        console.log("✅ Content generated with Google Search");
        console.log("DEBUG RESPONSE:", responseText);
      } else {
        // Use standard SDK
        result = await model.generateContent(content);
        responseText = result.response.text();
        console.log("✅ Content generated successfully");
        console.log("DEBUG RESPONSE:", responseText);
      }
    } catch (error: any) {
      console.error("❌ Gemini API Error:", error);
      console.error("Error details:", {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });

      // Check for specific error types
      if (error.message?.includes("API key")) {
        throw new Error("Invalid API key. Please check your GEMINI_API_KEY in .env.local");
      }

      // If primary model fails, try multiple fallback strategies
      if (error.message?.includes("not found") || error.message?.includes("not available") || error.status === 404) {
        console.log("⚠️ Gemini 2.5 Flash not available, falling back to Gemini 2.0 Flash Exp");
        const fallbackModel = getGeminiModel("gemini-2.0-flash-exp");
        try {
          result = await fallbackModel.generateContent(content);
          console.log("✅ Fallback model succeeded");
        } catch (fallbackError: any) {
          console.error("❌ Fallback model also failed:", fallbackError);
          throw new Error(`Both models failed. Primary: ${error.message}, Fallback: ${fallbackError.message}`);
        }
      } else if (error.message?.includes("content") && error.message?.includes("too long")) {
        // Content too long - try with reduced evidence
        console.log("⚠️ Content too long, trying with reduced evidence...");
        const reducedContent = [
          { text: systemPrompt },
          { text: keyTermsHint },
          { text: evidenceContext.substring(0, 50000) }, // Truncate evidence
          { text: `\n\nUser Query: ${message}` },
          ...fileParts,
        ];

        try {
          result = await model.generateContent(reducedContent);
          responseText = result.response.text();
          console.log("✅ Succeeded with reduced content");
        } catch (reducedError: any) {
          console.error("❌ Reduced content also failed:", reducedError);
          throw new Error(`Content too long even after reduction: ${reducedError.message}`);
        }
      } else {
        throw error;
      }
    }

    // CITATION VALIDATION - Verify all citations exist in provided evidence
    // Uses new unified server-side validator (Phase 1)
    if (mode === "doctor" && ragEvidence !== null) {
      try {
        const { validateCitations, formatValidationResult, sanitizeResponse } = await import("@/lib/citation/server-validator");

        // Validate citations against evidence package
        const validationResult = validateCitations(responseText, ragEvidence);

        console.log("📊 CITATION VALIDATION RESULTS:");
        console.log(formatValidationResult(validationResult));

        if (!validationResult.isValid) {
          console.warn("⚠️  INVALID CITATIONS DETECTED - Sanitizing response");
          
          // Option 1: Sanitize (remove invalid citations)
          responseText = sanitizeResponse(responseText, validationResult);
          console.log("✅ Response sanitized - invalid citations removed");
          
          // Option 2: Reject and log for review (uncomment to enable)
          // console.error("🚨 REJECTING RESPONSE - Too many invalid citations");
          // return NextResponse.json(
          //   { error: "Response quality check failed. Please try rephrasing your question." },
          //   { status: 500 }
          // );
        } else {
          console.log("✅ All citations validated successfully");
        }
      } catch (validationError: any) {
        console.error("❌ Citation validation error:", validationError.message);
        // Continue even if validation fails
      }
    }

    // URL VALIDATION - Fix broken or invalid URLs in citations
    if (mode === "doctor") {
      try {
        const { validateResponseURLs } = await import("@/lib/citation/url-validator");
        
        const urlValidation = validateResponseURLs(responseText);
        responseText = urlValidation.validatedResponse;
        
        if (urlValidation.fixedCount > 0 || urlValidation.removedCount > 0) {
          console.log(`🔗 URL Validation: Fixed ${urlValidation.fixedCount}, Removed ${urlValidation.removedCount} invalid URLs`);
        } else {
          console.log("✅ All citation URLs validated successfully");
        }
      } catch (urlError: any) {
        console.error("❌ URL validation error:", urlError.message);
        // Continue even if validation fails
      }
    }

    // REFERENCE ENRICHMENT - Temporarily disabled due to missing dependency
    // TODO: Re-enable after fixing reference-enrichment.ts dependency
    if (mode === "doctor" && false) {
      try {
        const { enrichReferencesInResponse } = await import("../../../lib/reference-enrichment-processor");
        console.log("🔍 Enriching references with DOIs/PMIDs...");
        responseText = await enrichReferencesInResponse(responseText);
        console.log("✅ Reference enrichment complete");
      } catch (enrichError: any) {
        console.error("❌ Reference enrichment error:", enrichError.message);
        // Continue without enrichment if it fails
      }
    }

    // MODE-SPECIFIC MEDICAL IMAGE RETRIEVAL
    let medicalImages: any[] = [];
    if (!hasFiles) {
      try {
        console.log(`🖼️  Fetching relevant medical images for ${mode} mode...`);

        // Add timeout for image retrieval to prevent hanging
        const imageRetrievalPromise = (async () => {
          if (mode === "doctor") {
            // DOCTOR MODE: Clinical diagrams, pathophysiology, algorithms
            // Extract basic tags from query for image matching
            const messageLower = message.toLowerCase();
            const disease_tags: string[] = [];
            const decision_tags: string[] = [];
            
            // Extract disease tags
            if (messageLower.match(/atrial fibrillation|af\b|afib/)) disease_tags.push('AF');
            if (messageLower.match(/heart failure|hf\b|hfpef|hfref/)) disease_tags.push('HF');
            if (messageLower.match(/diabetes|dm\b|t1dm|t2dm/)) disease_tags.push('DIABETES');
            if (messageLower.match(/kidney|renal|ckd/)) disease_tags.push('CKD');
            if (messageLower.match(/vte|dvt|pulmonary embolism|pe\b/)) disease_tags.push('VTE');
            if (messageLower.match(/pneumonia|cap\b/)) disease_tags.push('CAP');
            if (messageLower.match(/cancer|tumor|oncology/)) disease_tags.push('CANCER');
            if (messageLower.match(/stroke|cva/)) disease_tags.push('STROKE');
            
            // Extract decision tags
            if (messageLower.match(/anticoagulation|anticoagulant|warfarin|doac/)) decision_tags.push('anticoagulation');
            if (messageLower.match(/therapy|treatment|medication/)) decision_tags.push('therapy');
            if (messageLower.match(/antiplatelet|aspirin|clopidogrel/)) decision_tags.push('antiplatelet');
            if (messageLower.match(/dosing|dose|titration/)) decision_tags.push('dose');
            if (messageLower.match(/drug|medication choice/)) decision_tags.push('drug_choice');
            
            const imageTags = { disease_tags, decision_tags };
            console.log(`📋 Extracted image tags:`, imageTags);

            // STEP 1: Try to get images from web search (diagrams, flowcharts)
            const { retrieveMedicalImages, formatMedicalImages } = await import('@/lib/medical-image-retriever');
            const webImageCandidates = await retrieveMedicalImages(message, mode as 'doctor' | 'general', imageTags);
            
            const webImages = formatMedicalImages(webImageCandidates).map(img => {
              // Add proper source badge for web search images
              let sourceBadge = img.source;
              if (typeof img.source === 'string') {
                if (img.source.includes('openi.nlm.nih.gov') || img.source === 'Open-i') {
                  sourceBadge = 'Open-i';
                } else if (img.source.includes('injurymap.com') || img.source === 'InjuryMap') {
                  sourceBadge = 'InjuryMap';
                } else if (!['Open-i', 'InjuryMap'].includes(img.source)) {
                  sourceBadge = 'Web Search';
                }
              }
              
              return {
                url: img.url,
                title: img.title,
                description: img.description,
                source: sourceBadge,
                license: img.license, // Pass through license information for lightbox
                type: 'anatomy' as any,
                attribution: img.attribution || `Image from ${sourceBadge}`
              };
            });

            // STEP 2: Extract images from PMC articles in the evidence (if available)
            const pmcImages: any[] = [];
            if (ragEvidence && (ragEvidence.pmcArticles?.length > 0 || ragEvidence.europePMCOpenAccess?.length > 0)) {
              console.log('📸 Extracting images from PMC articles in evidence...');
              
              const { fetchEuropePMCImages } = await import('@/lib/evidence/pmc-image-extractor');
              
              // Extract from Europe PMC articles (they have better image API)
              const europePMCArticles = ragEvidence.europePMCOpenAccess || [];
              const topEuropePMC = europePMCArticles.slice(0, 2); // Top 2 articles
              
              for (const article of topEuropePMC) {
                try {
                  // Extract PMID from article
                  const pmid = article.pmid || article.id;
                  if (pmid) {
                    const images = await fetchEuropePMCImages(pmid);
                    images.forEach(img => {
                      pmcImages.push({
                        url: img.url,
                        title: img.caption,
                        description: `From: ${article.title}`,
                        source: 'Europe PMC',
                        type: 'clinical-image',
                        pmcId: img.pmcId,
                        articleTitle: article.title
                      });
                    });
                  }
                } catch (error) {
                  console.error('Error extracting PMC images:', error);
                }
              }
              
              console.log(`✅ Extracted ${pmcImages.length} images from PMC articles`);
            }

            // Combine web images and PMC images
            // PMC images come first (they're from the actual evidence)
            return [...pmcImages, ...webImages];

          } else {
            // GENERAL MODE: Consumer-friendly diagrams, prevention infographics
            const healthTopic = message.toLowerCase().match(/\b(heart|diabetes|kidney|lung|blood pressure|cholesterol|exercise|diet)\b/)?.[0] || 'health';
            const userConcerns = message.toLowerCase().match(/\b(pain|tired|worried|scared|confused|help)\b/g) || [];

            const { retrieveGeneralModeImages, formatGeneralModeImages } = await import('@/lib/general-mode-image-retriever');
            const imageCandidates = await retrieveGeneralModeImages(message, healthTopic, userConcerns);

            return formatGeneralModeImages(imageCandidates).map(img => {
              // Determine source badge based on domain
              let sourceBadge = 'Web Search';
              if (img.source.includes('openi.nlm.nih.gov')) {
                sourceBadge = 'Open-i';
              } else if (img.source.includes('visualsonline.cancer.gov')) {
                sourceBadge = 'NCI Visuals';
              } else if (img.source.includes('injurymap.com')) {
                sourceBadge = 'InjuryMap';
              } else if (img.source.includes('nih.gov') || img.source.includes('cdc.gov') || img.source.includes('who.int')) {
                sourceBadge = 'Government Source';
              } else if (img.source.includes('mayoclinic.org') || img.source.includes('clevelandclinic.org')) {
                sourceBadge = 'Medical Institution';
              }
              
              return {
                url: img.url,
                title: img.title,
                description: img.description,
                source: sourceBadge,
                license: img.license, // Pass through license information for lightbox
                type: img.imageType,
                consumerFriendly: true,
                attribution: img.attribution || `Image from ${img.source}`
              };
            });
          }
        })();

        // Add 10-second timeout for image retrieval
        const timeoutPromise = new Promise<any[]>((_, reject) => {
          // Increased from 10s to 30s for multi-panel Open-i searches
          setTimeout(() => reject(new Error('Image retrieval timeout')), 30000);
        });

        medicalImages = await Promise.race([imageRetrievalPromise, timeoutPromise]);
        console.log(`✅ ${mode} Mode: Found ${medicalImages.length} images`);

      } catch (imgError: any) {
        console.error(`❌ Error fetching ${mode} mode images:`, imgError.message);
        console.log(`⚠️ ${mode} mode image system failed, continuing without images`);
        medicalImages = [];

        // Don't let image failures crash the entire request
        if (imgError.message?.includes('timeout')) {
          console.log('   📝 Image retrieval timed out - this is normal for slow networks');
        } else if (imgError.message?.includes('API key')) {
          console.log('   📝 SERPER_API_KEY missing or invalid - images disabled');
        } else {
          console.log('   📝 Unexpected image error - continuing with text-only response');
        }
      }
    }

    // Validate response before returning
    if (!responseText || responseText.trim().length === 0) {
      console.warn('⚠️ Empty response generated, providing fallback');
      responseText = mode === 'doctor'
        ? "I apologize, but I encountered an issue generating a comprehensive response. Please try rephrasing your question or breaking it into smaller parts."
        : "I'm sorry, but I had trouble understanding your question. Could you please rephrase it or ask something more specific about your health concern?";
    }

    // Ensure response is not too long (prevent client issues)
    if (responseText.length > 50000) {
      console.warn('⚠️ Response too long, truncating to prevent client issues');
      responseText = responseText.substring(0, 47000) + "\n\n[Response truncated due to length. Please ask for specific aspects if you need more detail.]";
    }

    // Append image references to response if images are present
    let finalResponse = responseText;
    if (medicalImages.length > 0) {
      const imageReferences = formatImageReferences(medicalImages);
      if (imageReferences) {
        finalResponse = responseText + '\n\n' + imageReferences;
      }
    }

    return NextResponse.json({
      response: finalResponse,
      model: modelName,
      mode: mode,
      medicalImages: medicalImages.length > 0 ? medicalImages : undefined,
    });

  } catch (error: any) {
    console.error("❌ DETAILED ERROR ANALYSIS:");
    console.error("Error type:", error.constructor?.name);
    console.error("Error message:", error.message);
    console.error("Error status:", error.status);
    console.error("Error code:", error.code);
    console.error("Full error object:", JSON.stringify(error, null, 2));

    // Check for specific error types
    let userFriendlyMessage = "Failed to generate response";
    let statusCode = 500;

    if (error.message?.includes("API key")) {
      userFriendlyMessage = "Invalid API key configuration";
      statusCode = 401;
    } else if (error.message?.includes("quota") || error.message?.includes("rate limit")) {
      userFriendlyMessage = "API rate limit exceeded. Please try again in a moment.";
      statusCode = 429;
    } else if (error.message?.includes("timeout") || error.message?.includes("TIMEOUT")) {
      userFriendlyMessage = "Request timed out. Please try a shorter question or try again.";
      statusCode = 408;
    } else if (error.message?.includes("content") && error.message?.includes("too long")) {
      userFriendlyMessage = "Question is too complex. Please try breaking it into smaller parts.";
      statusCode = 413;
    } else if (error.status === 400) {
      userFriendlyMessage = "Invalid request format. Please try rephrasing your question.";
      statusCode = 400;
    } else if (error.status === 403) {
      userFriendlyMessage = "Access denied. Please check your API key permissions.";
      statusCode = 403;
    }

    return NextResponse.json(
      {
        error: userFriendlyMessage,
        details: error.message,
        errorType: error.constructor?.name,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
}
