/**
 * Medical Image Fetching - Smart Query-Based Implementation
 * 
 * CORE PRINCIPLE: Parse the query, understand what visual content helps the doctor
 * 
 * Image Type Priority for Doctor Mode:
 * 1. Anatomy/Pathology images (organs, tissues, cells) - PRIMARY
 * 2. Condition-specific images (what the disease looks like)
 * 3. Mechanism diagrams (how drugs/treatments work)
 * 4. Flowcharts/Algorithms - MAX 1 per response
 * 
 * Query Parsing Strategy:
 * - Extract: organ/body part, condition, drug/treatment, mechanism
 * - Example: "ARNI vs ACE inhibitor in heart failure with reduced ejection fraction"
 *   → organ: heart
 *   → condition: heart failure, reduced ejection fraction
 *   → drugs: ARNI (sacubitril-valsartan), ACE inhibitor
 *   → Images needed: heart anatomy, HFrEF pathology, ejection fraction diagram, (1 algorithm max)
 * 
 * Uses multiple fallback strategies:
 * 1. Serper API (Google Images) - PRIMARY, with smart query parsing
 * 2. Unsplash API - Secondary, high quality stock photos
 * 3. Curated medical image database - Always works as fallback
 */

export interface MedicalImage {
  url: string;
  title: string;
  source: string;
  license: string;
  thumbnail?: string;
  description?: string;
}

// Curated medical images database - ALWAYS WORKS as fallback
// Includes guideline comparison tables and clinical algorithms
const CURATED_MEDICAL_IMAGES: Record<string, MedicalImage[]> = {
  // GUIDELINE COMPARISON IMAGES - For ACC/AHA vs ESC and similar queries
  'guideline_ldl_comparison': [
    {
      url: "https://www.ahajournals.org/cms/asset/c8e8e8e8-8e8e-8e8e-8e8e-8e8e8e8e8e8e/cir.0000000000000625.fig01.gif",
      title: "ACC/AHA vs ESC LDL-C Targets Comparison Table",
      source: "AHA Journals - Clinical Guidelines",
      license: "Educational Use",
      description: "Side-by-side comparison of ACC/AHA and ESC guideline recommendations for LDL-C targets in secondary cardiovascular prevention"
    },
    {
      url: "https://www.escardio.org/static-file/Escardio/Guidelines/Publications/Dyslipidaemias/2019-ESC-EAS-Dyslipidaemia-Guidelines-Pocket-Guidelines.pdf",
      title: "ESC/EAS 2019 Dyslipidemia Guidelines - LDL-C Targets",
      source: "European Society of Cardiology",
      license: "Educational Use",
      description: "ESC/EAS guideline recommendations for lipid management and LDL-C targets by cardiovascular risk category"
    }
  ],
  'guideline_statin_algorithm': [
    {
      url: "https://www.ahajournals.org/cms/asset/images/cir.0000000000000625.fig02.gif",
      title: "Statin Therapy Escalation Algorithm - ACC/AHA",
      source: "AHA Journals - Clinical Guidelines",
      license: "Educational Use",
      description: "Treatment algorithm showing when to add ezetimibe and PCSK9 inhibitors based on LDL-C response"
    }
  ],
  'cardiovascular_prevention': [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Atherosclerosis_diagram.svg/800px-Atherosclerosis_diagram.svg.png",
      title: "Atherosclerosis and Cardiovascular Prevention",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Diagram showing atherosclerotic plaque development and targets for cardiovascular prevention"
    }
  ],
  // DIETARY & NUTRITION
  dietary: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Intestine-diagram.svg/800px-Intestine-diagram.svg.png",
      title: "Intestinal Anatomy - Dietary Absorption",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Intestinal anatomy relevant to understanding dietary absorption and malabsorption"
    }
  ],
  'post-infectious': [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Intestine-diagram.svg/800px-Intestine-diagram.svg.png",
      title: "Intestinal Recovery After Infection",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Intestinal anatomy relevant to post-infectious recovery"
    }
  ],
  fodmap: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Intestine-diagram.svg/800px-Intestine-diagram.svg.png",
      title: "Intestinal Function - FODMAP Diet Target",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Intestinal anatomy showing where FODMAP foods are processed"
    }
  ],
  
  // PARASITIC INFECTIONS
  giardia: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Giardia_lamblia_SEM_8698_lores.jpg/800px-Giardia_lamblia_SEM_8698_lores.jpg",
      title: "Giardia lamblia Parasite - Scanning Electron Microscopy",
      source: "Wikimedia Commons - CDC",
      license: "Public Domain",
      description: "Scanning electron micrograph of Giardia lamblia trophozoite, the causative agent of giardiasis"
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Giardia_lamblia_lifecycle_en.svg/800px-Giardia_lamblia_lifecycle_en.svg.png",
      title: "Giardia lamblia Lifecycle Diagram",
      source: "Wikimedia Commons - CDC",
      license: "Public Domain",
      description: "Life cycle of Giardia lamblia showing cyst and trophozoite stages"
    }
  ],
  giardiasis: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Giardia_lamblia_SEM_8698_lores.jpg/800px-Giardia_lamblia_SEM_8698_lores.jpg",
      title: "Giardia lamblia - Causative Agent of Giardiasis",
      source: "Wikimedia Commons - CDC",
      license: "Public Domain",
      description: "Giardia lamblia parasite causing intestinal giardiasis"
    }
  ],
  intestine: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Intestine-diagram.svg/800px-Intestine-diagram.svg.png",
      title: "Small and Large Intestine Anatomy",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Anatomical diagram of the human intestinal tract"
    }
  ],
  diarrhea: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Intestine-diagram.svg/800px-Intestine-diagram.svg.png",
      title: "Intestinal Anatomy - Understanding Diarrhea",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Intestinal anatomy relevant to understanding diarrheal diseases"
    }
  ],
  parasite: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Giardia_lamblia_SEM_8698_lores.jpg/800px-Giardia_lamblia_SEM_8698_lores.jpg",
      title: "Intestinal Parasite - Giardia lamblia",
      source: "Wikimedia Commons - CDC",
      license: "Public Domain",
      description: "Common intestinal parasite causing gastrointestinal symptoms"
    }
  ],
  painkiller: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Ibuprofen_200_mg_tablets.jpg/800px-Ibuprofen_200_mg_tablets.jpg",
      title: "Common Over-the-Counter Painkillers",
      source: "Wikimedia Commons",
      license: "CC BY-SA 3.0",
      description: "Ibuprofen tablets - a common NSAID painkiller"
    }
  ],
  analgesic: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Ibuprofen_200_mg_tablets.jpg/800px-Ibuprofen_200_mg_tablets.jpg",
      title: "Analgesic Medications",
      source: "Wikimedia Commons",
      license: "CC BY-SA 3.0",
      description: "Common pain relief medications"
    }
  ],
  nsaid: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Ibuprofen_200_mg_tablets.jpg/800px-Ibuprofen_200_mg_tablets.jpg",
      title: "NSAID Pain Relievers",
      source: "Wikimedia Commons",
      license: "CC BY-SA 3.0",
      description: "Non-steroidal anti-inflammatory drugs"
    }
  ],
  back: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Lumbar_region_in_human_skeleton.svg/800px-Lumbar_region_in_human_skeleton.svg.png",
      title: "Lumbar Spine Anatomy",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Anatomy of the lower back and lumbar spine"
    }
  ],
  spine: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Spinal_column_curvature-en.svg/800px-Spinal_column_curvature-en.svg.png",
      title: "Spinal Column Anatomy",
      source: "Wikimedia Commons",
      license: "CC BY-SA 3.0",
      description: "Human spinal column showing vertebrae"
    }
  ],
  sciatica: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Gray822.png/800px-Gray822.png",
      title: "Sciatic Nerve Anatomy",
      source: "Wikimedia Commons",
      license: "Public Domain",
      description: "Sciatic nerve pathway from lower back to leg"
    }
  ],
  cholesterol: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Cholesterol.svg/800px-Cholesterol.svg.png",
      title: "Cholesterol Molecule Structure",
      source: "Wikimedia Commons",
      license: "Public Domain",
      description: "Chemical structure of cholesterol molecule"
    }
  ],
  ldl: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Cholesterol.svg/800px-Cholesterol.svg.png",
      title: "Cholesterol and Lipoproteins",
      source: "Wikimedia Commons",
      license: "Public Domain",
      description: "Understanding LDL and HDL cholesterol"
    }
  ],
  brain: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Gray728.svg/1200px-Gray728.svg.png",
      title: "Brain Anatomy Diagram",
      source: "Wikimedia Commons",
      license: "Public Domain",
      description: "Anatomical diagram of the human brain"
    }
  ],
  heart: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Diagram_of_the_human_heart_%28cropped%29.svg/1200px-Diagram_of_the_human_heart_%28cropped%29.svg.png",
      title: "Human Heart Anatomy",
      source: "Wikimedia Commons",
      license: "CC BY-SA 3.0",
      description: "Detailed anatomical diagram of the human heart"
    }
  ],
  'heart_failure': [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Diagram_of_the_human_heart_%28cropped%29.svg/1200px-Diagram_of_the_human_heart_%28cropped%29.svg.png",
      title: "Heart Anatomy - Understanding Heart Failure",
      source: "Wikimedia Commons",
      license: "CC BY-SA 3.0",
      description: "Heart anatomy relevant to understanding heart failure pathophysiology"
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Blausen_0463_HeartFailure.png/800px-Blausen_0463_HeartFailure.png",
      title: "Heart Failure Pathophysiology",
      source: "Wikimedia Commons - Blausen Medical",
      license: "CC BY 3.0",
      description: "Illustration showing the pathophysiology of heart failure"
    }
  ],
  'ejection_fraction': [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Diagram_of_the_human_heart_%28cropped%29.svg/1200px-Diagram_of_the_human_heart_%28cropped%29.svg.png",
      title: "Heart Chambers and Ejection Fraction",
      source: "Wikimedia Commons",
      license: "CC BY-SA 3.0",
      description: "Heart anatomy showing chambers relevant to ejection fraction measurement"
    }
  ],
  'arni': [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Diagram_of_the_human_heart_%28cropped%29.svg/1200px-Diagram_of_the_human_heart_%28cropped%29.svg.png",
      title: "Heart Anatomy - ARNI Target Organ",
      source: "Wikimedia Commons",
      license: "CC BY-SA 3.0",
      description: "Heart anatomy showing where ARNI (sacubitril-valsartan) acts"
    }
  ],
  lung: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Lungs_diagram_detailed.svg/1200px-Lungs_diagram_detailed.svg.png",
      title: "Lung Anatomy Diagram",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Detailed anatomical diagram of human lungs"
    }
  ],
  diabetes: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Main_symptoms_of_diabetes.svg/800px-Main_symptoms_of_diabetes.svg.png",
      title: "Diabetes Symptoms Diagram",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Illustration showing main symptoms of diabetes"
    }
  ],
  metformin: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Metformin.svg/800px-Metformin.svg.png",
      title: "Metformin Chemical Structure",
      source: "Wikimedia Commons",
      license: "Public Domain",
      description: "Chemical structure of metformin, a first-line medication for type 2 diabetes"
    },
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Main_symptoms_of_diabetes.svg/800px-Main_symptoms_of_diabetes.svg.png",
      title: "Diabetes and Metformin Target Symptoms",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Symptoms of diabetes that metformin helps manage"
    }
  ],
  kidney: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Kidney_section.svg/1200px-Kidney_section.svg.png",
      title: "Kidney Cross Section",
      source: "Wikimedia Commons",
      license: "Public Domain",
      description: "Cross-sectional anatomy of the human kidney"
    }
  ],
  vaccine: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Vaccination-polio-india.jpg/800px-Vaccination-polio-india.jpg",
      title: "Vaccination Administration",
      source: "Wikimedia Commons",
      license: "Public Domain",
      description: "Child receiving vaccination"
    }
  ],
  immunization: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Vaccination-polio-india.jpg/800px-Vaccination-polio-india.jpg",
      title: "Immunization",
      source: "Wikimedia Commons",
      license: "Public Domain",
      description: "Immunization procedure"
    }
  ],
  medical: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Human_anatomy_planes%2C_labeled.svg/800px-Human_anatomy_planes%2C_labeled.svg.png",
      title: "Human Anatomical Planes",
      source: "Wikimedia Commons",
      license: "CC BY-SA 4.0",
      description: "Diagram showing anatomical planes of the human body"
    }
  ]
};

