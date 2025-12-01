import { useState } from "react";

interface UseGeminiOptions {
  mode: "doctor" | "general";
}

interface MedicalImage {
  url: string;
  title: string;
  source: string;
  license: string;
  thumbnail?: string;
  description?: string;
}

interface GeminiResponse {
  response: string;
  model: string;
  mode: string;
  medicalImages?: MedicalImage[];
}

export function useGemini({ mode }: UseGeminiOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (
    message: string,
    files?: File[],
    history?: any[]
  ): Promise<GeminiResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      // Prepare file data if present
      let fileData: string[] = [];
      if (files && files.length > 0) {
        // Convert files to base64 for API transmission
        fileData = await Promise.all(
          files.map(async (file) => {
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                resolve(reader.result as string);
              };
              reader.readAsDataURL(file);
            });
          })
        );
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          mode,
          files: fileData,
          history: history || [],
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to get response";
        try {
          // Try to get the response text first
          const responseText = await response.text();
          
          // Try to parse it as JSON
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.details || errorMessage;
          } catch {
            // If not JSON, use the text directly
            console.error("Non-JSON error response:", responseText);
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          }
        } catch (readError) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data: GeminiResponse = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendMessage,
    loading,
    error,
  };
}
