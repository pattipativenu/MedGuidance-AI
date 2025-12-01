/**
 * DailyMed Drug Information Database
 * National Library of Medicine's official source for FDA drug labeling
 * https://dailymed.nlm.nih.gov/
 */

export interface DailyMedDrug {
  setId: string;
  title: string;
  genericName: string;
  brandName: string;
  manufacturer: string;
  dosageForm: string;
  route: string;
  marketingStatus: string;
  url: string;
  indications?: string;
  warnings?: string;
  adverseReactions?: string;
  dosageAndAdministration?: string;
}

/**
 * Common drug names for extraction from queries
 * This list helps identify drug-related terms in user questions
 */
const COMMON_DRUGS = [
  // Diabetes medications
  'metformin', 'insulin', 'glipizide', 'glyburide', 'sitagliptin', 'januvia', 'ozempic', 'semaglutide',
  'empagliflozin', 'jardiance', 'dapagliflozin', 'farxiga', 'canagliflozin', 'invokana', 'liraglutide',
  'victoza', 'trulicity', 'dulaglutide', 'pioglitazone', 'actos', 'glimepiride', 'amaryl',
  // Cardiovascular
  'aspirin', 'lisinopril', 'atorvastatin', 'lipitor', 'metoprolol', 'amlodipine', 'losartan',
  'hydrochlorothiazide', 'hctz', 'furosemide', 'lasix', 'warfarin', 'coumadin', 'apixaban', 'eliquis',
  'rivaroxaban', 'xarelto', 'clopidogrel', 'plavix', 'carvedilol', 'coreg', 'diltiazem', 'verapamil',
  'simvastatin', 'zocor', 'rosuvastatin', 'crestor', 'pravastatin', 'ezetimibe', 'zetia',
  // Pain/Anti-inflammatory
  'ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'acetaminophen', 'tylenol', 'celecoxib', 'celebrex',
  'meloxicam', 'mobic', 'diclofenac', 'voltaren', 'tramadol', 'ultram', 'gabapentin', 'neurontin',
  'pregabalin', 'lyrica', 'morphine', 'oxycodone', 'hydrocodone', 'fentanyl',
  // Antibiotics
  'amoxicillin', 'augmentin', 'azithromycin', 'zithromax', 'ciprofloxacin', 'cipro', 'levofloxacin',
  'levaquin', 'doxycycline', 'metronidazole', 'flagyl', 'clindamycin', 'sulfamethoxazole', 'bactrim',
  'cephalexin', 'keflex', 'penicillin', 'vancomycin', 'ceftriaxone', 'rocephin',
  // Mental health
  'sertraline', 'zoloft', 'fluoxetine', 'prozac', 'escitalopram', 'lexapro', 'citalopram', 'celexa',
  'venlafaxine', 'effexor', 'duloxetine', 'cymbalta', 'bupropion', 'wellbutrin', 'trazodone',
  'alprazolam', 'xanax', 'lorazepam', 'ativan', 'clonazepam', 'klonopin', 'diazepam', 'valium',
  'quetiapine', 'seroquel', 'aripiprazole', 'abilify', 'risperidone', 'risperdal', 'olanzapine', 'zyprexa',
  // Respiratory
  'albuterol', 'ventolin', 'proair', 'fluticasone', 'flovent', 'budesonide', 'pulmicort', 'montelukast',
  'singulair', 'tiotropium', 'spiriva', 'ipratropium', 'atrovent', 'prednisone', 'methylprednisolone',
  // GI medications
  'omeprazole', 'prilosec', 'pantoprazole', 'protonix', 'esomeprazole', 'nexium', 'lansoprazole',
  'prevacid', 'famotidine', 'pepcid', 'ranitidine', 'ondansetron', 'zofran', 'metoclopramide', 'reglan',
  // Thyroid
  'levothyroxine', 'synthroid', 'liothyronine', 'methimazole', 'propylthiouracil',
  // Other common
  'sildenafil', 'viagra', 'tadalafil', 'cialis', 'finasteride', 'propecia', 'tamsulosin', 'flomax',
  'cyclobenzaprine', 'flexeril', 'baclofen', 'naloxone', 'narcan', 'naltrexone', 'vivitrol',
];

/**
 * Extract drug names from a query string
 */
function extractDrugNamesFromQuery(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const foundDrugs: string[] = [];
  
  for (const drug of COMMON_DRUGS) {
    if (lowerQuery.includes(drug)) {
      foundDrugs.push(drug);
    }
  }
  
  return foundDrugs;
}

/**
 * Search DailyMed for drug information
 * Uses the DailyMed API to find FDA-approved drug labels
 */
