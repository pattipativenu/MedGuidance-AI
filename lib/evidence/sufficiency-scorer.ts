/**
 * Evidence Sufficiency Scoring System
 * 
 * Calculates a quality score (0-100) for evidence packages based on:
 * - Presence of Cochrane reviews (gold standard)
 * - Clinical guidelines from authoritative sources
 * - Randomized controlled trials with results
 * - Recent peer-reviewed articles (last 5 years)
 * 
 * Provides transparent reasoning for scores and warnings for low-quality evidence.
 */

import type { EvidencePackage } from './engine';

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

/**
 * Calculate evidence sufficiency score
 * 
 * Scoring Algorithm:
 * - Cochrane reviews: +30 points (gold standard systematic reviews)
 * - Clinical guidelines: +25 points (authoritative recommendations)
 * - RCTs with results: +20 points (high-quality primary evidence)
 * - Recent articles (≥5 in last 5 years): +15 points (current evidence)
 * - Systematic reviews (non-Cochrane): +10 points (additional synthesis)
 * 
 * Maximum possible score: 100 points
 * 
 * Error Handling: Returns default "insufficient" score on failure (graceful degradation)
 */
export function scoreEvidenceSufficiency(
  evidence: EvidencePackage
): SufficiencyScore {
  try {
    // Validate input
    if (!evidence) {
      console.warn('⚠️  Sufficiency scoring: No evidence package provided');
      return {
        score: 0,
        level: 'insufficient',
        reasoning: ['No evidence package provided'],
        breakdown: {
          cochraneReviews: 0,
          guidelines: 0,
          rcts: 0,
          recentArticles: 0,
        },
      };
    }

    let score = 0;
    const reasoning: string[] = [];
    const breakdown = {
      cochraneReviews: 0,
      guidelines: 0,
      rcts: 0,
      recentArticles: 0,
    };

    // 1. Cochrane Reviews (Gold Standard) - 30 points
    try {
      const cochraneCount = (evidence.cochraneReviews?.length || 0) + (evidence.cochraneRecent?.length || 0);
      if (cochraneCount > 0) {
        breakdown.cochraneReviews = 30;
        score += 30;
        reasoning.push(`${cochraneCount} Cochrane review${cochraneCount > 1 ? 's' : ''} (gold standard)`);
      }
    } catch (error: any) {
      console.error('❌ Error scoring Cochrane reviews:', error.message);
    }

    // 2. Clinical Guidelines - 25 points
    try {
      const guidelineCount = 
        (evidence.guidelines?.length || 0) +
        (evidence.pubmedGuidelines?.length || 0) +
        (evidence.whoGuidelines?.length || 0) +
        (evidence.cdcGuidelines?.length || 0) +
        (evidence.niceGuidelines?.length || 0) +
        (evidence.bmjBestPractice?.length || 0) +
        (evidence.cardiovascularGuidelines?.length || 0) +
        (evidence.aapGuidelines?.length || 0);
      
      if (guidelineCount > 0) {
        breakdown.guidelines = 25;
        score += 25;
        reasoning.push(`${guidelineCount} clinical guideline${guidelineCount > 1 ? 's' : ''}`);
      }
    } catch (error: any) {
      console.error('❌ Error scoring guidelines:', error.message);
    }

    // 3. RCTs with Results - 20 points
    try {
      const rctsWithResults = (evidence.clinicalTrials || []).filter(
        trial => trial.hasResults && trial.studyType === 'Interventional'
      );
      if (rctsWithResults.length > 0) {
        breakdown.rcts = 20;
        score += 20;
        reasoning.push(`${rctsWithResults.length} randomized controlled trial${rctsWithResults.length > 1 ? 's' : ''} with results`);
      }
    } catch (error: any) {
      console.error('❌ Error scoring RCTs:', error.message);
    }

    // 4. Recent Articles (last 5 years, ≥5 articles) - 15 points
    try {
      const currentYear = new Date().getFullYear();
      const recentThreshold = currentYear - 5;
      
      const recentArticles = (evidence.pubmedArticles || []).filter(article => {
        const year = parseInt(article.publicationDate);
        return !isNaN(year) && year >= recentThreshold;
      });
      
      if (recentArticles.length >= 5) {
        breakdown.recentArticles = 15;
        score += 15;
        reasoning.push(`${recentArticles.length} recent articles (last 5 years)`);
      } else if (recentArticles.length > 0) {
        reasoning.push(`Only ${recentArticles.length} recent articles (need ≥5 for full credit)`);
      }
    } catch (error: any) {
      console.error('❌ Error scoring recent articles:', error.message);
    }

    // 5. Systematic Reviews (non-Cochrane) - 10 points bonus
    try {
      const cochraneCount = (evidence.cochraneReviews?.length || 0) + (evidence.cochraneRecent?.length || 0);
      const systematicReviewCount = 
        (evidence.pubmedReviews?.length || 0) +
        (evidence.systematicReviews?.length || 0) +
        (evidence.pmcReviews?.length || 0);
      
      if (systematicReviewCount > 0 && cochraneCount === 0) {
        score += 10;
        reasoning.push(`${systematicReviewCount} systematic review${systematicReviewCount > 1 ? 's' : ''} (non-Cochrane)`);
      }
    } catch (error: any) {
      console.error('❌ Error scoring systematic reviews:', error.message);
    }

    // Determine quality level based on score
    let level: 'excellent' | 'good' | 'limited' | 'insufficient';
    if (score >= 70) {
      level = 'excellent';
    } else if (score >= 50) {
      level = 'good';
    } else if (score >= 30) {
      level = 'limited';
    } else {
      level = 'insufficient';
    }

    // Add summary reasoning
    if (reasoning.length === 0) {
      reasoning.push('No high-quality evidence sources found');
    }

    return {
      score,
      level,
      reasoning,
      breakdown,
    };
  } catch (error: any) {
    console.error('❌ Sufficiency scoring failed:', error.message);
    console.error('Stack trace:', error.stack);
    // Return default insufficient score - system continues without scoring
    return {
      score: 0,
      level: 'insufficient',
      reasoning: ['Error calculating evidence sufficiency'],
      breakdown: {
        cochraneReviews: 0,
        guidelines: 0,
        rcts: 0,
        recentArticles: 0,
      },
    };
  }
}

