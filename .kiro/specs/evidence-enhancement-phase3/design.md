# Design Document - Phase 3: Chunk-level Attribution and Evaluation Framework

## Overview

Phase 3 implements precise chunk-level attribution and automated evaluation to enable data-driven quality improvements. Instead of citing entire papers, the system cites specific sentences with provenance tracking (PMID + sentence index). An evaluation framework with ground truth test cases measures citation precision and recall, enabling objective assessment of system improvements.

**Key Innovation:** Sentence-level citations provide verifiable, precise attribution while the evaluation framework enables continuous quality measurement.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Article Processing                       │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Abstract → Sentences → Chunks with Provenance   │       │
│  │  PMID:12345, Sentence 0: "First sentence..."     │       │
│  │  PMID:12345, Sentence 1: "Second sentence..."    │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Chunk-level Semantic Search                     │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Query → Embed → Find Similar Sentences          │       │
│  │  Return: Sentence + Context (±1 sentence)        │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              AI Generation with Chunks                       │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Generate response citing specific sentences      │       │
│  │  Format: "...claim [PMID:12345, S:2]"           │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Citation Validation                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Extract citations → Verify PMIDs → Verify       │       │
│  │  sentences → Calculate precision                 │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Evaluation Framework                            │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Test Set → Run Queries → Compare to Ground      │       │
│  │  Truth → Calculate Precision/Recall → Report     │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Sentence Splitter

**Purpose:** Split abstracts into sentences while preserving provenance.

**Interface:**
```typescript
interface SentenceSplitter {
  // Split text into sentences
  splitIntoSentences(text: string): string[];
  
  // Create chunks with provenance
  createChunks(article: Article): Chunk[];
}

interface Chunk {
  pmid: string;
  sentenceIndex: number;
  text: string;
  context?: {
    before?: string;  // Previous sentence
    after?: string;   // Next sentence
  };
  metadata: {
    title: string;
    source: string;
    publicationDate?: string;
    journal?: string;
  };
}
```

### 2. Chunk-level Search Engine

**Purpose:** Search and retrieve relevant sentences instead of full abstracts.

**Interface:**
```typescript
interface ChunkSearchEngine {
  // Search for relevant chunks
  searchChunks(query: string, options: ChunkSearchOptions): Promise<ChunkResult[]>;
  
  // Get chunks for specific article
  getArticleChunks(pmid: string): Promise<Chunk[]>;
}

interface ChunkSearchOptions {
  topK?: number;  // Number of chunks to return
  minSimilarity?: number;  // Minimum similarity threshold
  includeContext?: boolean;  // Include ±1 sentence context
  sources?: string[];  // Filter by source
}

interface ChunkResult {
  chunk: Chunk;
  similarity: number;
  rank: number;
}
```

### 3. Citation Validator

**Purpose:** Validate that generated citations match retrieved evidence.

**Interface:**
```typescript
interface CitationValidator {
  // Extract citations from generated text
  extractCitations(text: string): Citation[];
  
  // Validate citations against evidence
  validateCitations(citations: Citation[], evidence: Chunk[]): ValidationResult;
  
  // Calculate precision
  calculatePrecision(validationResult: ValidationResult): number;
}

interface Citation {
  pmid: string;
  sentenceIndex?: number;
  text: string;  // The claim being cited
  position: number;  // Position in generated text
}

interface ValidationResult {
  totalCitations: number;
  validCitations: number;
  invalidCitations: Citation[];
  precision: number;
}
```

### 4. Evaluation Framework

**Purpose:** Automated testing with ground truth to measure system performance.

**Interface:**
```typescript
interface EvaluationFramework {
  // Run evaluation on test set
  runEvaluation(testSet: TestCase[]): Promise<EvaluationReport>;
  
  // Evaluate single test case
  evaluateTestCase(testCase: TestCase): Promise<TestCaseResult>;
  
  // Calculate metrics
  calculateMetrics(results: TestCaseResult[]): Metrics;
}

interface TestCase {
  id: string;
  query: string;
  expectedCitations: {
    pmid: string;
    sentenceIndex?: number;
    keyPhrase: string;  // Key phrase that should be cited
  }[];
  category: string;  // e.g., "diabetes", "cardiology"
  difficulty: 'easy' | 'medium' | 'hard';
}

interface TestCaseResult {
  testCase: TestCase;
  generatedResponse: string;
  extractedCitations: Citation[];
  precision: number;
  recall: number;
  f1Score: number;
}

interface Metrics {
  averagePrecision: number;
  averageRecall: number;
  averageF1: number;
  byCategory: Map<string, Metrics>;
  byDifficulty: Map<string, Metrics>;
}
```

## Data Models

### Chunk with Provenance

```typescript
interface ChunkWithProvenance {
  // Unique identifier
  id: string;  // Format: "PMID:12345:S:2"
  
  // Content
  text: string;
  
  // Provenance
  pmid: string;
  sentenceIndex: number;
  source: string;  // 'pubmed', 'cochrane', etc.
  
  // Context
  previousSentence?: string;
  nextSentence?: string;
  
  // Metadata
  articleTitle: string;
  journal?: string;
  publicationDate?: string;
  authors?: string[];
  doi?: string;
  
  // Search metadata
  embedding?: number[];
  indexedAt?: string;
}
```

### Test Set Format

