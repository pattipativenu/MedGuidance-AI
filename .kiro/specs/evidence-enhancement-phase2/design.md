# Design Document - Phase 2: Semantic Search with Biomedical Embeddings

## Overview

Phase 2 introduces semantic search capabilities to the evidence retrieval system using biomedical embeddings. This enhancement enables the system to find relevant medical literature based on semantic similarity rather than just keyword matching, significantly improving recall and relevance.

The design leverages state-of-the-art biomedical language models (PubMedBERT, BioLinkBERT) to generate embeddings, stores them in a vector database for efficient retrieval, and implements hybrid search combining keyword and semantic results.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Query                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Query Processing Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Keyword    │  │   Semantic   │  │    Hybrid    │      │
│  │   Search     │  │   Search     │  │    Search    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Embedding Generation                            │
│  ┌──────────────────────────────────────────────────┐       │
│  │  PubMedBERT / BioLinkBERT                        │       │
│  │  - 768-dimensional embeddings                    │       │
│  │  - Trained on biomedical literature              │       │
│  │  - Cached in memory for performance              │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Vector Database Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pinecone   │  │   Weaviate   │  │    Qdrant    │      │
│  │   (Cloud)    │  │   (Self-host)│  │  (Self-host) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  - Cosine similarity search                                 │
│  - Top-k retrieval                                          │
│  - Metadata filtering                                       │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Result Fusion & Reranking                       │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Reciprocal Rank Fusion (RRF)                    │       │
│  │  - Combines keyword + semantic results           │       │
│  │  - Deduplicates by PMID                          │       │
│  └──────────────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Cross-Encoder Reranking (Optional)              │       │
│  │  - MS MARCO MiniLM                               │       │
│  │  - Query-document pair scoring                   │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Ranked Results                                  │
│  - Semantically relevant articles                           │
│  - Similarity scores                                        │
│  - Source attribution                                       │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction

```
┌──────────────┐
│ Evidence     │
│ Engine       │
└──────┬───────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Keyword      │  │ Semantic     │
│ Search       │  │ Search       │
│ (Phase 1)    │  │ (Phase 2)    │
└──────┬───────┘  └──────┬───────┘
       │                 │
       │                 ▼
       │          ┌──────────────┐
       │          │ Embedding    │
       │          │ Generator    │
       │          └──────┬───────┘
       │                 │
       │                 ▼
       │          ┌──────────────┐
       │          │ Vector DB    │
       │          │ Client       │
       │          └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
                ▼
         ┌──────────────┐
         │ Result       │
         │ Fusion       │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │ Reranker     │
         │ (Optional)   │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │ Final        │
         │ Results      │
         └──────────────┘
```

## Components and Interfaces

### 1. Embedding Generator

**Purpose:** Generate semantic embeddings for queries and documents using biomedical language models.

**Interface:**
```typescript
interface EmbeddingGenerator {
  // Generate embedding for a single text
  generateEmbedding(text: string): Promise<number[]>;
  
  // Generate embeddings for multiple texts (batched)
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  
  // Get embedding dimension
  getDimension(): number;
  
  // Check if model is loaded
  isReady(): boolean;
}
```

**Implementation Details:**
- Use `@xenova/transformers` for running models in Node.js
- Support PubMedBERT (`microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext`)
- Support BioLinkBERT (`michiyasunaga/BioLinkBERT-base`)
- Cache model in memory after first load
- Normalize embeddings for cosine similarity
- Handle text truncation (512 tokens max)
- Batch processing for efficiency

### 2. Vector Database Client

**Purpose:** Store and query article embeddings in a vector database.

**Interface:**
```typescript
interface VectorDatabaseClient {
  // Store embeddings with metadata
  upsert(vectors: VectorRecord[]): Promise<void>;
  
  // Query for similar vectors
  query(embedding: number[], topK: number, filter?: MetadataFilter): Promise<QueryResult[]>;
  
  // Delete vectors by ID
  delete(ids: string[]): Promise<void>;
  
  // Get database statistics
  getStats(): Promise<DatabaseStats>;
  
  // Check if database is available
  isAvailable(): Promise<boolean>;
}

interface VectorRecord {
  id: string;  // PMID or unique identifier
  embedding: number[];
  metadata: {
    pmid?: string;
    title: string;
    abstract?: string;
    source: string;  // 'pubmed', 'cochrane', etc.
    publicationDate?: string;
    journal?: string;
  };
}

interface QueryResult {
  id: string;
  score: number;  // Cosine similarity
  metadata: Record<string, any>;
}
```

**Supported Databases:**
- **Pinecone** (Cloud, managed)
- **Weaviate** (Self-hosted, open-source)
- **Qdrant** (Self-hosted, Rust-based)

### 3. Semantic Search Engine

**Purpose:** Orchestrate semantic search across evidence sources.

