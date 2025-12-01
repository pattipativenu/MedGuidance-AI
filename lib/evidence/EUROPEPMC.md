# Europe PMC Integration Guide

## Overview

Europe PMC (PubMed Central) is a comprehensive database of life sciences literature with over 40 million abstracts. It's particularly valuable because it includes **preprints** (bioRxiv, medRxiv) alongside peer-reviewed articles.

## Key Features

✅ **No API Key Required** - Free and open access  
✅ **Includes Preprints** - Get the latest research before peer review  
✅ **40+ Million Articles** - Comprehensive coverage  
✅ **Open Access Focus** - Many full-text articles available  
✅ **Advanced Search** - Field-specific queries (author, title, journal)  
✅ **Citations & References** - Track research impact  
✅ **Multiple Sources** - PubMed, PMC, preprints, patents, clinical guidelines

## Quick Start

```typescript
import { searchEuropePMC, searchCOVID19, searchPreprints } from "@/lib/evidence/europepmc";

// Basic search
const results = await searchEuropePMC("diabetes", { pageSize: 10 });

// COVID-19 research (comprehensive query)
const covidResults = await searchCOVID19(25);

// Latest preprints
const preprints = await searchPreprints("cancer immunotherapy", 15);
```

## Search Options

```typescript
searchEuropePMC(query, {
  pageSize: 25,           // Number of results (default: 25)
  cursorMark: "*",        // Pagination cursor (default: "*" for first page)
  sort: "relevance",      // "relevance" | "date" | "cited"
  resultType: "core",     // "core" | "lite" | "idlist"
  synonym: true,          // Enable synonym expansion (default: true)
})
```

## Field Search Syntax

Europe PMC supports powerful field-specific searches:

```typescript
// Search by author
AUTH:"Smith J"

// Search by title
TITLE:"machine learning"

// Search by journal
JOURNAL:"Nature"

// Search by publication year
PUB_YEAR:2024
PUB_YEAR:[2020 TO 2024]

// Search by MeSH terms
MESH:"Diabetes Mellitus"

// Filter by source
SRC:MED        // PubMed
SRC:PMC        // PubMed Central
SRC:PPR        // Preprints

// Filter by open access
OPEN_ACCESS:Y

// Combine fields
TITLE:"cancer" AND AUTH:"Johnson" AND PUB_YEAR:2024
```

## Common Use Cases

### 1. Latest Research (Including Preprints)

```typescript
import { searchRecent } from "@/lib/evidence/europepmc";

const latest = await searchRecent("hypertension treatment", 20);
// Returns articles sorted by publication date (newest first)
```

### 2. Highly Cited Articles

```typescript
import { searchHighlyCited } from "@/lib/evidence/europepmc";

const influential = await searchHighlyCited("CRISPR", 15);
// Returns articles sorted by citation count
```

### 3. Open Access Only

```typescript
import { searchOpenAccess } from "@/lib/evidence/europepmc";

const openAccess = await searchOpenAccess("diabetes", 20);
// Returns only open access articles with full text
```

### 4. Preprints (Cutting-Edge Research)

```typescript
import { searchPreprints } from "@/lib/evidence/europepmc";

const preprints = await searchPreprints("COVID-19 vaccine", 10);
// Returns preprints from bioRxiv, medRxiv, etc.
```

### 5. Get Specific Article

```typescript
import { getArticleById } from "@/lib/evidence/europepmc";

// By PMID
const article = await getArticleById("33301246", "med");

// By DOI
const article2 = await getArticleById("10.1038/s41586-020-2008-3", "doi");
```

### 6. Citations & References

```typescript
import { getCitations, getReferences } from "@/lib/evidence/europepmc";

// Get articles that cite this one
const citations = await getCitations("33301246", "med", 25);

// Get articles this one references
const references = await getReferences("33301246", "med", 25);
```

## COVID-19 Research

The comprehensive COVID-19 query includes all variants and related terms:

```typescript
import { searchCOVID19 } from "@/lib/evidence/europepmc";

const covidResearch = await searchCOVID19(50);
```

This searches for:
- 2019-nCoV, COVID-19, SARS-CoV-2
- Coronavirus variants
- SARS, MERS
- ACE2, ARDS
- And more...

## Response Format

```typescript
interface EuropePMCArticle {
  id: string;
  source: string;              // "MED" (PubMed), "PMC", "PPR" (preprint)
  pmid?: string;
  pmcid?: string;
  doi?: string;
  title: string;
  authorString?: string;       // "Smith J, Johnson A, Williams B"
  journalTitle?: string;
  pubYear?: string;
  pubType?: string;
  isOpenAccess?: string;       // "Y" or "N"
  citedByCount?: number;
  abstractText?: string;
  firstPublicationDate?: string;
}
```

## Rate Limits

- No strict rate limits
- Reasonable use policy
- No authentication required
- Recommended: Don't exceed 10 requests/second

## Best Practices

1. **Use Field Search** - More precise results
   ```typescript
   TITLE:"diabetes" AND PUB_YEAR:[2023 TO 2025]
   ```

2. **Sort by Date for Latest** - Get cutting-edge research
   ```typescript
   searchEuropePMC(query, { sort: "date" })
   ```

3. **Include Preprints** - Don't miss latest findings
   ```typescript
   searchPreprints(query, 10)
   ```

4. **Filter Open Access** - Get full-text articles
   ```typescript
   searchOpenAccess(query, 20)
   ```

5. **Check Citations** - Assess research impact
   ```typescript
   article.citedByCount
   ```

## Integration with Evidence Engine

Europe PMC is automatically integrated into the main evidence engine:

```typescript
import { gatherEvidence } from "@/lib/evidence/engine";

const evidence = await gatherEvidence("acute myocardial infarction");

// Evidence package includes:
// - europePMCRecent: Latest articles (including preprints)
// - europePMCCited: Highly cited articles
// - europePMCPreprints: Preprints only
// - europePMCOpenAccess: Open access articles
```

## Testing

Run the test suite:

```bash
npx tsx lib/evidence/test-europepmc.ts
```

Run examples:

```bash
npx tsx lib/evidence/europepmc-examples.ts
```

## Resources

- **API Documentation**: https://europepmc.org/RestfulWebService
- **Field Search**: https://www.ebi.ac.uk/europepmc/webservices/test/rest/fields
- **Web Interface**: https://europepmc.org/

## Advantages Over PubMed

1. **Preprints Included** - bioRxiv, medRxiv, etc.
2. **No API Key Needed** - Simpler setup
3. **Better JSON API** - Easier to parse than PubMed XML
4. **Open Access Focus** - More full-text articles
5. **Citation Tracking** - Built-in citation counts
6. **Multiple Sources** - Not just PubMed

## When to Use Europe PMC vs PubMed

**Use Europe PMC when:**
- You want the latest research (preprints)
- You need open access articles
- You want simpler API integration
- You need citation counts

**Use PubMed when:**
- You need MeSH term indexing
- You want only peer-reviewed articles
- You need specific PubMed filters
- You're doing systematic reviews

**Best Practice:** Use both! The evidence engine queries both sources in parallel for comprehensive coverage.
