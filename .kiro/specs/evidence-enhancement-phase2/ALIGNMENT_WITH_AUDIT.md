# Phase 2 Alignment with Evidence System Audit

## Overview

This document explains how Phase 2 requirements align with the recommendations from `EVIDENCE_SYSTEM_AUDIT.md`.

## Audit Findings Addressed

### Gap: "No semantic search - relies on keyword matching"

**Audit Impact:** Lower recall, especially for novel terminology. Misses conceptually similar papers.

**Phase 2 Solution:**
- **Requirement 1**: Semantic similarity search with medical terminology
- **Requirement 2**: Biomedical embedding models (PubMedBERT/BioBERT)
- **Requirement 3**: Semantic reranking of keyword results
- **Requirement 8**: Multi-source semantic reranking

**Approach:** Instead of building a full vector database (which the audit recommends against), we use **semantic reranking** of keyword search results. This gives us semantic search benefits without the infrastructure overhead.

### Gap: "No query expansion beyond MeSH terms"

**Audit Impact:** Misses related concepts, harder to find relevant trials.

**Phase 2 Solution:**
- **Requirement 5**: PICO extraction (Population, Intervention, Comparator, Outcome)
- **Requirement 5**: Synonym generation using medical ontologies
- **Requirement 5**: Expanded query search strategies

**Approach:** Extract clinical trial elements and generate variations, building on existing MeSH enhancement from Phase 1.

### Gap: "No reranking of results by relevance"

**Audit Impact:** Less relevant results shown first.

**Phase 2 Solution:**
- **Requirement 3**: Semantic similarity reranking
- **Requirement 6**: Cross-encoder reranking for final scoring
- **Requirement 8**: Per-source reranking

**Approach:** Two-stage reranking: (1) semantic similarity for broad relevance, (2) cross-encoder for precise query-document matching.

## What We're NOT Building (Per Audit Recommendations)

❌ **Full vector database**: Audit says "don't replace your API approach"
- Instead: Semantic reranking of API results

❌ **Embedding all of PubMed**: Audit says "35M articles is overkill"
- Instead: Embed only top-50 results per query

❌ **Document ingestion pipeline**: Audit says "APIs give you this for free"
- Instead: Keep real-time API orchestration

❌ **Real-time indexing**: Audit says "daily batch updates are fine"
- Instead: No indexing needed with our approach

❌ **Custom reranker training**: Audit says "use off-the-shelf models"
- Instead: Use pretrained PubMedBERT and MS MARCO models

## Alignment with Audit Roadmap

### Audit Phase 2: Semantic Enhancement (2-4 weeks)

**Audit Recommendation 4: "Add biomedical embeddings"**
- ✅ Requirement 2: PubMedBERT/BioBERT integration
- ✅ Requirement 3: Semantic reranking
- ✅ Requirement 8: Multi-source support

**Audit Recommendation 5: "Implement query expansion"**
- ✅ Requirement 5: PICO extraction
- ✅ Requirement 5: Synonym generation
- ✅ Requirement 5: Expanded query search

## Integration with Phase 1

Phase 2 builds on Phase 1's caching infrastructure:

**Phase 1 Provided:**
- Redis caching layer (24-hour TTL)
- Cache hit/miss logging
- Graceful degradation when cache unavailable
- Configuration validation

**Phase 2 Leverages:**
- **Requirement 7**: Cache semantic search results using Phase 1 infrastructure
- **Requirement 7**: Same TTL and key generation patterns
- **Requirement 9**: Extend Phase 1 monitoring to include semantic metrics
- **Requirement 10**: Extend Phase 1 configuration validation

## Cost-Benefit Analysis

### Audit's Cost Projections

**Full RAG System (NOT recommended):**
- Vector DB: $200-500/month
- Embedding API: $50-100/month
- Reindexing: $100/month
- Total: $350-700/month + engineering time
- **ROI: Negative**

