# Implementation Plan - Phase 3: Chunk-level Attribution and Evaluation Framework

## Overview

Phase 3 implements sentence-level citations with provenance tracking and an automated evaluation framework to measure citation quality. This enables precise, verifiable citations and data-driven quality improvements.

---

- [x] 1. Implement sentence splitter with provenance tracking
  - Create sentence splitter module
  - Split abstracts into sentences
  - Track provenance (PMID, sentence index, source)
  - Add context window (±1 sentence)
  - Test with various abstract formats
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 1.1 Write property test for provenance completeness
  - **Property 1: Provenance completeness**
  - **Validates: Requirements 2.3, 2.4**

- [ ]* 1.2 Write property test for sentence boundary preservation
  - **Property 2: Sentence boundary preservation**
  - **Validates: Requirements 2.2**

- [ ]* 1.3 Write unit tests for sentence splitter
  - Test splitting with various formats
  - Test provenance tracking
  - Test context window creation
  - Test edge cases (single sentence, empty abstract)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Extend semantic search to chunk-level
  - Modify semantic reranker to work with chunks
  - Embed individual sentences
  - Search at sentence level
  - Return chunks with context
  - Handle multiple chunks from same article
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 2.1 Write property test for context window consistency
  - **Property 6: Context window consistency**
  - **Validates: Requirements 3.3**

- [ ]* 2.2 Write property test for chunk deduplication
  - **Property 7: Chunk deduplication**
  - **Validates: Requirements 2.1, 2.3**

- [ ]* 2.3 Write unit tests for chunk-level search
  - Test sentence-level retrieval
  - Test context inclusion
  - Test multiple chunks from same article
  - Test fallback to abstract-level
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Implement citation validator
  - Create citation extractor
  - Extract citations from generated text
  - Validate PMIDs against retrieved evidence
  - Validate sentence indices
  - Calculate precision score
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 3.1 Write property test for citation validation correctness
  - **Property 3: Citation validation correctness**
  - **Validates: Requirements 4.2, 4.3**

- [ ]* 3.2 Write property test for precision calculation accuracy
  - **Property 4: Precision calculation accuracy**
  - **Validates: Requirements 6.1, 6.3**

- [ ]* 3.3 Write unit tests for citation validator
  - Test citation extraction
  - Test PMID validation
  - Test sentence index validation
  - Test precision calculation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Create initial test set with ground truth
  - Define test set format (JSON)
  - Create 10-20 initial test cases
  - Include diverse medical queries
  - Define expected citations for each
  - Add rationale for each test case
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 4.1 Write unit tests for test set validation
  - Test test case format validation
  - Test test set loading
  - Test version control
  - _Requirements: 5.4, 5.5_

- [ ] 5. Implement evaluation framework
  - Create evaluation runner
  - Process test queries
  - Extract and validate citations
  - Compare to ground truth
  - Calculate precision and recall
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 5.1 Write property test for recall calculation accuracy
  - **Property 5: Recall calculation accuracy**
  - **Validates: Requirements 6.2, 6.4**

- [ ]* 5.2 Write unit tests for evaluation framework
  - Test metric calculation
  - Test report generation
  - Test error handling
  - Test confidence intervals
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6. Integrate chunk-level attribution with AI generation
  - Modify prompt to request sentence-level citations
  - Format citations as [PMID:12345, S:2]
  - Update citation formatter
  - Test with various queries
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 6.1 Write unit tests for citation formatting
  - Test citation format generation
  - Test PMID grouping
  - Test sentence display
  - Test link generation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 7. Integrate with Phase 1 caching
  - Add cache support for chunks
  - Include provenance in cached data
  - Generate cache keys for chunk-level search
  - Handle cache unavailability
  - Test cache hit/miss scenarios
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]* 7.1 Write unit tests for chunk caching
  - Test provenance preservation in cache
  - Test cache key generation
  - Test cache retrieval
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. Add comprehensive error handling
  - Handle sentence splitting failures
  - Handle chunk search failures
  - Handle citation validation failures
  - Handle evaluation failures
  - Ensure graceful degradation
  - _Requirements: 2.5, 3.5, 4.4, 7.5_

- [ ]* 8.1 Write property test for graceful degradation
  - **Property 8: Graceful degradation**
  - **Validates: Requirements 2.5, 3.5**

- [ ]* 8.2 Write unit tests for error handling
  - Test sentence splitting fallback
  - Test chunk search fallback
  - Test validation error handling
  - Test evaluation error handling
  - _Requirements: 2.5, 3.5, 4.4, 7.5_

- [x] 9. Add monitoring and logging
  - Log chunk count and relevance scores
  - Log citation count per response
  - Log precision scores
  - Log evaluation metrics
  - Log failure reasons
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 10. Implement configuration system
  - Add chunk-level attribution configuration
  - Support enable/disable chunk-level search
  - Support context window size configuration
  - Support precision threshold configuration
  - Support test set path configuration
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 11. Expand test set to 50+ cases
  - Add test cases across medical categories
  - Include easy, medium, hard difficulty levels
  - Add edge cases and challenging queries
  - Validate all test cases
  - Document test set creation process
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 12. Integration testing
  - Test end-to-end chunk-level attribution
  - Test citation validation with real responses
  - Run evaluation on full test set
  - Measure performance impact
  - Compare chunk-level vs abstract-level precision
  - _Requirements: All_

- [ ]* 12.1 Write integration tests
  - Test full pipeline from article to chunk citation
  - Test evaluation framework with sample test set
  - Test cache integration
  - _Requirements: All_

- [ ] 13. Performance optimization
  - Optimize sentence splitting
  - Optimize chunk-level search
  - Optimize citation validation
  - Measure and document latency impact
  - _Requirements: All_

- [ ] 14. Create evaluation automation
  - Set up automated evaluation runs
  - Create metrics tracking over time
  - Set up regression alerts
  - Create metrics dashboard
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 15. Documentation
  - Document chunk-level attribution architecture
  - Document citation format
  - Document test set format and creation process
  - Document evaluation metrics
  - Create deployment guide
  - _Requirements: All_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

