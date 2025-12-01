# MedGuidence AI

An advanced medical AI assistant providing evidence-based clinical information through two specialized modes: **Doctor Mode** for healthcare professionals and **General Mode** for consumers.

## 🌟 Key Features

### Evidence-Based Medicine
- **20+ Medical Databases**: PubMed, Cochrane, Europe PMC, WHO, CDC, NICE, FDA, and more
- **Verified Citations**: Every claim backed by PMIDs, DOIs, and authoritative sources
- **Smart Evidence Engine**: Parallel search across all sources for maximum coverage

### Two Specialized Modes

**Doctor Mode** (`/doctor`)
- Clinical research copilot for healthcare professionals
- Tabbed responses: Clinical Analysis, Diagnosis & Logic, Treatment & Safety, Evidence Database
- Medical image analysis with bounding box annotations
- Comprehensive drug interaction checking
- **Clinical Decision Support**: Auto-triggered for psychiatric emergencies, QT-risk medications, adolescent care
- All claims cited with real PMIDs/DOIs

**General Mode** (`/general`)
- Consumer-friendly health information
- Simplified responses with key points and actionable advice
- "When to See a Doctor" guidance
- Foods to consider and helpful exercises
- Educational focus with safety disclaimers

### Medical Image Analysis
- Vision AI with thermal heatmaps
- Annotated findings with bounding boxes
- Support for X-rays, CT, MRI, ultrasound
- Multi-image analysis (frontal + lateral views)

## 🛠 Tech Stack

### Core Framework
- **Next.js 16** with App Router and React Server Components
- **React 19** with React Compiler for automatic optimization
- **TypeScript 5** (strict mode)

### AI & APIs
- **Google Gemini 2.5 Flash** - Primary AI model with streaming
- **20+ Medical APIs** - PubMed, Cochrane, WHO, CDC, NICE, FDA, etc.

### Styling
- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** components (new-york style)
- **Framer Motion** for animations
- **Lottie** for animated illustrations

### Medical Databases
- PubMed (NCBI E-utilities API)
- Cochrane Library
- Europe PMC
- ClinicalTrials.gov API v2
- OpenFDA, DailyMed, RxNorm
- WHO, CDC, NICE curated guidelines
- Semantic Scholar
- OpenAlex
- And 10+ more sources

## 📁 Project Structure

```
├── app/
│   ├── page.tsx                    # Landing page (mode selection)
│   ├── doctor/page.tsx             # Doctor Mode interface
│   ├── general/page.tsx            # General Mode interface
│   ├── api/
│   │   ├── chat/route.ts           # Main chat endpoint
│   │   └── radiology-triage/       # Radiology analysis
│   └── layout.tsx                  # Root layout
├── components/
│   └── ui/                         # Reusable UI components
├── lib/
│   ├── evidence/                   # Medical database integrations
│   │   ├── engine.ts              # Evidence orchestration
│   │   ├── perplexity.ts          # Perplexity AI integration
│   │   ├── pubmed.ts              # PubMed integration
│   │   ├── cochrane.ts            # Cochrane reviews
│   │   ├── who-guidelines.ts      # WHO guidelines
│   │   ├── cdc-guidelines.ts      # CDC guidelines
│   │   ├── nice-guidelines.ts     # NICE guidelines
│   │   └── ... (15+ more sources)
│   ├── clinical-decision-support/ # Psychiatric & safety modules
│   │   ├── index.ts               # Main orchestrator
│   │   ├── suicide-risk-assessment.ts  # Risk tiering engine
│   │   ├── safety-plan-template.ts     # Stanley-Brown framework
│   │   ├── qt-risk-library.ts          # QTc risk database
│   │   └── adolescent-care-templates.ts # Care coordination
│   ├── gemini.ts                  # Gemini AI client
│   └── storage.ts                 # localStorage utilities
└── hooks/
    └── useGemini.ts               # Custom React hooks
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Google Gemini API key

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd medguidence-ai
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional (improves rate limits)
NCBI_API_KEY=your_ncbi_api_key_here

# Optional (for OpenAlex polite pool)
OPENALEX_EMAIL=your_email@example.com
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to [(https://medguidence-ai-473674535154.us-central1.run.app/)]

### Production Build

```bash
npm run build
npm run start
```

## 🔑 API Keys

### Required APIs

**Google Gemini API** (Required)
- Get your API key: https://makersuite.google.com/app/apikey
- Used for: AI response generation

### Optional APIs (Recommended)

**NCBI API Key** (Recommended)
- Get your API key: https://www.ncbi.nlm.nih.gov/account/settings/
- Benefits: Higher rate limits for PubMed searches (10 req/sec vs 3 req/sec)

**OpenAlex Email** (Optional)
- Provide your email for polite pool access
- Benefits: Better rate limits for OpenAlex API

**Redis Cache** (Optional - Phase 1 Enhancement)
- Install Redis locally or use a hosted service (Redis Cloud, AWS ElastiCache, etc.)
- Benefits: 
  - Reduces query latency from 5-7s to 1-2s for cached queries
  - Cuts API costs by ~53% through intelligent caching
  - 24-hour TTL for evidence freshness
- Setup:
  ```bash
  # Local Redis (macOS)
  brew install redis
  brew services start redis
  
  # Local Redis (Linux)
  sudo apt-get install redis-server
  sudo systemctl start redis
  
  # Add to .env.local
  REDIS_URL=redis://localhost:6379
  ```
- Graceful degradation: If Redis is unavailable, the system automatically falls back to direct API calls

## 📊 Evidence System

### How It Works

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  PARALLEL EVIDENCE SEARCH (Promise.all)                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Curated     │  │  Medical     │  │  Perplexity  │  │
│  │  Guidelines  │  │  Databases   │  │  Real-Time   │  │
│  │  (WHO,CDC,   │  │  (PubMed,    │  │  Search      │  │
│  │   NICE)      │  │   Cochrane)  │  │  (30+ sites) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                 │           │
│         └─────────────────┴─────────────────┘           │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           ▼
                  ┌─────────────────┐
                  │  Gemini 2.5     │
                  │  (Synthesis)    │
                  └─────────────────┘
                           │
                           ▼
                  Structured Response
                  with Verified Citations
```

