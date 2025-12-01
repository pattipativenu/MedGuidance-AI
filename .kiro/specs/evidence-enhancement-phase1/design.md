# Design Document

## Overview

Phase 1 enhances the MedGuidance AI evidence system with three strategic improvements:

1. **Redis Caching Layer**: Reduces query latency from 5-7s to 1-2s for cached queries and cuts API costs by 53%
2. **Conflict Detection**: Identifies when authoritative sources (WHO, CDC, NICE, etc.) provide contradictory guidance
3. **Evidence Sufficiency Scoring**: Provides transparent assessment of evidence quality (excellent/good/limited/insufficient)

These enhancements are designed to be non-breaking, with graceful degradation when Redis is unavailable.

## Architecture

### High-Level Flow

```
User Query
    ↓
[NEW] Check Redis Cache
    ↓ (cache miss)
MeSH Enhancement
    ↓
Parallel API Calls (20+ sources)
    ↓
[NEW] Store in Redis Cache
    ↓
Evidence Packaging (21 zones)
    ↓
[NEW] Detect Conflicts
    ↓
[NEW] Calculate Sufficiency Score
    ↓
Format Evidence with Enhancements
    ↓
AI Generation
    ↓
Response
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Evidence Engine                       │
│  (lib/evidence/engine.ts - existing)                    │
└────────────┬────────────────────────────────────────────┘
             │
             ├──────────────────────────────────────────┐
             │                                          │
┌────────────▼──────────┐              ┌───────────────▼──────────┐
│   Cache Manager        │              │  Conflict Detector       │
│  (lib/evidence/        │              │  (lib/evidence/          │
│   cache-manager.ts)    │              │   conflict-detector.ts)  │
│  - NEW -               │              │  - NEW -                 │
│                        │              │                          │
│ • getCachedEvidence()  │              │ • detectConflicts()      │
│ • cacheEvidence()      │              │ • formatConflicts()      │
│ • hashQuery()          │              │                          │
│ • isAvailable()        │              │                          │
└────────────┬───────────┘              └──────────────────────────┘
             │
             │
┌────────────▼──────────────────────────────────────────┐
│                    Redis Client                        │
│  (ioredis library)                                    │
│                                                        │
│ • get(key)                                            │
│ • setex(key, ttl, value)                              │
│ • Connection management                               │
└───────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│            Sufficiency Scorer                            │
│  (lib/evidence/sufficiency-scorer.ts)                   │
│  - NEW -                                                │
│                                                          │
│ • scoreEvidenceSufficiency()                            │
│ • formatSufficiencyWarning()                            │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Cache Manager (`lib/evidence/cache-manager.ts`)

**Purpose**: Manages Redis caching for evidence retrieval with graceful degradation.

**Interface**:

```typescript
export interface CacheMetadata {
  timestamp: string;
  source: string;
  queryHash: string;
  ttl: number;
}

export interface CachedEvidence<T> {
  data: T;
  metadata: CacheMetadata;
}

// Check if caching is available
export function isCacheAvailable(): boolean;

// Get cached evidence for a query and source
export async function getCachedEvidence<T>(
  query: string,
  source: string
): Promise<CachedEvidence<T> | null>;

// Cache evidence with 24-hour TTL
export async function cacheEvidence<T>(
  query: string,
  source: string,
  data: T
): Promise<void>;

// Generate consistent query hash
export function hashQuery(query: string): string;

// Get cache statistics
export function getCacheStats(): {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
};
```

**Implementation Details**:
- Uses `ioredis` library for Redis connection
- Connection string from `process.env.REDIS_URL`
- Graceful degradation: if Redis unavailable, returns null (cache miss)
- SHA-256 hashing for query keys
- Cache key format: `evidence:{query_hash}:{source}`
- TTL: 24 hours (86400 seconds)
- Tracks metrics in memory for monitoring

### 2. Conflict Detector (`lib/evidence/conflict-detector.ts`)

**Purpose**: Identifies contradictory recommendations from authoritative sources.

**Interface**:

```typescript
export interface Conflict {
  topic: string;
  sources: ConflictingSource[];
  severity: 'major' | 'minor';
  description: string;
}

