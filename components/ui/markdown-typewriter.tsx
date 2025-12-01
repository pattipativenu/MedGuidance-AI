"use client";

import { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { motion } from "framer-motion";

interface MarkdownTypewriterProps {
  content: string;
  speed?: number;
  onComplete?: () => void;
}

/**
 * Tokenizes content into chunks that should be displayed together.
 * This prevents HTML tags from being split mid-way during typing.
 * Also handles citation links [[N]](url) as single tokens.
 */
function tokenizeContent(content: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  
  while (i < content.length) {
    // Check for HTML tags - keep entire tag together
    if (content[i] === '<') {
      const tagEnd = content.indexOf('>', i);
      if (tagEnd !== -1) {
        // Include the entire tag as one token
        tokens.push(content.slice(i, tagEnd + 1));
        i = tagEnd + 1;
        continue;
      }
    }
    
    // Check for citation format [[N]](url) - keep entire citation together
    if (content[i] === '[' && content[i + 1] === '[') {
      // Find the end of [[N]](url) pattern
      const closeBracket = content.indexOf(']]', i);
      if (closeBracket !== -1) {
        // Check if followed by (url)
        const afterBracket = closeBracket + 2;
        if (content[afterBracket] === '(') {
          const urlEnd = content.indexOf(')', afterBracket);
          if (urlEnd !== -1) {
            // Include entire [[N]](url) as one token
            tokens.push(content.slice(i, urlEnd + 1));
            i = urlEnd + 1;
            continue;
          }
        }
        // Just [[N]] without url
        tokens.push(content.slice(i, closeBracket + 2));
        i = closeBracket + 2;
        continue;
      }
    }
    
    // Check for markdown link [text](url) - keep entire link together
    if (content[i] === '[' && content[i + 1] !== '[') {
      const closeBracket = content.indexOf(']', i);
      if (closeBracket !== -1 && content[closeBracket + 1] === '(') {
        const urlEnd = content.indexOf(')', closeBracket);
        if (urlEnd !== -1) {
          tokens.push(content.slice(i, urlEnd + 1));
          i = urlEnd + 1;
          continue;
        }
      }
    }
    
    // Check for sup tags with citations - keep together
    if (content.slice(i, i + 4) === '<sup') {
      const supEnd = content.indexOf('</sup>', i);
      if (supEnd !== -1) {
        tokens.push(content.slice(i, supEnd + 6));
        i = supEnd + 6;
        continue;
      }
    }
    
    // Check for words - group word characters together
    if (/\w/.test(content[i])) {
      let wordEnd = i;
      while (wordEnd < content.length && /\w/.test(content[wordEnd])) {
        wordEnd++;
      }
      tokens.push(content.slice(i, wordEnd));
      i = wordEnd;
      continue;
    }
    
    // Single character (punctuation, space, etc.)
    tokens.push(content[i]);
    i++;
  }
  
  return tokens;
}

export default function MarkdownTypewriter({
  content,
  speed = 1, // Much faster default - 1ms per token
  onComplete,
}: MarkdownTypewriterProps) {
  const [displayedTokenCount, setDisplayedTokenCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  // Tokenize content once
  const tokens = useMemo(() => tokenizeContent(content), [content]);
  
  // Build displayed content from tokens
  const displayedContent = useMemo(() => {
    return tokens.slice(0, displayedTokenCount).join('');
  }, [tokens, displayedTokenCount]);

  useEffect(() => {
    if (displayedTokenCount < tokens.length) {
      // Type multiple tokens per frame for faster display
      const tokensPerFrame = Math.max(3, Math.ceil(tokens.length / 300)); // Adaptive speed
      
      const timeout = setTimeout(() => {
        setDisplayedTokenCount(prev => Math.min(prev + tokensPerFrame, tokens.length));
      }, speed);

      return () => clearTimeout(timeout);
    } else if (!isComplete) {
      setIsComplete(true);
      if (onComplete) {
        onComplete();
      }
    }
  }, [displayedTokenCount, tokens.length, speed, onComplete, isComplete]);

  // Reset when content changes
  useEffect(() => {
    setDisplayedTokenCount(0);
    setIsComplete(false);
  }, [content]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="prose prose-sm max-w-none w-full"
      style={{ maxWidth: '100%' }}
    >
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => (
            <h1 
              className="text-2xl font-bold mt-10 mb-4 block w-full border-b-2 border-gray-200 pb-3" 
              style={{ 
                fontFamily: 'var(--font-lora), Georgia, serif', 
                color: '#0F172A', 
                lineHeight: '1.35',
                fontSize: '24px'
              }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 
              className="text-xl font-bold mt-10 mb-3 block w-full" 
              style={{ 
                fontFamily: 'var(--font-lora), Georgia, serif', 
                fontSize: '20px', 
                fontWeight: 700, 
                lineHeight: '1.35', 
                color: '#0F172A',
                letterSpacing: '-0.01em'
              }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 
              className="text-lg font-semibold mt-6 mb-2 block w-full" 
              style={{ 
                fontFamily: 'var(--font-lora), Georgia, serif', 
                fontSize: '18px', 
                fontWeight: 600, 
                lineHeight: '1.4', 
                color: '#0F172A' 
              }}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p 
              className="mb-5 w-full max-w-full" 
              style={{ 
                fontFamily: 'var(--font-lora), Georgia, serif', 
                fontSize: '16px', 
                fontWeight: 400, 
                lineHeight: '1.8', 
                color: '#374151',
                marginTop: '0.5rem'
              }}
            >
              {children}
            </p>
          ),
          strong: ({ children }) => {
            // Check if this is a section heading (ends with colon or is a known heading)
            const text = String(children);
            const isHeading = text.match(/^(Clinical Snapshot|Quick Answer|Clinical Answer|Evidence Summary|Clinical Response|Clinical Recommendations|Risk|Quick Counter|Clinical Evidence Summary|Summary|Severe\/Systemic|Preferred first-line|If severe|Key Action|Disposition|Ceftriaxone|Doxycycline|Levofloxacin):?$/i);
            
            return (
              <strong style={{ 
                fontWeight: isHeading ? 700 : 600, 
                color: '#111827',
                fontSize: isHeading ? '17px' : 'inherit'
              }}>
                {children}
              </strong>
            );
          },
          ul: ({ children }) => (
            <ul 
              className="list-disc mb-5 space-y-2 w-full pl-6" 
              style={{ 
                fontFamily: 'var(--font-lora), Georgia, serif', 
                fontSize: '16px', 
                lineHeight: '1.8', 
                color: '#374151' 
              }}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol 
              className="list-decimal mb-5 space-y-2 w-full pl-6" 
              style={{ 
                fontFamily: 'var(--font-lora), Georgia, serif', 
                fontSize: '16px', 
                lineHeight: '1.8', 
                color: '#374151' 
              }}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li 
              className="mb-2" 
              style={{ 
                fontFamily: 'var(--font-lora), Georgia, serif', 
                fontSize: '16px', 
                lineHeight: '1.8', 
                color: '#374151',
                paddingLeft: '0.5rem'
              }}
            >
              {children}
            </li>
          ),
          code: ({ children }) => (
            <code className="bg-blue-50 px-2 py-0.5 rounded text-sm font-mono text-blue-700 border border-blue-200">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote 
              className="border-l-4 border-blue-500 pl-5 py-2 italic my-5 bg-blue-50 rounded-r" 
              style={{ 
                fontFamily: 'var(--font-lora), Georgia, serif', 
                color: '#4B5563' 
              }}
            >
              {children}
            </blockquote>
          ),
          sup: ({ children, className }) => (
            <sup className={className || "citation-number"}>{children}</sup>
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {displayedContent}
      </ReactMarkdown>
      {displayedTokenCount < tokens.length && (
        <span className="inline-block w-0.5 h-4 bg-blue-600 animate-pulse ml-0.5" />
      )}
    </motion.div>
  );
}
