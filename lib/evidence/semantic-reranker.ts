/**
 * Semantic Reranker
 * 
 * Reranks search results using semantic similarity to improve relevance.
 * Uses biomedical embeddings to calculate cosine similarity between query and articles.
 * Integrates with Phase 1 caching for optimal performance.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { getEmbeddingGenerator, cosineSimilarity } from './embedding-generator';
import { getCachedEvidence, cacheEvidence } from './cache-manager';
import type { PubMedArticle } from './pubmed';
import type { CochraneReview } from './cochrane';
import type { EuropePMCArticle } from './europepmc';
import type { Chunk } from './sentence-splitter';

export interface RankedArticle<T = PubMedArticle> {
  article: T;
  similarity: number;
  originalRank: number;
}

export interface RerankerOptions {
  topK?: number; // Number of articles to rerank (default: 50)
  minSimilarity?: number; // Minimum similarity threshold (default: 0.0)
  skipIfFewResults?: number; // Skip reranking if fewer than N results (default: 10)
  useCache?: boolean; // Enable caching (default: true)
  cacheSource?: string; // Cache source identifier (default: 'semantic')
}

/**
 * Semantic Reranker for evidence articles
 */
export class SemanticReranker {
  private embeddingGenerator = getEmbeddingGenerator();

  /**
   * Rerank articles using semantic similarity
   * 
   * @param query - The search query
   * @param articles - Articles to rerank
   * @param options - Reranking options
   * @returns Reranked articles with similarity scores
   */
  async rerankArticles<T extends { title: string; abstract?: string; pmid?: string }>(
    query: string,
    articles: T[],
    options: RerankerOptions = {}
  ): Promise<RankedArticle<T>[]> {
    const {
      topK = 50,
      minSimilarity = 0.0,
      skipIfFewResults = 10,
      useCache = true,
      cacheSource = 'semantic',
    } = options;

    // Check cache first (if enabled)
    if (useCache) {
      try {
        const cacheKey = `${query}:${articles.length}:${topK}`;
        const cached = await getCachedEvidence<RankedArticle<T>[]>(cacheKey, cacheSource);
        
        if (cached) {
          console.log(`[SemanticReranker] Using cached reranked results`);
          return cached.data;
        }
      } catch (error: any) {
        console.error('[SemanticReranker] Cache read error, continuing without cache:', error.message);
        // Continue with reranking
      }
    }

    // Skip reranking if too few results
    if (articles.length < skipIfFewResults) {
      console.log(`[SemanticReranker] Skipping reranking: only ${articles.length} articles (< ${skipIfFewResults})`);
      return articles.map((article, index) => ({
        article,
        similarity: 1.0, // Default similarity
        originalRank: index,
      }));
    }

    try {
      // Limit to topK articles for efficiency
      const articlesToRerank = articles.slice(0, topK);
      
      console.log(`[SemanticReranker] Reranking ${articlesToRerank.length} articles for query: "${query}"`);
      const startTime = Date.now();

      // Generate query embedding
      const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query);

      // Generate article embeddings
      const articleTexts = articlesToRerank.map(article => 
        this.getArticleText(article)
      );
      const articleEmbeddings = await this.embeddingGenerator.generateEmbeddings(articleTexts);

      // Calculate similarities
      const rankedArticles: RankedArticle<T>[] = articlesToRerank.map((article, index) => {
        const similarity = cosineSimilarity(queryEmbedding, articleEmbeddings[index]);
        return {
          article,
          similarity,
          originalRank: index,
        };
      });

      // Sort by similarity (descending)
      rankedArticles.sort((a, b) => b.similarity - a.similarity);

      // Filter by minimum similarity
      const filteredArticles = rankedArticles.filter(
        item => item.similarity >= minSimilarity
      );

      const elapsedTime = Date.now() - startTime;
      const avgSimilarity = filteredArticles.length > 0
        ? filteredArticles.reduce((sum, item) => sum + item.similarity, 0) / filteredArticles.length
        : 0;

      console.log(
        `[SemanticReranker] Reranked ${filteredArticles.length} articles in ${elapsedTime}ms ` +
        `(avg similarity: ${avgSimilarity.toFixed(3)})`
      );

      // Cache the results (if enabled)
      if (useCache) {
        try {
          const cacheKey = `${query}:${articles.length}:${topK}`;
          await cacheEvidence(cacheKey, cacheSource, filteredArticles);
        } catch (error: any) {
          console.error('[SemanticReranker] Cache write error:', error.message);
          // Continue - results are still returned
        }
      }

      return filteredArticles;
    } catch (error) {
      console.error('[SemanticReranker] Reranking failed, returning original order:', error);
      
      // Graceful degradation: return original order
      return articles.map((article, index) => ({
        article,
        similarity: 1.0,
        originalRank: index,
      }));
    }
  }

  /**
   * Get text representation of an article for embedding
   * Combines title and abstract (if available)
   */
  private getArticleText(article: { title: string; abstract?: string }): string {
    if (article.abstract) {
      return `${article.title} ${article.abstract}`;
    }
    return article.title;
  }

  /**
   * Rerank PubMed articles specifically
   * Convenience method with PubMed-specific defaults
   */
  async rerankPubMedArticles(
    query: string,
    articles: PubMedArticle[],
    options: RerankerOptions = {}
  ): Promise<RankedArticle<PubMedArticle>[]> {
    return this.rerankArticles(query, articles, options);
  }

  /**
   * Rerank Cochrane reviews specifically
   * Convenience method with Cochrane-specific defaults
   */
  async rerankCochraneReviews(
    query: string,
    reviews: CochraneReview[],
    options: RerankerOptions = {}
  ): Promise<RankedArticle<CochraneReview>[]> {
    return this.rerankArticles(query, reviews, options);
  }

  /**
   * Rerank Europe PMC articles specifically
   * Convenience method with Europe PMC-specific defaults
   */
  async rerankEuropePMCArticles(
    query: string,
    articles: EuropePMCArticle[],
    options: RerankerOptions = {}
  ): Promise<RankedArticle<EuropePMCArticle>[]> {
    // Europe PMC has different field names, so we need to adapt
    const adaptedArticles = articles.map(article => ({
      ...article,
      title: article.title,
      abstract: article.abstractText,
    }));
    
    return this.rerankArticles(query, adaptedArticles as any, options) as Promise<RankedArticle<EuropePMCArticle>[]>;
  }

  /**
   * Rerank chunks (sentence-level search)
   * Enables precise chunk-level attribution
   */
  async rerankChunks(
    query: string,
    chunks: Chunk[],
    options: RerankerOptions = {}
  ): Promise<RankedArticle<Chunk>[]> {
    // Adapt chunks to have title and abstract fields
    const adaptedChunks = chunks.map(chunk => ({
      ...chunk,
      title: chunk.metadata.title,
      abstract: chunk.text, // Use chunk text as "abstract"
    }));
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.rerankArticles(query, adaptedChunks as any, options).then(results => results as unknown as RankedArticle<Chunk>[]);
  }
}

