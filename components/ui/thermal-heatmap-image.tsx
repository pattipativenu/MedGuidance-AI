"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

export interface HeatmapRegion {
  // Center point of the finding (0-1000 scale)
  centerX: number;
  centerY: number;
  // Radius of the affected area
  radius: number;
  // Intensity of the finding (0-1, where 1 is most severe)
  intensity: number;
  // Label for the finding
  label: string;
  // Severity level
  severity: "critical" | "moderate" | "mild" | "normal";
  // Description
  description: string;
  // Confidence score (0-1)
  confidence?: number;
}

export interface VisualFinding {
  fileIndex: number;
  description: string;
  severity: "critical" | "moderate" | "mild" | "normal";
  boundingBoxes: Array<{
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
    label: string;
    confidence?: number;
  }>;
}

interface ThermalHeatmapImageProps {
  imageUrl: string; // base64 image data
  findings: VisualFinding[];
  fileIndex: number;
  showHeatmap?: boolean;
  heatmapOpacity?: number;
  compact?: boolean; // For side-by-side layout with smaller images
}

/**
 * Convert bounding box to heatmap region
 * Uses TIGHT radius calculation for precise localization
 */
function boundingBoxToHeatmapRegion(
  box: VisualFinding["boundingBoxes"][0],
  severity: VisualFinding["severity"],
  description: string
): HeatmapRegion {
  const centerX = (box.xmin + box.xmax) / 2;
  const centerY = (box.ymin + box.ymax) / 2;
  const width = box.xmax - box.xmin;
  const height = box.ymax - box.ymin;
  
  // Use the AVERAGE of width and height, not max, for more accurate representation
  // Also cap the radius to prevent overly large heatmaps
  const rawRadius = (width + height) / 4; // Average radius
  const maxRadius = 150; // Maximum radius to prevent full-image coverage
  const radius = Math.min(rawRadius, maxRadius);

  // Map severity to intensity
  const intensityMap: Record<string, number> = {
    critical: 1.0,
    moderate: 0.7,
    mild: 0.4,
    normal: 0.1,
  };

  console.log(`Heatmap region: ${box.label} at (${centerX}, ${centerY}) with radius ${radius} (raw: ${rawRadius})`);

  return {
    centerX,
    centerY,
    radius,
    intensity: intensityMap[severity] || 0.5,
    label: box.label,
    severity,
    description,
    confidence: box.confidence,
  };
}

/**
 * Get color for intensity value using thermal gradient
 * Blue (cold/normal) -> Cyan -> Green -> Yellow -> Orange -> Red (hot/critical)
 */
function getHeatmapColor(intensity: number): { r: number; g: number; b: number } {
  // Clamp intensity between 0 and 1
  intensity = Math.max(0, Math.min(1, intensity));

  // Thermal color stops (similar to medical imaging thermal maps)
  // 0.0 = Blue (normal)
  // 0.25 = Cyan
  // 0.5 = Green/Yellow
  // 0.75 = Orange
  // 1.0 = Red (critical)

  let r: number, g: number, b: number;

  if (intensity < 0.25) {
    // Blue to Cyan
    const t = intensity / 0.25;
    r = 0;
    g = Math.round(255 * t);
    b = 255;
  } else if (intensity < 0.5) {
    // Cyan to Green
    const t = (intensity - 0.25) / 0.25;
    r = 0;
    g = 255;
    b = Math.round(255 * (1 - t));
  } else if (intensity < 0.75) {
    // Green to Yellow
    const t = (intensity - 0.5) / 0.25;
    r = Math.round(255 * t);
    g = 255;
    b = 0;
  } else {
    // Yellow to Red
    const t = (intensity - 0.75) / 0.25;
    r = 255;
    g = Math.round(255 * (1 - t));
    b = 0;
  }

  return { r, g, b };
}

/**
 * ThermalHeatmapImage Component
 * Displays medical images with AI-detected pathology as thermal heatmap overlays
 * Similar to professional medical imaging software
 */
