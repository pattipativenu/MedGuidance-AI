# MedGuidance AI Evidence Engine

## Overview
The Evidence Engine is the core system that retrieves and integrates clinical evidence from multiple open, legitimate sources to support evidence-based medical decision-making.

## Architecture

### Evidence Sources

1. **ClinicalTrials.gov API**
   - Global clinical trial registry
   - Includes completed, ongoing, and terminated trials
   - Provides trial design, interventions, outcomes, and results
   - File: `clinical-trials.ts`

2. **openFDA API**
   - FDA drug product labels (indications, dosing, contraindications, warnings)
   - FAERS adverse event reports
   - Drug recall enforcement data
   - Files: `openfda.ts`

3. **OpenAlex API**
   - Open scholarly literature catalog
   - Systematic reviews and meta-analyses
   - RCTs and observational studies
   - Citation counts and open access status
   - File: `openalex.ts`

4. **PubMed/NCBI E-utilities**
   - Direct access to PubMed indexed articles
   - MeSH term indexing
   - Abstracts and full metadata
   - Systematic reviews and RCTs
   - File: `pubmed.ts`

5. **Europe PMC REST API**
   - 40+ million abstracts from life sciences
   - **Includes preprints** (bioRxiv, medRxiv, etc.)
   - Open access full-text articles
   - Citations and references
   - No API key required
   - File: `europepmc.ts`

6. **Cochrane Library (via PubMed)** ✨ NEW
   - Gold standard systematic reviews
   - Accessed through PubMed indexing (legitimate, free)
   - Intervention, diagnostic, and methodology reviews
   - Highest quality evidence synthesis
   - No API key required
   - File: `cochrane.ts`

7. **Future Integrations**
   - WHO ICTRP (International Clinical Trials Registry Platform)
   - NICE Guidelines
   - NLM Open-i (medical images)

### Main Coordinator

**`engine.ts`** - Orchestrates all evidence sources:
- Runs parallel searches across all APIs
- Aggregates results into unified `EvidencePackage`
- Formats evidence for AI prompt inclusion
- Logs evidence retrieval metrics

## Usage

```typescript
import { gatherEvidence, formatEvidenceForPrompt } from "@/lib/evidence/engine";

// Gather evidence for a clinical query
const evidence = await gatherEvidence(
  "Management of acute myocardial infarction",
  ["aspirin", "clopidogrel"] // Optional drug names
);

// Format for AI prompt
const promptContext = formatEvidenceForPrompt(evidence);
```

## Evidence Hierarchy

The system prioritizes evidence according to clinical standards:

1. **Guidelines & Consensus Statements** (Highest)
2. **Systematic Reviews & Meta-Analyses**
3. **Randomized Controlled Trials (RCTs)**
4. **Observational Cohorts**
5. **Case Series & Case Reports**
6. **Expert Opinion / Mechanism-Only** (Lowest)

## API Rate Limits & Best Practices

### ClinicalTrials.gov
- No authentication required
- Rate limit: ~100 requests/minute
- Best practice: Cache results, limit to 5-10 trials per query

### openFDA
- No authentication required
- Rate limit: 240 requests/minute (1000/hour with API key)
- Best practice: Batch drug queries when possible

### OpenAlex
- No authentication required
- Rate limit: Polite pool (10 req/sec with email in User-Agent)
- Best practice: Include email in User-Agent header

### PubMed/NCBI
- Optional API key (increases rate limit from 3 to 10 req/sec)
- Set `NCBI_API_KEY` environment variable
- Best practice: Use ESummary for basic info, EFetch for abstracts

### Europe PMC
- No authentication required
- No strict rate limits (reasonable use)
- Best practice: Use `resultType=core` for full metadata
- Supports advanced queries with field search (AUTH:, TITLE:, etc.)

### Cochrane Library
- Accessed via PubMed (no separate API key needed)
- Uses same rate limits as PubMed (3-10 req/sec)
- Searches for "Cochrane Database Syst Rev" journal
- Best practice: Prioritize Cochrane reviews as gold standard evidence

## Error Handling

All API functions:
- Return empty arrays on failure (never throw)
- Log errors to console for debugging
- Allow the system to continue with partial evidence

## Future Enhancements

1. **Caching Layer**
   - Redis/memory cache for frequently queried evidence
   - TTL: 24 hours for clinical trials, 7 days for literature

2. **Evidence Quality Scoring**
   - Assign confidence scores based on source quality
   - Weight by study design, sample size, recency

3. **MedGemma Integration**
   - Extract clinical entities from images
   - Generate targeted evidence queries from X-rays/CT/MRI

4. **Citation Management**
   - Generate proper citations (AMA, Vancouver style)
   - Create clickable reference links

5. **Real-time Updates**
   - WebSocket connections for long-running evidence searches
   - Progressive evidence loading

## Testing

```bash
# Test individual sources
npm run test:evidence

# Test full evidence pipeline
npm run test:evidence:integration
```

## Compliance

All evidence sources are:
- ✅ Publicly accessible
- ✅ Free to use (no licensing fees)
- ✅ Legitimate medical/scientific databases
- ✅ Properly attributed in responses

We do NOT use:
- ❌ Proprietary databases (UpToDate, Micromedex, etc.)
- ❌ Competitor APIs (OpenEvidence, etc.)
- ❌ Scraped content
- ❌ Unverified sources
