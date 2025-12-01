"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Loader2, Zap, Eye, Brain, ArrowLeft } from "lucide-react";
import { analyzeChestXRay } from "@/lib/radiology-triage";
import { RadiologyViewer, type RadiologyTriageResult } from "@/components/ui/radiology-viewer";

export default function RadiologyDemo() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadiologyTriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((newFiles: File[]) => {
    const imageFiles = newFiles.filter(f => f.type.startsWith("image/"));
    setFiles(imageFiles);
    setError(null);
    
    // Generate previews
    const newPreviews: string[] = [];
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target?.result as string);
        if (newPreviews.length === imageFiles.length) {
          setPreviews([...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError("Please upload at least one X-ray image");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const analysisResult = await analyzeChestXRay(files, {
        enhanceImages: true,
        includeChainOfThought: true,
      });
      setResult(analysisResult);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const clearFiles = () => {
    setFiles([]);
    setPreviews([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Automated Radiology Triage</h1>
                <p className="text-xs text-cyan-400">Powered by Gemini 2.5 Flash</p>
              </div>
            </div>
            <button
              onClick={() => window.location.href = "/doctor"}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-all hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Doctor Mode
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-white mb-4">
            Automated Radiology Triage with{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Gemini 2.5
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            This system detects complex thoracic pathologies using an agentic reasoning approach.
            Unlike traditional CNNs, it identifies specific signs like the Golden&apos;s S Sign 
            (Right Upper Lobe collapse with Hilar Mass).
          </p>
        </motion.div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: Zap, title: "Low Latency", desc: "Analysis under 200ms suitable for ER triage", color: "cyan" },
            { icon: Eye, title: "Multimodal", desc: "Ingests Frontal & Lateral views simultaneously", color: "blue" },
            { icon: Brain, title: "Reasoning", desc: 'Provides "Chain of Thought" finding explanations', color: "purple" },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (i + 1) }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className={`w-12 h-12 bg-${feature.color}-500/20 rounded-lg flex items-center justify-center mb-4`}>
                <feature.icon className={`w-6 h-6 text-${feature.color}-400`} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8"
        >
          <h3 className="text-xl font-semibold text-white mb-6">Upload Chest X-Ray Images</h3>
          
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
              dragActive 
                ? "border-cyan-400 bg-cyan-500/10" 
                : "border-gray-600 hover:border-gray-500"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-lg font-medium text-white mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-gray-500">
                PA, AP, or Lateral chest X-rays (PNG, JPG, DICOM)
              </p>
            </label>
          </div>

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-300">Uploaded Files ({files.length})</p>
                <button
                  onClick={clearFiles}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {previews.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-700"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm">{files[idx]?.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={files.length === 0 || loading}
            className="mt-6 w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span>Initiate Analysis</span>
              </>
            )}
          </button>
        </motion.div>

        {/* System Architecture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-8 border border-cyan-500/20"
        >
          <h3 className="text-xl font-semibold text-white mb-4">System Architecture</h3>
          <p className="text-gray-400 mb-6">
            The system bypasses traditional pre-processing pipelines (segmentation/cropping) and feeds 
            full-fidelity DICOM/PNG data directly into the Gemini 2.5 Flash Vision Encoder.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-black/30 rounded-lg p-4 border border-white/10">
              <p className="text-sm font-semibold text-white mb-1">INPUT</p>
              <p className="text-xs text-gray-400">PA + Lateral</p>
            </div>
            <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg p-4 text-white">
              <p className="text-sm font-semibold mb-1">GEMINI 2.5 FLASH</p>
              <p className="text-xs opacity-80">Align • Detect • Correlate</p>
            </div>
            <div className="bg-black/30 rounded-lg p-4 border border-white/10">
              <p className="text-sm font-semibold text-white mb-1">OUTPUT</p>
              <p className="text-xs text-gray-400">JSON Report</p>
            </div>
          </div>
        </motion.div>

        {/* Detection Logic Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
        >
          <h3 className="text-xl font-semibold text-white mb-4">
            Detection Logic: The &quot;Golden&apos;s S&quot; Pattern
          </h3>
          <p className="text-gray-400 mb-6">
            Detecting a Right Upper Lobe (RUL) collapse secondary to a hilar mass requires 
            identifying specific geometric distortions. The system is prompted to look for 
            the &quot;Golden&apos;s S Sign&quot; (or Reverse S Sign of Golden).
          </p>
          
          <div className="space-y-4">
            {[
              { step: 1, title: "Density Identification", desc: "The model first identifies increased opacity in the right upper zone. It checks if the opacity obscures the right upper mediastinal border." },
              { step: 2, title: 'Fissure Analysis (The "S" Shape)', desc: "Critical Step: The model traces the horizontal fissure. In a simple collapse, the fissure shifts upwards. However, if a mass is present at the hilum, the medial part of the fissure is pushed downwards (convex inferiorly) while the lateral part moves upwards (concave inferiorly). This creates the characteristic \"S\" shape." },
              { step: 3, title: "Secondary Signs Verification", desc: "To confirm, the model checks for: Tracheal Deviation (to the right), Elevated Hemidiaphragm (right side higher), and Hyperlucency (RML/RLL appear darker due to compensatory hyperexpansion)." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-cyan-400 font-bold text-sm">{item.step}</span>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">{item.title}</h4>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Radiology Viewer Modal */}
      {result && (
        <RadiologyViewer
          result={result}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}