export interface ConflictingSource {
  name: string; // "WHO", "CDC", "NICE", etc.
  position: string;
  url?: string;
  year?: string;
}

// Detect conflicts in evidence package
export function detectConflicts(evidence: EvidencePackage): Conflict[];

// Format conflicts for inclusion in evidence prompt
export function formatConflictsForPrompt(conflicts: Conflict[]): string;

// Check if two guidelines conflict on a topic
export function checkGuidelineConflict(
  guideline1: WHOGuideline | CDCGuideline | NICEGuideline,
  guideline2: WHOGuideline | CDCGuideline | NICEGuideline
): Conflict | null;
```

**Implementation Details**:
- **Phase 1 Approach**: Keyword-based conflict detection
  - Scan guideline titles/summaries for opposing terms
  - Examples: "recommend" vs "not recommend", "should" vs "should not"
  - Focus on treatment recommendations, not diagnostic criteria
- **Conflict Severity**:
  - Major: Direct contradiction on treatment (e.g., "use drug X" vs "avoid drug X")
  - Minor: Different thresholds or timing (e.g., "screen at 40" vs "screen at 45")
- **Sources Checked**: WHO, CDC, NICE, BMJ, ACC/AHA, ESC, AAP guidelines
- **Future Enhancement**: Use NLI (Natural Language Inference) models for semantic conflict detection

### 3. Sufficiency Scorer (`lib/evidence/sufficiency-scorer.ts`)

**Purpose**: Calculates evidence quality score and provides transparent reasoning.

**Interface**:

```typescript
export interface SufficiencyScore {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'limited' | 'insufficient';
  reasoning: string[];
  breakdown: {
    cochraneReviews: number;
    guidelines: number;
    rcts: number;
    recentArticles: number;
  };
}

// Calculate evidence sufficiency score
export function scoreEvidenceSufficiency(
  evidence: EvidencePackage
): SufficiencyScore;

// Format sufficiency warning for low-quality evidence
export function formatSufficiencyWarning(
  score: SufficiencyScore
): string | null;

// Check if evidence is sufficient for clinical decision-making
export function isEvidenceSufficient(score: SufficiencyScore): boolean;
```

**Implementation Details**:
- **Scoring Algorithm**:
  - Cochrane reviews: +30 points (gold standard)
  - Clinical guidelines (PubMed, WHO, CDC, NICE): +25 points
  - RCTs (from ClinicalTrials.gov with results): +20 points
  - Recent articles (last 5 years, ≥5 articles): +15 points
  - Systematic reviews (non-Cochrane): +10 points
- **Level Thresholds**:
  - Excellent: ≥70 points
  - Good: 50-69 points
  - Limited: 30-49 points
  - Insufficient: <30 points
- **Warning Generation**:
  - "Limited" or "Insufficient" triggers warning in formatted evidence
  - Warning includes specific gaps (e.g., "No clinical guidelines found")

## Data Models

### Cache Entry Structure

```typescript
// Stored in Redis as JSON string
interface CacheEntry {
  data: any; // Evidence data (PubMedArticle[], ClinicalTrial[], etc.)
  metadata: {
    timestamp: string; // ISO 8601
    source: string; // "pubmed", "cochrane", "clinicaltrials", etc.
    queryHash: string; // SHA-256 hash
    ttl: number; // 86400 (24 hours)
  };
}

