/**
 * PICO Extractor for Query Expansion
 * 
 * Extracts PICO elements (Population, Intervention, Comparator, Outcome) from clinical queries
 * and generates synonym variations using medical ontologies for better search coverage.
 * 
 * PICO Framework:
 * - P (Population): Who is the patient? (age, gender, condition)
 * - I (Intervention): What treatment/test/exposure?
 * - C (Comparator): What is the alternative? (optional)
 * - O (Outcome): What are you trying to accomplish/measure?
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

export interface PICOElements {
  population?: string[];
  intervention?: string[];
  comparator?: string[];
  outcome?: string[];
  originalQuery: string;
}

export interface ExpandedQuery {
  original: string;
  expanded: string[];
  picoElements: PICOElements;
}

/**
 * Common medical synonyms for query expansion
 * Maps terms to their medical synonyms
 */
const MEDICAL_SYNONYMS: Record<string, string[]> = {
  // Conditions
  'diabetes': ['diabetes mellitus', 'diabetic', 'hyperglycemia', 'high blood sugar'],
  'heart attack': ['myocardial infarction', 'MI', 'cardiac infarction', 'coronary thrombosis'],
  'high blood pressure': ['hypertension', 'elevated blood pressure', 'HTN'],
  'stroke': ['cerebrovascular accident', 'CVA', 'brain attack', 'cerebral infarction'],
  'heart failure': ['cardiac failure', 'congestive heart failure', 'CHF'],
  'copd': ['chronic obstructive pulmonary disease', 'emphysema', 'chronic bronchitis'],
  'asthma': ['bronchial asthma', 'reactive airway disease'],
  
  // Treatments
  'metformin': ['glucophage', 'biguanide'],
  'aspirin': ['acetylsalicylic acid', 'ASA'],
  'insulin': ['insulin therapy', 'insulin treatment'],
  'statin': ['HMG-CoA reductase inhibitor', 'atorvastatin', 'simvastatin'],
  'beta blocker': ['beta-adrenergic blocker', 'beta-adrenergic antagonist'],
  'ace inhibitor': ['ACE-I', 'angiotensin-converting enzyme inhibitor'],
  
  // Outcomes
  'mortality': ['death', 'survival', 'fatality'],
  'morbidity': ['disease', 'illness', 'complications'],
  'quality of life': ['QOL', 'life quality', 'well-being'],
  'hospitalization': ['hospital admission', 'inpatient care'],
  'adverse effects': ['side effects', 'adverse events', 'complications', 'toxicity'],
};

/**
 * Population indicators (age, gender, conditions)
 */
const POPULATION_PATTERNS = [
  /\b(adult|adults|elderly|children|pediatric|infant|adolescent|geriatric)\b/gi,
  /\b(men|women|male|female|patient|patients)\b/gi,
  /\b(with|having|diagnosed with)\s+([a-z\s]+)/gi,
  /\b(type\s+\d+)\b/gi,
];

/**
 * Intervention indicators (treatments, procedures, drugs)
 */
const INTERVENTION_PATTERNS = [
  /\b(treatment|therapy|medication|drug|intervention)\b/gi,
  /\b(surgery|procedure|operation)\b/gi,
  /\b(exercise|diet|lifestyle)\b/gi,
  /\b([a-z]+mycin|[a-z]+cillin|[a-z]+statin|[a-z]+pril|[a-z]+sartan)\b/gi, // Drug suffixes
];

/**
 * Comparator indicators (vs, compared to, versus)
 */
const COMPARATOR_PATTERNS = [
  /\b(vs|versus|compared to|compared with|against)\s+([a-z\s]+)/gi,
  /\b(placebo|control|standard care)\b/gi,
];

/**
 * Outcome indicators (results, effects, outcomes)
 */
const OUTCOME_PATTERNS = [
  /\b(mortality|death|survival)\b/gi,
  /\b(efficacy|effectiveness|benefit)\b/gi,
  /\b(adverse|side effects|complications|toxicity)\b/gi,
  /\b(quality of life|QOL)\b/gi,
  /\b(reduction|improvement|decrease|increase)\b/gi,
];

/**
 * PICO Extractor
 */
