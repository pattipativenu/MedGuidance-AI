# Requirements Document - Phase 2: Semantic Enhancement

## Introduction

Phase 2 builds on Phase 1's caching infrastructure to add semantic search capabilities using biomedical embeddings. This phase focuses on improving recall and relevance through semantic similarity matching, query expansion with PICO extraction, and intelligent reranking. The goal is to find conceptually similar evidence that keyword matching alone would miss, while maintaining the real-time API orchestration approach that keeps data fresh.

**Context from Audit:** Phase 1 addressed the critical caching gap (reducing latency from 5-7s to 1-2s and cutting API costs by 53%). Phase 2 now tackles the "keyword-only search" limitation identified in the audit, which causes the system to miss semantically similar papers, especially for novel terminology.

## Glossary

- **Embedding**: A dense vector representation of text that captures semantic meaning
- **Biomedical Embedding Model**: A neural network trained on medical literature to create embeddings
- **Vector Database**: A database optimized for storing and querying high-dimensional vectors
- **Semantic Search**: Search based on meaning rather than exact keyword matches
- **Cosine Similarity**: A metric for measuring similarity between embedding vectors
- **Reranking**: Post-retrieval scoring to improve result relevance
- **Hybrid Search**: Combining keyword-based and semantic search results
- **Evidence System**: The MedGuidence AI evidence retrieval pipeline
- **PubMed**: Primary medical literature database
- **Cochrane**: Systematic review database

## Requirements

### Requirement 1

**User Story:** As a clinician, I want the system to find relevant evidence even when I use different terminology, so that I don't miss important research due to vocabulary mismatches.

#### Acceptance Criteria

1. WHEN a user queries using synonyms or related terms THEN the Evidence System SHALL retrieve semantically similar articles
2. WHEN a user queries "heart attack" THEN the Evidence System SHALL also retrieve articles about "myocardial infarction"
3. WHEN a user queries "high blood pressure" THEN the Evidence System SHALL also retrieve articles about "hypertension"
4. WHEN semantic search is unavailable THEN the Evidence System SHALL fall back to keyword search
5. WHEN semantic results are returned THEN the Evidence System SHALL include similarity scores

### Requirement 2

**User Story:** As a system architect, I want to use a biomedical-specific embedding model, so that medical terminology and concepts are properly understood.

#### Acceptance Criteria

1. WHEN generating embeddings THEN the Evidence System SHALL use PubMedBERT or BioBERT trained on biomedical literature
2. WHEN the embedding model is PubMedBERT THEN the Evidence System SHALL use pritamdeka/BioBERT-mnli-snli-scinli-scitail-mednli-stsb
3. WHEN embedding generation fails THEN the Evidence System SHALL log the error and continue with keyword search
4. WHEN embeddings are generated THEN the Evidence System SHALL normalize vectors for cosine similarity
5. WHEN the model is loaded THEN the Evidence System SHALL cache it in memory for reuse across requests

### Requirement 3

**User Story:** As a developer, I want to rerank search results using semantic similarity, so that the most relevant articles appear first without requiring a full vector database.

#### Acceptance Criteria

1. WHEN reranking results THEN the Evidence System SHALL embed the query and top-50 articles from keyword search
2. WHEN calculating similarity THEN the Evidence System SHALL use cosine similarity between embeddings
3. WHEN reranking is complete THEN the Evidence System SHALL sort results by semantic similarity score
4. WHEN embedding fails THEN the Evidence System SHALL return original keyword ranking
5. WHEN reranking THEN the Evidence System SHALL preserve article metadata (PMID, title, abstract, source)

### Requirement 4

**User Story:** As a clinician, I want hybrid search combining keyword and semantic results, so that I get both exact matches and semantically similar articles.

#### Acceptance Criteria

1. WHEN performing hybrid search THEN the Evidence System SHALL combine keyword and semantic results
2. WHEN combining results THEN the Evidence System SHALL use reciprocal rank fusion
3. WHEN duplicate articles appear in both result sets THEN the Evidence System SHALL deduplicate by PMID
4. WHEN ranking combined results THEN the Evidence System SHALL prioritize higher-scoring articles
5. WHEN hybrid search is enabled THEN the Evidence System SHALL return more diverse results than keyword-only

