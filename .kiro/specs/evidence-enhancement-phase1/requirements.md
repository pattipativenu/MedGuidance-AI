# Requirements Document

## Introduction

This specification defines Phase 1 enhancements to the MedGuidance AI evidence system. The goal is to improve query performance, reduce API costs, increase transparency when evidence sources conflict, and provide honest assessment of evidence quality - all without disrupting the existing production system.

Phase 1 focuses on three high-impact, low-complexity improvements that can be delivered in 1-2 weeks and provide immediate value to users.

## Glossary

- **Evidence Package**: Structured collection of medical evidence from 20+ databases (PubMed, Cochrane, WHO, CDC, etc.)
- **Cache Hit**: When requested evidence is found in Redis cache, avoiding API call
- **Cache Miss**: When evidence must be retrieved from source API
- **TTL (Time To Live)**: Duration evidence remains valid in cache (24 hours)
- **Conflict**: When two or more authoritative sources provide contradictory recommendations
- **Evidence Sufficiency**: Measure of whether retrieved evidence is adequate to answer a clinical query
- **High-Quality Source**: Guidelines, Cochrane reviews, or RCTs from last 5 years
- **Redis**: In-memory data store used for caching
- **Query Hash**: Unique identifier for a query used as cache key

## Requirements

### Requirement 1: Evidence Caching System

**User Story:** As a system administrator, I want to cache evidence from medical databases, so that repeated queries are faster and API costs are reduced.

#### Acceptance Criteria

1. WHEN a query is made THEN the system SHALL check Redis cache before calling external APIs
2. WHEN evidence is retrieved from APIs THEN the system SHALL store it in Redis with 24-hour TTL
3. WHEN cached evidence exists and is not expired THEN the system SHALL return cached data without API calls
4. WHEN cached evidence is expired THEN the system SHALL fetch fresh data and update the cache
5. WHEN cache operations fail THEN the system SHALL fall back to direct API calls without blocking the request
6. WHEN evidence is cached THEN the system SHALL include cache metadata (timestamp, source, query hash)
7. WHEN multiple sources are queried THEN the system SHALL cache each source independently
8. WHEN a cache hit occurs THEN the system SHALL log cache hit metrics for monitoring

### Requirement 2: Conflict Detection System

**User Story:** As a clinician, I want to know when authoritative sources disagree, so that I can make informed decisions and understand areas of medical controversy.

#### Acceptance Criteria

1. WHEN evidence contains guidelines from multiple organizations THEN the system SHALL scan for contradictory recommendations
2. WHEN WHO and CDC provide different guidance THEN the system SHALL flag this as a conflict
3. WHEN a conflict is detected THEN the system SHALL identify the specific topic of disagreement
4. WHEN presenting conflicting evidence THEN the system SHALL show both positions with equal prominence
5. WHEN conflicts exist THEN the system SHALL include a "Sources Disagree" notice in the formatted evidence
6. WHEN no conflicts are detected THEN the system SHALL not add conflict warnings
7. WHEN conflicts are detected THEN the system SHALL log conflict metadata for analysis

### Requirement 3: Evidence Sufficiency Scoring

**User Story:** As a user, I want to know if the evidence supporting an answer is strong or limited, so that I can assess the reliability of medical guidance.

#### Acceptance Criteria

1. WHEN evidence is gathered THEN the system SHALL calculate a sufficiency score from 0-100
2. WHEN Cochrane reviews are present THEN the system SHALL add 30 points to the sufficiency score
3. WHEN clinical guidelines are present THEN the system SHALL add 25 points to the sufficiency score
4. WHEN RCTs are present THEN the system SHALL add 20 points to the sufficiency score
5. WHEN recent articles (last 5 years) are present THEN the system SHALL add 15 points to the sufficiency score
6. WHEN sufficiency score is ≥70 THEN the system SHALL classify evidence as "excellent"
7. WHEN sufficiency score is 50-69 THEN the system SHALL classify evidence as "good"
8. WHEN sufficiency score is 30-49 THEN the system SHALL classify evidence as "limited"
9. WHEN sufficiency score is <30 THEN the system SHALL classify evidence as "insufficient"
10. WHEN evidence is "limited" or "insufficient" THEN the system SHALL include a warning in the formatted evidence
11. WHEN sufficiency is calculated THEN the system SHALL provide reasoning explaining the score

### Requirement 4: Cache Management

**User Story:** As a system administrator, I want to manage the evidence cache, so that I can monitor performance and clear stale data when needed.

#### Acceptance Criteria

1. WHEN cache is initialized THEN the system SHALL connect to Redis using environment variable REDIS_URL
2. WHEN Redis connection fails THEN the system SHALL log error and continue without caching
3. WHEN cache key is generated THEN the system SHALL use format "evidence:{query_hash}:{source}"
4. WHEN query hash is computed THEN the system SHALL use consistent hashing algorithm (SHA-256)
5. WHEN cache size exceeds limits THEN Redis SHALL automatically evict oldest entries (LRU policy)

### Requirement 5: Monitoring and Metrics

**User Story:** As a system administrator, I want to track cache performance and evidence quality, so that I can measure the impact of these enhancements.

#### Acceptance Criteria

1. WHEN a cache hit occurs THEN the system SHALL log "Cache hit: {source} for query {hash}"
2. WHEN a cache miss occurs THEN the system SHALL log "Cache miss: {source} for query {hash}"
3. WHEN evidence sufficiency is calculated THEN the system SHALL log the score and level
4. WHEN conflicts are detected THEN the system SHALL log conflict details
5. WHEN cache operations complete THEN the system SHALL log timing metrics

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want Phase 1 enhancements to be non-breaking, so that existing functionality continues to work without modification.

#### Acceptance Criteria

1. WHEN caching is added THEN existing API signatures SHALL remain unchanged
2. WHEN cache is unavailable THEN the system SHALL function identically to current behavior
3. WHEN evidence is formatted THEN existing zone structure SHALL be preserved
4. WHEN conflicts are detected THEN they SHALL be added as supplementary information, not replacing existing content
5. WHEN sufficiency scores are added THEN they SHALL not alter the evidence retrieval logic