**Interface:**
```typescript
interface SemanticSearchEngine {
  // Perform semantic search
  search(query: string, options: SearchOptions): Promise<SemanticSearchResult[]>;
  
  // Perform hybrid search (keyword + semantic)
  hybridSearch(query: string, options: SearchOptions): Promise<HybridSearchResult[]>;
  
  // Index new articles
  indexArticles(articles: Article[]): Promise<IndexResult>;
  
  // Get search statistics
  getStats(): SearchStats;
}

interface SearchOptions {
  topK?: number;  // Number of results (default: 10)
  minSimilarity?: number;  // Minimum similarity threshold (default: 0.7)
  sources?: string[];  // Filter by source
  rerank?: boolean;  // Enable reranking (default: false)
}

interface SemanticSearchResult {
  article: Article;
  similarity: number;
  source: string;
}
```

### 4. Result Fusion

**Purpose:** Combine keyword and semantic search results using reciprocal rank fusion.

**Algorithm:**
```typescript
function reciprocalRankFusion(
  keywordResults: SearchResult[],
  semanticResults: SearchResult[],
  k: number = 60  // RRF constant
): SearchResult[] {
  const scores = new Map<string, number>();
  
  // Score keyword results
  keywordResults.forEach((result, rank) => {
    const score = 1 / (k + rank + 1);
    scores.set(result.id, (scores.get(result.id) || 0) + score);
  });
  
  // Score semantic results
  semanticResults.forEach((result, rank) => {
    const score = 1 / (k + rank + 1);
    scores.set(result.id, (scores.get(result.id) || 0) + score);
  });
  
  // Sort by combined score
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ id, score }));
}
```

### 5. Cross-Encoder Reranker

**Purpose:** Rerank search results using a cross-encoder model for improved relevance.

**Interface:**
```typescript
interface Reranker {
  // Rerank results based on query
  rerank(query: string, results: SearchResult[]): Promise<RankedResult[]>;
  
  // Check if reranker is available
  isAvailable(): boolean;
}

interface RankedResult extends SearchResult {
  rerankScore: number;
  originalRank: number;
}
```

**Implementation:**
- Use MS MARCO MiniLM cross-encoder
- Score query-document pairs
- Sort by reranking score
- Fallback to original ranking on failure

## Data Models

### Article Embedding

```typescript
interface ArticleEmbedding {
  pmid: string;
  embedding: number[];  // 768-dimensional vector
  metadata: {
    title: string;
    abstract?: string;
    source: string;
    publicationDate?: string;
    journal?: string;
    authors?: string[];
    doi?: string;
  };
  indexedAt: string;  // ISO timestamp
}
```

### Search Configuration