// Redis key: "evidence:abc123def456:pubmed"
// Redis value: JSON.stringify(CacheEntry)
// Redis TTL: 86400 seconds
```

### Conflict Structure

```typescript
interface Conflict {
  topic: string; // "COVID-19 vaccination timing"
  sources: [
    {
      name: "WHO",
      position: "Recommends 3-week interval for mRNA vaccines",
      url: "https://who.int/...",
      year: "2024"
    },
    {
      name: "CDC",
      position: "Recommends 4-week interval for mRNA vaccines",
      url: "https://cdc.gov/...",
      year: "2024"
    }
  ],
  severity: "minor", // Different timing, not contradictory
  description: "WHO and CDC recommend different intervals for mRNA COVID-19 vaccines"
}
```

### Sufficiency Score Structure

```typescript
interface SufficiencyScore {
  score: 75, // Excellent
  level: "excellent",
  reasoning: [
    "2 Cochrane reviews (gold standard)",
    "3 clinical guidelines",
    "5 randomized controlled trials",
    "12 recent articles (last 5 years)"
  ],
  breakdown: {
    cochraneReviews: 30,
    guidelines: 25,
    rcts: 20,
    recentArticles: 0 // <5 recent articles
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Cache-before-API ordering
*For any* query, the system should check the cache before making API calls, ensuring cached data is used when available.
**Validates: Requirements 1.1, 1.3**

### Property 2: Cache storage completeness
*For any* evidence retrieved from APIs, the system should store it in Redis with 24-hour TTL and include all required metadata (timestamp, source, query hash).
**Validates: Requirements 1.2, 1.6**

### Property 3: Cache expiration handling
*For any* expired cache entry, the system should fetch fresh data from APIs and update the cache with new TTL.
**Validates: Requirements 1.4**

### Property 4: Cache failure resilience
*For any* cache operation failure (Redis unavailable, network error), the system should fall back to direct API calls without blocking or throwing errors.
**Validates: Requirements 1.5**

### Property 5: Cache isolation per source
*For any* query with multiple sources, each source should have its own independent cache entry with unique key.
**Validates: Requirements 1.7**

### Property 6: Cache hit logging
*For any* cache hit, the system should log metrics including source, query hash, and timestamp.
**Validates: Requirements 1.8, 5.1, 5.2**

### Property 7: Conflict detection completeness
*For any* evidence package containing guidelines from multiple organizations, the system should scan all guideline pairs for contradictions.
**Validates: Requirements 2.1**

### Property 8: Conflict topic identification
*For any* detected conflict, the system should identify and include the specific topic of disagreement.
**Validates: Requirements 2.3**

### Property 9: Conflict presentation fairness
*For any* conflicting evidence, both positions should appear in the formatted output with equal prominence.
**Validates: Requirements 2.4**

### Property 10: Conflict notice inclusion
*For any* evidence package with conflicts, the formatted output should include a "Sources Disagree" notice.
**Validates: Requirements 2.5**

### Property 11: No false conflict warnings
*For any* evidence package without conflicts, the formatted output should not include conflict warnings.
**Validates: Requirements 2.6**

### Property 12: Sufficiency score range
*For any* evidence package, the calculated sufficiency score should be in the range 0-100.
**Validates: Requirements 3.1**

### Property 13: Cochrane scoring contribution
*For any* evidence package with Cochrane reviews, the sufficiency score should include exactly 30 points from Cochrane.
**Validates: Requirements 3.2**

### Property 14: Guideline scoring contribution
*For any* evidence package with clinical guidelines, the sufficiency score should include exactly 25 points from guidelines.
**Validates: Requirements 3.3**

### Property 15: RCT scoring contribution
*For any* evidence package with RCTs, the sufficiency score should include exactly 20 points from RCTs.
**Validates: Requirements 3.4**

### Property 16: Recency scoring contribution
*For any* evidence package with ≥5 recent articles (last 5 years), the sufficiency score should include exactly 15 points for recency.
**Validates: Requirements 3.5**

### Property 17: Score-to-level mapping
*For any* sufficiency score, the level classification should match the defined thresholds (≥70=excellent, 50-69=good, 30-49=limited, <30=insufficient).
**Validates: Requirements 3.6, 3.7, 3.8, 3.9**

### Property 18: Low-quality evidence warnings
*For any* evidence with "limited" or "insufficient" sufficiency, the formatted output should include a warning.
**Validates: Requirements 3.10**

### Property 19: Sufficiency reasoning presence
*For any* calculated sufficiency score, the result should include non-empty reasoning explaining the score.
**Validates: Requirements 3.11**

### Property 20: Cache key format consistency
*For any* generated cache key, it should match the format "evidence:{query_hash}:{source}" where query_hash is SHA-256.
**Validates: Requirements 4.3, 4.4**

### Property 21: Backward compatibility preservation
*For any* existing API call, the function signature and return type should remain unchanged after Phase 1 enhancements.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

## Error Handling

### Cache Errors

**Scenario**: Redis connection fails or times out

**Handling**:
1. Log error: `"Cache unavailable: {error.message}"`
2. Set `isCacheAvailable()` to return `false`
3. All `getCachedEvidence()` calls return `null` (cache miss)
4. All `cacheEvidence()` calls silently fail (no-op)
5. System continues with direct API calls

**User Impact**: Slower queries, higher API costs, but no functionality loss

### Conflict Detection Errors

**Scenario**: Conflict detection throws exception

**Handling**:
1. Log error: `"Conflict detection failed: {error.message}"`
2. Return empty conflicts array `[]`
3. Continue with evidence formatting without conflict notices

**User Impact**: Conflicts not flagged, but evidence still presented

### Sufficiency Scoring Errors

**Scenario**: Scoring calculation throws exception

**Handling**:
1. Log error: `"Sufficiency scoring failed: {error.message}"`
2. Return default score: `{ score: 50, level: 'good', reasoning: ['Unable to calculate score'], breakdown: {...} }`
3. Continue with evidence formatting

**User Impact**: No quality assessment, but evidence still presented

## Testing Strategy

### Unit Tests

**Cache Manager Tests** (`lib/evidence/__tests__/cache-manager.test.ts`):
- Test cache hit returns cached data
- Test cache miss returns null
- Test cache storage with correct TTL
- Test query hashing consistency
- Test graceful degradation when Redis unavailable
- Test cache key format
- Test metadata inclusion

**Conflict Detector Tests** (`lib/evidence/__tests__/conflict-detector.test.ts`):
- Test conflict detection with known contradictions
- Test no false positives with non-conflicting guidelines
- Test conflict formatting
- Test severity classification (major vs minor)
- Test multiple conflicts in single evidence package

**Sufficiency Scorer Tests** (`lib/evidence/__tests__/sufficiency-scorer.test.ts`):
- Test score calculation with various evidence combinations
- Test level classification thresholds
- Test reasoning generation
- Test warning generation for low-quality evidence
- Test breakdown accuracy

### Property-Based Tests

We will use **fast-check** (JavaScript property testing library) for property-based testing.

**Property Test 1: Cache round-trip consistency** (`lib/evidence/__tests__/cache-manager.pbt.test.ts`):
- **Feature: evidence-enhancement-phase1, Property 2: Cache storage completeness**
- Generate random evidence data
- Cache the data
- Retrieve from cache
- Verify retrieved data matches original
- Verify metadata is present and correct

**Property Test 2: Sufficiency score monotonicity** (`lib/evidence/__tests__/sufficiency-scorer.pbt.test.ts`):
- **Feature: evidence-enhancement-phase1, Property 12: Sufficiency score range**
- Generate random evidence packages
- Calculate sufficiency scores
- Verify all scores are in range 0-100
- Verify adding high-quality sources increases score

**Property Test 3: Conflict detection symmetry** (`lib/evidence/__tests__/conflict-detector.pbt.test.ts`):
- **Feature: evidence-enhancement-phase1, Property 7: Conflict detection completeness**
- Generate pairs of guidelines
- Detect conflicts
- Verify if guideline A conflicts with B, then B conflicts with A

### Integration Tests

**End-to-End Cache Test** (`lib/evidence/__tests__/integration/caching.test.ts`):
- Make real query to PubMed
- Verify cache miss on first call
- Verify cache hit on second call
- Verify response time improvement
- Verify API call count reduction

**Conflict Detection Integration** (`lib/evidence/__tests__/integration/conflicts.test.ts`):
- Use real evidence with known conflicts (e.g., WHO vs CDC on specific topic)
- Verify conflicts are detected
- Verify formatted output includes conflict notice

**Sufficiency Scoring Integration** (`lib/evidence/__tests__/integration/sufficiency.test.ts`):
- Query with high-quality evidence (Cochrane + guidelines)
- Verify "excellent" classification
- Query with low-quality evidence (few sources)
- Verify "limited" or "insufficient" classification with warning

## Performance Considerations

### Cache Performance

**Expected Improvements**:
- Cache hit latency: <50ms (Redis GET operation)
- Cache miss latency: Same as current (5-7s for API calls)
- Overall latency with 70% hit rate: ~2s average (down from 5-7s)

**Redis Configuration**:
- Memory limit: 256MB (sufficient for ~10K cached queries)
- Eviction policy: `allkeys-lru` (least recently used)
- Persistence: Optional (cache can be rebuilt from APIs)

### Conflict Detection Performance

**Complexity**: O(n²) where n = number of guidelines
- Typical case: 5-10 guidelines → 25-100 comparisons
- Each comparison: <1ms (keyword matching)
- Total overhead: <100ms

**Optimization**: Early exit when conflict found

### Sufficiency Scoring Performance

**Complexity**: O(n) where n = total evidence items
- Typical case: 50-100 evidence items
- Each item: <1ms (simple counting)
- Total overhead: <100ms

## Security Considerations

### Redis Security

**Connection Security**:
- Use TLS for Redis connection in production
- Store `REDIS_URL` in environment variables, not code
- Use Redis AUTH if available

**Data Privacy**:
- Cache contains only public medical literature (no PHI)
- No user-specific data in cache
- Cache keys are hashed (query content not visible)

### Input Validation

**Query Hashing**:
- Sanitize query before hashing to prevent injection
- Limit query length to prevent DoS (max 1000 characters)

**Cache Key Validation**:
- Validate source name against whitelist
- Prevent cache key injection attacks

## Deployment Strategy

### Phase 1A: Cache Manager (Week 1)

1. Deploy Redis instance (development)
2. Implement cache manager with graceful degradation
3. Add caching to PubMed integration only
4. Monitor cache hit rate and performance
5. Deploy to production with feature flag

### Phase 1B: Conflict Detection (Week 1-2)

1. Implement conflict detector
2. Test with known controversial topics
3. Add conflict formatting to evidence engine
4. Deploy to production

### Phase 1C: Sufficiency Scoring (Week 2)

1. Implement sufficiency scorer
2. Add scoring to evidence engine
3. Add warnings to formatted evidence
4. Deploy to production

### Rollback Plan

**If cache causes issues**:
1. Set `REDIS_URL` to empty string
2. System automatically falls back to direct API calls
3. No code changes needed

**If conflicts cause confusion**:
1. Disable conflict detection in `engine.ts`
2. Remove conflict formatting
3. Deploy hotfix

**If sufficiency scores are inaccurate**:
1. Adjust scoring thresholds
2. Deploy configuration update
3. No code changes needed

## Monitoring and Metrics

### Cache Metrics

- `cache_hit_rate`: Percentage of queries served from cache
- `cache_latency_p50`: Median cache operation time
- `cache_latency_p99`: 99th percentile cache operation time
- `cache_errors`: Count of cache operation failures

### Conflict Metrics

- `conflicts_detected`: Count of conflicts found
- `conflicts_by_source`: Breakdown by source pair (WHO-CDC, CDC-NICE, etc.)
- `conflict_severity`: Count by major vs minor

### Sufficiency Metrics

- `sufficiency_score_avg`: Average sufficiency score
- `sufficiency_level_distribution`: Count by excellent/good/limited/insufficient
- `low_quality_queries`: Count of queries with limited/insufficient evidence

### Performance Metrics

- `query_latency_with_cache`: Average query time with caching
- `query_latency_without_cache`: Average query time without caching
- `api_cost_reduction`: Percentage reduction in API calls

## Future Enhancements (Phase 2+)

### Semantic Conflict Detection

Replace keyword matching with NLI (Natural Language Inference) models:
- Use models like `microsoft/deberta-v3-base-mnli`
- Detect semantic contradictions, not just keyword opposites
- Handle nuanced disagreements (e.g., different patient populations)

### Intelligent Cache Invalidation

- Invalidate cache when new guidelines published
- Subscribe to PubMed updates for specific topics
- Selective cache refresh for high-priority queries

### Evidence Sufficiency Triggers

- Automatically search additional sources when evidence insufficient
- Suggest alternative search terms
- Recommend specialist consultation for very low scores

### Conflict Resolution Recommendations

- Provide guidance on which source to prioritize
- Consider evidence recency, quality, and regional applicability
- Generate "consensus vs. controversy" summaries