### Evidence Sources (20+)

**Guidelines & Authorities:**
- WHO Guidelines (Physical Activity, Nutrition, etc.)
- CDC Guidelines (Exercise, Diet, Sleep, etc.)
- NICE Guidelines (UK clinical excellence)
- ACC/AHA Cardiovascular Guidelines
- ADA Diabetes Standards

**Primary Literature:**
- PubMed (40M+ articles)
- Cochrane Library (systematic reviews)
- Europe PMC (40M+ abstracts)
- PMC (full-text articles)
- Semantic Scholar

**Clinical Trials:**
- ClinicalTrials.gov API v2

**Drug Information:**
- OpenFDA (drug labels, adverse events)
- DailyMed (FDA drug labels)
- RxNorm (drug nomenclature)
- PubChem (chemical data)

**Specialty Sources:**
- AAP Guidelines (pediatrics)
- NCBI Books (StatPearls)
- OMIM (genetic disorders)
- MedlinePlus (consumer health)

**Real-Time Search:**
- Perplexity AI (30+ trusted medical domains)

## 🎯 Key Features Explained

### Smart Query Enhancement
- MeSH term mapping for better PubMed results
- Query expansion for lifestyle/prevention topics
- Automatic detection of medical specialties

### Citation Validation
- Extracts PMIDs from PubMed URLs
- Extracts DOIs from journal URLs
- Validates all citations against source databases
- No fabricated references

### Evidence Quality Ranking
1. Guidelines & consensus statements
2. Systematic reviews & meta-analyses
3. Randomized controlled trials
4. Observational cohorts
5. Case series & case reports

### Privacy-First Design
- localStorage with 1-hour expiration
- No server-side persistence
- No user data collection

## 📖 Usage Examples

### Doctor Mode
```
Query: "What are the latest guidelines for managing type 2 diabetes?"

Response includes:
- ADA Standards of Care 2024
- WHO Diabetes Guidelines
- Recent systematic reviews
- Drug recommendations with evidence
- All claims cited with PMIDs/DOIs
```

### General Mode
```
Query: "How much exercise do I need to stay healthy?"

Response includes:
- WHO Physical Activity Guidelines (150-300 min/week)
- CDC Exercise Recommendations
- Helpful exercises with descriptions
- When to see a doctor
- Simple, actionable advice
```

## 🔧 Development

### Common Commands

```bash
# Development
npm run dev          # Start dev server (localhost:3000)

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
```

### Environment Variables

See `.env.local` for all available configuration options.

## 📝 Documentation

- **DOCTOR_MODE_ARCHITECTURE.md** - Detailed doctor mode documentation
- **GENERAL_MODE_ARCHITECTURE.md** - Detailed general mode documentation
- **KIRO_USAGE_DOCUMENTATION.md** - Kiro AI assistant documentation
- **lib/clinical-decision-support/README.md** - Clinical decision support module documentation
- **IMPLEMENTATION_SUMMARY.md** - Latest implementation summary

## 🤝 Contributing

This is a private medical AI project. For questions or issues, contact the development team.

## ⚠️ Medical Disclaimer

MedGuidence AI is an educational and informational tool. It is NOT a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare providers with questions regarding medical conditions.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- Landing Page: `/`
- Doctor Mode: `/doctors and medical students`
- General Mode: `/general user`

---

Built with ❤️ using Kiro, Next.js, React, MedGemma and Google Gemini AI