/**
 * Singleton instance for reuse
 */
let rerankerInstance: SemanticReranker | null = null;

/**
 * Get the singleton semantic reranker instance
 */
export function getSemanticReranker(): SemanticReranker {
  if (!rerankerInstance) {
    rerankerInstance = new SemanticReranker();
  }
  return rerankerInstance;
}

/**
 * Convenience function to rerank PubMed articles
 */
export async function rerankPubMedArticles(
  query: string,
  articles: PubMedArticle[],
  options: RerankerOptions = {}
): Promise<PubMedArticle[]> {
  const reranker = getSemanticReranker();
  const rankedArticles = await reranker.rerankPubMedArticles(query, articles, options);
  return rankedArticles.map(item => item.article);
}

/**
 * Convenience function to rerank Cochrane reviews
 */
export async function rerankCochraneReviews(
  query: string,
  reviews: CochraneReview[],
  options: RerankerOptions = {}
): Promise<CochraneReview[]> {
  const reranker = getSemanticReranker();
  const rankedReviews = await reranker.rerankCochraneReviews(query, reviews, options);
  return rankedReviews.map(item => item.article);
}

/**
 * Convenience function to rerank Europe PMC articles
 */
export async function rerankEuropePMCArticles(
  query: string,
  articles: EuropePMCArticle[],
  options: RerankerOptions = {}
): Promise<EuropePMCArticle[]> {
  const reranker = getSemanticReranker();
  const rankedArticles = await reranker.rerankEuropePMCArticles(query, articles, options);
  return rankedArticles.map(item => item.article);
}

/**
 * Convenience function to rerank chunks (sentence-level)
 */
export async function rerankChunks(
  query: string,
  chunks: Chunk[],
  options: RerankerOptions = {}
): Promise<Chunk[]> {
  const reranker = getSemanticReranker();
  const rankedChunks = await reranker.rerankChunks(query, chunks, options);
  return rankedChunks.map(item => item.article);
}
