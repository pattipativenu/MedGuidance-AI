/**
 * Parser for extracting structured medical findings from AI responses
 */

import { PathologyFinding, BoundingBox, SeverityLevel, PathologyType } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parse visual findings from AI response
 * Extracts bounding boxes and pathology information
 */
export function parseVisualFindings(responseText: string): PathologyFinding[] {
  const findings: PathologyFinding[] = [];

  // Look for the VISUAL FINDINGS section
  const visualFindingsMatch = responseText.match(
    /\*\*VISUAL FINDINGS[:\s]*\*\*([\s\S]*?)(?=\n\n##|\n\n\*\*[A-Z]|$)/i
  );

  if (!visualFindingsMatch) {
    console.warn('No VISUAL FINDINGS section found in response');
    // Try alternative parsing
    return parseAlternativeFormat(responseText);
  }

  const findingsText = visualFindingsMatch[1];

  // Parse each finding line
  // Format: - [Description] | Severity: [level] | Coordinates: [ymin, xmin, ymax, xmax] | Label: [name]
  const findingLines = findingsText
    .split('\n')
    .filter((line) => line.trim().startsWith('-'));

  findingLines.forEach((line, index) => {
    try {
      const finding = parseFindingLine(line, index);
      if (finding) {
        findings.push(finding);
      }
    } catch (error) {
      console.error('Error parsing finding line:', line, error);
    }
  });

  return findings;
}

/**
 * Parse a single finding line
 */
function parseFindingLine(line: string, index: number): PathologyFinding | null {
  // Extract description (before first |)
  const descMatch = line.match(/^-\s*([^|]+)/);
  if (!descMatch) return null;
  const description = descMatch[1].trim();

  // Extract severity
  const severityMatch = line.match(/Severity:\s*(critical|moderate|mild|normal)/i);
  const severity = (severityMatch
    ? severityMatch[1].toLowerCase()
    : 'moderate') as SeverityLevel;

  // Extract coordinates [ymin, xmin, ymax, xmax]
  const coordsMatch = line.match(/Coordinates:\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/);
  if (!coordsMatch) {
    console.warn('No coordinates found in finding:', line);
    return null;
  }

  const rawYmin = parseInt(coordsMatch[1]);
  const rawXmin = parseInt(coordsMatch[2]);
  const rawYmax = parseInt(coordsMatch[3]);
  const rawXmax = parseInt(coordsMatch[4]);

  // Validate and constrain coordinates
  const constrained = validateCoordinates(rawYmin, rawXmin, rawYmax, rawXmax);
  if (!constrained) {
    console.warn('Invalid coordinates:', { rawYmin, rawXmin, rawYmax, rawXmax });
    return null;
  }
  
  const { ymin, xmin, ymax, xmax } = constrained;

  // Extract label
  const labelMatch = line.match(/Label:\s*([^\n|]+)/);
  const label = labelMatch ? labelMatch[1].trim() : description.substring(0, 20);

  // Extract location from description
  const location = extractLocation(description);

  // Determine pathology type
  const type = determinePathologyType(description, label);

  // Calculate confidence (default to high for explicit findings)
  const confidence = severity === 'critical' ? 0.9 : severity === 'moderate' ? 0.8 : 0.7;

  // Create bounding box
  const boundingBox: BoundingBox = {
    ymin,
    xmin,
    ymax,
    xmax,
    label,
    confidence,
  };

  // Create finding
  const finding: PathologyFinding = {
    id: uuidv4(),
    type,
    description,
    severity,
    location,
    boundingBox,
    confidence,
    clinicalSignificance: generateClinicalSignificance(type, severity),
  };

  return finding;
}

/**
 * Validate and constrain bounding box coordinates
 * Returns constrained coordinates or null if invalid
 */
function validateCoordinates(
  ymin: number,
  xmin: number,
  ymax: number,
  xmax: number
): { ymin: number; xmin: number; ymax: number; xmax: number } | null {
  // Clamp to 0-1000 range
  ymin = Math.max(0, Math.min(1000, ymin));
  xmin = Math.max(0, Math.min(1000, xmin));
  ymax = Math.max(0, Math.min(1000, ymax));
  xmax = Math.max(0, Math.min(1000, xmax));

  // Swap if inverted
  if (ymax < ymin) [ymin, ymax] = [ymax, ymin];
  if (xmax < xmin) [xmin, xmax] = [xmax, xmin];

  // Check if box has valid dimensions (at least 20x20)
  if (ymax - ymin < 20) return null;
  if (xmax - xmin < 20) return null;

  // CRITICAL: Constrain maximum box size to prevent full-image heatmaps
  const maxSize = 350;
  const width = xmax - xmin;
  const height = ymax - ymin;

  if (width > maxSize) {
    const centerX = (xmin + xmax) / 2;
    xmin = Math.max(0, centerX - maxSize / 2);
    xmax = Math.min(1000, centerX + maxSize / 2);
    console.warn(`MedGem: Bounding box width constrained from ${width} to ${maxSize}`);
  }

  if (height > maxSize) {
    const centerY = (ymin + ymax) / 2;
    ymin = Math.max(0, centerY - maxSize / 2);
    ymax = Math.min(1000, centerY + maxSize / 2);
    console.warn(`MedGem: Bounding box height constrained from ${height} to ${maxSize}`);
  }

  return { ymin, xmin, ymax, xmax };
}

/**
 * Extract anatomical location from description
 */
function extractLocation(description: string): string {
  const locationPatterns = [
    // Lung locations
    /(?:right|left)\s+(?:upper|middle|lower)\s+lobe/i,
    /(?:right|left)\s+lung/i,
    // Bone locations
    /(?:right|left)\s+\d+(?:st|nd|rd|th)\s+rib/i,
    /(?:right|left)\s+clavicle/i,
    // General locations
    /(?:right|left)\s+(?:side|hemithorax)/i,
    /(?:upper|middle|lower)\s+(?:zone|field)/i,
    /mediastinum/i,
    /cardiac\s+silhouette/i,
    /diaphragm/i,
  ];

  for (const pattern of locationPatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return 'Location not specified';
}

/**
 * Determine pathology type from description and label
 */
function determinePathologyType(description: string, label: string): PathologyType {
  const text = (description + ' ' + label).toLowerCase();

  // Chest X-ray pathologies
  if (text.includes('pneumothorax')) return 'pneumothorax';
  if (text.includes('pleural effusion') || text.includes('effusion')) return 'pleural-effusion';
  if (text.includes('consolidation')) return 'consolidation';
  if (text.includes('atelectasis')) return 'atelectasis';
  if (text.includes('cardiomegaly') || text.includes('enlarged heart')) return 'cardiomegaly';
  if (text.includes('fracture')) return 'fracture';
  if (text.includes('mass')) return 'mass';
  if (text.includes('nodule')) return 'nodule';
  if (text.includes('edema')) return 'edema';
  if (text.includes('pneumonia')) return 'pneumonia';
  if (text.includes('device') || text.includes('tube') || text.includes('line')) return 'device';

  // CT/MRI pathologies
  if (text.includes('hemorrhage') || text.includes('bleed')) return 'hemorrhage';
  if (text.includes('tumor')) return 'tumor';
  if (text.includes('laceration')) return 'laceration';
  if (text.includes('vascular') || text.includes('aneurysm')) return 'vascular-abnormality';
  if (text.includes('lymph') || text.includes('adenopathy')) return 'lymphadenopathy';
  if (text.includes('lesion')) return 'lesion';
  if (text.includes('compression')) return 'compression';
  if (text.includes('malformation')) return 'malformation';

  return 'other';
}

/**
 * Generate clinical significance based on pathology type and severity
 */
function generateClinicalSignificance(type: PathologyType, severity: SeverityLevel): string {
  const significanceMap: Partial<Record<PathologyType, Record<SeverityLevel, string>>> = {
    'pneumothorax': {
      critical: 'Life-threatening condition requiring immediate intervention. Risk of tension pneumothorax.',
      moderate: 'Significant finding requiring urgent evaluation and possible chest tube placement.',
      mild: 'Small pneumothorax may be observed with close monitoring.',
      normal: 'No pneumothorax detected.',
    },
    'pleural-effusion': {
      critical: 'Large effusion causing respiratory compromise. Immediate drainage may be needed.',
      moderate: 'Moderate effusion requiring diagnostic thoracentesis to determine etiology.',
      mild: 'Small effusion, clinical correlation needed to determine cause.',
      normal: 'No pleural effusion.',
    },
    'consolidation': {
      critical: 'Extensive consolidation with respiratory failure. ICU-level care may be needed.',
      moderate: 'Pneumonia or other consolidative process requiring treatment.',
      mild: 'Focal consolidation, may represent early pneumonia or atelectasis.',
      normal: 'No consolidation.',
    },
    'fracture': {
      critical: 'Displaced fracture with potential for complications. Orthopedic consultation needed.',
      moderate: 'Fracture requiring pain management and possible immobilization.',
      mild: 'Non-displaced fracture, conservative management likely sufficient.',
      normal: 'No fracture.',
    },
    'mass': {
      critical: 'Large mass with mass effect. Urgent further evaluation needed.',
      moderate: 'Mass requiring tissue diagnosis and staging workup.',
      mild: 'Small mass or nodule requiring follow-up imaging.',
      normal: 'No mass detected.',
    },
    'nodule': {
      critical: 'Large nodule with suspicious features. Urgent biopsy recommended.',
      moderate: 'Nodule requiring follow-up imaging or biopsy.',
      mild: 'Small nodule, follow-up imaging recommended.',
      normal: 'No nodule detected.',
    },
    'atelectasis': {
      critical: 'Complete lobar collapse requiring intervention.',
      moderate: 'Significant atelectasis requiring respiratory therapy.',
      mild: 'Minor atelectasis, may resolve with deep breathing.',
      normal: 'No atelectasis.',
    },
    'cardiomegaly': {
      critical: 'Severe cardiomegaly with signs of heart failure.',
      moderate: 'Moderate cardiomegaly requiring cardiac evaluation.',
      mild: 'Mild cardiomegaly, clinical correlation needed.',
      normal: 'Normal heart size.',
    },
    'edema': {
      critical: 'Severe pulmonary edema requiring immediate treatment.',
      moderate: 'Moderate edema requiring diuretic therapy.',
      mild: 'Mild edema, monitor and treat underlying cause.',
      normal: 'No edema.',
    },
    'pneumonia': {
      critical: 'Severe pneumonia with respiratory compromise.',
      moderate: 'Pneumonia requiring antibiotic therapy.',
      mild: 'Early or resolving pneumonia.',
      normal: 'No pneumonia.',
    },
    'hemorrhage': {
      critical: 'Active hemorrhage requiring immediate intervention.',
      moderate: 'Hemorrhage requiring close monitoring and possible intervention.',
      mild: 'Minor hemorrhage, observation recommended.',
      normal: 'No hemorrhage.',
    },
    'tumor': {
      critical: 'Large tumor with mass effect or invasion.',
      moderate: 'Tumor requiring staging and treatment planning.',
      mild: 'Small tumor or suspicious lesion requiring follow-up.',
      normal: 'No tumor detected.',
    },
    'lesion': {
      critical: 'Large or aggressive-appearing lesion.',
      moderate: 'Lesion requiring further characterization.',
      mild: 'Small lesion, follow-up recommended.',
      normal: 'No lesion detected.',
    },
  };

  const typeSignificance = significanceMap[type];
  if (typeSignificance) {
    return typeSignificance[severity];
  }

  // Default significance
  const defaultMap: Record<SeverityLevel, string> = {
    critical: 'Critical finding requiring immediate clinical attention.',
    moderate: 'Significant finding requiring further evaluation.',
    mild: 'Minor finding, clinical correlation recommended.',
    normal: 'No significant abnormality.',
  };

  return defaultMap[severity];
}

/**
 * Alternative parsing for responses that don't follow the standard format
 */
function parseAlternativeFormat(responseText: string): PathologyFinding[] {
  const findings: PathologyFinding[] = [];

  // Look for coordinate patterns anywhere in the text
  const coordPattern = /\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = coordPattern.exec(responseText)) !== null) {
    const rawYmin = parseInt(match[1]);
    const rawXmin = parseInt(match[2]);
    const rawYmax = parseInt(match[3]);
    const rawXmax = parseInt(match[4]);

    // Validate and constrain coordinates
    const constrained = validateCoordinates(rawYmin, rawXmin, rawYmax, rawXmax);
    if (!constrained) {
      continue;
    }
    
    const { ymin, xmin, ymax, xmax } = constrained;

    // Try to find context around the coordinates
    const matchIndex = match.index;
    const startIndex = Math.max(0, matchIndex - 200);
    const endIndex = Math.min(responseText.length, matchIndex + 100);
    const context = responseText.substring(startIndex, endIndex);

    // Extract description from context
    const lines = context.split('\n');
    const relevantLine = lines.find((line) => line.includes(match![0])) || '';

    // Extract label (look for common medical terms)
    const medicalTerms = [
      'pneumothorax',
      'effusion',
      'consolidation',
      'fracture',
      'mass',
      'nodule',
      'tumor',
      'hemorrhage',
      'lesion',
      'atelectasis',
      'cardiomegaly',
      'edema',
    ];

    let label = 'Finding';
    let type: PathologyType = 'other';
    for (const term of medicalTerms) {
      if (context.toLowerCase().includes(term)) {
        label = term.charAt(0).toUpperCase() + term.slice(1);
        type = determinePathologyType(term, term);
        break;
      }
    }

    // Determine severity from context
    let severity: SeverityLevel = 'moderate';
    const contextLower = context.toLowerCase();
    if (
      contextLower.includes('critical') ||
      contextLower.includes('severe') ||
      contextLower.includes('emergency') ||
      contextLower.includes('life-threatening')
    ) {
      severity = 'critical';
    } else if (contextLower.includes('mild') || contextLower.includes('minor')) {
      severity = 'mild';
    }

    const finding: PathologyFinding = {
      id: uuidv4(),
      type,
      description: relevantLine.trim() || 'Medical finding detected',
      severity,
      location: extractLocation(context),
      boundingBox: {
        ymin,
        xmin,
        ymax,
        xmax,
        label,
        confidence: 0.7,
      },
      confidence: 0.7,
      clinicalSignificance: generateClinicalSignificance(type, severity),
    };

    findings.push(finding);
  }

  return findings;
}

/**
 * Clean and validate findings, applying coordinate constraints
 */
export function cleanFindings(findings: PathologyFinding[]): PathologyFinding[] {
  return findings
    .map((finding) => {
      // Validate and constrain bounding box
      const bb = finding.boundingBox;
      const constrained = validateCoordinates(bb.ymin, bb.xmin, bb.ymax, bb.xmax);
      
      if (!constrained) {
        return null;
      }
      
      // Return finding with constrained coordinates
      return {
        ...finding,
        boundingBox: {
          ...finding.boundingBox,
          ymin: constrained.ymin,
          xmin: constrained.xmin,
          ymax: constrained.ymax,
          xmax: constrained.xmax,
        },
      };
    })
    .filter((finding): finding is PathologyFinding => {
      if (!finding) return false;
      
      // Ensure description is not empty
      if (!finding.description || finding.description.trim().length === 0) {
        return false;
      }

      return true;
    });
}
