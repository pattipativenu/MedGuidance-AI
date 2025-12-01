# Implementation Plan - Phase 2: Semantic Enhancement

## Overview

Phase 2 implements semantic search through reranking of keyword results, avoiding the need for a vector database while still providing semantic search benefits. This approach aligns with the Evidence System Audit recommendation to get "80% of RAG benefits at 20% of the cost."

---

- [x] 1. Set up biomedical embedding infrastructure
  - Install @xenova/transformers for model inference
  - Download and cache PubMedBERT model
  - Implement embedding generation with normalization
  - Add model loading and caching logic
  - Test embedding generation with medical terms
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 1.1 Write property test for embedding dimension consistency
  - **Property 2: Embedding dimension consistency**
  - **Validates: Requirements 2.4**

- [x] 2. Implement semantic reranking for PubMed
  - Create semantic reranker module
  - Embed query and top-50 PubMed results
  - Calculate cosine similarity scores
  - Sort results by similarity
  - Preserve all article metadata
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 2.1 Write property test for semantic similarity symmetry
  - **Property 1: Semantic similarity symmetry**
  - **Validates: Requirements 1.1, 1.5**

- [ ]* 2.2 Write unit tests for semantic reranking
  - Test reranking with various medical queries
  - Test similarity score calculation
  - Test metadata preservation
  - Test fallback on embedding failure
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Extend semantic reranking to additional sources
  - Add reranking to Cochrane reviews
  - Add reranking to Europe PMC results
  - Skip reranking for sources with <10 results
  - Maintain source attribution
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4. Implement PICO extraction for query expansion
  - Create PICO extractor module
  - Extract Population, Intervention, Comparator, Outcome
  - Generate synonym variations using MeSH
  - Create expanded query variations
  - Test with clinical trial queries
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 4.1 Write unit tests for PICO extraction
  - Test extraction with various clinical queries
  - Test synonym generation
  - Test fallback to MeSH enhancement
  - Test expanded query generation
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Implement hybrid search with reciprocal rank fusion
  - Create result fusion module
  - Implement reciprocal rank fusion (RRF) algorithm
  - Deduplicate results by PMID
  - Combine keyword and semantic rankings
  - Test with various query types
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 5.1 Write property test for RRF monotonicity
  - **Property 4: Reciprocal rank fusion monotonicity**
  - **Validates: Requirements 4.2, 4.4**

- [ ]* 5.2 Write property test for hybrid search completeness
  - **Property 3: Hybrid search completeness**
  - **Validates: Requirements 4.1, 4.3**

- [ ]* 5.3 Write unit tests for result fusion
  - Test RRF algorithm with various inputs
  - Test deduplication logic
  - Test edge cases (empty results, single source)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6. Implement cross-encoder reranking (optional)
  - Create cross-encoder reranker module
  - Use MS MARCO MiniLM model
  - Score query-document pairs
  - Apply to top-20 semantic results
  - Add fallback to semantic ranking
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 6.1 Write unit tests for cross-encoder reranking
  - Test reranking with various queries
  - Test score ordering
  - Test fallback on failure
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7. Integrate semantic search with Phase 1 caching
  - Add cache support for semantic search results
  - Generate cache keys with search type
  - Use same TTL as keyword results (24 hours)
  - Handle cache unavailability gracefully
  - Test cache hit/miss scenarios
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 7.1 Write property test for cache consistency
  - **Property 6: Cache consistency**
  - **Validates: Requirements 7.1, 7.2**

- [x] 8. Add comprehensive error handling
  - Handle embedding generation failures
  - Handle reranking failures
  - Handle PICO extraction failures
  - Ensure graceful degradation to keyword search
  - Log all failures with context
  - _Requirements: 1.4, 2.3, 3.4, 5.5, 6.5_

- [ ]* 8.1 Write property test for graceful degradation
  - **Property 5: Graceful degradation**
  - **Validates: Requirements 1.4, 3.4, 6.5**

- [ ]* 8.2 Write unit tests for error handling
  - Test embedding failure fallback
  - Test reranking failure fallback
  - Test PICO extraction failure fallback
  - _Requirements: 1.4, 2.3, 3.4, 5.5, 6.5_

- [x] 9. Add monitoring and logging
  - Log query embedding time
  - Log reranking time
  - Log PICO extraction results
  - Log result count and average similarity
  - Log failure reasons
  - Add performance metrics tracking
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 10. Implement configuration system
  - Add semantic search configuration options
  - Support top-k results configuration
  - Support similarity threshold configuration
  - Support enable/disable reranking
  - Validate configuration and use safe defaults
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 11. Integration testing
  - Test end-to-end semantic reranking
  - Test hybrid search with real queries
  - Test PICO extraction with clinical queries
  - Test cross-encoder reranking (if enabled)
  - Measure performance impact
  - Compare relevance vs. keyword-only
  - _Requirements: All_

- [ ]* 11.1 Write integration tests
  - Test semantic reranking with medical queries
  - Test hybrid search result diversity
  - Test PICO extraction accuracy
  - Test cache integration
  - _Requirements: All_

- [x] 12. Performance optimization
  - Optimize embedding batch processing
  - Add model quantization (optional)
  - Tune reranking parameters
  - Optimize cache key generation
  - Measure and document latency impact
  - _Requirements: All_

- [x] 13. Documentation
  - Document semantic search architecture
  - Document PICO extraction logic
  - Document configuration options
  - Document performance characteristics
  - Create deployment guide
  - _Requirements: All_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