### Requirement 5

**User Story:** As a clinician, I want query expansion with PICO extraction, so that the system finds relevant evidence even when I don't use perfect medical terminology.

#### Acceptance Criteria

1. WHEN a clinical query is received THEN the Evidence System SHALL extract PICO elements (Population, Intervention, Comparator, Outcome)
2. WHEN PICO elements are extracted THEN the Evidence System SHALL generate synonym variations for each element
3. WHEN generating variations THEN the Evidence System SHALL use medical ontologies (MeSH, SNOMED CT concepts)
4. WHEN expanded queries are generated THEN the Evidence System SHALL search with both original and expanded terms
5. WHEN PICO extraction fails THEN the Evidence System SHALL fall back to original query with MeSH enhancement

### Requirement 6

**User Story:** As a developer, I want to use cross-encoder reranking for final relevance scoring, so that the most relevant articles appear first.

#### Acceptance Criteria

1. WHEN reranking top results THEN the Evidence System SHALL use a cross-encoder model (MS MARCO MiniLM or medical-specific)
2. WHEN cross-encoding THEN the Evidence System SHALL score query-document pairs jointly
3. WHEN reranking is complete THEN the Evidence System SHALL sort results by cross-encoder score
4. WHEN cross-encoder reranking is enabled THEN the Evidence System SHALL apply it to top-20 semantic results
5. WHEN cross-encoder fails THEN the Evidence System SHALL return semantic similarity ranking

### Requirement 7

**User Story:** As a system architect, I want semantic search to integrate with existing caching, so that performance remains optimal.

#### Acceptance Criteria

1. WHEN semantic search results are retrieved THEN the Evidence System SHALL cache them
2. WHEN a cached semantic search exists THEN the Evidence System SHALL return it
3. WHEN caching semantic results THEN the Evidence System SHALL use the same TTL as keyword results
4. WHEN cache is unavailable THEN the Evidence System SHALL perform semantic search without caching
5. WHEN cache keys are generated THEN the Evidence System SHALL include search type (semantic/hybrid)

### Requirement 8

**User Story:** As a clinician, I want semantic reranking to work across all evidence sources, so that I get the most relevant results from each database.

#### Acceptance Criteria

1. WHEN semantic reranking is enabled THEN the Evidence System SHALL rerank PubMed articles
2. WHEN semantic reranking is enabled THEN the Evidence System SHALL rerank Cochrane reviews
3. WHEN semantic reranking is enabled THEN the Evidence System SHALL rerank Europe PMC results
4. WHEN a source returns fewer than 10 results THEN the Evidence System SHALL skip reranking for that source
5. WHEN combining multi-source results THEN the Evidence System SHALL maintain source attribution and original quality scores

### Requirement 9

**User Story:** As a developer, I want comprehensive monitoring for semantic search, so that I can track performance and quality.

#### Acceptance Criteria

1. WHEN semantic search is performed THEN the Evidence System SHALL log query embedding time
2. WHEN vector database is queried THEN the Evidence System SHALL log query latency
3. WHEN reranking is performed THEN the Evidence System SHALL log reranking time
4. WHEN semantic search fails THEN the Evidence System SHALL log the failure reason
5. WHEN semantic search succeeds THEN the Evidence System SHALL log result count and average similarity

### Requirement 10

**User Story:** As a system administrator, I want to configure semantic search parameters, so that I can optimize for my use case.

#### Acceptance Criteria

1. WHEN configuring semantic search THEN the Evidence System SHALL support setting top-k results
2. WHEN configuring semantic search THEN the Evidence System SHALL support setting similarity threshold
3. WHEN configuring semantic search THEN the Evidence System SHALL support enabling/disabling reranking
4. WHEN configuring semantic search THEN the Evidence System SHALL support setting batch size for indexing
5. WHEN configuration is invalid THEN the Evidence System SHALL use safe defaults and log a warning
