import React, { useState } from 'react';
import { analyzeBusinessDocument } from '../services/geminiService';

interface KnowledgeBaseProps {
  onContextUpdate: (context: string) => void;
  currentContext: string;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ onContextUpdate, currentContext }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const mimeType = file.type;

        try {
          const analysis = await analyzeBusinessDocument(base64String, mimeType);
          onContextUpdate(currentContext + "\n\n--- Extracted from " + file.name + " ---\n" + analysis);
        } catch (err) {
            setError("Failed to analyze document. Ensure it is a readable image or PDF.");
        } finally {
            setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Error reading file.");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 4.168 6.253v13C4.168 19.125 5.754 19.625 7.5 19.625s3.332-.5 4.168-1.373m4.168-13.627c-1.168 0-2.332.42-3.332 1.253v13C13.668 19.125 15.254 19.625 17 19.625s3.332-.5 4.168-1.373v-13c-.836-.75-2.001-1.123-3.168-1.123" />
        </svg>
        Knowledge Base
      </h3>
      <p className="text-slate-400 text-sm">
        Upload business documents (menus, price lists, policy PDFs) to train your agent.
        We use Gemini 3.0 Pro's deep thinking capabilities to extract key details.
      </p>

      <div className="flex flex-col gap-3">
        <label className="block text-sm font-medium text-slate-300">Add Source Material</label>
        <div className="relative">
             <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              disabled={isAnalyzing}
              className="block w-full text-sm text-slate-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-600 file:text-white
                hover:file:bg-indigo-700
                cursor-pointer disabled:opacity-50"
            />
            {isAnalyzing && (
                <div className="absolute right-0 top-0 h-full flex items-center pr-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                </div>
            )}
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Active Context</label>
        <textarea
          value={currentContext}
          onChange={(e) => onContextUpdate(e.target.value)}
          className="w-full h-40 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          placeholder="Extracted knowledge will appear here. You can also manually edit this..."
        />
      </div>
    </div>
  );
};

export default KnowledgeBase;