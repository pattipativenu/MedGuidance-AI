"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, AlertTriangle, CheckCircle, Activity, Zap, Thermometer, Eye, EyeOff } from "lucide-react";

// Types
interface ChainOfThoughtStep {
  step: number;
  phase: "initialization" | "normalization" | "landmark" | "observation" | "analysis" | "conclusion";
  message: string;
  timestamp: number;
  status: "pending" | "processing" | "complete" | "critical";
}

interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  label: string;
}

interface AnatomicalLocation {
  zone: string;
  side: "left" | "right" | "bilateral" | "central";
  description: string;
}

interface RadiologyFinding {
  id: string;
  type: string;
  location: AnatomicalLocation;
  description: string;
  severity: "critical" | "moderate" | "mild" | "normal";
  confidence: number;
  boundingBox?: BoundingBox;
}

interface DiagnosticReport {
  primaryFinding: string;
  etiology: string;
  confidence: number;
  urgency: "emergent" | "urgent" | "routine" | "normal";
  recommendations: string[];
  differentialDiagnosis: string[];
  clinicalNotes: string;
}

interface EnhancedImage {
  original: string;
  enhanced: string;
  viewType: "PA" | "AP" | "Lateral" | "Unknown";
  dimensions: { width: number; height: number };
}

export interface RadiologyTriageResult {
  analysisId: string;
  timestamp: string;
  processingTimeMs: number;
  chainOfThought: ChainOfThoughtStep[];
  findings: RadiologyFinding[];
  report: DiagnosticReport;
  enhancedImages: EnhancedImage[];
  rawResponse?: string;
}

interface RadiologyViewerProps {
  result: RadiologyTriageResult;
  onClose: () => void;
}