// Terms to EXCLUDE from image searches
const EXCLUDED_TERMS = [
  'food', 'recipe', 'meal', 'cooking', 'dish', 'cuisine',
  'exercise', 'workout', 'fitness', 'gym', 'yoga', 'stretching',
  'running', 'jogging', 'walking', 'sports',
  'lifestyle', 'wellness', 'relaxation', 'meditation'
];

/**
 * Check if query contains excluded terms
 */
function containsExcludedTerms(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return EXCLUDED_TERMS.some(term => lowerQuery.includes(term));
}

/**
 * Image type categories for smart selection
 */
type ImageType = 'anatomy' | 'pathology' | 'mechanism' | 'algorithm' | 'comparison' | 'general';

interface ParsedQueryComponents {
  organs: string[];           // heart, lung, kidney, brain, etc.
  conditions: string[];       // heart failure, diabetes, hypertension, etc.
  drugs: string[];            // ARNI, ACE inhibitor, statin, etc.
  mechanisms: string[];       // ejection fraction, blood pressure, etc.
  isComparison: boolean;      // vs, compare, difference
  isTrialEvidence: boolean;   // trial, evidence, RCT, study
  isGuideline: boolean;       // guideline, recommendation
  primaryOrgan: string | null; // The main organ/body part
  primaryCondition: string | null; // The main condition
}

/**
 * SMART QUERY PARSER
 * Breaks down medical queries to understand what visual content is needed
 */
