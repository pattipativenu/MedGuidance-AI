/**
 * ClinicalTrials.gov API v2 Integration
 * Official API documentation: https://clinicaltrials.gov/data-api/about-api
 */

import { getCachedEvidence, cacheEvidence } from './cache-manager';

export interface ClinicalTrial {
  nctId: string;
  briefTitle: string;
  officialTitle?: string;
  overallStatus: string;
  phases: string[];
  conditions: string[];
  interventions: string[];
  leadSponsor: string;
  startDate?: string;
  completionDate?: string;
  enrollment?: number;
  studyType: string;
  hasResults: boolean;
  briefSummary?: string;
  eligibilityCriteria?: string;
  locations?: string[];
}

/**
 * Search ClinicalTrials.gov for relevant trials using API v2
 * NOW WITH CACHING: Checks Redis cache before hitting ClinicalTrials.gov API
 * @param query - Search query (can use condition, intervention, or general terms)
 * @param maxResults - Maximum number of results to return (default: 10)
 * @returns Array of clinical trials
 */
export async function searchClinicalTrials(
  query: string,
  maxResults: number = 10
): Promise<ClinicalTrial[]> {
  // PHASE 1 ENHANCEMENT: Check cache first
  // Error handling: If cache fails, continue with API call (graceful degradation)
  const cacheKey = `${query}_${maxResults}`; // Include maxResults in cache key
  try {
    const cached = await getCachedEvidence<ClinicalTrial[]>(cacheKey, 'clinicaltrials');

    if (cached) {
      console.log(`📬 Using cached ClinicalTrials.gov results for query`);
      return cached.data;
    }
  } catch (error: any) {
    console.error('❌ Cache read error in ClinicalTrials.gov, falling back to API:', error.message);
    // Continue to API call
  }

  // Cache miss - fetch from API
  try {
    // ClinicalTrials.gov API v2 - Updated endpoint structure
    // Using query.cond and query.term for comprehensive search
    // API v2 uses different parameter format than v1
    const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(query)}&query.term=${encodeURIComponent(query)}&pageSize=${maxResults}&format=json`;
    
    console.log("🔬 Fetching clinical trials from ClinicalTrials.gov API v2...");
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      console.error(`❌ ClinicalTrials.gov API error: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.studies || data.studies.length === 0) {
      console.log("⚠️  No clinical trials found for query:", query);
      return [];
    }
    
    console.log(`✅ Found ${data.studies.length} clinical trials`);
    
    // Parse and structure the results according to API v2 schema
    const trials: ClinicalTrial[] = data.studies.map((study: any) => {
      const protocol = study.protocolSection || {};
      const identification = protocol.identificationModule || {};
      const status = protocol.statusModule || {};
      const design = protocol.designModule || {};
      const conditions = protocol.conditionsModule || {};
      const armsInterventions = protocol.armsInterventionsModule || {};
      const sponsorCollab = protocol.sponsorCollaboratorsModule || {};
      const description = protocol.descriptionModule || {};
      const eligibility = protocol.eligibilityModule || {};
      const contactsLocations = protocol.contactsLocationsModule || {};
      
      return {
        nctId: identification.nctId || "",
        briefTitle: identification.briefTitle || "",
        officialTitle: identification.officialTitle,
        overallStatus: status.overallStatus || "UNKNOWN",
        phases: design.phases || [],
        conditions: conditions.conditions || [],
        interventions: (armsInterventions.interventions || []).map((i: any) => i.name || "").filter(Boolean),
        leadSponsor: sponsorCollab.leadSponsor?.name || "",
        startDate: status.startDateStruct?.date,
        completionDate: status.completionDateStruct?.date,
        enrollment: design.enrollmentInfo?.count,
        studyType: design.studyType || "",
        hasResults: study.hasResults || false,
        briefSummary: description.briefSummary,
        eligibilityCriteria: eligibility.eligibilityCriteria,
        locations: (contactsLocations.locations || [])
          .map((loc: any) => {
            const city = loc.city || "";
            const country = loc.country || "";
            return city && country ? `${city}, ${country}` : city || country;
          })
          .filter(Boolean),
      };
    });
    
    // PHASE 1 ENHANCEMENT: Cache the result
    // Error handling: If caching fails, continue anyway (graceful degradation)
    try {
      await cacheEvidence(cacheKey, 'clinicaltrials', trials);
    } catch (error: any) {
      console.error('❌ Cache write error in ClinicalTrials.gov:', error.message);
      // Continue - result is still returned
    }
    
    return trials;
  } catch (error: any) {
    console.error("❌ Error fetching clinical trials:", error.message);
    return [];
  }
}

/**
 * Search for trials by specific condition
 */
export async function searchTrialsByCondition(
  condition: string,
  maxResults: number = 10
): Promise<ClinicalTrial[]> {
  try {
    const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(condition)}&pageSize=${maxResults}&format=json`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.error(`ClinicalTrials.gov API error (condition): ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return parseTrials(data);
  } catch (error: any) {
    console.error("Error fetching trials by condition:", error.message);
    return [];
  }
}

/**
 * Search for trials by intervention/drug
 */
export async function searchTrialsByIntervention(
  intervention: string,
  maxResults: number = 10
): Promise<ClinicalTrial[]> {
  try {
    const url = `https://clinicaltrials.gov/api/v2/studies?query.intr=${encodeURIComponent(intervention)}&pageSize=${maxResults}&format=json`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.error(`ClinicalTrials.gov API error (intervention): ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return parseTrials(data);
  } catch (error: any) {
    console.error("Error fetching trials by intervention:", error.message);
    return [];
  }
}

/**
 * Helper function to parse trial data from API v2 response
 */
function parseTrials(data: any): ClinicalTrial[] {
  if (!data.studies || !Array.isArray(data.studies)) {
    return [];
  }
  
  return data.studies.map((study: any) => {
    const protocol = study.protocolSection || {};
    const identification = protocol.identificationModule || {};
    const status = protocol.statusModule || {};
    const design = protocol.designModule || {};
    const conditions = protocol.conditionsModule || {};
    const armsInterventions = protocol.armsInterventionsModule || {};
    const sponsorCollab = protocol.sponsorCollaboratorsModule || {};
    const description = protocol.descriptionModule || {};
    const eligibility = protocol.eligibilityModule || {};
    
    return {
      nctId: identification.nctId || "",
      briefTitle: identification.briefTitle || "",
      officialTitle: identification.officialTitle,
      overallStatus: status.overallStatus || "UNKNOWN",
      phases: design.phases || [],
      conditions: conditions.conditions || [],
      interventions: (armsInterventions.interventions || [])
        .map((i: any) => i.name || "")
        .filter(Boolean),
      leadSponsor: sponsorCollab.leadSponsor?.name || "",
      startDate: status.startDateStruct?.date,
      completionDate: status.completionDateStruct?.date,
      enrollment: design.enrollmentInfo?.count,
      studyType: design.studyType || "",
      hasResults: study.hasResults || false,
      briefSummary: description.briefSummary,
      eligibilityCriteria: eligibility.eligibilityCriteria,
    };
  });
}