/**
 * Format sufficiency warning for low-quality evidence
 * Returns null if evidence is sufficient (good or excellent)
 */
export function formatSufficiencyWarning(
  score: SufficiencyScore
): string | null {
  if (score.level === 'excellent' || score.level === 'good') {
    return null; // No warning needed
  }

  let warning = '\n\n--- ⚠️  EVIDENCE QUALITY NOTICE ---\n\n';
  
  if (score.level === 'insufficient') {
    warning += '**INSUFFICIENT EVIDENCE** (Score: ' + score.score + '/100)\n\n';
    warning += 'The available evidence for this query is very limited. ';
    warning += 'Recommendations should be made with caution and may require specialist consultation.\n\n';
  } else {
    warning += '**LIMITED EVIDENCE** (Score: ' + score.score + '/100)\n\n';
    warning += 'The available evidence for this query is limited. ';
    warning += 'Consider the following gaps:\n\n';
  }

  // Identify specific gaps
  const gaps: string[] = [];
  
  if (score.breakdown.cochraneReviews === 0) {
    gaps.push('- No Cochrane systematic reviews found');
  }
  
  if (score.breakdown.guidelines === 0) {
    gaps.push('- No clinical practice guidelines found');
  }
  
  if (score.breakdown.rcts === 0) {
    gaps.push('- No randomized controlled trials with results found');
  }
  
  if (score.breakdown.recentArticles === 0) {
    gaps.push('- Limited recent research (last 5 years)');
  }

  if (gaps.length > 0) {
    warning += '**Evidence Gaps:**\n';
    warning += gaps.join('\n') + '\n\n';
  }

  warning += '**Clinical Guidance:**\n';
  warning += '- Base recommendations on available evidence while acknowledging limitations\n';
  warning += '- Consider consulting specialist resources or colleagues\n';
  warning += '- Inform patients about the level of evidence supporting recommendations\n';
  warning += '- Monitor for new evidence as research evolves\n\n';
  
  warning += '--- END EVIDENCE QUALITY NOTICE ---\n\n';
  
  return warning;
}

/**
 * Check if evidence is sufficient for clinical decision-making
 * Returns true if level is "good" or "excellent"
 */
export function isEvidenceSufficient(score: SufficiencyScore): boolean {
  return score.level === 'excellent' || score.level === 'good';
}

/**
 * Format sufficiency score for display in evidence prompt
 */
export function formatSufficiencyForPrompt(score: SufficiencyScore): string {
  const emoji = {
    'excellent': '🟢',
    'good': '🟡',
    'limited': '🟠',
    'insufficient': '🔴',
  };

  let formatted = '\n\n--- EVIDENCE QUALITY ASSESSMENT ---\n\n';
  formatted += `**Overall Quality:** ${emoji[score.level]} ${score.level.toUpperCase()} (${score.score}/100)\n\n`;
  
  formatted += '**Evidence Breakdown:**\n';
  formatted += score.reasoning.map(r => `- ${r}`).join('\n');
  formatted += '\n\n';
  
  if (score.level === 'excellent') {
    formatted += '**Interpretation:** Strong evidence base with high-quality sources. ';
    formatted += 'Recommendations can be made with confidence.\n\n';
  } else if (score.level === 'good') {
    formatted += '**Interpretation:** Adequate evidence base. ';
    formatted += 'Recommendations are well-supported but may benefit from additional sources.\n\n';
  }
  
  formatted += '--- END EVIDENCE QUALITY ASSESSMENT ---\n\n';
  
  return formatted;
}