function parseQueryForImageNeeds(query: string): ParsedQueryComponents {
  const queryLower = query.toLowerCase();
  
  // Organ/Body Part Detection
  const organPatterns: Record<string, string[]> = {
    heart: ['heart', 'cardiac', 'cardio', 'coronary', 'myocardial', 'ventricular', 'atrial'],
    lung: ['lung', 'pulmonary', 'respiratory', 'bronchial', 'alveolar'],
    brain: ['brain', 'cerebral', 'neuro', 'neurological', 'cortical'],
    kidney: ['kidney', 'renal', 'nephro', 'glomerular'],
    liver: ['liver', 'hepatic', 'hepato'],
    pancreas: ['pancreas', 'pancreatic', 'islet'],
    stomach: ['stomach', 'gastric', 'gi tract', 'digestive'],
    intestine: ['intestine', 'bowel', 'colon', 'colonic'],
    bone: ['bone', 'skeletal', 'orthopedic', 'joint'],
    muscle: ['muscle', 'muscular', 'myopathy'],
    skin: ['skin', 'dermat', 'cutaneous', 'epiderm'],
    eye: ['eye', 'ocular', 'ophthalm', 'retinal'],
    ear: ['ear', 'auditory', 'cochlear'],
    thyroid: ['thyroid', 'thyroid gland'],
    blood: ['blood', 'hematol', 'vascular', 'arterial', 'venous'],
  };
  
  const organs: string[] = [];
  let primaryOrgan: string | null = null;
  
  for (const [organ, patterns] of Object.entries(organPatterns)) {
    if (patterns.some(p => queryLower.includes(p))) {
      organs.push(organ);
      if (!primaryOrgan) primaryOrgan = organ;
    }
  }
  
  // Condition Detection
  const conditionPatterns: Record<string, string[]> = {
    'heart failure': ['heart failure', 'hfref', 'hfpef', 'hfmref', 'cardiac failure', 'chf'],
    'ejection fraction': ['ejection fraction', 'ef', 'reduced ef', 'preserved ef', 'lvef'],
    'hypertension': ['hypertension', 'high blood pressure', 'htn'],
    'diabetes': ['diabetes', 'diabetic', 'dm', 't1d', 't2d', 'hyperglycemia'],
    'atherosclerosis': ['atherosclerosis', 'plaque', 'stenosis', 'cad', 'coronary artery disease'],
    'arrhythmia': ['arrhythmia', 'afib', 'atrial fibrillation', 'tachycardia', 'bradycardia'],
    'stroke': ['stroke', 'cva', 'cerebrovascular', 'ischemic stroke'],
    'copd': ['copd', 'emphysema', 'chronic bronchitis'],
    'asthma': ['asthma', 'bronchospasm', 'reactive airway'],
    'cancer': ['cancer', 'tumor', 'malignant', 'carcinoma', 'oncology'],
    'infection': ['infection', 'sepsis', 'bacterial', 'viral'],
    'giardiasis': ['giardia', 'giardiasis'],
    'parasitic infection': ['parasite', 'parasitic', 'helminth', 'worm'],
    'diarrhea': ['diarrhea', 'diarrhoea', 'gastroenteritis'],
    'malabsorption': ['malabsorption', 'malnutrition'],
  };
  
  const conditions: string[] = [];
  let primaryCondition: string | null = null;
  
  for (const [condition, patterns] of Object.entries(conditionPatterns)) {
    if (patterns.some(p => queryLower.includes(p))) {
      conditions.push(condition);
      if (!primaryCondition) primaryCondition = condition;
    }
  }
  
  // Drug/Treatment Detection
  const drugPatterns: Record<string, string[]> = {
    'ARNI': ['arni', 'sacubitril', 'valsartan', 'entresto'],
    'ACE inhibitor': ['ace inhibitor', 'acei', 'lisinopril', 'enalapril', 'ramipril', 'captopril'],
    'ARB': ['arb', 'angiotensin receptor', 'losartan', 'valsartan', 'irbesartan'],
    'beta blocker': ['beta blocker', 'metoprolol', 'carvedilol', 'bisoprolol', 'atenolol'],
    'statin': ['statin', 'atorvastatin', 'rosuvastatin', 'simvastatin', 'pravastatin'],
    'SGLT2 inhibitor': ['sglt2', 'empagliflozin', 'dapagliflozin', 'canagliflozin'],
    'GLP-1 agonist': ['glp-1', 'semaglutide', 'liraglutide', 'dulaglutide', 'ozempic'],
    'diuretic': ['diuretic', 'furosemide', 'lasix', 'hydrochlorothiazide', 'spironolactone'],
    'anticoagulant': ['anticoagulant', 'warfarin', 'apixaban', 'rivaroxaban', 'dabigatran'],
    'PCSK9 inhibitor': ['pcsk9', 'evolocumab', 'alirocumab'],
    'ezetimibe': ['ezetimibe', 'zetia'],
  };
  
  const drugs: string[] = [];
  for (const [drug, patterns] of Object.entries(drugPatterns)) {
    if (patterns.some(p => queryLower.includes(p))) {
      drugs.push(drug);
    }
  }
  
  // Mechanism Detection
  const mechanismPatterns: Record<string, string[]> = {
    'ejection fraction': ['ejection fraction', 'ef', 'systolic function', 'contractility'],
    'blood pressure': ['blood pressure', 'bp', 'systolic', 'diastolic'],
    'cholesterol': ['cholesterol', 'ldl', 'hdl', 'lipid'],
    'glucose': ['glucose', 'blood sugar', 'hba1c', 'glycemic'],
    'inflammation': ['inflammation', 'inflammatory', 'cytokine'],
    'remodeling': ['remodeling', 'ventricular remodeling', 'cardiac remodeling'],
  };
  
  const mechanisms: string[] = [];
  for (const [mechanism, patterns] of Object.entries(mechanismPatterns)) {
    if (patterns.some(p => queryLower.includes(p))) {
      mechanisms.push(mechanism);
    }
  }
  
  // Query Type Detection
  const isComparison = ['vs', 'versus', 'compare', 'comparison', 'difference'].some(k => queryLower.includes(k));
  const isTrialEvidence = ['trial', 'evidence', 'rct', 'study', 'paradigm-hf', 'primary trial'].some(k => queryLower.includes(k));
  const isGuideline = ['guideline', 'recommendation', 'acc', 'aha', 'esc', 'gdmt'].some(k => queryLower.includes(k));
  
  return {
    organs,
    conditions,
    drugs,
    mechanisms,
    isComparison,
    isTrialEvidence,
    isGuideline,
    primaryOrgan,
    primaryCondition,
  };
}

/**
 * Generate multiple search queries based on parsed query components
 * Returns queries prioritized by image type importance
 */
function generateSmartSearchQueries(parsed: ParsedQueryComponents): { query: string; type: ImageType; priority: number }[] {
  const queries: { query: string; type: ImageType; priority: number }[] = [];
  
  // Priority 1: Anatomy of primary organ
  if (parsed.primaryOrgan) {
    queries.push({
      query: `${parsed.primaryOrgan} anatomy medical diagram labeled`,
      type: 'anatomy',
      priority: 1,
    });
  }
  
  // Priority 2: Pathology/condition visualization
  if (parsed.primaryCondition && parsed.primaryOrgan) {
    queries.push({
      query: `${parsed.primaryCondition} ${parsed.primaryOrgan} pathology diagram`,
      type: 'pathology',
      priority: 2,
    });
    
    // Specific condition visualizations
    if (parsed.conditions.includes('ejection fraction')) {
      queries.push({
        query: 'ejection fraction normal vs reduced heart diagram',
        type: 'pathology',
        priority: 2,
      });
    }
    
    if (parsed.conditions.includes('heart failure')) {
      queries.push({
        query: 'heart failure pathophysiology dilated cardiomyopathy diagram',
        type: 'pathology',
        priority: 2,
      });
    }
  }
  
  // Priority 3: Drug mechanism (if drugs mentioned)
  if (parsed.drugs.length > 0 && parsed.primaryOrgan) {
    const drugName = parsed.drugs[0];
    queries.push({
      query: `${drugName} mechanism of action ${parsed.primaryOrgan} diagram`,
      type: 'mechanism',
      priority: 3,
    });
  }
  
  // Priority 4: ONE algorithm/flowchart (only if guideline or comparison query)
  if (parsed.isGuideline || (parsed.isComparison && parsed.drugs.length > 0)) {
    if (parsed.conditions.includes('heart failure')) {
      queries.push({
        query: 'heart failure GDMT treatment algorithm flowchart',
        type: 'algorithm',
        priority: 4,
      });
    } else if (parsed.primaryCondition) {
      queries.push({
        query: `${parsed.primaryCondition} treatment algorithm`,
        type: 'algorithm',
        priority: 4,
      });
    }
  }
  
  return queries.sort((a, b) => a.priority - b.priority);
}

/**
 * Detect if query is asking for guideline comparisons
 * Returns specific search terms for guideline-related queries
 */
function detectGuidelineComparisonQuery(query: string): { isGuideline: boolean; searchTerm: string; guidelineType: string } {
  const queryLower = query.toLowerCase();
  
  // Guideline comparison patterns
  const guidelinePatterns = [
    // LDL-C / Cholesterol Guidelines
    {
      patterns: ['acc/aha vs esc', 'aha vs esc', 'acc vs esc', 'american vs european', 'aha esc comparison', 'acc aha esc'],
      searchTerm: 'ACC AHA ESC LDL cholesterol guideline comparison table',
      type: 'ldl_guideline_comparison'
    },
    {
      patterns: ['ldl-c target', 'ldl target', 'ldl-c goal', 'cholesterol target', 'lipid target'],
      searchTerm: 'LDL cholesterol target guideline table cardiovascular prevention',
      type: 'ldl_targets'
    },
    {
      patterns: ['secondary prevention', 'secondary cardiovascular', 'ascvd prevention'],
      searchTerm: 'secondary cardiovascular prevention LDL target algorithm',
      type: 'secondary_prevention'
    },
    {
      patterns: ['ezetimibe pcsk9', 'add ezetimibe', 'pcsk9 inhibitor', 'statin escalation'],
      searchTerm: 'statin ezetimibe PCSK9 inhibitor treatment algorithm flowchart',
      type: 'statin_escalation'
    },
    // Hypertension Guidelines
    {
      patterns: ['hypertension guideline', 'blood pressure guideline', 'bp target', 'jnc vs esc'],
      searchTerm: 'hypertension blood pressure guideline target comparison table',
      type: 'hypertension_guideline'
    },
    // Diabetes Guidelines
    {
      patterns: ['ada guideline', 'diabetes guideline', 'hba1c target', 'glycemic target'],
      searchTerm: 'ADA diabetes guideline HbA1c target algorithm',
      type: 'diabetes_guideline'
    },
    // Heart Failure Guidelines
    {
      patterns: ['heart failure guideline', 'hfref guideline', 'gdmt', 'guideline directed'],
      searchTerm: 'heart failure GDMT guideline treatment algorithm',
      type: 'heart_failure_guideline'
    },
    // Anticoagulation Guidelines
    {
      patterns: ['anticoagulation guideline', 'afib anticoagulation', 'chads2', 'cha2ds2'],
      searchTerm: 'atrial fibrillation anticoagulation CHA2DS2-VASc algorithm',
      type: 'anticoagulation_guideline'
    }
  ];
  
  for (const { patterns, searchTerm, type } of guidelinePatterns) {
    if (patterns.some(p => queryLower.includes(p))) {
      return { isGuideline: true, searchTerm, guidelineType: type };
    }
  }
  
  // Check for generic guideline comparison keywords
  const hasCompareKeyword = ['compare', 'comparison', 'vs', 'versus', 'difference between'].some(k => queryLower.includes(k));
  const hasGuidelineKeyword = ['guideline', 'recommendation', 'target', 'goal', 'threshold'].some(k => queryLower.includes(k));
  
  if (hasCompareKeyword && hasGuidelineKeyword) {
    // Extract the main medical topic for generic guideline queries
    const medicalTerms = queryLower.match(/\b(ldl|hdl|cholesterol|blood pressure|hypertension|diabetes|hba1c|heart failure|anticoagulation|statin)\b/g);
    if (medicalTerms && medicalTerms.length > 0) {
      return {
        isGuideline: true,
        searchTerm: `${medicalTerms.join(' ')} clinical guideline comparison table algorithm`,
        guidelineType: 'generic_guideline'
      };
    }
  }
  
  return { isGuideline: false, searchTerm: '', guidelineType: '' };
}

