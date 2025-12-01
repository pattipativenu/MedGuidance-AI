# Requirements Document - Phase 3: Chunk-level Attribution and Evaluation Framework

## Introduction

Phase 3 implements precise chunk-level attribution and a comprehensive evaluation framework. This phase enables the system to cite specific sentences from articles rather than entire papers, and provides automated testing to measure and improve citation quality. These enhancements address the audit's recommendations for "chunk-level attribution" and "evaluation framework" to enable data-driven improvements.

**Context from Audit:** Phases 1-2 addressed caching, conflict detection, sufficiency scoring, and semantic search. Phase 3 now tackles "full abstract citation" (can't cite specific sentences) and "no evaluation framework" (can't measure if changes improve quality), which are identified as medium-priority gaps in the audit.

## Glossary

- **Chunk**: A segment of text (typically a sentence or paragraph) from a source document
- **Attribution**: The process of linking a generated claim to its source evidence
- **Provenance**: Metadata tracking the origin of a chunk (PMID + sentence index)
- **Citation Precision**: Percentage of citations that are valid and verifiable
- **Citation Recall**: Percentage of key evidence that is properly cited
- **Ground Truth**: Manually verified correct citations for test queries
- **Test Set**: Collection of queries with known correct answers for evaluation
- **Chunk-level Citation**: Citation that references a specific sentence, not entire paper
- **Evidence System**: The MedGuidence AI evidence retrieval pipeline

## Requirements

### Requirement 1

**User Story:** As a clinician, I want citations to reference specific sentences, so that I can quickly verify claims without reading entire papers.

#### Acceptance Criteria

1. WHEN generating a response THEN the Evidence System SHALL cite specific sentences from source articles
2. WHEN a citation is provided THEN the Evidence System SHALL include PMID and sentence index
3. WHEN displaying citations THEN the Evidence System SHALL show the exact sentence cited
4. WHEN a sentence is cited THEN the Evidence System SHALL provide a link to the full article
5. WHEN multiple sentences from the same article are cited THEN the Evidence System SHALL group them by PMID

### Requirement 2

**User Story:** As a developer, I want to split abstracts into sentences with provenance tracking, so that each sentence can be independently cited.

#### Acceptance Criteria

1. WHEN processing an article THEN the Evidence System SHALL split the abstract into sentences
2. WHEN splitting sentences THEN the Evidence System SHALL preserve sentence boundaries correctly
3. WHEN storing chunks THEN the Evidence System SHALL track provenance (PMID, sentence index, source)
4. WHEN retrieving chunks THEN the Evidence System SHALL include all provenance metadata
5. WHEN sentence splitting fails THEN the Evidence System SHALL fall back to full abstract citation

### Requirement 3

**User Story:** As a system architect, I want chunk-level semantic search, so that the most relevant sentences are retrieved rather than entire abstracts.

#### Acceptance Criteria

1. WHEN performing semantic search THEN the Evidence System SHALL search at sentence level
2. WHEN ranking chunks THEN the Evidence System SHALL use semantic similarity to query
3. WHEN returning chunks THEN the Evidence System SHALL include surrounding context (±1 sentence)
4. WHEN multiple chunks from same article are relevant THEN the Evidence System SHALL return all relevant chunks
5. WHEN chunk-level search is unavailable THEN the Evidence System SHALL fall back to abstract-level search

### Requirement 4

**User Story:** As a developer, I want to validate that generated citations match retrieved evidence, so that hallucinated citations are detected.

#### Acceptance Criteria

1. WHEN a response is generated THEN the Evidence System SHALL extract all citations
2. WHEN citations are extracted THEN the Evidence System SHALL verify each PMID exists in retrieved evidence
3. WHEN a citation references a sentence THEN the Evidence System SHALL verify the sentence exists
4. WHEN a citation is invalid THEN the Evidence System SHALL flag it as unverifiable
5. WHEN validation is complete THEN the Evidence System SHALL report citation precision score

### Requirement 5

**User Story:** As a quality assurance engineer, I want a test set with ground truth citations, so that I can measure system performance objectively.

#### Acceptance Criteria

1. WHEN creating a test set THEN the Evidence System SHALL include 50+ diverse medical queries
2. WHEN defining ground truth THEN the Evidence System SHALL include expected PMIDs and key sentences
3. WHEN storing test cases THEN the Evidence System SHALL include query, expected citations, and rationale
4. WHEN test cases are added THEN the Evidence System SHALL validate format and completeness
5. WHEN test set is updated THEN the Evidence System SHALL version control changes

### Requirement 6

**User Story:** As a developer, I want to measure citation precision and recall, so that I can quantify system performance.

#### Acceptance Criteria

1. WHEN evaluating a response THEN the Evidence System SHALL calculate citation precision
2. WHEN evaluating a response THEN the Evidence System SHALL calculate citation recall
3. WHEN calculating precision THEN the Evidence System SHALL count valid citations / total citations
4. WHEN calculating recall THEN the Evidence System SHALL count cited key evidence / total key evidence
5. WHEN metrics are calculated THEN the Evidence System SHALL report confidence intervals

### Requirement 7

**User Story:** As a developer, I want automated evaluation runs, so that I can test changes without manual review.

#### Acceptance Criteria

1. WHEN running evaluation THEN the Evidence System SHALL process all test queries
2. WHEN processing a test query THEN the Evidence System SHALL generate response and extract citations
3. WHEN comparing to ground truth THEN the Evidence System SHALL calculate precision and recall
4. WHEN evaluation is complete THEN the Evidence System SHALL generate summary report
5. WHEN evaluation fails THEN the Evidence System SHALL log errors and continue with remaining tests

### Requirement 8

**User Story:** As a system architect, I want chunk-level attribution to integrate with existing caching, so that performance remains optimal.

#### Acceptance Criteria

1. WHEN caching chunks THEN the Evidence System SHALL include provenance metadata
2. WHEN retrieving cached chunks THEN the Evidence System SHALL return complete provenance
3. WHEN cache keys are generated THEN the Evidence System SHALL account for chunk-level search
4. WHEN cache is unavailable THEN the Evidence System SHALL perform chunk-level search without caching
5. WHEN caching chunks THEN the Evidence System SHALL use same TTL as Phase 1 (24 hours)

### Requirement 9

**User Story:** As a developer, I want comprehensive monitoring for chunk-level attribution, so that I can track citation quality.

#### Acceptance Criteria

1. WHEN chunk-level search is performed THEN the Evidence System SHALL log chunk count and relevance scores
2. WHEN citations are generated THEN the Evidence System SHALL log citation count per response
3. WHEN citations are validated THEN the Evidence System SHALL log precision score
4. WHEN evaluation runs THEN the Evidence System SHALL log precision and recall metrics
5. WHEN chunk-level attribution fails THEN the Evidence System SHALL log failure reason and fall back

### Requirement 10

**User Story:** As a system administrator, I want to configure chunk-level attribution parameters, so that I can optimize for my use case.

#### Acceptance Criteria

1. WHEN configuring chunk-level search THEN the Evidence System SHALL support enabling/disabling
2. WHEN configuring chunks THEN the Evidence System SHALL support setting context window size
3. WHEN configuring validation THEN the Evidence System SHALL support setting precision threshold
4. WHEN configuring evaluation THEN the Evidence System SHALL support setting test set path
5. WHEN configuration is invalid THEN the Evidence System SHALL use safe defaults and log warning
