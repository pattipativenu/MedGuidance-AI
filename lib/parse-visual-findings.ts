/**
 * Parse Visual Findings from AI Response
 * Extracts bounding box coordinates and annotations from medical image analysis
 * 
 * IMPROVED: Better parsing, validation, and normalization of coordinates
 */

import { VisualFinding, BoundingBox } from "@/components/ui/annotated-image";

/**
 * Normalize and validate coordinates to ensure consistency
 * - Ensures coordinates are within 0-1000 range
 * - Ensures ymax > ymin and xmax > xmin
 * - Ensures minimum box size
 * - CONSTRAINS maximum box size to prevent full-image overlays
 */
function normalizeCoordinates(ymin: number, xmin: number, ymax: number, xmax: number): {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
} | null {
  // Clamp to 0-1000 range
  ymin = Math.max(0, Math.min(1000, ymin));
  xmin = Math.max(0, Math.min(1000, xmin));
  ymax = Math.max(0, Math.min(1000, ymax));
  xmax = Math.max(0, Math.min(1000, xmax));
  
  // Swap if inverted
  if (ymax < ymin) [ymin, ymax] = [ymax, ymin];
  if (xmax < xmin) [xmin, xmax] = [xmax, xmin];
  
  // Ensure minimum box size (50x50)
  const minSize = 50;
  if (ymax - ymin < minSize) {
    const center = (ymin + ymax) / 2;
    ymin = Math.max(0, center - minSize / 2);
    ymax = Math.min(1000, center + minSize / 2);
  }
  if (xmax - xmin < minSize) {
    const center = (xmin + xmax) / 2;
    xmin = Math.max(0, center - minSize / 2);
    xmax = Math.min(1000, center + minSize / 2);
  }
  
  // CRITICAL: Constrain maximum box size to prevent full-image heatmaps
  // Medical findings should be localized, not covering the entire image
  const maxSize = 350; // Maximum 350x350 units (35% of image)
  const width = xmax - xmin;
  const height = ymax - ymin;
  
  if (width > maxSize) {
    const centerX = (xmin + xmax) / 2;
    xmin = Math.max(0, centerX - maxSize / 2);
    xmax = Math.min(1000, centerX + maxSize / 2);
    console.warn(`Bounding box width constrained from ${width} to ${maxSize}`);
  }
  
  if (height > maxSize) {
    const centerY = (ymin + ymax) / 2;
    ymin = Math.max(0, centerY - maxSize / 2);
    ymax = Math.min(1000, centerY + maxSize / 2);
    console.warn(`Bounding box height constrained from ${height} to ${maxSize}`);
  }
  
  // Validate final coordinates
  if (ymax <= ymin || xmax <= xmin) {
    return null;
  }
  
  return { ymin, xmin, ymax, xmax };
}

/**
 * Clean and normalize label text
 */
function cleanLabel(label: string): string {
  return label
    .trim()
    .replace(/\*\*/g, '') // Remove markdown bold
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphen
    .substring(0, 30); // Limit length
}

/**
 * Parse visual findings from AI response text
 * Looks for the **VISUAL FINDINGS:** section and extracts structured data
 */
