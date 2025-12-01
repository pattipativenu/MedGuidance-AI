---
inclusion: always
---

# MedGuidence AI - Product Rules

MedGuidence AI is a medical AI assistant providing evidence-based clinical information. When working on this codebase, follow these product-specific rules:

## Two Distinct Modes

### Doctor Mode (`/doctor`, `app/doctor/page.tsx`)
- Target audience: Healthcare professionals
- Evidence-based clinical research copilot with comprehensive citations
- Integrates 20+ medical databases (PubMed, Cochrane, FDA, ClinicalTrials.gov, etc.)
- Supports medical image analysis with bounding box annotations and thermal heatmaps
- Response structure: Tabbed interface with Clinical Analysis, Diagnosis & Logic, Treatment & Safety, Evidence Database
- **CRITICAL**: Every medical claim MUST be cited with real PMIDs, DOIs, or guideline URLs
- Use technical medical terminology appropriate for clinicians

### General Mode (`/general`, `app/general/page.tsx`)
- Target audience: General public seeking health information
- Consumer-friendly language with simplified explanations
- Include "When to See a Doctor" guidance in responses
- Focus on education and actionable advice
- Safety disclaimers required on all medical content
- Avoid overwhelming users with technical jargon

## Evidence & Citation Requirements

When implementing features that generate medical content:

1. **No Fabricated References**: Never generate fake PMIDs, DOIs, or citation identifiers
2. **Evidence Hierarchy**: Prioritize sources in this order:
   - Clinical practice guidelines (WHO, CDC, NICE, AAP)
   - Systematic reviews and meta-analyses (Cochrane)
   - Randomized controlled trials (ClinicalTrials.gov, PubMed)
   - Observational studies and case reports
3. **Evidence Engine**: Use `lib/evidence/engine.ts` for parallel database searches (~5-7 seconds)
4. **Citation Format**: Include author, year, title, journal, PMID/DOI in structured format
5. **Verification**: All citations must be verifiable through the integrated databases

## Medical Image Analysis

When working with medical imaging features:

- Use Gemini Vision API for image analysis (`lib/gemini.ts`)
- Generate thermal heatmaps to highlight regions of interest (`components/ui/thermal-heatmap-image.tsx`)
- Provide bounding box annotations for specific findings (`components/ui/annotated-image.tsx`)
- Include confidence levels and differential diagnoses
- Always add disclaimer: "AI analysis should be verified by qualified healthcare professionals"

## Privacy & Data Handling

- **No server-side persistence**: All conversation data stored in localStorage only
- **1-hour expiration**: Implement automatic data expiration for privacy
- **No PHI/PII**: Never store or log protected health information
- **Image processing**: Process images client-side or in-memory only
- Use `lib/storage.ts` utilities for consistent localStorage handling

## User Experience Patterns

- **Streaming responses**: Use streaming for AI-generated content to improve perceived performance
- **Typewriter effects**: Apply to markdown content for better readability (`components/ui/markdown-typewriter.tsx`)
- **Loading states**: Show evidence gathering progress with source logos (`components/ui/evidence-loading.tsx`)
- **Progressive disclosure**: Use tabs to organize complex medical information
- **Responsive design**: Ensure all features work on mobile and desktop

## Safety & Disclaimers

Every medical response must include appropriate disclaimers:

- Doctor Mode: "This information is for clinical decision support. Use professional judgment."
- General Mode: "This is educational information only. Consult a healthcare provider for medical advice."
- Emergency situations: Always recommend immediate medical attention when appropriate
- Drug interactions: Include warnings about checking with pharmacist/physician

## API Response Structure

When implementing or modifying API routes (`app/api/chat/route.ts`):

- Stream responses using `ReadableStream` for better UX
- Include metadata: evidence sources, confidence scores, processing time
- Handle errors gracefully with user-friendly messages
- Rate limit external API calls (350ms delay for NCBI)
- Return structured data for citations and evidence
