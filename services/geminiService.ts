import { GoogleGenAI, Type } from "@google/genai";

// Standard Gemini service for non-live interactions (Analysis, OCR, Planning)
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export async function analyzeBusinessDocument(
  fileBase64: string,
  mimeType: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  if (onProgress) onProgress("Initializing analysis model...");

  try {
    // Use gemini-3-pro-preview with thinking for deep analysis of documents
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType
            }
          },
          {
            text: "Analyze this business document. Extract all key information relevant for a voice receptionist agent, including: Business Name, Hours of Operation, Services/Products, Pricing, Cancellation Policies, and any specific instructions found. Return a clear, structured text summary that can be used as system instructions."
          }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 1024 }, // Enable thinking for better extraction accuracy
      }
    });

    return response.text || "Could not extract information.";
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
}

export async function searchWebGrounding(query: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: query,
            config: {
                tools: [{ googleSearch: {} }]
            }
        });
        
        let resultText = response.text;
        
        // Append source links if available
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunks = response.candidates[0].groundingMetadata.groundingChunks;
            const links = chunks
                .map((c: any) => c.web?.uri)
                .filter((uri: string) => uri)
                .join(', ');
            if (links) {
                resultText += `\n(Sources: ${links})`;
            }
        }
        return resultText || "No results found.";
    } catch (e) {
        console.error("Search failed", e);
        return "Search unavailable.";
    }
}

export async function generateSessionSummary(
  transcripts: { speaker: 'user' | 'agent'; text: string }[]
): Promise<string> {
  if (transcripts.length === 0) return "No conversation recorded.";

  try {
    const formattedTranscript = transcripts
      .map(t => `${t.speaker.toUpperCase()}: ${t.text}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Summarize the following customer service call concisely. Identify the main user intent, any actions taken by the agent, and the final outcome.\n\nTranscript:\n${formattedTranscript}`,
    });

    return response.text || "Unable to generate summary.";
  } catch (error) {
    console.error("Summarization failed:", error);
    return "Error generating summary.";
  }
}