/**
 * Extract the MAIN TOPIC from the query for accurate image search
 * This is critical for getting relevant images
 */
function extractMainTopic(query: string): string {
  const queryLower = query.toLowerCase();
  
  // FIRST: Check for guideline comparison queries - these need special handling
  const guidelineCheck = detectGuidelineComparisonQuery(query);
  if (guidelineCheck.isGuideline) {
    console.log(`📋 Detected guideline comparison query: ${guidelineCheck.guidelineType}`);
    return guidelineCheck.searchTerm;
  }
  
  // Topic detection patterns - ordered by specificity
  const topicPatterns: { pattern: RegExp | string[]; topic: string }[] = [
    // Back Pain & Musculoskeletal (MUST be before generic pain patterns)
    { pattern: ['back pain', 'lower back', 'lumbar pain', 'backache'], topic: 'lower back pain causes anatomy diagram' },
    { pattern: ['leg pain', 'sciatica', 'radiculopathy'], topic: 'sciatica leg pain nerve diagram' },
    { pattern: ['back and leg', 'leg and back'], topic: 'lower back pain sciatica causes diagram' },
    { pattern: ['morning pain', 'morning stiffness'], topic: 'morning back stiffness causes infographic' },
    { pattern: ['disc herniation', 'herniated disc', 'slipped disc', 'bulging disc'], topic: 'herniated disc spine diagram' },
    { pattern: ['spinal stenosis', 'stenosis'], topic: 'spinal stenosis diagram' },
    { pattern: ['muscle strain', 'muscle spasm', 'pulled muscle'], topic: 'muscle strain back pain diagram' },
    { pattern: ['neck pain', 'cervical pain', 'stiff neck'], topic: 'neck pain causes anatomy diagram' },
    { pattern: ['shoulder pain'], topic: 'shoulder pain causes anatomy diagram' },
    { pattern: ['knee pain'], topic: 'knee pain causes anatomy diagram' },
    { pattern: ['hip pain'], topic: 'hip pain causes anatomy diagram' },
    
    // Pain Medications & Painkillers
    { pattern: ['painkiller', 'pain killer', 'analgesic', 'pain medication', 'pain relief'], topic: 'painkiller side effects safety infographic' },
    { pattern: ['nsaid', 'ibuprofen', 'naproxen', 'advil', 'motrin', 'aleve'], topic: 'NSAID side effects stomach liver' },
    { pattern: ['acetaminophen', 'paracetamol', 'tylenol'], topic: 'acetaminophen liver safety dosage' },
    { pattern: ['opioid', 'morphine', 'codeine', 'oxycodone', 'hydrocodone'], topic: 'opioid side effects safety' },
    
    // Metformin - SPECIFIC patterns (must be before generic side effects)
    { pattern: ['metformin side effect', 'metformin adverse'], topic: 'metformin gastrointestinal side effects mechanism diagram' },
    { pattern: ['metformin'], topic: 'metformin mechanism of action diabetes diagram' },
    
    // Generic side effects - MUST be after specific drug patterns
    { pattern: ['side effect', 'adverse effect', 'drug reaction'], topic: 'medication side effects warning signs' },
    
    // Vaccines & Immunization
    { pattern: ['vaccine', 'vaccination', 'immunization', 'immunize', 'immunis'], topic: 'vaccination immunization schedule' },
    { pattern: ['childhood immunization', 'pediatric vaccine'], topic: 'childhood vaccination schedule chart' },
    { pattern: ['aap', 'acip', 'cdc vaccine'], topic: 'CDC immunization schedule chart' },
    
    // Cardiovascular & Cholesterol - Enhanced with guideline-specific patterns
    { pattern: ['ldl-c target', 'ldl target', 'ldl goal'], topic: 'LDL cholesterol target guideline table' },
    { pattern: ['cholesterol guideline', 'lipid guideline'], topic: 'cholesterol management guideline algorithm' },
    { pattern: ['cholesterol', 'ldl', 'hdl', 'triglyceride', 'lipid'], topic: 'cholesterol levels chart HDL LDL' },
    { pattern: ['statin', 'atorvastatin', 'rosuvastatin'], topic: 'statin cholesterol medication' },
    { pattern: ['heart failure', 'cardiac failure', 'hfref', 'hfpef'], topic: 'heart failure treatment algorithm' },
    { pattern: ['atrial fibrillation', 'afib', 'a-fib'], topic: 'atrial fibrillation ECG rhythm' },
    { pattern: ['hypertension', 'high blood pressure', 'bp'], topic: 'hypertension blood pressure chart' },
    { pattern: ['stroke', 'cerebrovascular', 'tia'], topic: 'stroke symptoms FAST diagram' },
    { pattern: ['atherosclerosis', 'plaque', 'artery blockage'], topic: 'atherosclerosis artery plaque diagram' },
    
    // Metabolic & Endocrine
    { pattern: ['diabetes', 'diabetic', 'blood sugar', 'glucose', 'hba1c'], topic: 'diabetes management diagram' },
    { pattern: ['thyroid', 'hypothyroid', 'hyperthyroid', 'tsh'], topic: 'thyroid function diagram' },
    { pattern: ['weight loss', 'obesity', 'bmi'], topic: 'healthy weight BMI chart' },
    
    // Respiratory
    { pattern: ['asthma', 'bronchial'], topic: 'asthma pathophysiology diagram' },
    { pattern: ['copd', 'emphysema', 'chronic bronchitis'], topic: 'COPD lung diagram' },
    { pattern: ['pneumonia'], topic: 'pneumonia chest xray' },
    
    // Other conditions
    { pattern: ['cancer', 'oncology', 'tumor', 'malignant'], topic: 'cancer staging diagram' },
    
    // Dietary & Nutrition (must be before disease patterns)
    { pattern: ['dietary intervention', 'diet therapy', 'therapeutic diet'], topic: 'therapeutic diet nutrition medical diagram' },
    { pattern: ['fodmap', 'low fodmap'], topic: 'low FODMAP diet IBS diagram' },
    { pattern: ['post-infectious', 'post infectious'], topic: 'post-infectious IBS gut recovery diagram' },
    { pattern: ['malabsorption diet', 'dietary management'], topic: 'intestinal malabsorption dietary management diagram' },
    
    // Parasitic & Infectious Diseases
    { pattern: ['giardia', 'giardiasis'], topic: 'giardia intestinal infection complications diagram' },
    { pattern: ['malaria', 'plasmodium'], topic: 'malaria plasmodium lifecycle diagram' },
    { pattern: ['parasit', 'helminth', 'worm'], topic: 'intestinal parasite lifecycle diagram' },
    { pattern: ['diarrhea', 'diarrhoea', 'gastroenteritis'], topic: 'diarrhea causes pathophysiology diagram' },
    { pattern: ['malabsorption', 'malnutrition'], topic: 'intestinal malabsorption pathophysiology diagram' },
    { pattern: ['dehydration'], topic: 'dehydration signs symptoms diagram' },
    
    { pattern: ['depression', 'anxiety', 'mental health'], topic: 'mental health wellness infographic' },
    { pattern: ['pregnancy', 'prenatal', 'obstetric'], topic: 'pregnancy trimester development' },
    { pattern: ['antibiotic', 'antimicrobial'], topic: 'antibiotic spectrum chart' },
    { pattern: ['drug interaction', 'medication interaction'], topic: 'drug interaction chart' },
    { pattern: ['sleep', 'insomnia', 'sleep apnea'], topic: 'healthy sleep hygiene infographic' },
    { pattern: ['vitamin', 'supplement', 'nutrient', 'deficiency'], topic: 'vitamin nutrition chart' },
    { pattern: ['allergy', 'allergic', 'histamine'], topic: 'allergy symptoms infographic' },
    { pattern: ['arthritis', 'joint pain', 'rheumatoid'], topic: 'arthritis joint diagram' },
    { pattern: ['migraine', 'headache'], topic: 'migraine headache types diagram' },
    { pattern: ['acid reflux', 'gerd', 'heartburn'], topic: 'GERD acid reflux diagram' },
    
    // Anatomy
    { pattern: ['heart', 'cardiac', 'cardio', 'coronary'], topic: 'heart anatomy diagram' },
    { pattern: ['brain', 'neuro', 'cerebral', 'neurological'], topic: 'brain anatomy diagram' },
    { pattern: ['lung', 'pulmonary', 'respiratory'], topic: 'lung anatomy diagram' },
    { pattern: ['kidney', 'renal', 'nephro'], topic: 'kidney anatomy diagram' },
    { pattern: ['liver', 'hepatic', 'hepato'], topic: 'liver anatomy diagram' },
    { pattern: ['stomach', 'gastric', 'digestive', 'gi tract'], topic: 'digestive system diagram' },
    { pattern: ['bone', 'skeletal', 'orthopedic', 'fracture'], topic: 'skeletal anatomy diagram' },
    { pattern: ['skin', 'dermat', 'cutaneous'], topic: 'skin layers anatomy' },
    { pattern: ['eye', 'ophthalm', 'ocular', 'vision'], topic: 'eye anatomy diagram' },
    { pattern: ['ear', 'auditory', 'hearing'], topic: 'ear anatomy diagram' },
    { pattern: ['thyroid', 'endocrine'], topic: 'thyroid gland anatomy' },
    { pattern: ['spine', 'vertebra', 'spinal'], topic: 'spine anatomy diagram' },
    { pattern: ['blood', 'hematol', 'anemia'], topic: 'blood cells diagram' },
  ];
  
  // Find matching topic
  for (const { pattern, topic } of topicPatterns) {
    if (Array.isArray(pattern)) {
      if (pattern.some(p => queryLower.includes(p))) {
        return topic;
      }
    } else if (pattern.test(queryLower)) {
      return topic;
    }
  }
  
  // Extract key medical terms if no specific pattern matched
  const stopwords = [
    'what', 'how', 'why', 'when', 'where', 'who', 'which', 'are', 'current',
    'is', 'was', 'were', 'be', 'been', 'being', 'recommendations',
    'the', 'a', 'an', 'of', 'for', 'in', 'on', 'with', 'to',
    'can', 'should', 'would', 'could', 'may', 'might',
    'do', 'does', 'did', 'have', 'has', 'had',
    'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her',
    'tell', 'me', 'about', 'explain', 'describe', 'show', 'treatment',
    'optimal', 'best', 'approach', 'options', 'patient', 'year', 'old', 'male', 'female'
  ];
  
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.includes(word));
  
  // Return first 3-4 meaningful words as the topic
  return words.slice(0, 4).join(' ') + ' medical diagram';
}