export const RadiologyViewer: React.FC<RadiologyViewerProps> = ({ result, onClose }) => {
  const [visibleSteps, setVisibleSteps] = useState<ChainOfThoughtStep[]>([]);
  const [isAnimating, setIsAnimating] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 800 });
  const logRef = useRef<HTMLDivElement>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAnimating || result.chainOfThought.length === 0) {
      setVisibleSteps(result.chainOfThought);
      setShowReport(true);
      return;
    }

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < result.chainOfThought.length) {
        setVisibleSteps(prev => [...prev, result.chainOfThought[stepIndex]]);
        stepIndex++;
        if (logRef.current) {
          logRef.current.scrollTop = logRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
        setIsAnimating(false);
        setTimeout(() => setShowReport(true), 500);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [result.chainOfThought, isAnimating]);

  const resetAnimation = () => {
    setVisibleSteps([]);
    setShowReport(false);
    setIsAnimating(true);
  };

  const skipAnimation = () => {
    setVisibleSteps(result.chainOfThought);
    setIsAnimating(false);
    setShowReport(true);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "emergent": return "bg-red-500";
      case "urgent": return "bg-orange-500";
      case "routine": return "bg-yellow-500";
      default: return "bg-green-500";
    }
  };

  const getUrgencyBg = (urgency: string) => {
    switch (urgency) {
      case "emergent": return "bg-red-500/10 border-red-500/30";
      case "urgent": return "bg-orange-500/10 border-orange-500/30";
      case "routine": return "bg-yellow-500/10 border-yellow-500/30";
      default: return "bg-green-500/10 border-green-500/30";
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case "critical":
        return <AlertTriangle className="w-3 h-3 text-red-400" />;
      case "complete":
        return <CheckCircle className="w-3 h-3 text-green-400" />;
      case "processing":
        return <Activity className="w-3 h-3 text-blue-400 animate-pulse" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-gray-500" />;
    }
  };

  const primaryImage = result.enhancedImages[0];

  // Update canvas size when container resizes
  useEffect(() => {
    if (!imageContainerRef.current) return;
    
    const updateSize = () => {
      if (imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Draw thermal heatmap overlay for findings
  useEffect(() => {
    if (!heatmapCanvasRef.current || !showHeatmap || !showReport) return;
    if (result.findings.length === 0) return;

    const canvas = heatmapCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use the tracked canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get color based on severity - thermal gradient colors
    const getHeatColors = (severity: string) => {
      switch (severity) {
        case "critical": 
          return { inner: { r: 255, g: 0, b: 0 }, mid: { r: 255, g: 100, b: 0 }, outer: { r: 255, g: 200, b: 0 } };
        case "moderate": 
          return { inner: { r: 255, g: 140, b: 0 }, mid: { r: 255, g: 200, b: 0 }, outer: { r: 200, g: 255, b: 0 } };
        case "mild": 
          return { inner: { r: 255, g: 255, b: 0 }, mid: { r: 150, g: 255, b: 0 }, outer: { r: 0, g: 255, b: 100 } };
        default: 
          return { inner: { r: 0, g: 255, b: 0 }, mid: { r: 0, g: 200, b: 100 }, outer: { r: 0, g: 150, b: 150 } };
      }
    };

    // Draw heatmap for each finding
    result.findings.forEach((finding) => {
      if (!finding.boundingBox) return;
      
      const box = finding.boundingBox;
      
      // Convert from 0-1000 scale to canvas pixels
      const centerX = ((box.xmin + box.xmax) / 2 / 1000) * canvas.width;
      const centerY = ((box.ymin + box.ymax) / 2 / 1000) * canvas.height;
      const boxWidth = ((box.xmax - box.xmin) / 1000) * canvas.width;
      const boxHeight = ((box.ymax - box.ymin) / 1000) * canvas.height;
      
      // Use the larger dimension for radius, with some padding
      const radius = Math.max(boxWidth, boxHeight) * 0.7;

      const colors = getHeatColors(finding.severity);
      
      // Create multi-stop radial gradient for realistic thermal effect
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, `rgba(${colors.inner.r}, ${colors.inner.g}, ${colors.inner.b}, 0.8)`);
      gradient.addColorStop(0.3, `rgba(${colors.inner.r}, ${colors.inner.g}, ${colors.inner.b}, 0.6)`);
      gradient.addColorStop(0.5, `rgba(${colors.mid.r}, ${colors.mid.g}, ${colors.mid.b}, 0.4)`);
      gradient.addColorStop(0.7, `rgba(${colors.outer.r}, ${colors.outer.g}, ${colors.outer.b}, 0.2)`);
      gradient.addColorStop(1, `rgba(${colors.outer.r}, ${colors.outer.g}, ${colors.outer.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      
      console.log(`Drew heatmap for ${finding.id} at (${centerX.toFixed(0)}, ${centerY.toFixed(0)}) radius ${radius.toFixed(0)}`);
    });
  }, [result.findings, showHeatmap, showReport, canvasSize]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400 text-sm font-medium">LIVE SYSTEM READY</span>
              </div>
              <div className="text-gray-400 text-sm">
                Analysis ID: {result.analysisId.slice(0, 20)}...
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={resetAnimation}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Reset"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              {isAnimating && (
                <button
                  onClick={skipAnimation}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white transition-colors"
                >
                  Skip Animation
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>


          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 max-h-[calc(90vh-80px)] overflow-hidden">
            {/* Left: X-Ray Image */}
            <div className="bg-black p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 text-sm font-medium">
                    {result.findings.length > 0 ? result.findings[0].location?.zone || "CHEST" : "CHEST"} VIEW
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Toggle Original/Enhanced */}
                  <button
                    onClick={() => setShowOriginal(!showOriginal)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      showOriginal ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {showOriginal ? "ORIGINAL" : "ENHANCED"}
                  </button>
                  {/* Toggle Heatmap */}
                  <button
                    onClick={() => setShowHeatmap(!showHeatmap)}
                    className={`p-1.5 rounded transition-colors ${
                      showHeatmap ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                    title={showHeatmap ? "Hide Heatmap" : "Show Heatmap"}
                  >
                    <Thermometer className="w-4 h-4" />
                  </button>
                  <span className="text-gray-500 text-xs">{result.processingTimeMs.toFixed(0)}ms</span>
                </div>
              </div>
              
              {/* AI Assistant Warning - Above Image */}
              <div className="mb-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-amber-200 text-xs font-medium">
                    AI assistant - Verify with radiologist
                  </span>
                </div>
              </div>
              
              <div 
                ref={imageContainerRef}
                className="relative flex-1 rounded-xl overflow-hidden bg-gray-900 border border-gray-700"
              >
                {primaryImage ? (
                  <>
                    {/* X-Ray Image (Original or Enhanced) */}
                    <img
                      src={`data:image/${primaryImage.enhanced.startsWith("/9j/") ? "jpeg" : "png"};base64,${showOriginal ? primaryImage.original : primaryImage.enhanced}`}
                      alt={showOriginal ? "Original X-Ray" : "Enhanced X-Ray"}
                      className="w-full h-full object-contain"
                    />
                    
                    {/* Thermal Heatmap Canvas Overlay */}
                    <canvas
                      ref={heatmapCanvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300 ${
                        showHeatmap && showReport ? "opacity-100" : "opacity-0"
                      }`}
                      style={{ mixBlendMode: "screen" }}
                    />
                    
                    {/* Bounding Box SVG Overlay */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 1000 1000"
                      preserveAspectRatio="none"
                    >
                      {result.findings.map((finding, i) => {
                        if (!finding.boundingBox) return null;
                        const box = finding.boundingBox;
                        const color = finding.severity === "critical" ? "#ef4444" :
                                     finding.severity === "moderate" ? "#f97316" :
                                     finding.severity === "mild" ? "#eab308" : "#22c55e";
                        
                        return (
                          <motion.g
                            key={finding.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: showReport ? 1 : 0 }}
                            transition={{ delay: i * 0.2 }}
                          >
                            <rect
                              x={box.xmin}
                              y={box.ymin}
                              width={box.xmax - box.xmin}
                              height={box.ymax - box.ymin}
                              fill="none"
                              stroke={color}
                              strokeWidth="4"
                              strokeDasharray="10,5"
                              className="animate-pulse"
                            />
                            <rect
                              x={box.xmin}
                              y={box.ymin - 35}
                              width={box.label.length * 12 + 20}
                              height="30"
                              fill={color}
                              rx="4"
                            />
                            <text
                              x={box.xmin + 10}
                              y={box.ymin - 12}
                              fill="white"
                              fontSize="18"
                              fontWeight="bold"
                            >
                              {box.label}
                            </text>
                          </motion.g>
                        );
                      })}
                    </svg>

                    {/* Thermal Scale Legend */}
                    {showHeatmap && result.findings.length > 0 && (
                      <div className="absolute top-3 left-3 bg-black/70 rounded-lg p-2">
                        <div className="text-white text-xs font-medium mb-1">Severity Scale</div>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-2 rounded" style={{
                            background: "linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)"
                          }} />
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                          <span>Normal</span>
                          <span>Critical</span>
                        </div>
                      </div>
                    )}

                    {/* Detected Findings Info */}
                    {result.findings.length > 0 && showReport && (
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="bg-black/90 backdrop-blur-sm rounded-lg px-4 py-3 border border-gray-700">
                          <div className="flex items-start gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-white font-semibold text-sm mb-1">
                                Detected Findings ({result.findings.length})
                              </div>
                              {result.findings.slice(0, 2).map((finding, idx) => (
                                <div key={finding.id} className="text-gray-300 text-xs mb-1 flex items-start gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${
                                    finding.severity === "critical" ? "bg-red-500 text-white" :
                                    finding.severity === "moderate" ? "bg-orange-500 text-white" :
                                    finding.severity === "mild" ? "bg-yellow-500 text-black" : "bg-green-500 text-white"
                                  }`}>
                                    {finding.severity}
                                  </span>
                                  <span className="line-clamp-2">{finding.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No image available
                  </div>
                )}
              </div>
            </div>


            {/* Right: Analysis Panel */}
            <div className="bg-gray-900 flex flex-col border-l border-gray-700">
              <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Chain of Thought Log
                </h3>
                
                <div
                  ref={logRef}
                  className="flex-1 bg-gray-950 rounded-xl p-4 font-mono text-sm overflow-y-auto border border-gray-800"
                >
                  <AnimatePresence>
                    {visibleSteps.map((step, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-start gap-2 mb-2 ${
                          step.status === "critical" ? "text-red-400" : "text-gray-300"
                        }`}
                      >
                        {getStepIcon(step.status)}
                        <span className={step.status === "critical" ? "font-bold" : ""}>
                          {step.message}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {isAnimating && (
                    <div className="flex items-center gap-2 text-cyan-400">
                      <div className="w-2 h-4 bg-cyan-400 animate-pulse" />
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {showReport && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 border-t border-gray-700"
                  >
                    <h3 className="text-white font-semibold mb-4">Final Diagnostic Report</h3>
                    
                    <div className={`rounded-xl p-4 border ${getUrgencyBg(result.report.urgency)}`}>
                      <div className="mb-4">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Finding</div>
                        <div className="text-white font-semibold text-lg">{result.report.primaryFinding}</div>
                      </div>

                      <div className="mb-4">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Etiology</div>
                        <div className="text-white">{result.report.etiology}</div>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div>
                          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Confidence</div>
                          <div className="text-2xl font-bold text-cyan-400">
                            {(result.report.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Urgency</div>
                          <div className={`px-3 py-1 rounded-full text-white text-sm font-medium ${getUrgencyColor(result.report.urgency)}`}>
                            {result.report.urgency.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {result.report.clinicalNotes && (
                        <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300 italic">
                          &quot;{result.report.clinicalNotes}&quot;
                        </div>
                      )}
                    </div>

                    {result.report.recommendations.length > 0 && (
                      <div className="mt-4">
                        <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Recommendations</div>
                        <ul className="space-y-1">
                          {result.report.recommendations.map((rec, i) => (
                            <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                              <span className="text-cyan-400">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RadiologyViewer;
