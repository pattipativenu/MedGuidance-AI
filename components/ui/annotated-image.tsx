"use client";

import { motion } from "framer-motion";

export interface BoundingBox {
  ymin: number; // 0-1000 scale
  xmin: number;
  ymax: number;
  xmax: number;
  label: string;
  confidence?: number;
}

export interface VisualFinding {
  fileIndex: number;
  description: string;
  severity: "critical" | "moderate" | "mild" | "normal";
  boundingBoxes: BoundingBox[];
}

interface AnnotatedImageProps {
  imageUrl: string; // base64 image data
  findings: VisualFinding[];
  fileIndex: number;
}

/**
 * AnnotatedImage Component
 * Displays medical images with AI-detected pathology annotations
 * - Red bounding boxes around areas of concern
 * - Arrows pointing to specific findings
 * - Labels with severity indicators
 */
export const AnnotatedImage: React.FC<AnnotatedImageProps> = ({
  imageUrl,
  findings,
  fileIndex,
}) => {
  // Filter findings relevant to this specific image
  const relevantFindings = findings.filter((f) => f.fileIndex === fileIndex);

  if (relevantFindings.length === 0) {
    // No annotations - just show the image
    return (
      <div className="relative inline-block w-full rounded-lg overflow-hidden bg-black">
        <img
          src={`data:image/png;base64,${imageUrl}`}
          alt={`Medical Image ${fileIndex + 1}`}
          className="w-full h-auto"
        />
      </div>
    );
  }

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#ef4444"; // red-500
      case "moderate":
        return "#f97316"; // orange-500
      case "mild":
        return "#eab308"; // yellow-500
      case "normal":
        return "#22c55e"; // green-500
      default:
        return "#ef4444";
    }
  };

  return (
    <div className="relative inline-block w-full rounded-lg overflow-hidden bg-black group">
      {/* The Original Medical Image */}
      <img
        src={`data:image/png;base64,${imageUrl}`}
        alt={`Medical Image ${fileIndex + 1}`}
        className="w-full h-auto"
      />

      {/* SVG Overlay Layer for Annotations */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1000 1000" // Matches the 0-1000 scale from Gemini
        preserveAspectRatio="none"
      >
        {relevantFindings.map((finding, i) =>
          finding.boundingBoxes.map((box, j) => {
            // Calculate center point and dimensions
            const centerX = (box.xmin + box.xmax) / 2;
            const centerY = (box.ymin + box.ymax) / 2;
            const width = box.xmax - box.xmin;
            const height = box.ymax - box.ymin;

            // Arrow positioning (pointing from top-right)
            const arrowStartX = box.xmax + 100;
            const arrowStartY = centerY - 100;
            const arrowEndX = box.xmax;
            const arrowEndY = centerY;

            const color = getSeverityColor(finding.severity);

            return (
              <motion.g
                key={`${i}-${j}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.2 }}
              >
                {/* Pulsing Glow Effect */}
                <rect
                  x={box.xmin - 10}
                  y={box.ymin - 10}
                  width={width + 20}
                  height={height + 20}
                  fill={color}
                  opacity="0.1"
                  rx="15"
                  className="animate-pulse"
                />

                {/* The Red Dotted Bounding Box */}
                <rect
                  x={box.xmin}
                  y={box.ymin}
                  width={width}
                  height={height}
                  fill="none"
                  stroke={color}
                  strokeWidth="6"
                  rx="10"
                  strokeDasharray="15,5"
                  className="animate-pulse-slow"
                />

                {/* Corner Markers (for emphasis) */}
                {/* Top-left */}
                <line
                  x1={box.xmin}
                  y1={box.ymin}
                  x2={box.xmin + 30}
                  y2={box.ymin}
                  stroke={color}
                  strokeWidth="8"
                />
                <line
                  x1={box.xmin}
                  y1={box.ymin}
                  x2={box.xmin}
                  y2={box.ymin + 30}
                  stroke={color}
                  strokeWidth="8"
                />

                {/* Top-right */}
                <line
                  x1={box.xmax}
                  y1={box.ymin}
                  x2={box.xmax - 30}
                  y2={box.ymin}
                  stroke={color}
                  strokeWidth="8"
                />
                <line
                  x1={box.xmax}
                  y1={box.ymin}
                  x2={box.xmax}
                  y2={box.ymin + 30}
                  stroke={color}
                  strokeWidth="8"
                />

                {/* Bottom-left */}
                <line
                  x1={box.xmin}
                  y1={box.ymax}
                  x2={box.xmin + 30}
                  y2={box.ymax}
                  stroke={color}
                  strokeWidth="8"
                />
                <line
                  x1={box.xmin}
                  y1={box.ymax}
                  x2={box.xmin}
                  y2={box.ymax - 30}
                  stroke={color}
                  strokeWidth="8"
                />

                {/* Bottom-right */}
                <line
                  x1={box.xmax}
                  y1={box.ymax}
                  x2={box.xmax - 30}
                  y2={box.ymax}
                  stroke={color}
                  strokeWidth="8"
                />
                <line
                  x1={box.xmax}
                  y1={box.ymax}
                  x2={box.xmax}
                  y2={box.ymax - 30}
                  stroke={color}
                  strokeWidth="8"
                />

                {/* The Arrow Pointing to the Finding */}
                <line
                  x1={arrowStartX}
                  y1={arrowStartY}
                  x2={arrowEndX}
                  y2={arrowEndY}
                  stroke={color}
                  strokeWidth="8"
                  markerEnd={`url(#arrowhead-${i}-${j})`}
                />

                {/* Label Background */}
                <rect
                  x={arrowStartX - 10}
                  y={arrowStartY - 50}
                  width={box.label.length * 15 + 20}
                  height="45"
                  fill={color}
                  rx="8"
                  opacity="0.9"
                />

                {/* The Text Label */}
                <text
                  x={arrowStartX}
                  y={arrowStartY - 20}
                  fill="white"
                  fontSize="30"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {box.label}
                </text>

                {/* Confidence Score (if available) */}
                {box.confidence && (
                  <text
                    x={arrowStartX}
                    y={arrowStartY + 10}
                    fill="white"
                    fontSize="20"
                    fontFamily="sans-serif"
                  >
                    {Math.round(box.confidence * 100)}% confidence
                  </text>
                )}

                {/* Arrowhead Definition */}
                <defs>
                  <marker
                    id={`arrowhead-${i}-${j}`}
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill={color} />
                  </marker>
                </defs>
              </motion.g>
            );
          })
        )}
      </svg>

      {/* Findings Legend (Bottom Overlay) - Always visible */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 pt-8">
        <h4 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Detected Findings:
        </h4>
        <div className="space-y-2">
          {relevantFindings.map((finding, i) => (
            <div key={i} className="flex items-start gap-2 text-white text-sm">
              <span
                className="inline-block w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ring-2 ring-white/30"
                style={{ backgroundColor: getSeverityColor(finding.severity) }}
              />
              <div className="flex-1 min-w-0">
                <span 
                  className="font-semibold px-1.5 py-0.5 rounded text-xs mr-2"
                  style={{ 
                    backgroundColor: getSeverityColor(finding.severity),
                    color: 'white'
                  }}
                >
                  {finding.severity.toUpperCase()}
                </span>
                <span className="text-white/90 leading-relaxed">
                  {finding.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Add custom animation to globals.css
// @keyframes pulse-slow {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0.5; }
// }
// .animate-pulse-slow {
//   animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
// }