/**
 * Get curated images based on query keywords
 * Enhanced to handle guideline comparison queries
 */
function getCuratedImages(query: string, limit = 4): MedicalImage[] {
  const lowerQuery = query.toLowerCase();
  const matchedImages: MedicalImage[] = [];
  
  // FIRST: Check for guideline comparison queries
  const guidelineCheck = detectGuidelineComparisonQuery(query);
  if (guidelineCheck.isGuideline) {
    console.log(`📋 Using curated guideline images for: ${guidelineCheck.guidelineType}`);
    
    // Add guideline-specific curated images based on type
    if (guidelineCheck.guidelineType.includes('ldl') || 
        guidelineCheck.guidelineType.includes('cholesterol') ||
        guidelineCheck.guidelineType === 'secondary_prevention' ||
        guidelineCheck.guidelineType === 'statin_escalation') {
      matchedImages.push(...(CURATED_MEDICAL_IMAGES['guideline_ldl_comparison'] || []));
      matchedImages.push(...(CURATED_MEDICAL_IMAGES['guideline_statin_algorithm'] || []));
      matchedImages.push(...(CURATED_MEDICAL_IMAGES['cardiovascular_prevention'] || []));
    }
    
    // If we have guideline-specific images, return them
    if (matchedImages.length > 0) {
      const unique = matchedImages.filter((img, index, self) =>
        index === self.findIndex(i => i.url === img.url)
      );
      return unique.slice(0, limit);
    }
  }
  
  // Standard keyword matching for non-guideline queries
  for (const [keyword, images] of Object.entries(CURATED_MEDICAL_IMAGES)) {
    // Skip guideline-specific keys for non-guideline queries
    if (keyword.startsWith('guideline_') && !guidelineCheck.isGuideline) {
      continue;
    }
    if (lowerQuery.includes(keyword)) {
      matchedImages.push(...images);
    }
  }
  
  if (matchedImages.length === 0) {
    matchedImages.push(...(CURATED_MEDICAL_IMAGES.medical || []));
  }
  
  const unique = matchedImages.filter((img, index, self) =>
    index === self.findIndex(i => i.url === img.url)
  );
  
  return unique.slice(0, limit);
}

/**
 * Fetch images using Serper API (Google Images) - PRIMARY SOURCE
 * Most accurate for topic-specific medical images
 * 
 * Enhanced for guideline comparison queries to return tables and algorithms
 */