export const ThermalHeatmapImage: React.FC<ThermalHeatmapImageProps> = ({
  imageUrl,
  findings,
  fileIndex,
  showHeatmap = true,
  heatmapOpacity = 0.6,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [showOverlay, setShowOverlay] = useState(showHeatmap);

  // Filter findings relevant to this specific image
  const relevantFindings = findings.filter((f) => f.fileIndex === fileIndex);

  // Convert findings to heatmap regions
  const heatmapRegions: HeatmapRegion[] = relevantFindings.flatMap((finding) =>
    finding.boundingBoxes.map((box) =>
      boundingBoxToHeatmapRegion(box, finding.severity, finding.description)
    )
  );

  // Draw heatmap on canvas
  useEffect(() => {
    if (!canvasRef.current || !imageLoaded || heatmapRegions.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showOverlay) return;

    // Create heatmap using radial gradients
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    // Scale factor from 0-1000 coordinate system to canvas pixels
    const scaleX = canvas.width / 1000;
    const scaleY = canvas.height / 1000;

    // For each pixel, calculate the combined heat from all regions
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        let totalHeat = 0;

        // Convert pixel coordinates to 0-1000 scale
        const normX = x / scaleX;
        const normY = y / scaleY;

        // Calculate heat contribution from each region
        for (const region of heatmapRegions) {
          const dx = normX - region.centerX;
          const dy = normY - region.centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // TIGHTER Gaussian falloff - heat should be concentrated on the finding
          // Use a smaller sigma (radius * 0.6) for more focused heatmaps
          const sigma = region.radius * 0.6; // Tighter spread
          const maxDistance = region.radius * 1.2; // Limit the spread distance
          
          if (distance < maxDistance) {
            // Sharper Gaussian falloff for more precise localization
            const falloff = Math.exp(-(distance * distance) / (2 * sigma * sigma));
            // Apply a threshold to cut off very low values
            if (falloff > 0.1) {
              totalHeat += region.intensity * falloff;
            }
          }
        }

        // Clamp total heat
        totalHeat = Math.min(1, totalHeat);

        if (totalHeat > 0.05) {
          // Only draw if there's significant heat
          const color = getHeatmapColor(totalHeat);
          const idx = (y * canvas.width + x) * 4;

          data[idx] = color.r;
          data[idx + 1] = color.g;
          data[idx + 2] = color.b;
          data[idx + 3] = Math.round(totalHeat * 255 * heatmapOpacity);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [imageLoaded, heatmapRegions, showOverlay, heatmapOpacity, imageDimensions]);

  // Handle image load
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);

    // Set canvas size to match image
    if (canvasRef.current) {
      canvasRef.current.width = img.clientWidth;
      canvasRef.current.height = img.clientHeight;
    }
  };

  // Get severity color for legend
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444"; // red
      case "moderate":
        return "#f97316"; // orange
      case "mild":
        return "#eab308"; // yellow
      case "normal":
        return "#22c55e"; // green
      default:
        return "#3b82f6"; // blue
    }
  };

  // No findings - just show the image
  if (relevantFindings.length === 0) {
    return (
      <div className={`relative inline-block w-full rounded-lg overflow-hidden bg-black ${compact ? 'max-h-[350px]' : ''}`}>
        <img
          src={`data:image/png;base64,${imageUrl}`}
          alt={`Medical Image ${fileIndex + 1}`}
          className={`w-full ${compact ? 'h-full object-contain' : 'h-auto'}`}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-3">
          <div className={`flex items-center gap-2 text-green-400 ${compact ? 'text-sm' : ''}`}>
            <svg className={`${compact ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">No significant abnormalities detected</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative inline-block w-full rounded-lg overflow-hidden bg-black group ${compact ? 'max-h-[350px]' : ''}`}>
      {/* Original Medical Image */}
      <img
        src={`data:image/png;base64,${imageUrl}`}
        alt={`Medical Image ${fileIndex + 1}`}
        className={`w-full ${compact ? 'h-full object-contain' : 'h-auto'}`}
        onLoad={handleImageLoad}
      />

      {/* Thermal Heatmap Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300"
        style={{ opacity: showOverlay ? 1 : 0 }}
      />

      {/* Toggle Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-lg font-medium flex items-center gap-1.5 transition-colors`}
        onClick={() => setShowOverlay(!showOverlay)}
      >
        {showOverlay ? (
          <>
            <svg className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            {compact ? 'Hide' : 'Hide Heatmap'}
          </>
        ) : (
          <>
            <svg className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {compact ? 'Show' : 'Show Heatmap'}
          </>
        )}
      </motion.button>

      {/* Color Scale Legend */}
      <div className={`absolute top-2 left-2 bg-black/70 rounded-lg ${compact ? 'p-1.5' : 'p-2'}`}>
        <div className={`text-white font-medium mb-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>Severity Scale</div>
        <div className="flex items-center gap-1">
          <div className={`${compact ? 'w-14 h-2' : 'w-20 h-3'} rounded`} style={{
            background: "linear-gradient(to right, #3b82f6, #06b6d4, #22c55e, #eab308, #f97316, #ef4444)"
          }} />
        </div>
        <div className={`flex justify-between text-gray-300 mt-0.5 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
          <span>Normal</span>
          <span>Critical</span>
        </div>
      </div>

      {/* AI Analysis Badge */}
      <div className={`absolute top-2 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'} rounded-full font-medium flex items-center gap-1`}>
        <svg className={`${compact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {compact ? 'AI-Detected' : 'AI-Detected Regions'}
      </div>

      {/* Findings Legend (Bottom Overlay) */}
      <div className={`absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/70 to-transparent ${compact ? 'p-2 pt-4' : 'p-4 pt-8'}`}>
        <h4 className={`text-white font-semibold ${compact ? 'mb-1.5 text-xs' : 'mb-3 text-sm'} flex items-center gap-2`}>
          <svg className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Detected Findings ({relevantFindings.length})
        </h4>
        <div className={`space-y-1.5 ${compact ? 'max-h-20' : 'max-h-32'} overflow-y-auto`}>
          {relevantFindings.map((finding, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-start gap-2 text-white ${compact ? 'text-xs' : 'text-sm'}`}
            >
              <span
                className={`inline-block ${compact ? 'w-2 h-2' : 'w-3 h-3'} rounded-full mt-0.5 shrink-0 ring-2 ring-white/30`}
                style={{ backgroundColor: getSeverityColor(finding.severity) }}
              />
              <div className="flex-1 min-w-0">
                <span
                  className={`font-semibold px-1 py-0.5 rounded ${compact ? 'text-[10px]' : 'text-xs'} mr-1`}
                  style={{
                    backgroundColor: getSeverityColor(finding.severity),
                    color: "white",
                  }}
                >
                  {finding.severity.toUpperCase()}
                </span>
                <span className={`text-white/90 leading-relaxed ${compact ? 'line-clamp-1' : ''}`}>{finding.description}</span>
                {!compact && finding.boundingBoxes[0]?.confidence && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({Math.round(finding.boundingBoxes[0].confidence * 100)}% confidence)
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ThermalHeatmapImage;
