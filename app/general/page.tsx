"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { Upload, X, FileText, Image as ImageIcon, Send, Loader2 } from "lucide-react";
import { useGemini } from "@/hooks/useGemini";
import MarkdownTypewriter from "@/components/ui/markdown-typewriter";
import { AnnotatedImage, VisualFinding } from "@/components/ui/annotated-image";
import { parseVisualFindings, parseVisualFindingsFlexible, cleanVisualFindings } from "@/lib/parse-visual-findings";
import { EvidenceLogosScroll } from "@/components/ui/evidence-logos-scroll";
import { Sidebar } from "@/components/ui/sidebar";
import { RotatingSuggestions } from "@/components/ui/rotating-suggestions";
import { EvidenceLoadingCard } from "@/components/ui/evidence-loading-card";
import { AddToCollectionModal } from "@/components/ui/add-to-collection-modal";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { FormattedQuestion } from "@/components/ui/formatted-question";

interface MedicalImage {
  url: string;
  title: string;
  source: string;
  license: string;
  thumbnail?: string;
  description?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  files?: File[];
  imageUrls?: string[]; // base64 image data (uploaded by user)
  visualFindings?: VisualFinding[];
  medicalImages?: MedicalImage[]; // fetched educational images
}

// Response Tabs Component
function ResponseTabs({ 
  response, 
  modelUsed,
  imageUrls,
  visualFindings,
  onComplete
}: { 
  response: string; 
  modelUsed: string;
  imageUrls?: string[];
  visualFindings?: VisualFinding[];
  onComplete?: () => void;
}) {
  const [activeTab, setActiveTab] = useState(0);

  // Parse response into sections
  const sections = {
    clinical: extractSection(response, ["TL;DR", "MEDICAL IMAGE ANALYSIS", "Clinical Context"]),
    diagnosis: extractSection(response, ["Differential Diagnosis", "VISUAL FINDINGS"]),
    treatment: extractSection(response, ["Recommended Approach", "Drug & Safety", "Treatment"]),
    evidence: extractSection(response, ["Evidence Snapshot", "Citations", "Evidence Database"])
  };

  const tabs = [
    { id: 0, name: "Clinical Analysis", icon: "🩺", content: sections.clinical },
    { id: 1, name: "Diagnosis & Logic", icon: "🔬", content: sections.diagnosis },
    { id: 2, name: "Treatment & Safety", icon: "💊", content: sections.treatment },
    { id: 3, name: "Evidence Database", icon: "📚", content: sections.evidence }
  ];

  return (
    <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-50 to-cyan-50 px-6 py-4 border-b border-gray-200 font-ui">
        <h3 className="text-lg font-semibold text-gray-900">AI Response</h3>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 bg-gray-50 font-ui">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-6 content-card">
        {/* Show annotated images if available and in diagnosis tab */}
        {activeTab === 1 && imageUrls && imageUrls.length > 0 && (
          <div className="mb-6 space-y-4">
            {imageUrls.map((imageUrl, imgIndex) => (
              <AnnotatedImage
                key={imgIndex}
                imageUrl={imageUrl}
                findings={visualFindings || []}
                fileIndex={imgIndex}
              />
            ))}
          </div>
        )}
        
        <MarkdownTypewriter 
          content={tabs[activeTab].content || response} 
          speed={2}
          onComplete={onComplete}
        />
      </div>
    </div>
  );
}