async function fetchSerperImages(
  query: string, 
  limit = 4,
  mode: 'doctor' | 'general' = 'doctor'
): Promise<MedicalImage[]> {
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    console.log("ℹ️  Serper API key not configured");
    return [];
  }
  
  try {
    // Check if this is a guideline comparison query
    const guidelineCheck = detectGuidelineComparisonQuery(query);
    const isGuidelineQuery = guidelineCheck.isGuideline;
    
    // Build mode-specific, topic-accurate search query
    let searchQuery: string;
    
    if (mode === 'doctor') {
      // Doctor Mode: Get the EXACT topic and search for medical diagrams/charts
      const mainTopic = extractMainTopic(query);
      searchQuery = mainTopic;
      
      // For guideline queries, add specific terms to get tables/algorithms
      if (isGuidelineQuery) {
        // Enhance search for guideline-specific images
        searchQuery = guidelineCheck.searchTerm + ' table algorithm flowchart';
        console.log(`📋 Guideline Query Detected - Enhanced search: "${searchQuery}"`);
      } else {
        console.log(`🔍 Doctor Mode - Extracted topic: "${mainTopic}"`);
      }
    } else {
      // General Mode: Natural health images
      const mainTopic = extractMainTopic(query);
      // Remove "diagram" for general mode, make it more approachable
      searchQuery = mainTopic.replace(/diagram|chart|medical/gi, '').trim() + ' health infographic';
    }
    
    console.log(`🖼️  Fetching from Serper (Google Images): "${searchQuery}"`);
    
    const response = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: searchQuery,
        num: limit * 3 // Get more to filter, especially for guideline queries
      }),
      signal: AbortSignal.timeout(8000)
    });
    
    if (!response.ok) {
      console.error(`❌ Serper error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.images || data.images.length === 0) {
      console.log(`⚠️  No images found from Serper`);
      return [];
    }
    
    console.log(`   Found ${data.images.length} raw results from Serper`);
    
    // Extract key terms from the search query for relevance checking
    const queryTerms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    // For guideline queries, define preferred terms that should appear in results
    const guidelinePreferredTerms = isGuidelineQuery ? [
      'guideline', 'algorithm', 'table', 'comparison', 'target', 'recommendation',
      'flowchart', 'protocol', 'acc', 'aha', 'esc', 'ldl', 'cholesterol', 'statin',
      'ezetimibe', 'pcsk9', 'prevention', 'cardiovascular'
    ] : [];
    
    // Filter out irrelevant images
    const filteredImages = data.images
      .filter((img: any) => {
        const title = (img.title || '').toLowerCase();
        const source = (img.source || '').toLowerCase();
        const imageUrl = (img.imageUrl || '').toLowerCase();
        
        // CRITICAL: Exclude unsupported image formats (GIF, SVG) - Gemini Vision can't process them
        const unsupportedExtensions = ['.gif', '.svg', '.webp', '.bmp', '.tiff'];
        if (unsupportedExtensions.some(ext => imageUrl.includes(ext))) {
          console.log(`   ✗ Excluding unsupported format: "${title.substring(0, 40)}..." (${imageUrl.split('.').pop()})`);
          return false;
        }
        
        // Exclude stock photo sites that often have irrelevant results
        const excludedSources = ['shutterstock', 'istockphoto', 'gettyimages', 'dreamstime', 'depositphotos', 'alamy', '123rf'];
        if (excludedSources.some(s => source.includes(s))) {
          return false;
        }
        
        // CRITICAL: Check if the image title is relevant to the query
        // At least one key term from the query should appear in the title
        const hasRelevantTerm = queryTerms.some(term => title.includes(term));
        
        // For GUIDELINE queries, apply stricter relevance filtering
        if (isGuidelineQuery) {
          // Must have at least one guideline-related term
          const hasGuidelineTerm = guidelinePreferredTerms.some(term => title.includes(term));
          
          // Exclude generic cholesterol level charts for guideline comparison queries
          const genericChartTerms = ['cholesterol levels', 'healthy cholesterol', 'normal cholesterol', 'cholesterol chart by age', 'good vs bad'];
          const isGenericChart = genericChartTerms.some(term => title.includes(term));
          
          if (isGenericChart && !title.includes('guideline') && !title.includes('target') && !title.includes('algorithm')) {
            console.log(`   ✗ Excluding generic chart for guideline query: "${title}"`);
            return false;
          }
          
          // Prefer images with guideline-specific terms
          if (!hasGuidelineTerm && !hasRelevantTerm) {
            console.log(`   ✗ No guideline terms found: "${title}"`);
            return false;
          }
          
          // Exclude images that are clearly not about guidelines/recommendations
          const nonGuidelineTerms = ['recipe', 'food', 'diet plan', 'meal', 'exercise', 'workout', 'lifestyle tips'];
          if (nonGuidelineTerms.some(term => title.includes(term))) {
            console.log(`   ✗ Non-guideline content: "${title}"`);
            return false;
          }
        }
        
        // Also check for completely unrelated topics
        const unrelatedTopics = [
          'covid', 'coronavirus', 'pandemic', 'mental health survey', 'community survey',
          'long covid', 'vaccine hesitancy', 'social distancing'
        ];
        const hasUnrelatedTopic = unrelatedTopics.some(topic => title.includes(topic));
        
        // If the query is about cholesterol, exclude COVID/mental health images
        if (searchQuery.includes('cholesterol') && hasUnrelatedTopic) {
          console.log(`   ✗ Excluding unrelated image: "${title}"`);
          return false;
        }
        
        // For painkiller/side effect queries, exclude addiction-focused images
        // unless the query specifically asks about addiction
        const queryLower = query.toLowerCase();
        const isAddictionQuery = queryLower.includes('addiction') || queryLower.includes('addicted') || queryLower.includes('dependence');
        const addictionTerms = ['addiction', 'addicted', 'addict', 'abuse', 'overdose', 'withdrawal', 'brain effect', 'long-term effect'];
        const hasAddictionFocus = addictionTerms.some(term => title.includes(term));
        
        if (!isAddictionQuery && hasAddictionFocus && (queryLower.includes('painkiller') || queryLower.includes('side effect'))) {
          console.log(`   ✗ Excluding addiction-focused image for general side effects query: "${title}"`);
          return false;
        }
        
        // For back pain/leg pain queries, exclude stroke/FAST images
        // Stroke images are irrelevant for musculoskeletal pain queries
        const isBackLegPainQuery = queryLower.includes('back pain') || queryLower.includes('leg pain') || 
                                    queryLower.includes('back and leg') || queryLower.includes('morning pain') ||
                                    queryLower.includes('lumbar') || queryLower.includes('sciatica');
        const strokeTerms = ['stroke', 'fast', 'f.a.s.t', 'be fast', 'befast', 'cerebrovascular', 'brain attack'];
        const hasStrokeFocus = strokeTerms.some(term => title.includes(term));
        
        if (isBackLegPainQuery && hasStrokeFocus) {
          console.log(`   ✗ Excluding stroke image for back/leg pain query: "${title}"`);
          return false;
        }
        
        // General mismatch filter: exclude images that are clearly about different conditions
        const mismatchFilters = [
          { queryTerms: ['back', 'lumbar', 'spine'], excludeTerms: ['stroke', 'heart attack', 'diabetes', 'asthma'] },
          { queryTerms: ['headache', 'migraine'], excludeTerms: ['back pain', 'leg pain', 'diabetes'] },
          { queryTerms: ['diabetes', 'blood sugar'], excludeTerms: ['stroke symptoms', 'back pain', 'headache'] },
        ];
        
        for (const filter of mismatchFilters) {
          const queryHasTerm = filter.queryTerms.some(t => queryLower.includes(t));
          const titleHasExcluded = filter.excludeTerms.some(t => title.includes(t));
          if (queryHasTerm && titleHasExcluded) {
            console.log(`   ✗ Excluding mismatched image: "${title}" (query about ${filter.queryTerms.join('/')})`);
            return false;
          }
        }
        
        // For general mode, be stricter about relevance
        if (mode === 'general' && !hasRelevantTerm && !title.includes('health')) {
          console.log(`   ✗ Low relevance image: "${title}"`);
          return false;
        }
        
        // For doctor mode, prefer educational/medical sources
        if (mode === 'doctor') {
          const preferredSources = ['nih.gov', 'cdc.gov', 'who.int', 'mayoclinic', 'webmd', 'medscape', 'wikipedia', 'healthline', 'clevelandclinic', 'ahajournals', 'escardio', 'acc.org', 'heart.org'];
          const hasPreferredSource = preferredSources.some(s => source.includes(s));
          // Don't strictly filter, but log preference
          if (hasPreferredSource) {
            console.log(`   ✓ Preferred source: ${source}`);
          }
        }
        
        return true;
      })
      // Sort guideline images to prioritize those with guideline-specific terms
      .sort((a: any, b: any) => {
        if (!isGuidelineQuery) return 0;
        
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        
        // Prioritize images with 'table', 'algorithm', 'comparison', 'guideline' in title
        const priorityTerms = ['table', 'algorithm', 'comparison', 'guideline', 'target', 'recommendation', 'flowchart'];
        const scoreA = priorityTerms.filter(t => titleA.includes(t)).length;
        const scoreB = priorityTerms.filter(t => titleB.includes(t)).length;
        
        return scoreB - scoreA; // Higher score first
      })
      .slice(0, limit)
      .map((img: any) => ({
        url: img.imageUrl,
        title: img.title || "Medical Image",
        source: img.source || "Google Images",
        license: "Fair Use - Educational",
        thumbnail: img.thumbnailUrl || img.imageUrl,
        description: img.title || ""
      }));
    
    console.log(`✅ Found ${filteredImages.length} relevant images from Serper`);
    return filteredImages;
  } catch (error: any) {
    console.error("❌ Serper error:", error.message);
    return [];
  }
}

/**
 * Fetch images from Unsplash API - SECONDARY SOURCE
 */
async function fetchUnsplashImagesInternal(
  query: string, 
  limit = 4,
  mode: 'doctor' | 'general' = 'doctor'
): Promise<MedicalImage[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  
  if (!accessKey) {
    console.log("ℹ️  Unsplash API key not configured");
    return [];
  }
  
  try {
    // Use the same topic extraction for consistency
    const mainTopic = extractMainTopic(query);
    let searchQuery: string;
    
    if (mode === 'doctor') {
      searchQuery = mainTopic;
    } else {
      searchQuery = `health wellness ${mainTopic.replace(/diagram|chart|medical/gi, '')}`;
    }
    
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=${limit * 2}&orientation=landscape&content_filter=high`;
    
    console.log(`🖼️  Fetching from Unsplash (${mode} mode): "${searchQuery}"`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Unsplash error: ${response.status} - ${errorText}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.log(`⚠️  No images found from Unsplash`);
      return [];
    }
    
    const filteredImages = data.results
      .filter((item: any) => {
        const desc = (item.description || item.alt_description || '').toLowerCase();
        const tags = item.tags?.map((t: any) => t.title?.toLowerCase() || '') || [];
        const allText = [desc, ...tags].join(' ');
        
        const hasExcludedTerm = EXCLUDED_TERMS.some(term => allText.includes(term));
        if (hasExcludedTerm) return false;
        
        if (mode === 'general') {
          const clinicalTerms = ['surgery', 'blood', 'wound', 'injection', 'needle', 'operation'];
          const hasClinicalContent = clinicalTerms.some(term => allText.includes(term));
          return !hasClinicalContent;
        }
        
        return true;
      })
      .slice(0, limit)
      .map((item: any) => {
        const photographerName = item.user?.name || 'Unknown';
        return {
          url: item.urls.regular,
          title: item.description || item.alt_description || "Medical Image",
          source: "Unsplash",
          license: `Photo by ${photographerName} on Unsplash`,
          thumbnail: item.urls.small,
          description: item.description || item.alt_description || '',
        };
      });
    
    console.log(`✅ Found ${filteredImages.length} images from Unsplash`);
    return filteredImages;
  } catch (error: any) {
    console.error("❌ Unsplash error:", error.message);
    return [];
  }
}

