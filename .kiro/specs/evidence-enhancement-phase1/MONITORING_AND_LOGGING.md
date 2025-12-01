# Phase 1 Monitoring and Logging

This document describes the comprehensive monitoring and logging implemented for Phase 1 enhancements.

## Overview

All Phase 1 enhancements include detailed logging for:
- Cache operations (hits, misses, errors)
- Conflict detection (conflicts found, errors)
- Sufficiency scoring (scores, levels, errors)
- Performance metrics (optional)

## Cache Operations Logging

### Location
`lib/evidence/cache-manager.ts`

### Events Logged

**Connection Events:**
- ✅ Redis cache connected
- ⚠️  Redis connection closed
- ❌ Redis connection failed after 3 retries
- ❌ Redis initialization failed

**Cache Operations:**
- 📬 Cache hit: `{source}` for query `{hash}`
- 📭 Cache miss: `{source}` for query `{hash}`
- 💾 Cached: `{source}` for query `{hash}` (TTL: 24h)
- ❌ Cache read error for `{source}`
- ❌ Cache write error for `{source}`

**Statistics:**
- Cache hits, misses, errors tracked in-memory
- Hit rate calculated automatically
- Available via `getCacheStats()`

### Example Output
```
✅ Redis cache connected
📭 Cache miss: pubmed for query a1b2c3d4e5f6g7h8
💾 Cached: pubmed for query a1b2c3d4e5f6g7h8 (TTL: 24h)
📬 Cache hit: pubmed for query a1b2c3d4e5f6g7h8
```

## Conflict Detection Logging

### Location
`lib/evidence/conflict-detector.ts`

### Events Logged

**Detection Process:**
- 🔍 Checking `{count}` guidelines for conflicts...
- ⚠️  Conflict detected: `{description}`
- ✅ Found `{count}` conflict(s)

**Errors:**
- ⚠️  Conflict detection: No evidence package provided
- ❌ Error checking conflict between guidelines `{i}` and `{j}`
- ❌ Conflict detection failed (with stack trace)

### Example Output
```
🔍 Checking 5 guidelines for conflicts...
⚠️  Conflict detected: WHO and CDC provide contradictory recommendations on diabetes management
✅ Found 1 conflict(s)
```

## Sufficiency Scoring Logging

### Location
`lib/evidence/sufficiency-scorer.ts`, `lib/evidence/engine.ts`

### Events Logged

**Scoring Results:**
- 📊 Evidence Sufficiency: `{LEVEL}` (`{score}`/100)

**Errors:**
- ⚠️  Sufficiency scoring: No evidence package provided
- ❌ Error scoring Cochrane reviews
- ❌ Error scoring guidelines
- ❌ Error scoring RCTs
- ❌ Error scoring recent articles
- ❌ Error scoring systematic reviews
- ❌ Sufficiency scoring failed (with stack trace)

### Example Output
```
📊 Evidence Sufficiency: GOOD (65/100)
```

## Integration Logging

### Location
`lib/evidence/engine.ts`

### Events Logged

**Phase 1 Enhancement Errors:**
- ❌ Evidence sufficiency scoring failed
- ❌ Conflict detection failed
- Continuing without `{feature}` (graceful degradation)

### Example Output
```
📊 Evidence Sufficiency: EXCELLENT (85/100)
🔍 Checking 8 guidelines for conflicts...
✅ Found 0 conflict(s)
```

## Performance Monitoring (Optional)

### Location
`lib/evidence/performance-monitor.ts`

### Features

**Tracking:**
- Total operation duration
- Cache operation timings (read/write)
- Individual source API call timings
- Phase 1 enhancement timings

**Metrics Available:**
```typescript
interface PerformanceMetrics {
  totalDuration: number;
  cacheOperations: {
    hits: number;
    misses: number;
    hitRate: number;
    avgReadTime: number;
    avgWriteTime: number;
  };
  sourceTimings: {
    [source: string]: number;
  };
  enhancements: {
    conflictDetection: number;
    sufficiencyScoring: number;
  };
  timestamp: string;
}
```

**Usage:**
```typescript
import { 
  startPerformanceTracking, 
  completePerformanceTracking,
  logPerformanceMetrics 
} from './performance-monitor';

// Start tracking
startPerformanceTracking();

// ... perform operations ...

// Complete and log
const metrics = completePerformanceTracking(cacheHits, cacheMisses);
logPerformanceMetrics(metrics);
```

**Example Output:**
```
📊 PERFORMANCE METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Total Duration: 5234ms (5.23s)

💾 Cache Operations:
   Hits: 3
   Misses: 7
   Hit Rate: 30.00%
   Avg Read Time: 12.5ms
   Avg Write Time: 8.3ms

🔍 Slowest Sources (Top 5):
   pubmed: 1234ms
   cochrane: 987ms
   europepmc: 876ms
   clinicaltrials: 654ms
   semantic-scholar: 543ms

⚡ Phase 1 Enhancements:
   Conflict Detection: 45ms
   Sufficiency Scoring: 23ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Log Levels

All logging uses appropriate console methods:
- `console.log()` - Informational messages (✅, 📬, 📭, 💾, 🔍)
- `console.warn()` - Warnings (⚠️)
- `console.error()` - Errors (❌) with stack traces where appropriate

## Monitoring Best Practices

1. **Cache Statistics**: Check `getCacheStats()` regularly to monitor cache effectiveness
2. **Error Tracking**: Monitor error logs for patterns indicating system issues
3. **Performance**: Use performance monitor to identify slow sources
4. **Graceful Degradation**: All errors log but don't break the system

## Future Enhancements

Potential improvements for Phase 2:
- Structured logging (JSON format)
- Log aggregation service integration
- Real-time monitoring dashboard
- Alerting for error thresholds
- Performance regression detection