export async function searchDailyMed(query: string, limit = 5): Promise<DailyMedDrug[]> {
  try {
    // First, try to extract specific drug names from the query
    const extractedDrugs = extractDrugNamesFromQuery(query);
    
    // If we found specific drugs, search for each one
    if (extractedDrugs.length > 0) {
      console.log(`💊 Found drug names in query: ${extractedDrugs.join(', ')}`);
      
      const allDrugs: DailyMedDrug[] = [];
      
      // Search for each extracted drug (limit to first 3 to avoid too many requests)
      for (const drugName of extractedDrugs.slice(0, 3)) {
        const searchUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(drugName)}&page=1&pagesize=2`;
        
        try {
          const response = await fetch(searchUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'MedGuidance-AI/1.0'
            },
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              const drugs = data.data.map((item: any) => ({
                setId: item.setid || '',
                title: item.title || 'Unknown Drug',
                genericName: item.generic_name || '',
                brandName: item.brand_name || '',
                manufacturer: item.labeler || '',
                dosageForm: item.dosage_form || '',
                route: item.route || '',
                marketingStatus: item.marketing_status || '',
                url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${item.setid}`,
              }));
              allDrugs.push(...drugs);
            }
          }
        } catch (err) {
          console.warn(`⚠️ Failed to fetch DailyMed for ${drugName}`);
        }
      }
      
      if (allDrugs.length > 0) {
        console.log(`✅ Found ${allDrugs.length} drugs in DailyMed`);
        return allDrugs.slice(0, limit);
      }
    }
    
    // Fallback: Clean query and search
    const cleanQuery = query
      .toLowerCase()
      .replace(/\b(what|is|the|are|how|does|do|can|should|for|with|about|dosing|dosage|treatment|therapy|medication|drug|prescription|side effects|interactions)\b/gi, '')
      .replace(/[?.,!]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 3) // Take first 3 words
      .join(' ');
    
    if (cleanQuery.length < 3) {
      console.log(`⚠️ Query too short for DailyMed search: "${cleanQuery}"`);
      return [];
    }
    
    console.log(`💊 Searching DailyMed for: "${cleanQuery}"`);
    
    // DailyMed API endpoint for drug search
    const searchUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(cleanQuery)}&page=1&pagesize=${limit}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MedGuidance-AI/1.0'
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      console.error(`❌ DailyMed API error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      console.log(`⚠️ No drugs found in DailyMed for: "${cleanQuery}"`);
      return [];
    }
    
    const drugs: DailyMedDrug[] = data.data.map((item: any) => ({
      setId: item.setid || '',
      title: item.title || 'Unknown Drug',
      genericName: item.generic_name || '',
      brandName: item.brand_name || '',
      manufacturer: item.labeler || '',
      dosageForm: item.dosage_form || '',
      route: item.route || '',
      marketingStatus: item.marketing_status || '',
      url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${item.setid}`,
    }));
    
    console.log(`✅ Found ${drugs.length} drugs in DailyMed`);
    return drugs;
    
  } catch (error: any) {
    console.error('❌ Error searching DailyMed:', error.message);
    return [];
  }
}

/**
 * Get detailed drug information from DailyMed
 * Fetches the full SPL (Structured Product Label) for a drug
 */
export async function getDailyMedDetails(setId: string): Promise<any> {
  try {
    const detailUrl = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${setId}.json`;
    
    const response = await fetch(detailUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MedGuidance-AI/1.0'
      },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.data;
    
  } catch (error) {
    console.error('Error fetching DailyMed details:', error);
    return null;
  }
}

/**
 * Format DailyMed results for the AI prompt
 */
export function formatDailyMedForPrompt(drugs: DailyMedDrug[]): string {
  if (drugs.length === 0) return '';
  
  let formatted = '**DailyMed Drug Labels (FDA-Approved):**\n\n';
  
  drugs.forEach((drug, idx) => {
    formatted += `${idx + 1}. **${drug.title}**\n`;
    if (drug.genericName) formatted += `   Generic: ${drug.genericName}\n`;
    if (drug.brandName) formatted += `   Brand: ${drug.brandName}\n`;
    if (drug.manufacturer) formatted += `   Manufacturer: ${drug.manufacturer}\n`;
    if (drug.dosageForm) formatted += `   Form: ${drug.dosageForm}\n`;
    if (drug.route) formatted += `   Route: ${drug.route}\n`;
    if (drug.marketingStatus) formatted += `   Status: ${drug.marketingStatus}\n`;
    formatted += `   URL: ${drug.url}\n`;
    formatted += `   SetID: ${drug.setId}\n\n`;
  });
  
  return formatted;
}

/**
 * Comprehensive DailyMed search for drug information
 * Searches for drug labels and returns formatted results
 */
export async function comprehensiveDailyMedSearch(query: string): Promise<{
  drugs: DailyMedDrug[];
  formatted: string;
}> {
  const drugs = await searchDailyMed(query, 5);
  const formatted = formatDailyMedForPrompt(drugs);
  
  return { drugs, formatted };
}