**Our Phase 2 Approach (Semantic Reranking):**
- Embedding model: Self-hosted (free after setup)
- No vector database needed
- No reindexing needed
- Additional latency: ~200-300ms per query
- **ROI: Positive** (better recall without infrastructure costs)

### Performance Impact

**Audit Baseline (with Phase 1 caching):**
- Cached queries: 1-2s
- Uncached queries: 5-7s

**Phase 2 Addition:**
- Semantic reranking: +200-300ms
- PICO extraction: +50-100ms
- Cross-encoder reranking: +100-200ms
- **Total with Phase 2**: 1.5-2.5s (cached), 5.5-8s (uncached)

**Acceptable because:**
- Still under 3s target for 80% of queries (cached)
- Improved recall justifies slight latency increase
- Can be optimized with model quantization

## Success Metrics (From Audit)

### Quality Metrics
- **Citation recall**: Target >80% → Phase 2 should improve to >85%
- **Semantic recall**: New metric - measure papers found via semantic vs. keyword only

### Performance Metrics
- **Query latency**: Maintain <2s for cached queries
- **Semantic reranking time**: Target <300ms

### User Experience
- **Relevance**: Users should see more relevant results in top 5
- **Novel terminology**: Better handling of new medical terms

## Technical Approach Validation

### Audit Recommendation: "Use off-the-shelf models"

**Our Approach:**
- ✅ PubMedBERT (pretrained on PubMed abstracts)
- ✅ BioBERT (pretrained on biomedical literature)
- ✅ MS MARCO MiniLM (pretrained cross-encoder)
- ❌ No custom training needed

### Audit Recommendation: "Don't build vector database"

**Our Approach:**
- ✅ Semantic reranking of API results
- ✅ Embed only top-50 per query (not entire corpus)
- ✅ No persistent vector storage
- ✅ Keep real-time API orchestration

### Audit Recommendation: "Incremental improvements"

**Our Approach:**
- ✅ Phase 2 builds on Phase 1 caching
- ✅ Graceful degradation (falls back to keyword search)
- ✅ Can be deployed incrementally (reranking first, then PICO, then cross-encoder)
- ✅ Each component is independently testable

## Risk Mitigation

### Risk: Semantic reranking adds latency

**Mitigation:**
- Requirement 3: Only rerank top-50 results (not all)
- Requirement 6: Cross-encoder only on top-20 (not all)
- Requirement 10: Configurable - can disable if too slow
- Can use model quantization for faster inference

### Risk: Embedding model memory usage

**Mitigation:**
- Requirement 2: Cache model in memory (load once)
- Use smaller models (MiniLM variants)
- Can offload to GPU if available
- Requirement 10: Configurable batch size

### Risk: PICO extraction accuracy

**Mitigation:**
- Requirement 5: Falls back to MeSH enhancement if extraction fails
- Can use rule-based extraction initially
- Can upgrade to ML-based extraction later
- Requirement 9: Monitor extraction success rate

## Next Steps

1. **Review Phase 2 requirements** with stakeholders
2. **Create Phase 2 design document** with architecture details
3. **Implement in order**:
   - Week 1-2: Semantic reranking (Req 1-3)
   - Week 3-4: PICO extraction (Req 5)
   - Week 5-6: Cross-encoder reranking (Req 6)
   - Week 7-8: Integration & testing (Req 7-10)

## Conclusion

Phase 2 follows the audit's recommendation for **incremental semantic enhancement** rather than a full RAG rebuild. By using semantic reranking instead of a vector database, we get 80% of the benefits at 20% of the cost and complexity.

This approach:
- ✅ Addresses the "keyword-only search" gap
- ✅ Maintains real-time freshness
- ✅ Avoids expensive infrastructure
- ✅ Builds on Phase 1 caching
- ✅ Provides graceful degradation
- ✅ Aligns with audit's cost-benefit analysis
