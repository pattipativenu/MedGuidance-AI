# MedGuidence AI - Project Document

## Project Overview

**MedGuidence AI** is an evidence-based medical AI assistant that provides comprehensive, cited medical insights by integrating 20+ medical databases with Google Gemini AI. The application serves two distinct user groups through specialized modes.

---

## Hackathon Category: Frankenstein 🧟

MedGuidence AI fits the **Frankenstein** category - stitching together a chimera of technologies into one powerful application:

- **20+ Medical Database APIs** (PubMed, Cochrane, WHO, CDC, FDA, etc.)
- **Google Gemini 2.5 Flash** (AI text generation)
- **Gemini Vision** (Medical image analysis)
- **Perplexity AI** (Real-time search)
- **BioBERT/PubMedBERT** (Semantic reranking)
- **Next.js 16 + React 19** (Modern web framework)
- **Tailwind CSS v4** (Styling)
- **shadcn/ui** (Component library)

These seemingly incompatible elements combine to create an unexpectedly powerful medical research copilot.

---

## Key Features

### 1. Doctor Mode (Healthcare Professionals)
- Evidence-based clinical research copilot
- 4-tab response structure (Clinical Analysis, Diagnosis, Treatment, Evidence)
- Medical image analysis with bounding boxes and thermal heatmaps
- Drug interaction checking
- Exam preparation and mock test generation
- Clinical decision support for psychiatric emergencies

### 2. General Mode (General Public)
- Consumer-friendly health information
- Simple, everyday language
- "When to See a Doctor" guidance
- Safety net for crisis detection
- Actionable advice with exercises and dietary suggestions

### 3. Evidence Engine (20+ Sources)
- **Guidelines**: WHO, CDC, NICE, ACC/AHA, ADA, BMJ
- **Literature**: PubMed, Cochrane, Europe PMC, PMC
- **Trials**: ClinicalTrials.gov
- **Drugs**: OpenFDA, DailyMed, RxNorm
- **Specialty**: AAP, NCBI Books, OMIM, MedlinePlus
- **Real-time**: Perplexity AI

### 4. Medical Image Analysis
- X-ray, CT, MRI, ultrasound support
- Bounding box annotations
- Thermal heatmap visualization
- Multi-image analysis (frontal + lateral)

---

## Technical Architecture

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              MEDGUIDENCE AI SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  USER INPUT                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                     │
│  │  Text Query     │  │  Medical Image  │  │  Mode Selection │                     │
│  │  (Health Q)     │  │  (X-ray/CT/MRI) │  │  (Doctor/General)│                    │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                     │
│           └────────────────────┴────────────────────┘                               │
│                                │                                                     │
│                                ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         SAFETY PRE-CHECK                                     │    │
│  │  Crisis keyword detection → Immediate safety response if detected           │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                │                                                     │
│                                ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         EVIDENCE ENGINE                                      │    │
│  │                                                                              │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │    │
│  │  │   PubMed    │  │  Cochrane   │  │    WHO      │  │    CDC      │        │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │    │
│  │  │  Europe PMC │  │   OpenFDA   │  │  DailyMed   │  │  Perplexity │        │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │    │
│  │  │   RxNorm    │  │    NICE     │  │  ClinTrials │  │  + 10 more  │        │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │    │
│  │                                                                              │    │
│  │  All searches run in PARALLEL (Promise.all) → 5-7 seconds total             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                │                                                     │
│                                ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         SEMANTIC RERANKING                                   │    │
│  │  BioBERT/PubMedBERT embeddings → Improved relevance                         │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                │                                                     │
│                                ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         GEMINI 2.5 FLASH                                     │    │
│  │  Evidence synthesis → Structured response with citations                    │    │
│  │  (+ Gemini Vision for image analysis)                                       │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                │                                                     │
│                                ▼                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         STREAMING RESPONSE                                   │    │
│  │  Doctor Mode: 4-tab structure with citations                                │    │
│  │  General Mode: Simple language with "When to See a Doctor"                  │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 (Strict Mode) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (new-york style) |
| AI Model | Google Gemini 2.5 Flash |
| Vision Model | Gemini 2.0 Flash Exp |
| Animations | Framer Motion |
| Fonts | Inter (UI), Lora (content), Geist Mono (code) |

---

## Project Structure

