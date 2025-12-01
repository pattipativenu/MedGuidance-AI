---
inclusion: always
---

# MedGuidence AI - Project Structure

## Directory Organization

```
app/                          # Next.js App Router pages
├── api/                      # API route handlers
│   ├── chat/route.ts        # Main chat endpoint (streaming)
│   ├── radiology-triage/    # Radiology image analysis
│   └── admin/               # Admin/testing endpoints
├── doctor/page.tsx          # Doctor Mode UI (professionals)
├── general/page.tsx         # General Mode UI (consumers)
├── radiology-demo/          # Radiology demo interface
├── page.tsx                 # Landing page (mode selection)
├── layout.tsx               # Root layout (fonts, metadata)
└── globals.css              # Tailwind CSS imports

components/ui/               # Reusable UI components
├── sidebar.tsx              # Navigation sidebar
├── markdown-typewriter.tsx  # Streaming markdown renderer
├── evidence-loading.tsx     # Evidence gathering animation
├── annotated-image.tsx      # Medical image with bounding boxes
├── thermal-heatmap-image.tsx # Heatmap overlay for images
├── quick-actions.tsx        # Suggested follow-up questions
└── formatted-question.tsx   # User question display

lib/                         # Core business logic
├── evidence/                # Medical database integrations (20+)
│   ├── engine.ts           # Orchestrates parallel searches
│   ├── pubmed.ts           # PubMed/NCBI integration
│   ├── cochrane.ts         # Cochrane Library reviews
│   ├── clinical-trials.ts  # ClinicalTrials.gov API
│   ├── europepmc.ts        # Europe PMC full-text articles
│   ├── openfda.ts          # FDA drug/device data
│   └── [18 more sources]   # Guidelines, trials, drug info
├── clinical-decision-support/ # Clinical templates & risk tools
│   ├── index.ts            # Main CDS orchestrator
│   ├── suicide-risk-assessment.ts
│   ├── qt-risk-library.ts
│   └── adolescent-care-templates.ts
├── medgem/                  # MedGemma integration (optional)
├── gemini.ts                # Google Gemini AI client
├── storage.ts               # localStorage with expiration
├── response-parser.ts       # Parse AI responses into sections
├── smart-model-router.ts    # Route queries to optimal model
└── radiology-triage.ts      # Radiology urgency classification

hooks/
└── useGemini.ts             # Custom hook for Gemini streaming

public/logos/                # Evidence source logos (for UI)
```

## File Naming & Code Style

**Files:**
- Components: `kebab-case.tsx` (e.g., `evidence-loading-card.tsx`)
- Pages: `page.tsx` (Next.js App Router convention)
- API Routes: `route.ts` (Next.js App Router convention)
- Utilities: `kebab-case.ts` (e.g., `response-parser.ts`)

**Code:**
- Component names: `PascalCase` (e.g., `EvidenceLoadingCard`)
- Functions: `camelCase` (e.g., `gatherEvidence`, `parseResponse`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `GEMINI_MODELS`, `API_DELAY`)
- Interfaces/Types: `PascalCase` (e.g., `EvidenceSource`, `ChatMessage`)

**Imports:**
- Use path alias `@/` for all imports (e.g., `import { cn } from '@/lib/utils'`)
- Group imports: React/Next, third-party, local components, local utilities

## Architecture Patterns

### Evidence System (`lib/evidence/`)
- **One file per database**: Each source has its own module (e.g., `pubmed.ts`, `cochrane.ts`)
- **Consistent interface**: All sources export `comprehensiveSearch(query: string)` returning `Promise<Article[]>`
- **Rate limiting**: Use 350ms delays for NCBI APIs, respect API guidelines
- **Error handling**: Catch and log errors, never fail entire evidence gathering
- **Parallel execution**: `engine.ts` uses `Promise.all()` to query sources simultaneously
- **Caching**: Use `cache-manager.ts` for repeated queries (1-hour TTL)

### API Routes (`app/api/*/route.ts`)
- **Streaming responses**: Use `ReadableStream` with `TextEncoder` for long AI generations
- **Input validation**: Validate request body before processing
- **Error responses**: Return structured JSON errors with appropriate status codes
- **CORS**: Not needed (same-origin requests only)
- **Example pattern**:
  ```typescript
  export async function POST(req: Request) {
    const { messages, mode } = await req.json();
    // Validate inputs
    const stream = new ReadableStream({ /* streaming logic */ });
    return new Response(stream);
  }
  ```

### React Components (`components/ui/`)
- **Client components**: Add `"use client"` directive when using hooks, events, or browser APIs
- **Server components**: Default for static content (no directive needed)
- **shadcn/ui patterns**: Use existing shadcn components, maintain consistent styling
- **Composition**: Break complex UIs into smaller, focused components
- **Props**: Use TypeScript interfaces for prop types
- **Example**:
  ```typescript
  "use client"
  interface Props { content: string; onComplete?: () => void; }
  export function MyComponent({ content, onComplete }: Props) { /* ... */ }
  ```

### State Management
- **Local state**: `useState` for component-specific state (e.g., input values, UI toggles)
- **Persistent state**: `lib/storage.ts` utilities for localStorage with 1-hour expiration
- **Derived state**: `useMemo` for expensive computations (e.g., filtering, parsing)
- **Refs**: `useRef` for DOM elements, scroll positions, and mutable values
- **No global state**: Each mode (doctor/general) manages its own state independently

### File Organization Rules
- **New evidence sources**: Add to `lib/evidence/`, export from `engine.ts`
- **New UI components**: Add to `components/ui/`, use kebab-case naming
- **New API endpoints**: Create `app/api/[name]/route.ts`
- **Shared utilities**: Add to `lib/` with descriptive names
- **Tests**: Co-locate in `__tests__/` subdirectories (e.g., `lib/evidence/__tests__/`)

### Import Path Examples
```typescript
// Correct - use @ alias
import { gatherEvidence } from '@/lib/evidence/engine'
import { EvidenceLoading } from '@/components/ui/evidence-loading'
import { cn } from '@/lib/utils'

// Incorrect - avoid relative paths
import { gatherEvidence } from '../../lib/evidence/engine'
```