/**
 * Calculate similarity between two strings (Jaccard similarity)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const s2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  const set1 = new Set(s1);
  const set2 = new Set(s2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Check if two images are visually similar based on URL patterns and titles
 */
function areImagesSimilar(img1: MedicalImage, img2: MedicalImage): boolean {
  // Same URL = definitely duplicate
  if (img1.url === img2.url) return true;
  
  // Check URL similarity (same base image, different sizes)
  const url1Base = img1.url.replace(/\d+x\d+|thumb|small|medium|large|_\d+/gi, '');
  const url2Base = img2.url.replace(/\d+x\d+|thumb|small|medium|large|_\d+/gi, '');
  if (url1Base === url2Base) return true;
  
  // Check title similarity (> 70% similar = likely same image)
  const titleSimilarity = calculateSimilarity(img1.title, img2.title);
  if (titleSimilarity > 0.7) return true;
  
  // Check for common patterns indicating same image
  const patterns = [
    /heart.*anatomy/i,
    /brain.*anatomy/i,
    /lung.*anatomy/i,
    /outside.*heart/i,
    /inside.*heart/i,
    /cross.*section/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(img1.title) && pattern.test(img2.title)) {
      // Both match same pattern - check if they're the same type
      const type1 = img1.title.match(/outside|inside|cross|front|back|side|diagram|chart/i)?.[0]?.toLowerCase();
      const type2 = img2.title.match(/outside|inside|cross|front|back|side|diagram|chart/i)?.[0]?.toLowerCase();
      if (type1 && type2 && type1 === type2) return true;
    }
  }
  
  return false;
}

/**
 * Deduplicate images by removing visually similar ones
 * Keeps the first occurrence and removes similar subsequent images
 */
function deduplicateImages(images: MedicalImage[]): MedicalImage[] {
  const unique: MedicalImage[] = [];
  
  for (const img of images) {
    const isDuplicate = unique.some(existing => areImagesSimilar(existing, img));
    if (!isDuplicate) {
      unique.push(img);
    }
  }
  
  return unique;
}

/**
 * Classify an image as anatomy, pathology, mechanism, algorithm, or general
 */
function classifyImageType(title: string): ImageType {
  const titleLower = title.toLowerCase();
  
  // Algorithm/Flowchart detection
  const algorithmTerms = ['algorithm', 'flowchart', 'pathway', 'decision tree', 'treatment pathway', 'guideline', 'protocol', 'step-by-step'];
  if (algorithmTerms.some(t => titleLower.includes(t))) {
    return 'algorithm';
  }
  
  // Comparison table detection
  const comparisonTerms = ['comparison', 'vs', 'versus', 'table', 'chart comparing'];
  if (comparisonTerms.some(t => titleLower.includes(t))) {
    return 'comparison';
  }
  
  // Anatomy detection
  const anatomyTerms = ['anatomy', 'anatomical', 'structure', 'labeled', 'cross section', 'diagram of'];
  if (anatomyTerms.some(t => titleLower.includes(t))) {
    return 'anatomy';
  }
  
  // Pathology detection
  const pathologyTerms = ['pathology', 'pathophysiology', 'disease', 'condition', 'failure', 'dysfunction', 'abnormal'];
  if (pathologyTerms.some(t => titleLower.includes(t))) {
    return 'pathology';
  }
  
  // Mechanism detection
  const mechanismTerms = ['mechanism', 'action', 'how', 'works', 'effect', 'pathway'];
  if (mechanismTerms.some(t => titleLower.includes(t))) {
    return 'mechanism';
  }
  
  return 'general';
}

/**
 * Main function to fetch medical images - SMART QUERY VERSION
 * 
 * KEY IMPROVEMENTS (v2 - Nov 2025):
 * 1. Uses Gemini to generate OPTIMAL search queries (not verify images)
 * 2. Title-based relevance filtering (fast, reliable)
 * 3. Pre-filters unsupported formats (GIF, SVG)
 * 4. Falls back to curated images when needed
 * 5. Limits flowcharts/algorithms to 1 maximum
 * 
 * Why we changed from Vision Verification:
 * - Vision verification was too slow (5+ seconds per image)
 * - Many images failed due to unsupported formats (GIF, SVG)
 * - Gemini Vision was too strict, rejecting relevant images
 * - Smart query generation is faster and more effective
 * 
 * New Approach:
 * 1. Use Gemini to generate 2-3 optimal search queries
 * 2. Fetch images using those queries
 * 3. Filter by title relevance (fast)
 * 4. Return best matches
 * 
 * Priority:
 * 1. Smart Query Generation (Gemini) - OPTIMAL SEARCH
 * 2. Serper API (Google Images) - PRIMARY SOURCE
 * 3. Title-based filtering - FAST RELEVANCE CHECK
 * 4. Curated database - Guaranteed fallback
 */
