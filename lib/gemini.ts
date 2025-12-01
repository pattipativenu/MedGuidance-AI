import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API
// In Next.js, server-side code can access process.env directly
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables");
  throw new Error("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);
const genAIClient = new GoogleGenAI({ apiKey });

/**
 * Available Gemini models (as per official Google AI documentation)
 */
export const GEMINI_MODELS = {
  // Gemini 3 (Latest - 2025)
  PRO_3_PREVIEW: "gemini-3-pro-preview",
  
  // Gemini 2.5 (Stable)
  PRO_2_5: "gemini-2.5-pro",
  PRO_2_5_EXP: "gemini-2.5-pro-exp",
  FLASH_2_5: "gemini-2.5-flash",
  FLASH_2_5_LITE: "gemini-2.5-flash-lite",
  
  // Gemini 2.0 (Stable)
  FLASH_2_0: "gemini-2.0-flash",
  FLASH_2_0_EXP: "gemini-2.0-flash-exp",
  FLASH_2_0_LITE: "gemini-2.0-flash-lite",
  
  // Gemini 1.5 (Legacy)
  FLASH_1_5: "gemini-1.5-flash",
  FLASH_1_5_LATEST: "gemini-1.5-flash-latest",
  PRO_1_5: "gemini-1.5-pro",
  PRO_1_5_LATEST: "gemini-1.5-pro-latest",
} as const;

/**
 * Get the Gemini model instance
 * Uses Gemini 2.5 Flash as the primary model
 * - Fast and cost-effective
 * - Multimodal (text + images)
 */
export function getGeminiModel(modelName?: string) {
  // Default to Gemini 2.5 Flash
  const model = modelName || GEMINI_MODELS.FLASH_2_5;
  
  return genAI.getGenerativeModel({
    model: model,
  });
}

/**
 * Get Gemini model with vision capabilities for image analysis
 * Uses Gemini 2.5 Flash which supports multimodal input (text + images)
 */
export function getGeminiVisionModel() {
  return genAI.getGenerativeModel({
    model: GEMINI_MODELS.FLASH_2_5,
  });
}

/**
 * Get Gemini model with Google Search grounding
 * Enables the model to search the web for up-to-date information
 * Uses the new @google/genai SDK with google_search tool
 */
export function getGeminiWithSearch() {
  return {
    client: genAIClient,
    model: GEMINI_MODELS.FLASH_2_5,
    isSearchEnabled: true
  };
}

export { genAIClient };
export default genAI;