```json
{
  "version": "1.0",
  "created": "2025-01-01T00:00:00Z",
  "testCases": [
    {
      "id": "diabetes-001",
      "query": "What is the first-line treatment for type 2 diabetes?",
      "category": "diabetes",
      "difficulty": "easy",
      "expectedCitations": [
        {
          "pmid": "12345678",
          "sentenceIndex": 3,
          "keyPhrase": "Metformin is recommended as first-line therapy"
        }
      ],
      "rationale": "ADA guidelines clearly state metformin as first-line"
    }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Provenance completeness
*For any* chunk created from an article, the chunk must include PMID, sentence index, and source
**Validates: Requirements 2.3, 2.4**

### Property 2: Sentence boundary preservation
*For any* abstract split into sentences, concatenating the sentences should reconstruct the original abstract (modulo whitespace)
**Validates: Requirements 2.2**

### Property 3: Citation validation correctness
*For any* citation with valid PMID and sentence index, the validator should mark it as valid if the sentence exists in retrieved evidence
**Validates: Requirements 4.2, 4.3**

### Property 4: Precision calculation accuracy
*For any* validation result, precision should equal validCitations / totalCitations
**Validates: Requirements 6.1, 6.3**

### Property 5: Recall calculation accuracy
*For any* test case, recall should equal citedKeyEvidence / totalKeyEvidence
**Validates: Requirements 6.2, 6.4**

### Property 6: Context window consistency
*For any* chunk with context, the context should be the actual adjacent sentences from the source article
**Validates: Requirements 3.3**

### Property 7: Chunk deduplication
*For any* set of chunks from the same article, no two chunks should have the same sentence index
**Validates: Requirements 2.1, 2.3**

### Property 8: Graceful degradation
*For any* query, when chunk-level search fails, the system should fall back to abstract-level search
**Validates: Requirements 2.5, 3.5**

## Error Handling

### Sentence Splitting Failures
- **Cause:** Malformed text, unusual formatting
- **Handling:** Log error, fall back to full abstract
- **User Impact:** Less precise citations (full abstract instead of sentence)

### Citation Validation Failures
- **Cause:** Invalid citation format, missing evidence
- **Handling:** Log error, mark citation as unverifiable
- **User Impact:** Lower precision score, flagged citations

### Evaluation Failures
- **Cause:** Test case format error, generation failure
- **Handling:** Log error, skip test case, continue with others
- **User Impact:** Incomplete evaluation report

### Chunk Search Failures
- **Cause:** Embedding failure, search timeout
- **Handling:** Log error, fall back to abstract-level search
- **User Impact:** Less precise retrieval

## Testing Strategy

### Unit Tests

**Sentence Splitter:**
- Test splitting with various abstract formats
- Test provenance tracking
- Test context window creation
- Test edge cases (single sentence, empty abstract)

**Citation Validator:**
- Test citation extraction from various formats
- Test validation logic
- Test precision calculation
- Test invalid citation handling

**Evaluation Framework:**
- Test test case loading
- Test metric calculation
- Test report generation
- Test error handling

### Property-Based Tests

**Property 1: Provenance completeness**
- Generate random articles
- Verify all chunks have complete provenance

**Property 2: Sentence boundary preservation**
- Generate random abstracts
- Verify split + join = original

**Property 3: Citation validation correctness**
- Generate random citations and evidence
- Verify validation logic

**Property 4-5: Metric calculation accuracy**
- Generate random validation results
- Verify precision/recall calculations

### Integration Tests

**End-to-End Chunk-level Attribution:**
- Test full pipeline from article to chunk-level citation
- Verify provenance preservation
- Measure latency impact

**Evaluation Framework:**
- Run evaluation on sample test set
- Verify metrics calculation
- Test report generation

## Performance Considerations

### Sentence Splitting
- **Latency:** ~1-5ms per abstract
- **Throughput:** 1000+ abstracts/second
- **Memory:** Minimal (streaming)

### Chunk-level Search
- **Latency:** +50-100ms vs abstract-level (more embeddings)
- **Throughput:** 5-10 queries/second
- **Memory:** ~2x abstract-level (more chunks)

### Citation Validation
- **Latency:** ~10-20ms per response
- **Throughput:** 50+ responses/second
- **Memory:** Minimal

### Evaluation
- **Latency:** ~30-60 seconds for 50 test cases
- **Throughput:** 1-2 test cases/second
- **Memory:** Moderate (loads test set)

## Deployment Considerations

### Test Set Management
- Store test set in version control
- Use JSON format for easy editing
- Include rationale for each test case
- Regular updates as system evolves

### Evaluation Automation
- Run evaluation on every major change
- Track metrics over time
- Alert on regression (precision/recall drop)
- Generate comparison reports

### Monitoring
- Track citation precision in production
- Monitor chunk-level search performance
- Alert on validation failures
- Dashboard for metrics visualization

## Migration Path

### Step 1: Sentence Splitting
1. Implement sentence splitter
2. Test with sample abstracts
3. Integrate with evidence engine

### Step 2: Chunk-level Search
1. Extend semantic search to chunks
2. Test retrieval quality
3. Measure performance impact

### Step 3: Citation Validation
1. Implement citation extractor
2. Implement validator
3. Test with sample responses

### Step 4: Evaluation Framework
1. Create initial test set (10-20 cases)
2. Implement evaluation runner
3. Generate baseline metrics

### Step 5: Expansion
1. Expand test set to 50+ cases
2. Add category-specific tests
3. Automate evaluation runs
4. Create monitoring dashboard

