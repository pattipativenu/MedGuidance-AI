/**
 * Sentence Splitter with Provenance Tracking
 * 
 * Splits abstracts into sentences while preserving provenance metadata.
 * Enables chunk-level attribution for precise citations.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import type { PubMedArticle } from './pubmed';

export interface Chunk {
  id: string; // Format: "PMID:12345:S:2"
  pmid: string;
  sentenceIndex: number;
  text: string;
  context?: {
    before?: string; // Previous sentence
    after?: string; // Next sentence
  };
  metadata: {
    title: string;
    source: string;
    publicationDate?: string;
    journal?: string;
    authors?: string[];
    doi?: string;
  };
}

/**
 * Sentence Splitter
 */
export class SentenceSplitter {
  /**
   * Split text into sentences
   * Uses simple rule-based approach with common abbreviations handling
   */
  splitIntoSentences(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Common medical abbreviations that shouldn't trigger sentence breaks
    const abbreviations = [
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
      'vs', 'etc', 'i.e', 'e.g', 'cf', 'al',
      'Fig', 'Tab', 'Vol', 'No', 'Ref',
    ];

    // Replace abbreviations temporarily to avoid false splits
    let processedText = text;
    const replacements: Map<string, string> = new Map();
    
    abbreviations.forEach((abbr, index) => {
      const placeholder = `__ABBR${index}__`;
      const pattern = new RegExp(`\\b${abbr}\\.`, 'g');
      processedText = processedText.replace(pattern, placeholder);
      replacements.set(placeholder, `${abbr}.`);
    });

    // Split on sentence boundaries (. ! ?)
    // Look for period/exclamation/question followed by space and capital letter
    const sentencePattern = /([.!?])\s+(?=[A-Z])/g;
    const parts = processedText.split(sentencePattern);

    // Reconstruct sentences
    const sentences: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      let sentence = parts[i];
      if (i + 1 < parts.length) {
        sentence += parts[i + 1]; // Add back the punctuation
      }
      
      // Restore abbreviations
      replacements.forEach((original, placeholder) => {
        sentence = sentence.replace(new RegExp(placeholder, 'g'), original);
      });
      
      const trimmed = sentence.trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
    }

    // If no sentences were found, return the whole text as one sentence
    if (sentences.length === 0 && text.trim().length > 0) {
      return [text.trim()];
    }

    return sentences;
  }

  /**
   * Create chunks with provenance from an article
   */
  createChunks(article: PubMedArticle, includeContext: boolean = true): Chunk[] {
    const chunks: Chunk[] = [];
    
    // Get abstract text
    const abstractText = article.abstract || '';
    if (!abstractText) {
      return chunks;
    }

    // Split into sentences
    const sentences = this.splitIntoSentences(abstractText);

    // Create chunks with provenance
    sentences.forEach((sentence, index) => {
      const chunk: Chunk = {
        id: `PMID:${article.pmid}:S:${index}`,
        pmid: article.pmid,
        sentenceIndex: index,
        text: sentence,
        metadata: {
          title: article.title,
          source: 'pubmed', // Default source
          publicationDate: article.publicationDate,
          journal: article.journal,
          authors: article.authors,
          doi: article.doi,
        },
      };

      // Add context (±1 sentence)
      if (includeContext) {
        chunk.context = {
          before: index > 0 ? sentences[index - 1] : undefined,
          after: index < sentences.length - 1 ? sentences[index + 1] : undefined,
        };
      }

      chunks.push(chunk);
    });

    return chunks;
  }

  /**
   * Create chunks from multiple articles
   */
  createChunksFromArticles(articles: PubMedArticle[], includeContext: boolean = true): Chunk[] {
    const allChunks: Chunk[] = [];
    
    for (const article of articles) {
      const chunks = this.createChunks(article, includeContext);
      allChunks.push(...chunks);
    }
    
    return allChunks;
  }

  /**
   * Get chunk by ID
   */
  getChunkById(chunks: Chunk[], chunkId: string): Chunk | undefined {
    return chunks.find(chunk => chunk.id === chunkId);
  }

  /**
   * Get all chunks for a specific article
   */
  getChunksByPMID(chunks: Chunk[], pmid: string): Chunk[] {
    return chunks.filter(chunk => chunk.pmid === pmid);
  }

  /**
   * Reconstruct abstract from chunks
   * Useful for verifying sentence boundary preservation
   */
  reconstructAbstract(chunks: Chunk[]): string {
    // Sort by sentence index
    const sorted = [...chunks].sort((a, b) => a.sentenceIndex - b.sentenceIndex);
    
    // Join sentences with space
    return sorted.map(chunk => chunk.text).join(' ');
  }
}

/**
 * Singleton instance
 */
let splitterInstance: SentenceSplitter | null = null;

/**
 * Get the singleton sentence splitter instance
 */
export function getSentenceSplitter(): SentenceSplitter {
  if (!splitterInstance) {
    splitterInstance = new SentenceSplitter();
  }
  return splitterInstance;
}

/**
 * Convenience function to create chunks from articles
 */
export function createChunksFromArticles(
  articles: PubMedArticle[],
  includeContext: boolean = true
): Chunk[] {
  const splitter = getSentenceSplitter();
  return splitter.createChunksFromArticles(articles, includeContext);
}