```
medguidence-ai/
├── app/                          # Next.js App Router
│   ├── api/
│   │   └── chat/route.ts        # Main chat endpoint (streaming)
│   ├── doctor/page.tsx          # Doctor Mode UI
│   ├── general/page.tsx         # General Mode UI
│   ├── page.tsx                 # Landing page
│   └── layout.tsx               # Root layout
├── components/ui/               # Reusable UI components
│   ├── markdown-typewriter.tsx  # Streaming markdown renderer
│   ├── thermal-heatmap-image.tsx # Medical image heatmap
│   ├── annotated-image.tsx      # Bounding box annotations
│   └── evidence-loading.tsx     # Loading animation
├── lib/                         # Core business logic
│   ├── evidence/                # 20+ database integrations
│   │   ├── engine.ts           # Evidence orchestrator
│   │   ├── pubmed.ts           # PubMed API
│   │   ├── cochrane.ts         # Cochrane Library
│   │   ├── who-guidelines.ts   # WHO curated data
│   │   ├── perplexity.ts       # Real-time AI search
│   │   └── ... (15+ more)
│   ├── clinical-decision-support/ # CDS modules
│   │   ├── suicide-risk-assessment.ts
│   │   ├── qt-risk-library.ts
│   │   └── adolescent-care-templates.ts
│   └── gemini.ts               # Gemini AI client
├── hooks/
│   └── useGemini.ts            # Custom Gemini hook
├── .kiro/                       # Kiro configuration
│   ├── specs/                  # Feature specifications
│   └── steering/               # Development guidelines
└── public/logos/               # Evidence source logos
```

---

## Kiro Usage

### Specs Created
- **Phase 1**: Evidence Caching, Conflict Detection, Sufficiency Scoring
- **Phase 2**: Semantic Search Enhancement with BioBERT
- **Phase 3**: Chunk-level Attribution and Evaluation Framework

### Steering Rules
- **tech.md**: Tech stack guidelines
- **structure.md**: File organization patterns
- **product.md**: Medical domain rules

### Key Contributions
- Designed complete system architecture
- Implemented 20+ database integrations
- Created medical image analysis pipeline
- Built safety net for crisis detection
- Generated comprehensive documentation

---

## Evidence Sources (20+)

### Tier 1: Authoritative Guidelines
| Source | Coverage |
|--------|----------|
| WHO Guidelines | 15+ health topics |
| CDC Guidelines | 14+ clinical topics |
| NICE Guidelines | 11+ conditions |
| ACC/AHA Guidelines | Cardiovascular |
| ADA Standards | Diabetes |
| BMJ Best Practice | Clinical guidance |

### Tier 2: Systematic Reviews
| Source | Type |
|--------|------|
| Cochrane Library | Gold standard reviews |
| PubMed Reviews | Meta-analyses |
| PMC Reviews | Full-text reviews |

### Tier 3: Primary Literature
| Source | Coverage |
|--------|----------|
| PubMed | 40M+ articles |
| Europe PMC | 40M+ abstracts |
| Semantic Scholar | Highly cited |
| OpenAlex | Open literature |

### Tier 4: Clinical Trials & Drugs
| Source | Type |
|--------|------|
| ClinicalTrials.gov | Trials database |
| OpenFDA | Drug safety |
| DailyMed | FDA labels |
| RxNorm | Drug interactions |

### Tier 5: Specialty
| Source | Focus |
|--------|-------|
| AAP Guidelines | Pediatrics |
| NCBI Books | StatPearls |
| OMIM | Genetics |
| MedlinePlus | Consumer health |
| Perplexity AI | Real-time search |

---

## Safety Features

### Crisis Detection (General Mode)
- Pre-check before evidence gathering
- 20+ self-harm phrase detection
- Immediate crisis response (<100ms)
- Crisis hotline numbers (988, Samaritans)
- Bypasses all processing for speed

### Clinical Decision Support (Doctor Mode)
- Suicide risk assessment
- QT-prolonging medication alerts
- Adolescent care coordination
- Safety plan templates

### Privacy
- No server-side storage
- 1-hour localStorage expiration
- No PHI/PII logging
- Client-side image processing

---

## Performance

| Metric | Value |
|--------|-------|
| Evidence Gathering | 5-7 seconds |
| Crisis Response | <100ms |
| Total Response | 8-12 seconds |
| API Success Rate | 95%+ |
| Cost per Query | ~$0.0055 |

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Google Gemini API key

### Installation
```bash
# Clone repository
git clone <repository-url>
cd medguidence-ai

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Add GEMINI_API_KEY to .env.local

# Start development server
npm run dev
```

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| GEMINI_API_KEY | Yes | Google Gemini API key |
| NCBI_API_KEY | No | Improves PubMed rate limits |
| OPENALEX_EMAIL | No | OpenAlex polite pool access |
| PERPLEXITY_API_KEY | No | Real-time search |

---

## Demo

### Doctor Mode
1. Navigate to `/doctor`
2. Enter clinical query (e.g., "What is the first-line treatment for cellulitis?")
3. View 4-tab response with citations
4. Upload X-ray for image analysis

### General Mode
1. Navigate to `/general`
2. Enter health question (e.g., "How much exercise do I need?")
3. View simple response with actionable advice
4. See "When to See a Doctor" guidance

---
## Disclaimer

MedGuidence AI is an educational tool and decision support system. It is NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult qualified healthcare providers for medical decisions.

---

**Last Updated**: December 2025