export function parseVisualFindings(responseText: string): VisualFinding[] {
  const findings: VisualFinding[] = [];

  // Look for the VISUAL FINDINGS section with multiple patterns
  const patterns = [
    /\*\*VISUAL FINDINGS:\*\*([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/i,
    /\*\*VISUAL FINDINGS\*\*:?([\s\S]*?)(?=\n\n\*\*[A-Z]|$)/i,
    /##\s*VISUAL FINDINGS:?([\s\S]*?)(?=\n\n##|$)/i,
    /VISUAL FINDINGS:?\s*\n([\s\S]*?)(?=\n\n[A-Z]|$)/i,
  ];

  let findingsText = "";
  for (const pattern of patterns) {
    const match = responseText.match(pattern);
    if (match) {
      findingsText = match[1];
      break;
    }
  }

  if (!findingsText) {
    console.log("No VISUAL FINDINGS section found in response");
    return findings;
  }

  // Parse each finding line
  // Format: - [Description] | Severity: [level] | Coordinates: [ymin, xmin, ymax, xmax] | Label: [name]
  const findingLines = findingsText.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("-") || trimmed.match(/^\d+\./);
  });

  console.log(`Found ${findingLines.length} potential finding lines`);

  findingLines.forEach((line) => {
    try {
      // Extract description (everything before the first |)
      const descMatch = line.match(/^[-\d.]\s*([^|]+)/);
      let description = descMatch ? descMatch[1].trim() : "";
      
      // Clean up description
      description = description.replace(/\*\*/g, '').trim();

      // Extract severity with fallback
      const severityMatch = line.match(/Severity:\s*(critical|moderate|mild|normal)/i);
      const severity = (severityMatch
        ? severityMatch[1].toLowerCase()
        : "moderate") as "critical" | "moderate" | "mild" | "normal";

      // Extract coordinates [ymin, xmin, ymax, xmax] - try multiple formats
      let coordsMatch = line.match(/Coordinates:\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/);
      if (!coordsMatch) {
        // Try without "Coordinates:" prefix
        coordsMatch = line.match(/\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/);
      }
      
      if (!coordsMatch) {
        console.warn("No coordinates found in finding:", line);
        return;
      }

      const rawYmin = parseInt(coordsMatch[1]);
      const rawXmin = parseInt(coordsMatch[2]);
      const rawYmax = parseInt(coordsMatch[3]);
      const rawXmax = parseInt(coordsMatch[4]);

      // Normalize and validate coordinates
      const normalized = normalizeCoordinates(rawYmin, rawXmin, rawYmax, rawXmax);
      if (!normalized) {
        console.warn("Invalid coordinates after normalization:", line);
        return;
      }

      // Extract label with fallback
      const labelMatch = line.match(/Label:\s*([^\n|]+)/);
      let label = labelMatch ? cleanLabel(labelMatch[1]) : "";
      
      // If no label, generate from description
      if (!label && description) {
        // Extract key medical terms for label
        const medicalTerms = description.match(/\b(mass|lesion|nodule|tumor|fracture|pneumothorax|effusion|consolidation|opacity|cardiomegaly|atelectasis|hemorrhage|infarct|edema|abscess|cyst|collapse|hilar)\b/i);
        if (medicalTerms) {
          label = medicalTerms[1].charAt(0).toUpperCase() + medicalTerms[1].slice(1);
        } else {
          label = description.substring(0, 20);
        }
      }
      
      // Extract image index (for multi-image analysis)
      // Format: "| Image: 1" or "| Image: 2"
      const imageMatch = line.match(/Image:\s*(\d+)/i);
      const fileIndex = imageMatch ? parseInt(imageMatch[1]) - 1 : 0; // Convert to 0-based index

      // Create bounding box
      const boundingBox: BoundingBox = {
        ymin: normalized.ymin,
        xmin: normalized.xmin,
        ymax: normalized.ymax,
        xmax: normalized.xmax,
        label,
      };

      const boxWidth = normalized.xmax - normalized.xmin;
      const boxHeight = normalized.ymax - normalized.ymin;
      console.log(`Parsed finding: ${label} at [${normalized.ymin}, ${normalized.xmin}, ${normalized.ymax}, ${normalized.xmax}] (${boxWidth}x${boxHeight}) for Image ${fileIndex + 1}`);

      // Create finding
      findings.push({
        fileIndex, // Use extracted image index (0-based)
        description,
        severity,
        boundingBoxes: [boundingBox],
      });
    } catch (error) {
      console.error("Error parsing finding line:", line, error);
    }
  });

  return findings;
}

/**
 * Alternative: Parse using regex for more flexible formats
 * This is a fallback parser that looks for coordinate patterns anywhere in the text
 */
