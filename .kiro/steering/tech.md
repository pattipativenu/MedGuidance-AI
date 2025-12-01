---
inclusion: always
---

# Tech Stack & Development Guidelines

## Core Stack

**Next.js 16 + React 19 + TypeScript 5**
- Use App Router (not Pages Router) for all routes
- Leverage React Server Components by default (add `"use client"` only when needed)
- React Compiler enabled: avoid manual memoization unless necessary
- TypeScript strict mode: all code must be fully typed
- Import path alias: Always use `@/*` (e.g., `import { cn } from '@/lib/utils'`)

**Styling**
- Tailwind CSS v4: Use utility classes, avoid custom CSS
- shadcn/ui components: new-york style, neutral base color
- Framer Motion for animations, Lottie for illustrations
- Fonts: Inter (UI), Lora (content), Geist Mono (code)

## AI Integration

**Google Gemini API**
- Primary model: `gemini-2.5-flash` for text generation
- Vision model: `gemini-2.0-flash-exp` for medical image analysis
- Always use streaming responses via `ReadableStream` for better UX
- Import from: `@google/generative-ai` or `@google-cloud/vertexai`
- Client initialization in `lib/gemini.ts`

## Medical Evidence System

**20+ Integrated Databases**
- Core sources: PubMed, Europe PMC, Cochrane, ClinicalTrials.gov, OpenFDA
- Guidelines: WHO, CDC, NICE, AAP
- Drug info: DailyMed, RxNorm, MedlinePlus
- Research: OpenAlex, Semantic Scholar, PubChem

**Evidence Engine Rules**
- Use `lib/evidence/engine.ts` for parallel searches
- Rate limiting: 350ms delay for NCBI APIs (required)
- Error handling: Catch and log, never fail entire evidence gathering
- Caching: 1-hour TTL via `lib/evidence/cache-manager.ts`
- Each source exports `comprehensiveSearch(query: string): Promise<Article[]>`

## State Management

**Client State**
- Use React hooks: `useState`, `useEffect`, `useMemo`, `useRef`
- No global state library (Redux, Zustand, etc.)
- Each mode (doctor/general) manages independent state

**Persistent Storage**
- Use `lib/storage.ts` utilities for localStorage
- 1-hour automatic expiration for privacy
- Never persist PHI/PII or medical images server-side

## File Processing

**Images**
- Supported formats: JPEG, PNG, WebP
- Encoding: Base64 for API transmission
- Validation: MIME type checking before processing
- Processing: Client-side or in-memory only (no server storage)

**PDFs**
- Library: pdf-parse (currently disabled)
- Re-enable only if explicitly requested

## API Routes

**Pattern for `app/api/*/route.ts`**
```typescript
export async function POST(req: Request) {
  const body = await req.json();
  // Validate inputs
  const stream = new ReadableStream({
    async start(controller) {
      // Stream response chunks
      controller.enqueue(encoder.encode(data));
      controller.close();
    }
  });
  return new Response(stream);
}
```

**Requirements**
- Use streaming for AI responses
- Validate request body before processing
- Return structured JSON errors with appropriate status codes
- No CORS configuration needed (same-origin only)

## Performance Patterns

- React Compiler handles memoization automatically
- Use `Promise.all()` for parallel evidence gathering
- Stream AI responses to improve perceived performance
- Automatic code splitting via App Router
- Rate limit external APIs (350ms for NCBI)

## Environment Variables

**Required**
- `GEMINI_API_KEY` - Google Gemini API key

**Optional (improves rate limits)**
- `NCBI_API_KEY` - PubMed/NCBI API key
- `OPENALEX_EMAIL` - OpenAlex polite pool access

**Access in code**
- Server: `process.env.GEMINI_API_KEY`
- Client: Must be prefixed with `NEXT_PUBLIC_` (avoid for sensitive keys)

## Development Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint check
```

## Code Quality Rules

- All TypeScript code must pass strict type checking
- Use ESLint configuration (no warnings in production)
- Prefer functional components over class components
- Use async/await over raw Promises
- Handle errors gracefully with try/catch
- Add JSDoc comments for complex functions