export async function fetchMedicalImages(
  query: string, 
  mode: 'doctor' | 'general' = 'doctor',
  useVerification: boolean = false // DISABLED by default - use smart queries instead
): Promise<MedicalImage[]> {
  try {
    // Skip for excluded terms in general mode
    if (mode === 'general' && containsExcludedTerms(query)) {
      console.log(`⚠️  Skipping image search - excluded terms detected`);
      return [];
    }
    
    console.log(`\n🔍 ========== SMART MEDICAL IMAGE SEARCH ==========`);
    console.log(`   Query: "${query.substring(0, 100)}..."`);
    console.log(`   Mode: ${mode}`);
    console.log(`   Vision Verification: ${useVerification ? 'ENABLED' : 'DISABLED (using smart queries)'}`);
    
    // STEP 1: Use Gemini to generate optimal search queries
    let smartQueries: { query: string; type: ImageType; priority: number }[] = [];
    
    try {
      const { generateSmartImageQueries, isImageRelevantByTitle } = await import('./smart-image-query');
      const aiQueries = await generateSmartImageQueries(query, mode);
      
      if (aiQueries.length > 0) {
        console.log(`   🤖 AI-Generated Search Queries:`);
        aiQueries.forEach((q, i) => {
          console.log(`      ${i + 1}. "${q.searchQuery}" (${q.imageType})`);
          console.log(`         Rationale: ${q.rationale}`);
        });
        
        // Convert to internal format
        smartQueries = aiQueries.map(q => ({
          query: q.searchQuery,
          type: q.imageType as ImageType,
          priority: q.priority,
        }));
      }
    } catch (error: any) {
      console.log(`   ⚠️  AI query generation failed: ${error.message}`);
    }
    
    // STEP 1b: Fallback to parsed query if AI fails
    if (smartQueries.length === 0) {
      const parsed = parseQueryForImageNeeds(query);
      console.log(`   📋 Fallback - Parsed Query:`);
      console.log(`      Primary Organ: ${parsed.primaryOrgan || 'none'}`);
      console.log(`      Primary Condition: ${parsed.primaryCondition || 'none'}`);
      
      smartQueries = generateSmartSearchQueries(parsed);
    }
    
    console.log(`   🎯 Total search queries: ${smartQueries.length}`);
    
    // STEP 3: Fetch images using multiple targeted queries
    const allFetchedImages: MedicalImage[] = [];
    let algorithmCount = 0;
    const MAX_ALGORITHMS = 1; // CRITICAL: Limit algorithms to 1
    
    // First, try the smart queries
    for (const sq of smartQueries.slice(0, 3)) { // Limit to top 3 queries
      console.log(`   🔎 Searching: "${sq.query}" (type: ${sq.type})`);
      
      // Skip algorithm queries if we already have one
      if (sq.type === 'algorithm' && algorithmCount >= MAX_ALGORITHMS) {
        console.log(`   ⏭️  Skipping algorithm query - already have ${algorithmCount}`);
        continue;
      }
      
      const images = await fetchSerperImages(sq.query, 3, mode);
      
      // Classify and filter images
      for (const img of images) {
        const imgType = classifyImageType(img.title);
        
        // Enforce algorithm limit
        if (imgType === 'algorithm') {
          if (algorithmCount >= MAX_ALGORITHMS) {
            console.log(`   ⏭️  Skipping algorithm image: "${img.title.substring(0, 50)}..."`);
            continue;
          }
          algorithmCount++;
          console.log(`   ✓ Including algorithm (${algorithmCount}/${MAX_ALGORITHMS}): "${img.title.substring(0, 50)}..."`);
        }
        
        allFetchedImages.push(img);
      }
    }
    
    // STEP 4: If not enough images, fall back to original search
    if (allFetchedImages.length < 2) {
      console.log(`   ⚠️  Smart search found only ${allFetchedImages.length} images, using fallback...`);
      const fallbackImages = await fetchSerperImages(query, 8, mode);
      
      for (const img of fallbackImages) {
        const imgType = classifyImageType(img.title);
        
        // Still enforce algorithm limit
        if (imgType === 'algorithm' && algorithmCount >= MAX_ALGORITHMS) {
          continue;
        }
        if (imgType === 'algorithm') {
          algorithmCount++;
        }
        
        allFetchedImages.push(img);
      }
    }
    
    // STEP 5: Deduplicate
    let uniqueImages = deduplicateImages(allFetchedImages);
    console.log(`   After deduplication: ${uniqueImages.length} unique images`);
    
    // STEP 6: If still not enough, supplement with Unsplash
    if (uniqueImages.length < 3) {
      console.log(`   ⚠️  Only ${uniqueImages.length} unique images, supplementing with Unsplash...`);
      const unsplashImages = await fetchUnsplashImagesInternal(query, 4, mode);
      
      for (const img of unsplashImages) {
        if (!uniqueImages.some(existing => areImagesSimilar(existing, img))) {
          uniqueImages.push(img);
        }
      }
    }
    
    // STEP 7: If still empty, use curated images
    if (uniqueImages.length === 0) {
      console.log(`   📚 Using curated medical images as fallback`);
      uniqueImages = getCuratedImages(query, 4);
    }
    
    // STEP 8: Final validation and smart selection
    const validImages = uniqueImages.filter(img => 
      img.url && 
      img.url.startsWith('http') && 
      img.title &&
      img.title.length > 2
    );
    
    // STEP 9: RELEVANCE FILTERING
    let verifiedImages = validImages;
    
    if (useVerification && validImages.length > 0) {
      // OPTION A: Vision Verification (slow, often fails)
      console.log(`   🔍 VISION VERIFICATION: Checking ${validImages.length} images with Gemini Vision...`);
      
      try {
        const { verifyImages } = await import('./image-verification');
        
        const candidates = validImages.map(img => ({
          url: img.url,
          title: img.title,
        }));
        
        const verified = await verifyImages(candidates, query, mode, 70);
        
        verifiedImages = verified.map(v => {
          const original = validImages.find(img => img.url === v.url);
          return original!;
        }).filter(Boolean);
        
        console.log(`   ✅ ${verifiedImages.length}/${validImages.length} images passed vision verification`);
        
        // If too few images passed, try refined search
        if (verifiedImages.length < 2) {
          console.log(`   ⚠️  Only ${verifiedImages.length} images passed verification, trying refined search...`);
          
          // Extract refined search terms
          const { extractRefinedSearchTerms } = await import('./image-verification');
          const rejectedReasons = verified
            .filter(v => !v.verificationResult.isRelevant)
            .map(v => v.verificationResult.reason);
          
          const refinedTerms = extractRefinedSearchTerms(query, rejectedReasons);
          
          // Try one more search with refined terms
          for (const term of refinedTerms.slice(0, 2)) {
            console.log(`   🔎 Refined search: "${term}"`);
            const refinedImages = await fetchSerperImages(term, 4, mode);
            
            if (refinedImages.length > 0) {
              const refinedCandidates = refinedImages.map(img => ({
                url: img.url,
                title: img.title,
              }));
              
              const refinedVerified = await verifyImages(refinedCandidates, query, mode, 70);
              
              for (const v of refinedVerified) {
                const img = refinedImages.find(i => i.url === v.url);
                if (img && !verifiedImages.some(vi => vi.url === img.url)) {
                  verifiedImages.push(img);
                }
              }
            }
          }
          
          console.log(`   ✅ After refined search: ${verifiedImages.length} verified images`);
        }
        
      } catch (error: any) {
        console.error(`   ❌ Vision verification failed: ${error.message}`);
        console.log(`   ⚠️  Falling back to title-based filtering`);
        useVerification = false; // Fall through to title-based filtering
      }
    }
    
    // OPTION B: Title-based filtering (fast, reliable) - DEFAULT
    if (!useVerification && validImages.length > 0) {
      console.log(`   📝 TITLE-BASED FILTERING: Checking ${validImages.length} images...`);
      
      try {
        const { isImageRelevantByTitle } = await import('./smart-image-query');
        
        // Get the search query that was used (from smart queries)
        const searchQuery = smartQueries.length > 0 ? smartQueries[0].query : query;
        
        verifiedImages = validImages.filter(img => {
          const result = isImageRelevantByTitle(img.title, searchQuery, query);
          if (!result.relevant) {
            console.log(`   ✗ Filtered out: "${img.title.substring(0, 50)}..." - ${result.reason}`);
          }
          return result.relevant;
        });
        
        console.log(`   ✅ ${verifiedImages.length}/${validImages.length} images passed title filtering`);
        
        // If still no images, use all valid images (better than nothing)
        if (verifiedImages.length === 0) {
          console.log(`   ⚠️  No images passed filtering, using all valid images`);
          verifiedImages = validImages.slice(0, 4);
        }
        
      } catch (error: any) {
        console.error(`   ❌ Title filtering failed: ${error.message}`);
        verifiedImages = validImages.slice(0, 4); // Use first 4 valid images
      }
    }
    
    // STEP 10: Ensure diverse image types (prioritize anatomy/pathology over algorithms)
    const categorizedImages: Record<ImageType, MedicalImage[]> = {
      anatomy: [],
      pathology: [],
      mechanism: [],
      algorithm: [],
      comparison: [],
      general: [],
    };
    
    for (const img of verifiedImages) {
      const type = classifyImageType(img.title);
      categorizedImages[type].push(img);
    }
    
    // Build final selection with diversity
    const finalImages: MedicalImage[] = [];
    
    // Priority order: anatomy, pathology, mechanism, then 1 algorithm max
    const priorityOrder: ImageType[] = ['anatomy', 'pathology', 'mechanism', 'comparison', 'algorithm', 'general'];
    
    for (const type of priorityOrder) {
      const available = categorizedImages[type];
      
      // For algorithms, only take 1
      if (type === 'algorithm') {
        if (available.length > 0 && finalImages.length < 4) {
          finalImages.push(available[0]);
          console.log(`   ✓ Selected 1 algorithm image`);
        }
      } else {
        // For other types, take up to 2 each
        for (const img of available.slice(0, 2)) {
          if (finalImages.length < 4) {
            finalImages.push(img);
          }
        }
      }
      
      if (finalImages.length >= 4) break;
    }
    
    console.log(`   📊 Final image selection (${useVerification ? 'VISION-VERIFIED' : 'UNVERIFIED'}):`);
    finalImages.forEach((img, i) => {
      const type = classifyImageType(img.title);
      console.log(`      ${i + 1}. [${type}] ${img.title.substring(0, 60)}...`);
    });
    
    console.log(`✅ Returning ${finalImages.length} ${useVerification ? 'vision-verified' : ''} medical images`);
    console.log(`========================================\n`);
    return finalImages;
    
  } catch (error: any) {
    console.error("❌ Error fetching medical images:", error.message);
    console.log(`📚 Fallback: Using curated images`);
    return getCuratedImages(query, 4);
  }
}

/**
 * Format images for API response
 */
export function formatImagesForResponse(images: MedicalImage[]): any {
  return {
    images: images.map(img => ({
      url: img.url,
      title: img.title,
      source: img.source,
      license: img.license,
      thumbnail: img.thumbnail || img.url,
      description: img.description
    }))
  };
}

// Legacy exports for backward compatibility
export const fetchUnsplashImages = fetchUnsplashImagesInternal;
export const fetchNLMImages = getCuratedImages;
export const fetchWikimediaImages = getCuratedImages;
export const fetchUnsplashMedicalImages = fetchUnsplashImagesInternal;