export class PICOExtractor {
  /**
   * Extract PICO elements from a clinical query
   */
  extractPICO(query: string): PICOElements {
    const lowerQuery = query.toLowerCase();
    
    const population = this.extractPopulation(lowerQuery);
    const intervention = this.extractIntervention(lowerQuery);
    const comparator = this.extractComparator(lowerQuery);
    const outcome = this.extractOutcome(lowerQuery);

    return {
      population: population.length > 0 ? population : undefined,
      intervention: intervention.length > 0 ? intervention : undefined,
      comparator: comparator.length > 0 ? comparator : undefined,
      outcome: outcome.length > 0 ? outcome : undefined,
      originalQuery: query,
    };
  }

  /**
   * Extract population elements
   */
  private extractPopulation(query: string): string[] {
    const elements = new Set<string>();
    
    for (const pattern of POPULATION_PATTERNS) {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        if (match[0]) {
          elements.add(match[0].trim());
        }
      }
    }
    
    return Array.from(elements);
  }

  /**
   * Extract intervention elements
   */
  private extractIntervention(query: string): string[] {
    const elements = new Set<string>();
    
    for (const pattern of INTERVENTION_PATTERNS) {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        if (match[0]) {
          elements.add(match[0].trim());
        }
      }
    }
    
    return Array.from(elements);
  }

  /**
   * Extract comparator elements
   */
  private extractComparator(query: string): string[] {
    const elements = new Set<string>();
    
    for (const pattern of COMPARATOR_PATTERNS) {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        if (match[0]) {
          elements.add(match[0].trim());
        }
      }
    }
    
    return Array.from(elements);
  }

  /**
   * Extract outcome elements
   */
  private extractOutcome(query: string): string[] {
    const elements = new Set<string>();
    
    for (const pattern of OUTCOME_PATTERNS) {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        if (match[0]) {
          elements.add(match[0].trim());
        }
      }
    }
    
    return Array.from(elements);
  }

  /**
   * Generate synonym variations for a term
   */
  private generateSynonyms(term: string): string[] {
    const lowerTerm = term.toLowerCase().trim();
    const synonyms = new Set<string>([term]);
    
    // Check if term has known synonyms
    for (const [key, values] of Object.entries(MEDICAL_SYNONYMS)) {
      // Check for exact match or if term contains the key
      if (lowerTerm === key || lowerTerm.includes(key)) {
        values.forEach(syn => synonyms.add(syn));
        synonyms.add(key); // Add the key itself
      }
    }
    
    return Array.from(synonyms);
  }

  /**
   * Expand query with PICO elements and synonyms
   */
  expandQuery(query: string): ExpandedQuery {
    const picoElements = this.extractPICO(query);
    const expandedQueries = new Set<string>([query]);
    const lowerQuery = query.toLowerCase();

    // Check for known medical terms in the query and generate variations
    for (const [key, synonyms] of Object.entries(MEDICAL_SYNONYMS)) {
      if (lowerQuery.includes(key)) {
        // Generate a variation for each synonym
        for (const synonym of synonyms) {
          const expandedQuery = query.replace(new RegExp(key, 'gi'), synonym);
          if (expandedQuery !== query) {
            expandedQueries.add(expandedQuery);
          }
        }
      }
    }

    return {
      original: query,
      expanded: Array.from(expandedQueries).slice(0, 5), // Limit to 5 variations
      picoElements,
    };
  }

  /**
   * Check if query is a clinical question (has PICO elements)
   */
  isClinicalQuestion(query: string): boolean {
    const pico = this.extractPICO(query);
    return !!(pico.intervention || pico.outcome);
  }
}

/**
 * Singleton instance
 */
let extractorInstance: PICOExtractor | null = null;

/**
 * Get the singleton PICO extractor instance
 */
export function getPICOExtractor(): PICOExtractor {
  if (!extractorInstance) {
    extractorInstance = new PICOExtractor();
  }
  return extractorInstance;
}

/**
 * Convenience function to expand a query
 */
export function expandClinicalQuery(query: string): ExpandedQuery {
  const extractor = getPICOExtractor();
  return extractor.expandQuery(query);
}