```typescript
interface SemanticSearchConfig {
  enabled: boolean;
  embeddingModel: 'pubmedbert' | 'biolinkbert';
  vectorDatabase: 'pinecone' | 'weaviate' | 'qdrant';
  topK: number;
  minSimilarity: number;
  enableReranking: boolean;
  batchSize: number;  // For indexing
  cacheResults: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Semantic similarity symmetry
*For any* two texts A and B, the cosine similarity between their embeddings should be symmetric: similarity(A, B) = similarity(B, A)
**Validates: Requirements 1.1, 1.5**

### Property 2: Embedding dimension consistency
*For any* text input, the generated embedding should always have the same dimension as specified by the model
**Validates: Requirements 2.4**

### Property 3: Hybrid search completeness
*For any* query, hybrid search results should include all unique articles from both keyword and semantic searches
**Validates: Requirements 4.1, 4.3**

### Property 4: Reciprocal rank fusion monotonicity
*For any* two articles where article A ranks higher than article B in both keyword and semantic results, article A should rank higher than article B in the fused results
**Validates: Requirements 4.2, 4.4**

### Property 5: Graceful degradation
*For any* query, when semantic search fails, the system should return keyword search results without error
**Validates: Requirements 1.4, 3.4, 6.5**

### Property 6: Cache consistency
*For any* query, repeated semantic searches with the same parameters should return identical results when cached
**Validates: Requirements 7.1, 7.2**

### Property 7: Metadata preservation
*For any* article indexed in the vector database, all metadata fields should be retrievable with the embedding
**Validates: Requirements 3.5, 8.5**

### Property 8: Similarity threshold filtering
*For any* query with minimum similarity threshold T, all returned results should have similarity >= T
**Validates: Requirements 10.2**

### Property 9: Top-k result limit
*For any* query with top-k parameter K, the system should return at most K results
**Validates: Requirements 3.3, 10.1**

### Property 10: Reranking score ordering
*For any* reranked results, articles should be ordered by descending reranking score
**Validates: Requirements 6.4**

## Error Handling

### Embedding Generation Failures
- **Cause:** Model loading failure, out of memory, invalid input
- **Handling:** Log error, fall back to keyword search
- **User Impact:** None (graceful degradation)

### Vector Database Unavailability
- **Cause:** Network issues, database down, authentication failure
- **Handling:** Log error, fall back to keyword search, retry with exponential backoff
- **User Impact:** Slightly slower queries (no semantic search)

### Reranking Failures
- **Cause:** Model loading failure, timeout
- **Handling:** Log error, return original ranking
- **User Impact:** Potentially less relevant ordering

### Indexing Failures
- **Cause:** Invalid article data, database write failure
- **Handling:** Log error, skip article, continue with batch
- **User Impact:** Some articles not semantically searchable

## Testing Strategy

### Unit Tests

**Embedding Generator:**
- Test embedding generation for various medical terms
- Test batch embedding generation
- Test text truncation handling
- Test model caching
- Test error handling for invalid inputs

**Vector Database Client:**
- Test upsert operations
- Test query operations with various parameters
- Test metadata filtering
- Test connection failure handling
- Test batch operations

**Result Fusion:**
- Test RRF algorithm with various input combinations
- Test deduplication logic
- Test edge cases (empty results, single source)

**Reranker:**
- Test reranking with various queries
- Test score ordering
- Test fallback on failure

### Property-Based Tests

**Property 1: Semantic similarity symmetry**
- Generate random pairs of medical texts
- Verify similarity(A, B) ≈ similarity(B, A) (within floating-point tolerance)

**Property 2: Embedding dimension consistency**
- Generate random medical texts
- Verify all embeddings have dimension 768

**Property 3: Hybrid search completeness**
- Generate random query
- Verify hybrid results contain all unique PMIDs from both searches

**Property 4: RRF monotonicity**
- Generate ranked lists where A > B in both
- Verify A > B in fused results

**Property 5: Graceful degradation**
- Simulate vector database failure
- Verify system returns keyword results

### Integration Tests

**End-to-End Semantic Search:**
- Test full semantic search pipeline
- Verify results are relevant
- Measure latency

**Hybrid Search:**
- Test keyword + semantic combination
- Verify result diversity
- Compare with keyword-only

**Indexing Pipeline:**
- Test incremental indexing
- Verify new articles are searchable
- Test batch processing

**Cache Integration:**
- Test semantic search caching
- Verify cache hits/misses
- Test cache invalidation

## Performance Considerations

### Embedding Generation
- **Latency:** ~50-100ms per query (cached model)
- **Throughput:** ~10-20 queries/second (single instance)
- **Memory:** ~500MB for model
- **Optimization:** Batch processing, model quantization

### Vector Database
- **Latency:** ~10-50ms per query (depending on database)
- **Throughput:** 100-1000 queries/second (depending on database)
- **Storage:** ~3KB per article (768-dim float32 + metadata)
- **Optimization:** Index optimization, sharding

### Reranking
- **Latency:** ~100-200ms for 10 results
- **Throughput:** ~5-10 queries/second
- **Memory:** ~400MB for model
- **Optimization:** Limit reranking to top-N results

### Overall Impact
- **Semantic Search:** +100-200ms vs keyword-only
- **Hybrid Search:** +150-250ms vs keyword-only
- **With Reranking:** +250-450ms vs keyword-only
- **With Caching:** ~10-20ms (cache hit)

## Deployment Considerations

### Vector Database Options

**Pinecone (Recommended for Production):**
- Pros: Managed, scalable, reliable
- Cons: Cost (~$70/month for 1M vectors)
- Setup: API key configuration

**Weaviate (Self-Hosted):**
- Pros: Open-source, feature-rich, GraphQL API
- Cons: Requires infrastructure management
- Setup: Docker deployment

**Qdrant (Self-Hosted):**
- Pros: Fast (Rust), open-source, good documentation
- Cons: Requires infrastructure management
- Setup: Docker deployment

### Model Deployment

**Option 1: Local Inference (Recommended for Development)**
- Use `@xenova/transformers` for in-process inference
- Pros: Simple, no external dependencies
- Cons: Higher memory usage, slower

**Option 2: Model Server (Recommended for Production)**
- Deploy models on dedicated inference server
- Use TensorFlow Serving or TorchServe
- Pros: Better performance, scalability
- Cons: Additional infrastructure

### Scaling Strategy

**Phase 1: Single Instance**
- Local model inference
- Single vector database instance
- Suitable for <100K articles

**Phase 2: Horizontal Scaling**
- Load-balanced model servers
- Sharded vector database
- Suitable for 100K-1M articles

**Phase 3: Distributed**
- Distributed model serving
- Multi-region vector database
- Suitable for >1M articles

## Migration Path

### Step 1: Infrastructure Setup
1. Choose vector database (Pinecone recommended)
2. Set up database instance
3. Configure API keys/credentials

### Step 2: Model Deployment
1. Download embedding model
2. Test model inference
3. Optimize for production

### Step 3: Initial Indexing
1. Index existing PubMed articles (batch)
2. Index Cochrane reviews
3. Verify search quality

### Step 4: Integration
1. Integrate with evidence engine
2. Enable hybrid search
3. Add monitoring

### Step 5: Optimization
1. Enable caching
2. Tune parameters (top-k, similarity threshold)
3. Enable reranking (optional)

## Monitoring and Observability

### Metrics to Track
- Embedding generation latency (p50, p95, p99)
- Vector database query latency
- Reranking latency
- Cache hit rate for semantic searches
- Result relevance (manual evaluation)
- Fallback rate (semantic → keyword)

### Logging
- All semantic search queries
- Embedding generation failures
- Vector database errors
- Reranking failures
- Performance metrics

### Alerts
- Vector database unavailable
- Embedding generation failure rate > 5%
- Query latency > 1s (p95)
- Cache hit rate < 50%
