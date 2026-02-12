import { generateFolderStructure } from "@/api/ai";
import { useCallback } from "react";

export interface UseAiGenerationOptions {
  onStructureGenerated: (structure: string) => void;
}

export function useAiGeneration({
  onStructureGenerated,
}: UseAiGenerationOptions) {
  const handleAiSubmit = useCallback(
    async (prompt: string) => {
      try {
        const result = await generateFolderStructure(prompt);

        if (result.error) {
          throw new Error(result.error);
        }

        if (result.data) {
          // Extract the folder structure from the AI response
          const folderStructure = extractFolderStructure(result.data);
          onStructureGenerated(folderStructure);
        }
      } catch (error) {
        console.error("AI generation failed:", error);
        throw error;
      }
    },
    [onStructureGenerated]
  );

  return {
    handleAiSubmit,
  };
}

/**
 * Extracts folder structure from AI response
 * Looks for code blocks first, then falls back to parsing the response directly
 */
function extractFolderStructure(aiResponse: string): string {
  // First try to find code blocks in the response that might contain our folder structure
  const codeBlockRegex = /```(?:folderstructure)?\n([\s\S]*?)\n```/;
  const match = aiResponse.match(codeBlockRegex);

  if (match && match[1]) {
    // Found structure in code block
    return match[1].trim();
  }

  // Try to parse the output directly, looking for a structure pattern
  const lines = aiResponse.split("\n");
  const structureLines = lines.filter(
    (line) =>
      line.includes("|") ||
      (!line.startsWith("```") && !line.includes(":") && line.trim().length > 0)
  );

  const folderStructure = structureLines.join("\n");

  // If we can't parse a structure, just use the entire response
  return folderStructure.trim() || aiResponse;
}