export function parseVisualFindingsFlexible(responseText: string): VisualFinding[] {
  const findings: VisualFinding[] = [];
  const seenCoordinates = new Set<string>(); // Prevent duplicates

  // Look for coordinate patterns anywhere in the text
  const coordPattern = /\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = coordPattern.exec(responseText)) !== null) {
    const rawYmin = parseInt(match[1]);
    const rawXmin = parseInt(match[2]);
    const rawYmax = parseInt(match[3]);
    const rawXmax = parseInt(match[4]);

    // Skip if we've already seen these coordinates
    const coordKey = `${rawYmin},${rawXmin},${rawYmax},${rawXmax}`;
    if (seenCoordinates.has(coordKey)) {
      continue;
    }
    seenCoordinates.add(coordKey);

    // Normalize coordinates
    const normalized = normalizeCoordinates(rawYmin, rawXmin, rawYmax, rawXmax);
    if (!normalized) {
      continue;
    }

    // Try to find context around the coordinates
    const matchIndex = match.index || 0;
    const matchText = match[0];
    const startIndex = Math.max(0, matchIndex - 300);
    const endIndex = Math.min(responseText.length, matchIndex + 150);
    const context = responseText.substring(startIndex, endIndex);

    // Extract description from context
    const lines = context.split("\n");
    const relevantLine = lines.find((line) => line.includes(matchText)) || "";
    
    // Clean up the description
    let description = relevantLine
      .replace(/\*\*/g, '')
      .replace(/\|.*$/, '') // Remove everything after |
      .replace(/^[-\d.]\s*/, '') // Remove leading bullet/number
      .trim();

    // Extract label (look for common medical terms with priority)
    const medicalTerms = [
      { term: "brainstem", label: "Brainstem" },
      { term: "mass", label: "Mass" },
      { term: "lesion", label: "Lesion" },
      { term: "tumor", label: "Tumor" },
      { term: "nodule", label: "Nodule" },
      { term: "fracture", label: "Fracture" },
      { term: "pneumothorax", label: "Pneumothorax" },
      { term: "consolidation", label: "Consolidation" },
      { term: "effusion", label: "Effusion" },
      { term: "opacity", label: "Opacity" },
      { term: "infiltrate", label: "Infiltrate" },
      { term: "cardiomegaly", label: "Cardiomegaly" },
      { term: "atelectasis", label: "Atelectasis" },
      { term: "hemorrhage", label: "Hemorrhage" },
      { term: "infarct", label: "Infarct" },
      { term: "edema", label: "Edema" },
      { term: "abscess", label: "Abscess" },
      { term: "cyst", label: "Cyst" },
      { term: "schwannoma", label: "Schwannoma" },
      { term: "meningioma", label: "Meningioma" },
      { term: "glioma", label: "Glioma" },
    ];

    let label = "Finding";
    const contextLower = context.toLowerCase();
    
    // Try to find a label from the Label: field first
    const labelMatch = context.match(/Label:\s*([^\n|]+)/i);
    if (labelMatch) {
      label = cleanLabel(labelMatch[1]);
    } else {
      // Fall back to medical term detection
      for (const { term, label: termLabel } of medicalTerms) {
        if (contextLower.includes(term)) {
          // Check if there's a compound term (e.g., "brainstem mass")
          const compoundMatch = contextLower.match(new RegExp(`(\\w+\\s+)?${term}(\\s+\\w+)?`, 'i'));
          if (compoundMatch) {
            const compound = compoundMatch[0].trim();
            // Capitalize each word
            label = compound.split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
              .substring(0, 25);
          } else {
            label = termLabel;
          }
          break;
        }
      }
    }

    // Determine severity from context
    let severity: "critical" | "moderate" | "mild" | "normal" = "moderate";
    const severityMatch = context.match(/Severity:\s*(critical|moderate|mild|normal)/i);
    if (severityMatch) {
      severity = severityMatch[1].toLowerCase() as typeof severity;
    } else if (
      contextLower.includes("critical") ||
      contextLower.includes("severe") ||
      contextLower.includes("emergency") ||
      contextLower.includes("urgent")
    ) {
      severity = "critical";
    } else if (
      contextLower.includes("mild") || 
      contextLower.includes("minor") ||
      contextLower.includes("small")
    ) {
      severity = "mild";
    }

    // Extract image index from context
    const imageMatch = context.match(/Image:\s*(\d+)/i);
    const fileIndex = imageMatch ? parseInt(imageMatch[1]) - 1 : 0;

    const boxWidth = normalized.xmax - normalized.xmin;
    const boxHeight = normalized.ymax - normalized.ymin;
    console.log(`Flexible parsed: ${label} at [${normalized.ymin}, ${normalized.xmin}, ${normalized.ymax}, ${normalized.xmax}] (${boxWidth}x${boxHeight}) for Image ${fileIndex + 1}`);

    findings.push({
      fileIndex,
      description: description || "Medical finding detected",
      severity,
      boundingBoxes: [
        {
          ymin: normalized.ymin,
          xmin: normalized.xmin,
          ymax: normalized.ymax,
          xmax: normalized.xmax,
          label,
        },
      ],
    });
  }

  return findings;
}

/**
 * Validate bounding box coordinates
 */
export function validateBoundingBox(box: BoundingBox): boolean {
  // Check if coordinates are within 0-1000 range
  if (box.ymin < 0 || box.ymin > 1000) return false;
  if (box.xmin < 0 || box.xmin > 1000) return false;
  if (box.ymax < 0 || box.ymax > 1000) return false;
  if (box.xmax < 0 || box.xmax > 1000) return false;

  // Check if box has valid dimensions
  if (box.ymax <= box.ymin) return false;
  if (box.xmax <= box.xmin) return false;

  return true;
}

/**
 * Clean and validate findings
 */
export function cleanVisualFindings(findings: VisualFinding[]): VisualFinding[] {
  return findings
    .map((finding) => ({
      ...finding,
      boundingBoxes: finding.boundingBoxes.filter(validateBoundingBox),
    }))
    .filter((finding) => finding.boundingBoxes.length > 0);
}