// Simple Response Component for Q&A (no attachments)
function SimpleResponse({ 
  response, 
  modelUsed,
  onComplete,
  showFollowUpQuestions = true,
  medicalImages,
  conversationId: propConversationId
}: { 
  response: string; 
  modelUsed: string;
  onComplete?: () => void;
  showFollowUpQuestions?: boolean;
  medicalImages?: MedicalImage[];
  conversationId?: string;
}) {
  // Parse response to extract main content, references, and follow-up questions
  const sections = parseQAResponse(response);
  
  // State for feedback
  const [copied, setCopied] = useState(false);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const conversationId = propConversationId || `conv_${Date.now()}`;
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  
  // Build a map of reference numbers to URLs from the references section FIRST
  // IMPORTANT: Use the EXACT same URL generation logic as the reference list
  // This ensures inline citation links match the reference list links
  const referenceUrls = useMemo(() => {
    const urlMap: Record<string, string> = {};
    sections.references.forEach((ref, idx) => {
      const refNum = (idx + 1).toString();
      
      // Check for NCBI Bookshelf IDs (NBK...)
      const bookshelfMatch = ref.match(/NBK\d+/i);
      if (bookshelfMatch) {
        urlMap[refNum] = `https://www.ncbi.nlm.nih.gov/books/${bookshelfMatch[0]}`;
        return;
      }
      
      // Extract PMID and construct clean PubMed URL
      const pmidMatch = ref.match(/PMID:?\s*(\d+)/i);
      if (pmidMatch) {
        urlMap[refNum] = `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch[1]}/`;
        return;
      }
      
      // Extract PMCID and construct PMC URL
      const pmcMatch = ref.match(/PMC\d+/i);
      if (pmcMatch) {
        urlMap[refNum] = `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcMatch[0]}/`;
        return;
      }
      
      // Extract DOI
      const doiMatch = ref.match(/doi:?\s*(10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+)/i);
      if (doiMatch) {
        const cleanDoi = doiMatch[1].replace(/[.,;:)\]]+$/, '');
        urlMap[refNum] = `https://doi.org/${cleanDoi}`;
        return;
      }
      
      // Fallback: try to find any clean URL in the reference
      const urlMatch = ref.match(/https?:\/\/[^\s\)\]]+/);
      if (urlMatch) {
        let cleanUrl = urlMatch[0].replace(/[.,;:)\]]+$/, '');
        urlMap[refNum] = cleanUrl;
      }
    });
    return urlMap;
  }, [sections.references]);
  
  // Convert citations to clickable superscript links
  // Handles multiple formats: [[1]](url), [1], ^[1]^
  const contentWithSuperscriptCitations = useMemo(() => {
    let content = sections.mainContent;
    
    // Strip out any remaining "References" section that might have slipped through the parser
    content = content.replace(/\n*(?:\*\*|#{1,3}\s*)?References?(?:\*\*)?:?\s*\n(?:\d+\.\s+.+\n?)+/gi, '');
    
    // Strip out any remaining "You Might Also Want to Know" or "Follow-Up Questions" sections
    // that might have slipped through the parser (handles various formats)
    content = content.replace(/\n*(?:\*\*|#{1,3}\s*)?(You Might Also Want to Know|Follow[-\s]?Up Questions?)(?:\*\*)?:?\s*\n[\s\S]*$/i, '');
    
    // First, handle [[1]](url) format - new inline link format
    content = content
      .replace(/\[\[(\d+)\]\]\((https?:\/\/[^\s\)]+)\)/g, (match: string, num: string, url: string) => {
        return `<sup class="citation-number"><a href="${url}" target="_blank" rel="noopener noreferrer" class="citation-link" data-citation="${num}">[${num}]</a></sup>`;
      });
    
    // Handle ^[1]^ format (legacy format from AI)
    content = content.replace(/\^\[(\d+(?:,\s*\d+)*)\]\^/g, '[$1]');
    
    // Handle standalone ^^ or ^ symbols
    content = content.replace(/\^+/g, '');
    
    // Handle remaining [1] format - use referenceUrls map or anchor links
    // Also handle malformed citations like [21,2] or [24.1] by extracting only valid numbers
    content = content
      .replace(/(?<!<a[^>]*>)\[([0-9,.\s]+)\](?!\()/g, (match: string, numbers: string) => {
        // Split by comma or period and filter out invalid numbers
        const citationNumbers = numbers
          .split(/[,.]/)
          .map((n: string) => n.trim())
          .filter((n: string) => n && /^\d+$/.test(n)) // Only keep valid integers
          .filter((n: string) => {
            const num = parseInt(n);
            return num > 0 && num <= sections.references.length; // Only keep numbers within valid range
          });
        
        if (citationNumbers.length === 0) {
          // If no valid citations, return original text without superscript
          return match;
        }
        
        const links = citationNumbers.map((num: string) => {
          const url = referenceUrls[num];
          if (url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="citation-link" data-citation="${num}">[${num}]</a>`;
          }
          return `<a href="#ref-${num}" class="citation-link" data-citation="${num}">[${num}]</a>`;
        }).join(',');
        return `<sup class="citation-number">${links}</sup>`;
      });
    
    return content;
  }, [sections.mainContent, referenceUrls]);

  // Convert citations to inline links for copying (Open Evidence format)
  const getContentWithInlineLinks = () => {
    let content = sections.mainContent;
    
    // Remove ^[N]^ format first
    content = content.replace(/\^\[(\d+(?:,\s*\d+)*)\]\^/g, '[$1]');
    content = content.replace(/\^+/g, '');
    
    // Also handle [[N]](url) format that's already in the content - preserve it
    const existingLinks: string[] = [];
    content = content.replace(/\[\[(\d+)\]\]\((https?:\/\/[^\s\)]+)\)/g, (match: string) => {
      existingLinks.push(match);
      return `__EXISTING_LINK_${existingLinks.length - 1}__`;
    });
    
    // Convert remaining [N] to [[N]](URL) format
    content = content.replace(/\[(\d+(?:,\s*\d+)*)\]/g, (match: string, numbers: string) => {
      const nums = numbers.split(',').map((n: string) => n.trim());
      return nums.map((num: string) => {
        const url = referenceUrls[num];
        return url ? `[[${num}]](${url})` : `[${num}]`;
      }).join('');
    });
    
    // Restore existing links
    existingLinks.forEach((link, idx) => {
      content = content.replace(`__EXISTING_LINK_${idx}__`, link);
    });
    
    // Add references section with links (Open Evidence format)
    if (sections.references.length > 0) {
      content += '\n\nReferences\n';
      sections.references.forEach((ref, idx) => {
        const refNum = idx + 1;
        const url = referenceUrls[refNum.toString()];
        const parsed = parseReference(ref);
        
        if (url && parsed.title) {
          // Format: [Title](URL). Authors. Journal. Year. doi:DOI.
          let refLine = `[${parsed.title}](${url}).`;
          if (parsed.authors) refLine += ` ${parsed.authors}.`;
          if (parsed.journal) refLine += ` ${parsed.journal}.`;
          if (parsed.year) refLine += ` ${parsed.year}.`;
          if (parsed.doi) refLine += ` doi:${parsed.doi}.`;
          else if (parsed.pmid) refLine += ` PMID:${parsed.pmid}.`;
          content += refLine + '\n';
        } else if (url) {
          content += `[${ref}](${url}).\n`;
        } else {
          content += `${ref}\n`;
        }
      });
    }
    
    return content;
  };
  
  // Copy to clipboard with inline links
  const handleCopy = () => {
    const contentWithLinks = getContentWithInlineLinks();
    navigator.clipboard.writeText(contentWithLinks);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Handle marking as helpful - save to favorites
  const handleHelpful = (isHelpful: boolean) => {
    setHelpful(isHelpful);
    
    if (isHelpful) {
      // Save to favorites when marked as helpful
      const { saveFavorite } = require('@/lib/storage');
      saveFavorite({
        id: `fav_${Date.now()}`,
        conversationId,
        title: response.substring(0, 50) + '...',
        preview: response.substring(0, 150) + '...',
        timestamp: new Date()
      });
    }
  };
  
  return (
    <div className="space-y-8">
      {/* Medical Images - Display naturally without heading */}
      {medicalImages && medicalImages.length > 0 && (
        <div className="mb-6">
          <div className="overflow-x-auto pb-2 -mx-2 px-2">
            <div className="flex gap-4 min-w-max">
              {medicalImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setLightboxImage({ url: img.url, title: img.title })}
                  className="w-64 shrink-0 bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                >
                  <div className="h-48 bg-gray-100 overflow-hidden relative">
                    <img 
                      src={img.thumbnail || img.url} 
                      alt={img.title}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  </div>
                  <div className="p-2 bg-white text-left">
                    <p className="text-xs text-gray-600 line-clamp-2">{img.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Response - No box, natural flow */}
      <div className="content-card">
        <style jsx global>{`
          .citation-number {
            color: #f97316;
            font-weight: 600;
            cursor: pointer;
            font-size: 0.75em;
            line-height: 0;
            position: relative;
            vertical-align: baseline;
            top: -0.5em;
            margin: 0 1px;
          }
          .citation-number:hover {
            color: #ea580c;
            text-decoration: underline;
          }
        `}</style>
        <MarkdownTypewriter 
          content={contentWithSuperscriptCitations} 
          speed={2}
          onComplete={onComplete}
        />
      </div>
      
      {/* Action Buttons - Helpful/Not Helpful, Collection, and Copy */}
      <div className="flex items-center justify-between font-ui py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Was this helpful?</span>
            <button
              onClick={() => handleHelpful(true)}
              className={`p-2 rounded transition-colors ${
                helpful === true 
                  ? 'bg-green-100 text-green-700' 
                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
              }`}
              title="Helpful"
            >
              <svg className="w-5 h-5" fill={helpful === true ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </button>
            <button
              onClick={() => handleHelpful(false)}
              className={`p-2 rounded transition-colors ${
                helpful === false 
                  ? 'bg-red-100 text-red-700' 
                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
              }`}
              title="Not helpful"
            >
              <svg className="w-5 h-5" fill={helpful === false ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
            </button>
            
            {/* Collection Button */}
            <div className="h-6 w-px bg-gray-300"></div>
            <button
              onClick={() => setShowCollectionModal(true)}
              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
              title="Add to collection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

      {/* Disclaimer for General Mode - Placed above References */}
      <div className="mt-10 p-4 bg-gray-50 border border-gray-300 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-300 group">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-sm text-gray-600 font-ui">
            <p className="font-semibold mb-1 text-gray-700">Important Health Information Notice</p>
            <p className="text-gray-600 leading-relaxed">
              This is an AI-generated response for educational purposes only. It is not a substitute for professional medical advice, 
              diagnosis, or treatment. If you're experiencing health concerns, please consult with a qualified healthcare provider, 
              doctor, or visit your nearest clinic. For emergencies, call your local emergency services immediately.
            </p>
          </div>
        </div>
      </div>

      {/* References Section - No box, clean list */}
      {(() => {
        // Filter and deduplicate references - show ALL valid references
        const validRefs = sections.references
          .filter((ref) => {
            const parsed = parseReference(ref);
            // Include all valid references (with or without PMID/DOI)
            return parsed.isValid;
          })
          // Remove duplicates based on DOI, PMID, or title
          .filter((ref, index, self) => {
            const parsed = parseReference(ref);
            const identifier = parsed.doi || parsed.pmid || parsed.title?.toLowerCase();
            return index === self.findIndex((r) => {
              const p = parseReference(r);
              const id = p.doi || p.pmid || p.title?.toLowerCase();
              return id === identifier;
            });
          });
        
        return validRefs.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 font-ui flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              References
            </h3>
            <div className="space-y-4 font-ui">
              {validRefs.map((ref, idx) => {
                const parsed = parseReference(ref);
                const refLower = ref.toLowerCase();
                
                // Detect source types
                const isFDAFaers = refLower.includes('fda faers') || refLower.includes('faers');
                const isOpenFDA = refLower.includes('openfda') || refLower.includes('fda/openfda');
                const isDailyMed = refLower.includes('dailymed');
                const isADA = refLower.includes('american diabetes association') || refLower.includes('ada standards') || refLower.includes('standards of care in diabetes');
                const isWHO = refLower.includes('who guidelines') || refLower.includes('world health organization');
                const isNICE = refLower.includes('nice guideline') || refLower.includes('ng28') || refLower.includes('national institute for health');
                const isACC = refLower.includes('acc/aha') || refLower.includes('american college of cardiology');
                const isCDC = refLower.includes('cdc') || refLower.includes('centers for disease control');
                // Leading medical journals
                const isNEJM = refLower.includes('n engl j med') || refLower.includes('new england journal') || refLower.includes('nejm');
                const isJAMA = refLower.includes('jama') || refLower.includes('journal of the american medical');
                const isLancet = refLower.includes('lancet');
                const isBMJ = refLower.includes('bmj') || refLower.includes('british medical journal');
                const isAHA = refLower.includes('circulation') || refLower.includes('american heart association') || refLower.includes('stroke');
                const isNature = refLower.includes('nature') || refLower.includes('nat med');
                const isPerplexity = refLower.includes('perplexity') || refLower.includes('source: perplexity');
                
                // Generate URL with fallbacks - prioritize extracted URL from markdown link
                let url: string | null = null;
                if (parsed.url) {
                  // Use URL extracted from markdown link format [Title](URL)
                  url = parsed.url;
                } else if (parsed.pmid) {
                  url = `https://pubmed.ncbi.nlm.nih.gov/${parsed.pmid}`;
                } else if (parsed.doi) {
                  url = `https://doi.org/${parsed.doi}`;
                } else if (isFDAFaers || isOpenFDA) {
                  url = 'https://open.fda.gov/apis/drug/event/';
                } else if (isDailyMed) {
                  url = 'https://dailymed.nlm.nih.gov/dailymed/';
                } else if (isADA) {
                  url = 'https://diabetesjournals.org/care/issue/47/Supplement_1';
                } else if (isWHO) {
                  url = `https://www.who.int/publications/i/item/${encodeURIComponent(parsed.title || 'guidelines')}`;
                } else if (isNICE) {
                  const niceCode = ref.match(/\[?(NG\d+|CG\d+|TA\d+)\]?/i);
                  url = niceCode 
                    ? `https://www.nice.org.uk/guidance/${niceCode[1].toLowerCase()}`
                    : 'https://www.nice.org.uk/guidance';
                } else if (isACC) {
                  url = 'https://www.acc.org/Guidelines';
                } else if (isCDC) {
                  url = 'https://www.cdc.gov/guidelines/';
                } else if (parsed.title && parsed.title.length > 10) {
                  // CRITICAL FIX: Only generate PubMed search URL if title is a REAL article title
                  // NOT for generic titles, search queries, or source names
                  const titleLower = parsed.title.toLowerCase();
                  const isGenericOrSearchTitle = 
                    /^(what|how|why|when|where|which|who|is|are|can|does|do|should)\s/i.test(parsed.title) ||
                    titleLower.includes('clinical significance') ||
                    titleLower.includes('pubmed article') ||
                    titleLower.includes('pubmed search') ||
                    titleLower.includes('national institutes') ||
                    titleLower.includes('statpearls') ||
                    titleLower.includes('ncbi books') ||
                    titleLower.includes('medical reference') ||
                    /^(pubmed|pmc|nih|cdc|who|fda|ncbi)\s*(article|search|reference)?$/i.test(parsed.title);
                  
                  if (!isGenericOrSearchTitle) {
                    // Clean title for PubMed search - MUST remove all markdown/URL artifacts
                    const cleanTitle = parsed.title
                      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Extract text from markdown links
                      .replace(/https?:\/\/\S+/g, '')  // Remove URLs
                      .replace(/[\[\]\(\)\{\}]/g, '')  // Remove brackets
                      .replace(/[^\w\s-]/g, ' ')  // Replace special chars with spaces
                      .replace(/\s+/g, ' ')  // Normalize spaces
                      .trim()
                      .substring(0, 100);  // Limit length
                    
                    if (cleanTitle.length > 15) {  // Increased minimum length
                      url = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(cleanTitle)}`;
                    }
                  }
                  // If title is generic, don't generate a URL - the reference will be filtered out
                }
                
                // Get source badge info
                const sourceBadges: Record<string, { label: string; bgColor: string; textColor: string }> = {
                  pubmed: { label: 'PubMed', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
                  cochrane: { label: 'Cochrane', bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
                  europepmc: { label: 'Europe PMC', bgColor: 'bg-teal-100', textColor: 'text-teal-700' },
                  semanticscholar: { label: 'Semantic Scholar', bgColor: 'bg-cyan-100', textColor: 'text-cyan-700' },
                  clinicaltrials: { label: 'ClinicalTrials.gov', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700' },
                  openalex: { label: 'OpenAlex', bgColor: 'bg-violet-100', textColor: 'text-violet-700' },
                  pmc: { label: 'PMC', bgColor: 'bg-sky-100', textColor: 'text-sky-700' },
                  dailymed: { label: 'DailyMed (FDA)', bgColor: 'bg-rose-100', textColor: 'text-rose-700' },
                  aap: { label: 'AAP Guidelines', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
                  fdafaers: { label: 'FDA FAERS', bgColor: 'bg-red-100', textColor: 'text-red-700' },
                  openfda: { label: 'OpenFDA', bgColor: 'bg-red-100', textColor: 'text-red-700' },
                  ada: { label: 'ADA Guidelines', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
                  who: { label: 'WHO Guidelines', bgColor: 'bg-sky-100', textColor: 'text-sky-700' },
                  nice: { label: 'NICE Guidelines', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
                  acc: { label: 'ACC/AHA', bgColor: 'bg-rose-100', textColor: 'text-rose-700' },
                  cdc: { label: 'CDC', bgColor: 'bg-green-100', textColor: 'text-green-700' },
                  pubmedsearch: { label: 'PubMed Search', bgColor: 'bg-amber-100', textColor: 'text-amber-700' },
                  fda: { label: 'FDA', bgColor: 'bg-red-100', textColor: 'text-red-700' },
                  // Note: Perplexity badge removed - we show the actual source (NEJM, JAMA, etc.) instead
                  nejm: { label: 'NEJM', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
                  jama: { label: 'JAMA', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
                  lancet: { label: 'Lancet', bgColor: 'bg-red-100', textColor: 'text-red-700' },
                  bmj: { label: 'BMJ', bgColor: 'bg-sky-100', textColor: 'text-sky-700' },
                  aha: { label: 'AHA', bgColor: 'bg-rose-100', textColor: 'text-rose-700' },
                  nature: { label: 'Nature', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700' },
                  statpearls: { label: 'StatPearls', bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
                  ncbi: { label: 'NCBI Books', bgColor: 'bg-indigo-100', textColor: 'text-indigo-700' },
                };
                
                // Detect source for badge - check URL first, then text content
                let detectedSource = parsed.source;
                
                // If we have a URL, detect source from it
                if (parsed.url) {
                  const urlLower = parsed.url.toLowerCase();
                  if (urlLower.includes('pubmed.ncbi.nlm.nih.gov')) detectedSource = 'pubmed';
                  else if (urlLower.includes('who.int')) detectedSource = 'who';
                  else if (urlLower.includes('cdc.gov')) detectedSource = 'cdc';
                  else if (urlLower.includes('cochrane')) detectedSource = 'cochrane';
                  else if (urlLower.includes('clinicaltrials.gov')) detectedSource = 'clinicaltrials';
                  else if (urlLower.includes('jamanetwork.com')) detectedSource = 'jama';
                  else if (urlLower.includes('nejm.org')) detectedSource = 'nejm';
                  else if (urlLower.includes('thelancet.com')) detectedSource = 'lancet';
                  else if (urlLower.includes('bmj.com')) detectedSource = 'bmj';
                  else if (urlLower.includes('nature.com')) detectedSource = 'nature';
                  else if (urlLower.includes('nice.org.uk')) detectedSource = 'nice';
                  else if (urlLower.includes('fda.gov')) detectedSource = 'fda';
                  else if (urlLower.includes('diabetesjournals.org')) detectedSource = 'ada';
                  else if (urlLower.includes('ahajournals.org') || urlLower.includes('heart.org')) detectedSource = 'aha';
                  else if (urlLower.includes('academic.oup.com')) detectedSource = 'pubmed'; // Oxford journals often indexed in PubMed
                  else if (urlLower.includes('mayoclinic.org')) detectedSource = 'pubmed'; // Use PubMed badge for Mayo
                  else if (urlLower.includes('clevelandclinic.org')) detectedSource = 'pubmed'; // Use PubMed badge for Cleveland
                }
                
                // Fallback to text-based detection
                if (detectedSource === 'pubmed' || !detectedSource) {
                  if (isFDAFaers) detectedSource = 'fdafaers';
                  else if (isOpenFDA) detectedSource = 'openfda';
                  else if (isDailyMed) detectedSource = 'dailymed';
                  else if (isADA) detectedSource = 'ada';
                  else if (isWHO) detectedSource = 'who';
                  else if (isNICE) detectedSource = 'nice';
                  else if (isACC) detectedSource = 'acc';
                  else if (isCDC) detectedSource = 'cdc';
                  else if (isNEJM) detectedSource = 'nejm';
                  else if (isJAMA) detectedSource = 'jama';
                  else if (isLancet) detectedSource = 'lancet';
                  else if (isBMJ) detectedSource = 'bmj';
                  else if (isAHA) detectedSource = 'aha';
                  else if (isNature) detectedSource = 'nature';
                  else if (parsed.pmid) detectedSource = 'pubmed';
                  else if (parsed.doi) detectedSource = 'pubmed'; // DOI articles are usually in PubMed
                  else if (parsed.title) detectedSource = 'pubmedsearch';
                }
                
                const sourceBadge = sourceBadges[detectedSource] || sourceBadges.pubmed;
              
              return (
                <div key={idx} className="flex gap-4 p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors group">
                  <div className="shrink-0 w-8 h-8 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Title - Clickable Link at Top (max 2 lines, title only - no authors) */}
                    {(() => {
                      // Clean title - strip any remaining markdown link syntax
                      let displayTitle = parsed.title || '';
                      
                      // If title still contains markdown link syntax, extract just the text
                      const markdownMatch = displayTitle.match(/^\[([^\]]+)\]\([^)]+\)/);
                      if (markdownMatch) {
                        displayTitle = markdownMatch[1];
                      }
                      
                      // Fallback: if still empty, try to extract from raw ref
                      if (!displayTitle || displayTitle.length < 5) {
                        const refMatch = ref.match(/^\[([^\]]+)\]\([^)]+\)/);
                        if (refMatch) {
                          displayTitle = refMatch[1];
                        } else {
                          // Last resort: use cleaned ref without URLs
                          displayTitle = ref.replace(/\(https?:\/\/[^)]+\)/g, '').replace(/^\[|\]$/g, '').trim();
                        }
                      }
                      
                      // Final cleanup
                      displayTitle = displayTitle.replace(/^\[|\]$/g, '').trim();
                      
                      return url ? (
                        <a 
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline leading-snug block line-clamp-2"
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                          {displayTitle}
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{displayTitle}</p>
                      );
                    })()}
                    
                    {/* Authors - Below Title (always show if available) */}
                    {parsed.authors && (
                      <p className="text-xs text-gray-700">
                        {parsed.authors}
                      </p>
                    )}
                    
                    {/* Journal Info - Below Authors (formatted like Open Evidence) */}
                    {(parsed.journal || parsed.year) && (
                      <p className="text-xs text-gray-500">
                        {parsed.journal && <span className="font-medium">{parsed.journal}.</span>}
                        {parsed.year && <span> {parsed.year}</span>}
                        {parsed.volume && <span>;{parsed.volume}</span>}
                        {parsed.pages && <span>:{parsed.pages}</span>}
                        {parsed.pages && <span>.</span>}
                        {parsed.doi && <span> doi:{parsed.doi}.</span>}
                        {!parsed.doi && parsed.pmid && <span> PMID:{parsed.pmid}.</span>}
                      </p>
                    )}
                    
                    {/* Badges - Show actual source and quality indicators */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Database Source Badge - Dynamic based on detected source */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${sourceBadge.bgColor} ${sourceBadge.textColor} text-xs font-medium rounded`}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                        {sourceBadge.label}
                      </span>
                      {parsed.isLeadingJournal && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          Leading Journal
                        </span>
                      )}
                      {parsed.isRecentResearch && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          Recent Research
                        </span>
                      )}
                      {parsed.isSystematicReview && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                          Systematic Review
                        </span>
                      )}
                      {parsed.isOpenAccess && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                          Open Access
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Helpful/Not Helpful buttons */}
                  <div className="shrink-0 flex items-start gap-2">
                    <button 
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Helpful"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                    </button>
                    <button 
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Not helpful"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* Follow-Up Questions - No box, clean list */}
      {showFollowUpQuestions && sections.followUpQuestions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-6 font-ui flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Follow-Up Questions
          </h3>
          <div className="space-y-3 font-ui">
            {sections.followUpQuestions.map((question, idx) => (
              <FollowUpQuestionButton key={idx} question={question} />
            ))}
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <ImageLightbox
            imageUrl={lightboxImage.url}
            title={lightboxImage.title}
            onClose={() => setLightboxImage(null)}
          />
        )}
      </AnimatePresence>

      {/* Collection Modal */}
      <AnimatePresence>
        {showCollectionModal && (
          <AddToCollectionModal
            conversationId={conversationId}
            conversationTitle={response.substring(0, 50) + '...'}
            onClose={() => setShowCollectionModal(false)}
            onSuccess={() => {
              console.log('Added to collection successfully');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Follow-up question button component
function FollowUpQuestionButton({ question }: { question: string }) {
  // This will be connected to the parent component's handleFollowUpSubmit
  const handleClick = () => {
    // Trigger a custom event that the parent can listen to
    window.dispatchEvent(new CustomEvent('followUpQuestion', { detail: question }));
  };
  
  return (
    <button
      onClick={handleClick}
      className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:border-blue-300 border border-gray-200 transition-all group"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700 group-hover:text-blue-700 font-medium">{question}</span>
        <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// Helper functions to extract DOI and PMID from references
function extractDOI(reference: string): string | null {
  // More strict DOI pattern - must start with 10. and have proper format
  const doiMatch = reference.match(/doi:?\s*(10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+)/i);
  if (!doiMatch) return null;
  
  const doi = doiMatch[1];
  
  // Validate DOI format - must have proper structure
  // DOI format: 10.prefix/suffix where prefix is 4-9 digits
  if (!doi.match(/^10\.\d{4,9}\/[-._;()\/:A-Za-z0-9]+$/)) {
    return null;
  }
  
  // Clean up trailing punctuation that might have been captured
  return doi.replace(/[.,;:)\]]+$/, '');
}

function extractPMID(reference: string): string | null {
  const pmidMatch = reference.match(/PMID:?\s*(\d+)/i);
  return pmidMatch ? pmidMatch[1] : null;
}

// Parse reference into structured format
interface ParsedReference {
  title: string;
  authors: string;
  journal: string;
  year: string;
  volume: string;
  pages: string;
  doi: string | null;
  pmid: string | null;
  url: string | null;
  source: 'pubmed' | 'cochrane' | 'europepmc' | 'semanticscholar' | 'clinicaltrials' | 'openalex' | 'pmc' | 'dailymed' | 'aap' | 'fdafaers' | 'openfda' | 'ada' | 'who' | 'nice' | 'acc' | 'cdc' | 'pubmedsearch' | 'fda' | 'nejm' | 'jama' | 'lancet' | 'bmj' | 'aha' | 'nature' | 'statpearls' | 'ncbi';
  isLeadingJournal: boolean;
  isRecentResearch: boolean;
  isSystematicReview: boolean;
  isOpenAccess: boolean;
  isValid: boolean;
}

/**
 * COMPLETELY REWRITTEN parseReference function
 * Handles multiple reference formats from AI responses:
 * 1. [Title](URL) - markdown link format
 * 2. [Title](URL). Authors. Journal. Year. - full citation
 * 3. Authors. Title. Journal. Year. doi:xxx - traditional format
 * 4. Plain text references
 * 
 * CRITICAL FIX: Reject generic/invalid titles like:
 * - "Clinical Significance", "PubMed Article", "National Institutes of Health"
 * - Search queries like "What is the right treatment for..."
 * - Source names without actual article titles
 */
function parseReference(reference: string): ParsedReference {
  const refLower = reference.toLowerCase();
  let trimmedRef = reference.trim();
  
  // List of INVALID generic titles that should be rejected
  const INVALID_GENERIC_TITLES = [
    'clinical significance',
    'pubmed article',
    'pubmed search',
    'national institutes of health',
    'statpearls/ncbi books',
    'statpearls',
    'ncbi books',
    'world health organization',
    'centers for disease control',
    'medical reference',
    'health information',
    'drug information',
    'clinical overview',
    'overview',
    'introduction',
    'background',
    'summary',
    'abstract',
    'article',
    'reference',
    'source',
    'guideline',
    'guidelines',
  ];
  
  // Clean citation markdown format first: [[N]](URL) at the beginning
  trimmedRef = trimmedRef
    .replace(/^\[\[\d+\]\]\([^\)]+\)\s*/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // Extract identifiers first
  const doi = extractDOI(trimmedRef);
  const pmid = extractPMID(trimmedRef);
  
  // Initialize result
  let title = '';
  let authors = '';
  let journal = '';
  let year = '';
  let volume = '';
  let pages = '';
  let url: string | null = null;
  let source: ParsedReference['source'] = 'pubmed';
  
  // Extract year from anywhere in the reference
  const yearMatch = trimmedRef.match(/\b(19\d{2}|20\d{2})\b/);
  year = yearMatch ? yearMatch[1] : '';
  
  // STRATEGY 1: Check for markdown link format [Title](URL)
  const markdownMatch = trimmedRef.match(/^\[([^\]]+)\]\(([^)]+)\)/);
  if (markdownMatch) {
    title = markdownMatch[1].trim();
    url = markdownMatch[2].trim();
    
    // Extract authors from text after the link
    const afterLink = trimmedRef.substring(markdownMatch[0].length).trim();
    if (afterLink) {
      // Remove leading punctuation
      const cleanAfter = afterLink.replace(/^[.\s]+/, '');
      // First segment before period is usually authors
      const authorMatch = cleanAfter.match(/^([^.]+(?:et al\.?)?)/i);
      if (authorMatch && authorMatch[1].length > 3 && authorMatch[1].length < 200) {
        const potentialAuthors = authorMatch[1].trim();
        // Check if it looks like authors (has commas or "et al")
        if (potentialAuthors.includes(',') || potentialAuthors.toLowerCase().includes('et al')) {
          authors = potentialAuthors.replace(/,?\s*et al\.?$/i, ' et al').trim();
        }
      }
      // Try to extract journal
      const journalMatch = cleanAfter.match(/\.\s*([A-Z][^.]+(?:Journal|Rev|Med|Clin|Ann|Arch|BMJ|JAMA|Lancet|Nature)[^.]*)/i);
      if (journalMatch) {
        journal = journalMatch[1].trim();
      }
    }
  }
  // STRATEGY 2: Check for URL anywhere in the reference
  else {
    const urlMatch = trimmedRef.match(/(https?:\/\/[^\s\)]+)/);
    if (urlMatch) {
      url = urlMatch[1].trim();
      // Remove URL from reference to parse the rest
      const withoutUrl = trimmedRef.replace(urlMatch[0], '').replace(/\(\s*\)/, '').trim();
      
      // Try to extract title - usually the longest meaningful segment
      const segments = withoutUrl.split(/[.\n]/).filter(s => s.trim().length > 5);
      if (segments.length > 0) {
        // Find the best title candidate
        let bestTitle = '';
        for (const seg of segments) {
          const cleaned = seg.trim().replace(/^\[|\]$/g, '');
          // Skip if looks like authors (multiple commas, "et al")
          if (cleaned.split(',').length >= 3 && cleaned.length < 100) continue;
          if (cleaned.match(/^[A-Z][a-z]+\s+[A-Z]{1,2},/)) continue;
          // Prefer longer segments that look like titles
          if (cleaned.length > bestTitle.length && cleaned.length > 10) {
            bestTitle = cleaned;
          }
        }
        title = bestTitle || segments[0].trim();
      }
    }
    // STRATEGY 3: No URL - parse traditional citation format
    else {
      // Split by periods
      const parts = trimmedRef.split(/\.\s+/).filter(p => p.trim().length > 2);
      
      if (parts.length >= 2) {
        // Check if first part looks like authors
        const firstPart = parts[0].trim();
        const looksLikeAuthors = 
          firstPart.includes('et al') ||
          (firstPart.split(',').length >= 2 && firstPart.length < 150) ||
          firstPart.match(/^[A-Z][a-z]+\s+[A-Z]{1,2}[,\s]/);
        
        if (looksLikeAuthors && parts.length >= 2) {
          authors = firstPart.replace(/,?\s*et al\.?$/i, ' et al').trim();
          // Second part is likely the title
          title = parts[1].trim();
          // Third part might be journal
          if (parts.length >= 3) {
            journal = parts[2].replace(/\d{4}.*$/, '').trim();
          }
        } else {
          // First part is likely the title
          title = firstPart;
          // Look for authors in remaining parts
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i].trim();
            if (part.includes('et al') || part.split(',').length >= 2) {
              authors = part.replace(/,?\s*et al\.?$/i, ' et al').trim();
              break;
            }
          }
        }
      } else if (parts.length === 1) {
        title = parts[0].trim();
      } else {
        title = trimmedRef;
      }
    }
  }
  
  // Clean up title - remove any remaining markdown/URL artifacts
  // CRITICAL: This must be thorough to prevent markdown syntax from appearing in PubMed searches
  title = title
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Extract text from markdown links [text](url) -> text
    .replace(/^\[|\]$/g, '')  // Remove standalone brackets
    .replace(/\(https?:\/\/[^)]+\)/g, '')  // Remove URLs in parens
    .replace(/https?:\/\/\S+/g, '')  // Remove bare URLs
    .replace(/doi:?\s*10\.\d+\/\S+/gi, '')  // Remove DOIs
    .replace(/PMID:?\s*\d+/gi, '')  // Remove PMIDs
    .replace(/^\d+\.\s*/, '')  // Remove leading numbers
    .replace(/[.,;:]+$/, '')  // Remove trailing punctuation
    .replace(/^SOURCE:\s*/i, '')  // Remove "SOURCE:" prefix
    .replace(/\[\s*\]/g, '')  // Remove empty brackets
    .replace(/\(\s*\)/g, '')  // Remove empty parens
    .trim();
  
  // CRITICAL: Check if title looks like authors (not a real title)
  // Pattern: "LastName Initial, LastName Initial, LastName Initial" or "Name et al"
  const looksLikeAuthorsOnly = 
    (title.match(/^[A-Z][a-z]+\s+[A-Z]{1,2}(,\s*[A-Z][a-z]+\s+[A-Z]{1,2})*$/)) || // "Mehta A, San Juan PM"
    (title.split(',').length >= 2 && title.length < 80 && !title.includes(' and ') && title.match(/^[A-Z]/)) ||
    title.toLowerCase().endsWith('et al') ||
    title.match(/^[A-Z][a-z]+\s+[A-Z]{1,2}$/); // Single author "Mehta A"
  
  // Check if title is just a source identifier (e.g., "National Institutes of Health: PMC1198")
  const isSourceIdentifier = title.match(/^(National Institutes? of Health|PubMed Central|PMC|Nature|Science|JAMA|BMJ|Lancet):\s*(PMC|NBK|S)?\d+/i);
  if (isSourceIdentifier) {
    // This is just a source ID, not a real title
    const sourceMatch = title.match(/^([^:]+):\s*(.+)$/);
    if (sourceMatch) {
      title = `Article from ${sourceMatch[1]} (${sourceMatch[2]})`;
    }
  }
  
  // Check if title is just a source name (not a real title)
  const isJustSourceName = /^(StatPearls|PubMed|PMC|NIH|CDC|WHO|FDA|NCBI|SOURCE|Cochrane|UpToDate|MedlinePlus)$/i.test(title);
  
  // Check if title is too short or generic
  const isTooShort = title.length < 10;
  const isGenericKeywords = /^(Pain|Shoulder|Back|Knee|Head|Neck|Arm|Leg|Foot|Hand),?\s*(Pain|Shoulder|Back|Knee|Head|Neck|Arm|Leg|Foot|Hand)?$/i.test(title);
  
  // CRITICAL FIX: Check if title is a generic/invalid title from our list
  const titleLower = title.toLowerCase().trim();
  const isGenericTitle = INVALID_GENERIC_TITLES.some(invalid => 
    titleLower === invalid || 
    titleLower.startsWith(invalid + ':') ||
    titleLower.startsWith(invalid + ' -') ||
    titleLower.endsWith('- ' + invalid)
  );
  
  // CRITICAL FIX: Check if title looks like a search query (starts with question words)
  const isSearchQuery = /^(what|how|why|when|where|which|who|is|are|can|does|do|should)\s/i.test(title);
  
  // CRITICAL FIX: Check if title contains "search" or "term=" indicating it's a search URL title
  const isSearchUrlTitle = titleLower.includes('search') || titleLower.includes('term=') || titleLower.includes('query=');
  
  // If title looks like authors, swap with authors field or mark as needing better title
  if (looksLikeAuthorsOnly && !authors) {
    authors = title;
    title = ''; // Will be handled below
  }
  
  // CRITICAL FIX: Mark reference as INVALID if title is generic, a search query, or too short
  // This prevents displaying useless references with no real article information
  const hasInvalidTitle = !title || isJustSourceName || isTooShort || isGenericKeywords || isGenericTitle || isSearchQuery || isSearchUrlTitle;
  
  // If title is invalid, try to construct a better one from PMID/DOI
  if (hasInvalidTitle) {
    // If we have a PMID, we can at least show a meaningful link
    if (pmid) {
      title = `PubMed Article (PMID: ${pmid})`;
    } else if (doi) {
      title = `Research Article (DOI: ${doi})`;
    } else {
      // No identifiers - this reference is essentially useless
      // Mark it as invalid so it won't be displayed
      title = '';
    }
  }
  
  // Detect source from URL
  if (url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('pubmed.ncbi.nlm.nih.gov')) source = 'pubmed';
    else if (urlLower.includes('pmc.ncbi.nlm.nih.gov')) source = 'pmc';
    else if (urlLower.includes('ncbi.nlm.nih.gov/books')) source = 'ncbi';
    else if (urlLower.includes('statpearls')) source = 'statpearls';
    else if (urlLower.includes('who.int')) source = 'who';
    else if (urlLower.includes('cdc.gov')) source = 'cdc';
    else if (urlLower.includes('cochrane')) source = 'cochrane';
    else if (urlLower.includes('clinicaltrials.gov')) source = 'clinicaltrials';
    else if (urlLower.includes('jamanetwork.com')) source = 'jama';
    else if (urlLower.includes('nejm.org')) source = 'nejm';
    else if (urlLower.includes('thelancet.com')) source = 'lancet';
    else if (urlLower.includes('bmj.com')) source = 'bmj';
    else if (urlLower.includes('nature.com')) source = 'nature';
    else if (urlLower.includes('nice.org.uk')) source = 'nice';
    else if (urlLower.includes('fda.gov')) source = 'fda';
    else if (urlLower.includes('diabetesjournals.org')) source = 'ada';
    else if (urlLower.includes('ahajournals.org')) source = 'aha';
    else if (urlLower.includes('academic.oup.com')) source = 'pubmed';
  }
  // Detect source from text content
  else if (refLower.includes('statpearls')) source = 'statpearls';
  else if (refLower.includes('cochrane')) source = 'cochrane';
  else if (refLower.includes('who guidelines') || refLower.includes('world health organization')) source = 'who';
  else if (refLower.includes('cdc') || refLower.includes('centers for disease control')) source = 'cdc';
  else if (pmid) source = 'pubmed';
  else if (doi) source = 'pubmed';
  
  // Build URL if we don't have one
  if (!url) {
    if (pmid) {
      url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}`;
    } else if (doi) {
      url = `https://doi.org/${doi}`;
    }
  }
  
  // CRITICAL FIX: Stricter validation - reference must have:
  // 1. A meaningful title (not generic, not a search query)
  // 2. At least one identifier (PMID, DOI, or valid URL)
  const hasValidTitle = title.length > 10 && 
                        !title.match(/^[\d\s]+$/) && 
                        !INVALID_GENERIC_TITLES.some(invalid => title.toLowerCase().includes(invalid)) &&
                        !/^(what|how|why|when|where|which|who|is|are|can|does|do|should)\s/i.test(title);
  
  const hasValidIdentifier = pmid !== null || doi !== null || (url !== null && !url.includes('?term='));
  
  // A reference is valid only if it has BOTH a valid title AND a valid identifier
  // OR if it has a PMID/DOI (even with a generated title like "PubMed Article (PMID: xxx)")
  const isValid = (hasValidTitle && hasValidIdentifier) || pmid !== null || doi !== null;
  
  // Quality indicators
  const leadingJournals = ['Lancet', 'NEJM', 'New England', 'JAMA', 'BMJ', 'Nature', 'Science', 'Cell', 'Circulation', 'Cochrane'];
  const isLeadingJournal = leadingJournals.some(lj => refLower.includes(lj.toLowerCase()));
  const currentYear = new Date().getFullYear();
  const yearNum = year ? parseInt(year) : 0;
  const isRecentResearch = yearNum >= currentYear - 2 && yearNum <= currentYear;
  const isSystematicReview = refLower.includes('systematic review') || refLower.includes('meta-analysis') || refLower.includes('cochrane');
  const isOpenAccess = refLower.includes('open access') || refLower.includes('pmc') || source === 'pmc' || refLower.includes('free full text');
  
  return {
    title,
    authors,
    journal,
    year,
    volume,
    pages,
    doi,
    pmid,
    url,
    source,
    isLeadingJournal,
    isRecentResearch,
    isSystematicReview,
    isOpenAccess,
    isValid
  };
}

// Helper function to parse Q&A response
function parseQAResponse(response: string): {
  mainContent: string;
  references: string[];
  followUpQuestions: string[];
} {
  const lines = response.split('\n');
  let mainContent: string[] = [];
  let references: string[] = [];
  let followUpQuestions: string[] = [];
  let currentSection: 'main' | 'references' | 'followup' = 'main';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for References section (with or without markdown headers)
    // Also check if next line looks like a reference (starts with [ or number)
    if (trimmed.match(/^#{1,3}\s*References?$/i) || 
        trimmed.match(/^\*\*References?\*\*$/i) ||
        trimmed === 'References' ||
        trimmed === 'References:') {
      currentSection = 'references';
      continue;
    }
    
    // Check for Follow-Up Questions section (multiple variations, with or without markdown)
    if (trimmed.match(/^#{1,3}\s*(Follow[-\s]?Up Questions?|You Might Also Want to Know)$/i) ||
        trimmed.match(/^\*\*(Follow[-\s]?Up Questions?|You Might Also Want to Know)\*\*$/i) ||
        trimmed === 'You Might Also Want to Know' ||
        trimmed === 'You Might Also Want to Know:' ||
        trimmed === 'Follow-Up Questions' ||
        trimmed === 'Follow-Up Questions:' ||
        trimmed === 'Follow Up Questions' ||
        trimmed === 'Follow Up Questions:') {
      currentSection = 'followup';
      continue;
    }
    
    // Add content to appropriate section
    if (currentSection === 'main') {
      mainContent.push(line);
    } else if (currentSection === 'references' && trimmed) {
      // Extract reference - handle multiple formats:
      // 1. "1. [Title](URL)" or "- [Title](URL)"
      // 2. "[[Title](URL)](URL)" - nested link format
      // 3. Plain text references
      let ref = trimmed.replace(/^[\d\.\-\*\+]\s*/, '');
      
      // Clean up markdown link format [Title](URL) - extract both title and URL
      // This handles cases where AI generates: [Title](URL) instead of proper citation format
      const markdownLinkMatch = ref.match(/^\[([^\]]+)\]\((https?:\/\/[^\)]+)\)(.*)$/);
      if (markdownLinkMatch) {
        const title = markdownLinkMatch[1];
        const url = markdownLinkMatch[2];
        const rest = markdownLinkMatch[3].trim();
        // Reconstruct as: Title. URL rest
        ref = `${title}. ${url}${rest ? ' ' + rest : ''}`;
      }
      
      if (ref && ref.length > 5) references.push(ref);
    } else if (currentSection === 'followup' && trimmed) {
      // Extract question (remove leading bullets, numbers, and brackets)
      let question = trimmed.replace(/^[\d\.\-\*\+]\s*/, '');
      
      // Clean up malformed questions:
      // 1. Remove any bold markers
      question = question.replace(/\*\*/g, '');
      
      // 2. Remove surrounding brackets [question?] -> question?
      question = question.replace(/^\[(.+)\]$/, '$1');
      
      // 3. If question contains citations, it's malformed - extract just the question part
      if (question.includes('^[')) {
        // Try to extract just the question before any citation or long text
        const questionMatch = question.match(/^([^.!]+\?)/);
        if (questionMatch) {
          question = questionMatch[1];
        } else {
          // If no clear question, skip this line
          continue;
        }
      }
      
      // 4. Only add if it's a proper question (ends with ?) and we haven't reached the limit
      if (question.endsWith('?') && question.length < 200 && followUpQuestions.length < 3) {
        followUpQuestions.push(question);
      }
    }
  }

  return {
    mainContent: mainContent.join('\n').trim(),
    references,
    followUpQuestions: followUpQuestions.slice(0, 3) // Ensure maximum 3 questions
  };
}

// Helper function to extract sections from response
function extractSection(response: string, keywords: string[]): string {
  const lines = response.split('\n');
  let extractedLines: string[] = [];
  let capturing = false;
  let captureDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if this line starts a section we want
    const startsSection = keywords.some(keyword => 
      trimmedLine.toLowerCase().includes(keyword.toLowerCase()) &&
      (trimmedLine.startsWith('#') || trimmedLine.startsWith('**'))
    );

    if (startsSection) {
      capturing = true;
      captureDepth = 0;
      extractedLines.push(line);
      continue;
    }

    // Check if we hit a new major section (stop capturing)
    if (capturing && trimmedLine.match(/^#{1,2}\s/) && captureDepth > 0) {
      const isOurSection = keywords.some(keyword => 
        trimmedLine.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!isOurSection) {
        break;
      }
    }

    if (capturing) {
      extractedLines.push(line);
      captureDepth++;
    }
  }

  return extractedLines.length > 0 ? extractedLines.join('\n') : response;
}

// Learn More Capabilities Component for General Mode
function LearnMoreCapabilities({ 
  onQuestionClick, 
  loading 
}: { 
  onQuestionClick: (question: string) => void;
  loading: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const capabilities = [
    {
      title: "Health & Wellness Questions",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      questions: [
        "What are the best ways to lower my cholesterol naturally?",
        "What foods help reduce blood pressure the fastest?",
        "How much water should I drink every day for good health?"
      ]
    },
    {
      title: "Treatment & Home Remedies",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      questions: [
        "What are natural remedies for joint pain?",
        "What can I do at home to feel better if I have a cold?",
        "Are there any home treatments for acid reflux?"
      ]
    },
    {
      title: "Medication Safety",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      questions: [
        "Do painkillers have side effects I should watch out for?",
        "Is it safe to take allergy pills every day?",
        "Can I take ibuprofen and acetaminophen together?"
      ]
    },
    {
      title: "Nutrition & Diet",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      questions: [
        "Is eating eggs safe if I have high cholesterol?",
        "What vitamins should I take daily?",
        "Are artificial sweeteners bad for my health?"
      ]
    },
    {
      title: "Understanding Test Results",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 4h6m-6 4h6m-3 4h3" />
        </svg>
      ),
      questions: [
        "What tests should I ask my doctor about for heart health?",
        "What does it mean if my blood sugar is high?",
        "How often should I get a cholesterol test?"
      ]
    },
    {
      title: "Exercise & Fitness",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      questions: [
        "Is it true that exercise boosts your mood?",
        "How much exercise do I need to stay healthy?",
        "Can walking really help with diabetes?"
      ]
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="mt-6"
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mx-auto flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors font-ui"
      >
        <span>Learn More Capabilities</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-6 max-w-4xl mx-auto space-y-6"
        >
          {capabilities.map((capability, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2 text-gray-900 font-ui font-semibold">
                <span className="text-blue-600">{capability.icon}</span>
                <span>{capability.title}</span>
              </div>
              <div className="space-y-2 ml-7">
                {capability.questions.map((question, qIdx) => (
                  <button
                    key={qIdx}
                    onClick={() => onQuestionClick(question)}
                    disabled={loading}
                    className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all text-sm text-gray-700 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between group"
                  >
                    <span>{question}</span>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function GeneralMode() {
  const [query, setQuery] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [modelUsed, setModelUsed] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [hasSubmittedQuery, setHasSubmittedQuery] = useState(false);
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [isResponseComplete, setIsResponseComplete] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [showThinkingDetails, setShowThinkingDetails] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string>(`conv_${Date.now()}`);
  const historyRef = useRef<HTMLDivElement>(null);
  
  const { sendMessage, loading, error } = useGemini({ mode: "general" });

  // Save conversation to localStorage whenever chatHistory changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      const { saveConversation } = require('@/lib/storage');
      const firstUserMessage = chatHistory.find(m => m.role === 'user');
      saveConversation({
        id: conversationId,
        title: firstUserMessage?.content.substring(0, 50) + '...' || 'New Conversation',
        timestamp: new Date(),
        preview: firstUserMessage?.content.substring(0, 100) || '',
        messages: chatHistory.map(m => ({ role: m.role, content: m.content })),
        mode: 'general'
      });
    }
  }, [chatHistory, conversationId]);

  // Handle new conversation
  const handleNewConversation = () => {
    setChatHistory([]);
    setQuery("");
    setUploadedFiles([]);
    setHasSubmittedQuery(false);
    setCurrentResponse("");
    setIsResponseComplete(false);
    setConversationId(`conv_${Date.now()}`); // Generate new conversation ID
  };

  // Handle conversation selection - load from localStorage
  const handleSelectConversation = (id: string) => {
    const { getConversationById } = require('@/lib/storage');
    const conversation = getConversationById(id);
    if (conversation) {
      setConversationId(id);
      setChatHistory(conversation.messages.map((m: { role: 'user' | 'assistant'; content: string }, idx: number) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(conversation.timestamp),
      })));
      setHasSubmittedQuery(true);
      setIsResponseComplete(true);
      if (conversation.messages.length > 0) {
        const lastAssistant = conversation.messages.filter((m: { role: string }) => m.role === 'assistant').pop();
        if (lastAssistant) {
          setCurrentResponse(lastAssistant.content);
        }
      }
    }
  };

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };

    if (showHistory) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHistory]);

  // Listen for follow-up question clicks
  useEffect(() => {
    const handleFollowUpQuestion = async (event: any) => {
      const question = event.detail as string;
      
      // Directly handle the follow-up question
      setCurrentQuestion(question);
      setIsResponseComplete(false);
      setShowThinkingDetails(false);
      
      // Show evidence gathering progress - patient-friendly language
      setThinkingSteps([]);
      setTimeout(() => setThinkingSteps(prev => [...prev, "✓ Understanding your question..."]), 50);
      setTimeout(() => setThinkingSteps(prev => [...prev, "✓ Searching trusted medical sources (PubMed, FDA, MedlinePlus, and more)..."]), 400);
      setTimeout(() => setThinkingSteps(prev => [...prev, "→ Finding reliable, evidence-based information..."]), 1000);
      setTimeout(() => setThinkingSteps(prev => [...prev, "→ Creating a clear, evidence-backed answer..."]), 1800);
      
      // Add user message to history
      const userMessage: Message = {
        role: "user",
        content: question,
        timestamp: new Date(),
      };
      
      setChatHistory(prev => [...prev, userMessage]);
      setCurrentResponse("");
      
      // Don't scroll - keep user at current position to see the response appear
      // The response will appear below naturally
      
      // Send message
      const result = await sendMessage(question, [], chatHistory);
      
      if (result) {
        const assistantMessage: Message = {
          role: "assistant",
          content: result.response,
          timestamp: new Date(),
          medicalImages: result.medicalImages, // Include fetched medical images
        };
        
        setChatHistory(prev => [...prev, assistantMessage]);
        setCurrentResponse(result.response);
        setModelUsed(result.model);
      }
    };

    window.addEventListener('followUpQuestion', handleFollowUpQuestion);

    return () => {
      window.removeEventListener('followUpQuestion', handleFollowUpQuestion);
    };
  }, [chatHistory]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const handleSubmit = async () => {
    if (!query.trim() && uploadedFiles.length === 0) return;
    
    setHasSubmittedQuery(true); // Mark that first query has been submitted
    setCurrentQuestion(query); // Store the question to display
    setIsResponseComplete(false); // Reset completion state
    setShowThinkingDetails(false); // Reset thinking details
    
    // Show evidence gathering progress - patient-friendly language
    setThinkingSteps([]);
    setTimeout(() => setThinkingSteps(prev => [...prev, "✓ Understanding your question..."]), 50);
    setTimeout(() => setThinkingSteps(prev => [...prev, "✓ Searching trusted medical sources (PubMed, FDA, MedlinePlus, and more)..."]), 400);
    setTimeout(() => setThinkingSteps(prev => [...prev, "→ Finding reliable, evidence-based information..."]), 1000);
    setTimeout(() => setThinkingSteps(prev => [...prev, "→ Creating a clear, evidence-backed answer..."]), 1800);
    
    // Convert images to base64 for display
    const imageUrls: string[] = [];
    for (const file of uploadedFiles) {
      if (file.type.startsWith("image/")) {
        const base64 = await fileToBase64(file);
        imageUrls.push(base64);
      }
    }
    
    // Add user message to history
    const userMessage: Message = {
      role: "user",
      content: query,
      timestamp: new Date(),
      files: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setCurrentResponse(""); // Clear previous response
    
    // Clear input and files immediately
    setQuery("");
    setUploadedFiles([]);
    
    // Scroll to bring the new question into view (smooth scroll to top)
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
    
    // Send message with conversation history
    const result = await sendMessage(query, uploadedFiles, chatHistory);
    
    if (result) {
      // Parse visual findings from response
      let visualFindings: VisualFinding[] = [];
      if (imageUrls.length > 0) {
        const parsed = parseVisualFindings(result.response);
        const parsedFlexible = parseVisualFindingsFlexible(result.response);
        visualFindings = cleanVisualFindings([...parsed, ...parsedFlexible]);
      }
      
      // Add assistant response to history
      const assistantMessage: Message = {
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        visualFindings: visualFindings.length > 0 ? visualFindings : undefined,
        medicalImages: result.medicalImages, // Include fetched medical images
      };
      
      setChatHistory(prev => [...prev, assistantMessage]);
      setCurrentResponse(result.response);
      setModelUsed(result.model);
    }
  };

  const handleFollowUpSubmit = async () => {
    if (!followUpQuery.trim()) return;
    
    setCurrentQuestion(followUpQuery); // Update current question
    setIsResponseComplete(false); // Reset completion state
    
    // Add user message to history
    const userMessage: Message = {
      role: "user",
      content: followUpQuery,
      timestamp: new Date(),
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setCurrentResponse(""); // Clear previous response
    
    // Clear follow-up input immediately
    setFollowUpQuery("");
    
    // Don't scroll - keep user at current position to see the response appear
    // The new question and response will appear naturally in the conversation flow
    
    // Send message with conversation history
    const result = await sendMessage(followUpQuery, [], chatHistory);
    
    if (result) {
      // Add assistant response to history
      const assistantMessage: Message = {
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
        medicalImages: result.medicalImages, // Include fetched medical images
      };
      
      setChatHistory(prev => [...prev, assistantMessage]);
      setCurrentResponse(result.response);
      setModelUsed(result.model);
    }
  };
  
  // Helper function to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const clearHistory = () => {
    setChatHistory([]);
    setCurrentResponse("");
    setModelUsed("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <Sidebar
        mode="general"
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        isOpen={sidebarOpen}
        onToggle={setSidebarOpen}
      />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${sidebarOpen ? 'ml-[280px]' : 'ml-0'}`}>
        {/* Header - Sticky */}
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            {/* Menu Button - Only show when sidebar is closed */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Open sidebar"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            
            <button 
              onClick={handleNewConversation}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              title="Start new conversation"
            >
              <div className="w-10 h-10 bg-linear-to-br from-purple-600 to-pink-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">MedGuidence AI</h1>
                <p className="text-xs text-gray-500">General Mode</p>
              </div>
            </button>
          </motion.div>

          <div className="flex items-center gap-3">
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              onClick={() => window.location.href = "/"}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
            >
              Exit
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 px-6 ${hasSubmittedQuery ? 'py-6' : 'flex items-center justify-center py-12'}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-4xl mx-auto"
        >
          {/* Logo/Title - Hide after first query */}
          {!hasSubmittedQuery && (
            <div className="text-center mb-12">
              <h2 className="text-5xl font-light text-gray-900 mb-3">
                Med<span className="font-semibold">Guidence</span>
              </h2>
              <p className="text-gray-500 text-sm">Clear, evidence-based health information for everyone</p>
            </div>
          )}

          {/* Initial Search Container - Hide after first query */}
          {!hasSubmittedQuery && (
          <div className="relative">
            {/* Uploaded Files Display - Above input as "hanging" thumbnails */}
            {uploadedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 flex flex-wrap gap-2 px-2"
              >
                {uploadedFiles.map((file, index) => {
                  const isImage = file.type.startsWith("image/");
                  const imageUrl = isImage ? URL.createObjectURL(file) : null;
                  const fileSizeKB = (file.size / 1024).toFixed(1);
                  
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative group"
                    >
                      {isImage ? (
                        // Compact image thumbnail with filename
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all">
                          <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                            <img
                              src={imageUrl!}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-gray-500">{fileSizeKB} KB</span>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="ml-1 hover:bg-gray-100 rounded-full p-0.5 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-600" />
                          </button>
                        </div>
                      ) : (
                        // Document chip
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all">
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                            {getFileIcon(file)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-gray-500">{fileSizeKB} KB</span>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="ml-1 hover:bg-gray-100 rounded-full p-0.5 transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5 text-gray-500 hover:text-red-600" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Main Search Bar */}
            <div
              className={`relative bg-white border-2 rounded-full shadow-lg transition-all duration-300 ${
                isDragging ? "border-purple-400 shadow-purple-100" : "border-gray-200 hover:border-purple-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex items-center gap-3 px-6 py-4">
                {/* Upload Button */}
                <label className="cursor-pointer group">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <div className="w-10 h-10 rounded-full bg-gray-100 hover:bg-purple-50 flex items-center justify-center transition-colors group-hover:scale-110 transform duration-200">
                    <Upload className="w-5 h-5 text-gray-600 group-hover:text-purple-600" />
                  </div>
                </label>

                {/* Text Input - Auto-resizing with scrolling at max height */}
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask any health question: symptoms, treatments, medications, prevention..."
                  className="flex-1 text-gray-900 placeholder-gray-400 outline-none text-base resize-none overflow-y-auto"
                  disabled={loading}
                  rows={1}
                  style={{ minHeight: '24px', maxHeight: '180px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = '24px';
                    target.style.height = Math.min(target.scrollHeight, 180) + 'px';
                  }}
                />

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={(!query.trim() && uploadedFiles.length === 0) || loading}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 flex items-center justify-center transition-all duration-300 hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-md"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </div>

            {/* Drag & Drop Overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-blue-50/90 border-2 border-dashed border-blue-400 rounded-full flex items-center justify-center pointer-events-none">
                <p className="text-blue-600 font-medium">Drop files here</p>
              </div>
            )}
          </div>
          )}

          {/* Quick Actions - Hide after first query */}
          {!hasSubmittedQuery && (
          <RotatingSuggestions
            mode="general"
            onSelect={(prompt) => setQuery(prompt)}
            disabled={loading}
          />
          )}

          {/* Learn More Capabilities - Collapsible Section */}
          {!hasSubmittedQuery && (
            <LearnMoreCapabilities 
              onQuestionClick={(question) => {
                setQuery(question);
                setTimeout(() => handleSubmit(), 100);
              }}
              loading={loading}
            />
          )}

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <p className="text-red-800 font-medium text-sm">Error:</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </motion.div>
          )}

          {/* Conversation History Display */}
          {hasSubmittedQuery && (() => {
            // Group chat history into Q&A pairs
            const qaPairs: Array<{question: Message, answer: Message | null}> = [];
            for (let i = 0; i < chatHistory.length; i += 2) {
              if (chatHistory[i]?.role === "user") {
                qaPairs.push({
                  question: chatHistory[i],
                  answer: chatHistory[i + 1] || null
                });
              }
            }
            
            const lastUserMessage = chatHistory[chatHistory.length - 2];
            const hasAttachments = lastUserMessage?.files && lastUserMessage.files.length > 0;
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-8 space-y-8"
              >
                {/* Display all Q&A pairs */}
                {qaPairs.map((pair, pairIndex) => {
                  const isLastPair = pairIndex === qaPairs.length - 1;
                  const hasAttachmentsInPair = pair.question.files && pair.question.files.length > 0;
                  
                  return (
                    <div key={pairIndex} className="space-y-6">
                      {/* Question Display - Formatted for clinical questions */}
                      {!hasAttachmentsInPair && (
                        <FormattedQuestion content={pair.question.content} />
                      )}

                      {/* User Query Section - Only show if there are attachments */}
                      {hasAttachmentsInPair && (
                        <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                          <div className="bg-gray-100 px-6 py-3 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900">Your Question</h3>
                          </div>
                          <div className="px-6 py-4">
                            <p className="text-gray-900 mb-4">{pair.question.content}</p>
                            
                            {/* Show uploaded images */}
                            {pair.question.imageUrls && pair.question.imageUrls.length > 0 && (
                              <div className="grid grid-cols-2 gap-4 mt-4">
                                {pair.question.imageUrls.map((imageUrl, idx) => (
                                  <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-200">
                                    <img
                                      src={`data:image/jpeg;base64,${imageUrl}`}
                                      alt={`Uploaded image ${idx + 1}`}
                                      className="w-full h-auto"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Thinking Indicator - Show right under question, before card */}
                      {isLastPair && loading && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-gray-600">
                            {thinkingSteps.length > 0 ? thinkingSteps[thinkingSteps.length - 1] : "Analyzing query..."}
                          </span>
                        </div>
                      )}

                      {/* Evidence Loading Card - Show while gathering evidence */}
                      {isLastPair && loading && (
                        <EvidenceLoadingCard 
                          isLoading={loading}
                          mode="general"
                        />
                      )}

                      {/* AI Response - Always use SimpleResponse in General Mode */}
                      {pair.answer && (
                        <SimpleResponse 
                          response={pair.answer.content} 
                          modelUsed={modelUsed}
                          onComplete={() => isLastPair && setIsResponseComplete(true)}
                          showFollowUpQuestions={isLastPair}
                          medicalImages={pair.answer.medicalImages}
                          conversationId={conversationId}
                        />
                      )}
                      

                    </div>
                  );
                })}
              </motion.div>
            );
          })()}

          {/* Info Text and Evidence Logos - Hide after first query */}
          {!hasSubmittedQuery && (
            <>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mt-12 text-center text-xs text-gray-400"
              >
                All responses are generated using evidence-based medical literature and clinical guidelines
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="mt-6"
              >
                <EvidenceLogosScroll />
              </motion.div>
            </>
          )}
        </motion.div>
      </main>

      {/* Sticky Bottom Input Bar - Show after response is complete */}
      {hasSubmittedQuery && isResponseComplete && chatHistory.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3 bg-gray-50 border-2 border-gray-200 rounded-full px-6 py-3 focus-within:border-purple-400 transition-colors">
              <textarea
                value={followUpQuery}
                onChange={(e) => setFollowUpQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFollowUpSubmit();
                  }
                }}
                placeholder="Ask a follow-up question..."
                className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 outline-none text-base resize-none overflow-y-auto"
                disabled={loading}
                rows={1}
                style={{ minHeight: '24px', maxHeight: '180px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = '24px';
                  target.style.height = Math.min(target.scrollHeight, 180) + 'px';
                }}
              />
              <button
                onClick={handleFollowUpSubmit}
                disabled={!followUpQuery.trim() || loading}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 disabled:bg-gray-300 flex items-center justify-center transition-all duration-300 hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Send className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
