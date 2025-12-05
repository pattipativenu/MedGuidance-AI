/**
 * Learn More Capabilities
 * 
 * Comprehensive question sets for Doctor Mode and General Mode
 * Designed to showcase system capabilities and provide high-quality responses
 */

export interface RadiologyQuestion {
  text: string;
  imageUrls?: string[]; // Optional image URLs for radiology cases
}

export interface CapabilityCategory {
  title: string;
  icon: React.ReactNode;
  questions: (string | RadiologyQuestion)[];
}

// ============================================================================
// GENERAL MODE - Consumer-Friendly Health Questions
// ============================================================================

export const GENERAL_MODE_CAPABILITIES = [
  {
    title: "Chronic Disease Management",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    questions: [
      "What lifestyle changes are most effective for managing type 2 diabetes including diet, exercise, and weight loss?",
      "What are evidence-based natural ways to lower high blood pressure through diet and lifestyle modifications?",
      "What are the warning signs of worsening asthma and when should I seek medical attention?"
    ]
  },
  {
    title: "Pain & Injury Management",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    questions: [
      "What is the difference between a muscle strain and a ligament sprain and how should each be treated?",
      "What are the common causes of lower back pain with leg radiation (sciatica) and what treatment options are available?",
      "What are the evidence-based non-surgical treatments for knee osteoarthritis including physical therapy, medications, and injections?"
    ]
  },
  {
    title: "Medication Safety & Side Effects",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    questions: [
      "What are the risks of long-term ibuprofen use and what are safer alternatives for chronic pain management?",
      "What are the risks and benefits of long-term proton pump inhibitor (omeprazole) use for acid reflux?",
      "What medications and supplements should be avoided when taking blood thinners like warfarin or direct oral anticoagulants?"
    ]
  },
  {
    title: "Heart Health & Cardiovascular Risk",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    questions: [
      "What dietary changes can help lower high cholesterol naturally including foods to eat and avoid?",
      "What are the warning signs and symptoms of a heart attack that require immediate medical attention?",
      "What cardiovascular screening tests are recommended for people with a family history of heart disease?"
    ]
  },
  {
    title: "Mental Health & Sleep Disorders",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
    questions: [
      "What is the difference between normal anxiety and an anxiety disorder that requires treatment?",
      "What are the symptoms of obstructive sleep apnea and when should I get tested?",
      "What are evidence-based non-medication treatments for depression including psychotherapy and lifestyle interventions?"
    ]
  },
  {
    title: "Women's Health & Pregnancy",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    questions: [
      "What prenatal vitamins and supplements are recommended during pregnancy including folic acid, iron, and omega-3 fatty acids?",
      "What are the treatment options for severe menstrual cramps (dysmenorrhea) including medications and non-pharmacological approaches?",
      "What are the symptoms, diagnosis, and treatment options for polycystic ovary syndrome (PCOS)?"
    ]
  },
  {
    title: "Digestive Health & Nutrition",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    questions: [
      "What is the difference between irritable bowel syndrome (IBS), inflammatory bowel disease (IBD), and celiac disease?",
      "What dietary and lifestyle changes can help manage gastroesophageal reflux disease (GERD) and when should I see a doctor?",
      "What is the evidence for intermittent fasting for weight loss including health benefits and potential risks?"
    ]
  },
  {
    title: "Skin Conditions & Dermatology",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    questions: [
      "What are the ABCDE warning signs of melanoma and when should a mole be evaluated by a dermatologist?",
      "What are the treatment options for atopic dermatitis (eczema) including topical therapies and strategies to prevent flare-ups?",
      "What is the difference between psoriasis and eczema in terms of symptoms, causes, and treatment approaches?"
    ]
  },
  {
    title: "Preventive Care & Screening",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    questions: [
      "What cancer screening tests are recommended at age 50 including colonoscopy, mammography, and lung cancer screening?",
      "What preventive health screenings and vaccinations are recommended for healthy adults at age 40?",
      "What are the current USPSTF guidelines for breast cancer screening (mammography) and colorectal cancer screening (colonoscopy)?"
    ]
  },
  {
    title: "Respiratory & Allergies",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    questions: [
      "What is the difference between seasonal allergies (allergic rhinitis), common cold, and acute sinusitis?",
      "What are the common causes of chronic cough lasting more than 8 weeks and when should I see a doctor?",
      "What are the treatment options for chronic rhinosinusitis including medical management and surgical interventions?"
    ]
  }
];

// ============================================================================
// DOCTOR MODE - Professional Clinical Questions
// ============================================================================

export const DOCTOR_MODE_CAPABILITIES = [
  {
    title: "Evidence Synthesis & Meta-Analysis",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
    ),
    questions: [
      "What is the evidence comparing SGLT2 inhibitors versus GLP-1 agonists for cardiovascular outcomes in type 2 diabetes patients with established cardiovascular disease?",
      "What are the current ACC/AHA and ESC guideline recommendations for dual antiplatelet therapy duration after percutaneous coronary intervention in high bleeding risk patients?",
      "Compare the efficacy and safety of direct oral anticoagulants versus warfarin in atrial fibrillation patients with chronic kidney disease (eGFR 15-30 mL/min)."
    ]
  },
  {
    title: "Radiology Case Studies",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    questions: [
      {
        text: "A 78-year-old with a history of ischemic cardiomyopathy and hypertension presents with progressive dyspnea on exertion and orthopnea. This lateral chest X-ray was obtained along with a PA view. Interpret the radiographic findings, focusing on evidence of cardiomegaly or pulmonary congestion, and explain how they fit with possible heart failure vs alternative diagnoses.",
        imageUrls: [
          "/med-images/lateral chest X‑ray.jpg",
          "/med-images/PA.jpg"
        ]
      },
      {
        text: "A 62-year-old woman with a history of headaches undergoes brain MRI showing a right frontal convexity extra-axial mass with dural tail sign. Serial MRI obtained 6 months later. Interpret the imaging findings, assess for interval growth, discuss the differential diagnosis (meningioma vs other extra-axial masses), and provide evidence-based recommendations for observation versus surgical intervention based on WHO grading and growth rate.",
        imageUrls: [
          "/med-images/brain MRI.png",
          "/med-images/Brain-mri-2.png"
        ]
      }
    ]
  },
  {
    title: "Complex Clinical Cases & DDx",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    questions: [
      "What is the diagnostic approach and treatment for heart failure with preserved ejection fraction (HFpEF) in a patient with dyspnea, edema, and elevated BNP?",
      "How do you differentiate septic arthritis from crystal-induced arthropathy in acute monoarticular knee pain with synovial fluid showing 60,000 WBCs and 85% neutrophils?",
      "What is the workup for recurrent unprovoked deep vein thrombosis in a young patient? Include thrombophilia testing, antiphospholipid syndrome evaluation, and malignancy screening."
    ]
  },
  {
    title: "Advanced Pharmacotherapy & Drug Interactions",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    questions: [
      "What is the management strategy for warfarin-fluconazole drug interaction including INR monitoring and dose adjustments?",
      "Compare apixaban versus rivaroxaban dosing and drug interactions in atrial fibrillation patients with moderate renal impairment (CrCl 30-50 mL/min) taking amiodarone.",
      "What are the treatment options for immune checkpoint inhibitor-induced colitis? Compare corticosteroids versus infliximab and discuss when to discontinue immunotherapy."
    ]
  },
  {
    title: "Guideline-Based Treatment Algorithms",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    questions: [
      "What are the KDIGO guideline recommendations for managing hyperkalemia in chronic kidney disease patients on RAAS inhibitors? Compare patiromer versus sodium zirconium cyclosilicate.",
      "What are the ACC/AHA and ESC guideline differences for managing non-ST elevation acute coronary syndrome including risk stratification and timing of invasive strategy?",
      "What are the ADA guideline recommendations for initiating and intensifying insulin therapy in type 2 diabetes including basal insulin selection and titration?"
    ]
  },
  {
    title: "Oncology & Precision Medicine",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    questions: [
      "What are the treatment options for EGFR-mutant non-small cell lung cancer after osimertinib progression including chemotherapy and immunotherapy?",
      "Compare pembrolizumab monotherapy versus nivolumab plus ipilimumab for first-line treatment of metastatic melanoma including efficacy, toxicity, and PD-L1 considerations.",
      "What are the NCCN guidelines for BRCA1/2 testing in breast cancer and how do results guide treatment with PARP inhibitors and platinum chemotherapy?"
    ]
  },
  {
    title: "Critical Care & Emergency Medicine",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    questions: [
      "What are the Surviving Sepsis Campaign guideline recommendations for vasopressor selection in septic shock? Compare norepinephrine versus vasopressin and when to add additional agents.",
      "What is the evidence-based management of acute respiratory distress syndrome (ARDS) including lung-protective ventilation, prone positioning, and ECMO indications?",
      "What are the current guidelines for targeted temperature management after cardiac arrest including temperature targets, duration, and neuroprognostication?"
    ]
  },
  {
    title: "Exam Preparation & Board Review",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    questions: [
      "What is the management approach for non-ST elevation myocardial infarction with elevated troponin and ST depressions in lateral leads?",
      "What is the pathophysiology, clinical presentation, diagnostic criteria, and acute management of thyroid storm?",
      "Compare ACE inhibitors, ARBs, and ARNIs (sacubitril/valsartan) for heart failure including mechanisms of action, indications, and adverse effects."
    ]
  },
  {
    title: "Infectious Disease & Antimicrobial Stewardship",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    questions: [
      "What is the empiric antibiotic treatment for hospital-acquired pneumonia with MRSA and Pseudomonas risk factors? Compare vancomycin plus piperacillin-tazobactam versus cefepime.",
      "What are the IDSA guideline recommendations for Clostridioides difficile infection treatment? Compare fidaxomicin versus vancomycin and discuss fecal microbiota transplantation indications.",
      "What is the treatment approach for candidemia in non-neutropenic patients? Compare echinocandins versus fluconazole including source control and treatment duration."
    ]
  },
  {
    title: "Neurology & Stroke Management",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    questions: [
      "What is the treatment approach for acute ischemic stroke within 4.5 hours of onset? Compare IV alteplase, mechanical thrombectomy, and combination therapy including imaging requirements.",
      "Compare levetiracetam, lamotrigine, and carbamazepine as first-line monotherapy for newly diagnosed focal epilepsy including efficacy, tolerability, and drug interactions.",
      "What are the diagnostic criteria and treatment algorithm for myasthenia gravis including antibody testing, electrophysiology, and immunotherapy options?"
    ]
  },
  {
    title: "Medical Imaging Interpretation",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    questions: [
      "What are the classic chest X-ray findings of congestive heart failure including Kerley B lines, cephalization, pleural effusions, and cardiomegaly?",
      "What are the CT findings that differentiate ischemic stroke from hemorrhagic stroke in the acute setting including hyperdense MCA sign and loss of gray-white differentiation?",
      "What is the differential diagnosis for ground-glass opacities with crazy-paving pattern on chest CT including COVID-19, Pneumocystis jirovecii, and organizing pneumonia?"
    ]
  }
];
