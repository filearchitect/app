import { getStoreValue } from "@/api/store";
import { useStructures } from "@/features/structures/StructureContext";
import {
  createFoldersDetailed,
  getStructureCreationPlan,
  type CreateFoldersExecutionResult,
} from "@/lib/filearchitect";
import {
  processFileForImport,
  processMultipleFilesForImport,
} from "@/utils/fileProcessing";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UseStructureCreatorOptions } from "../types";
import { getInitialBaseDir, handleBrowseDirectory } from "../utils/folderUtils";
import { openFolder } from "../utils/structureCreation";

export function useStructureCreator(options: UseStructureCreatorOptions = {}) {
  const [baseDir, setBaseDir] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoOpenFolder, setAutoOpenFolder] = useState(false);
  const [executionReport, setExecutionReport] =
    useState<CreateFoldersExecutionResult | null>(null);

  const { structures, editorContent, setEditorContent } = useStructures();

  useEffect(() => {
    const initializeState = async () => {
      try {
        const initialBaseDir = await getInitialBaseDir();
        const storedBaseDir = await getStoreValue<string>("defaultPath");
        const storedAutoOpen = await getStoreValue<boolean>("autoOpenFolder");
        setBaseDir(storedBaseDir || initialBaseDir);
        setAutoOpenFolder(storedAutoOpen ?? false);

        return () => {};
      } catch (error) {
        console.error("Error initializing state:", error);
      }
    };

    initializeState();
  }, []);

  const runFolderCreation = useCallback(async () => {
    setIsLoading(true);

    const result = await createFoldersDetailed(
      editorContent,
      baseDir,
      options.replacements || []
    );

    if (result.failureCount === 0) {
      toast.success("Folders created successfully", {
        action: autoOpenFolder
          ? undefined
          : {
              label: "Open Folder",
              onClick: async () => {
                try {
                  await invoke("open_folder_command", { path: baseDir });
                  console.log("Folder opened successfully");
                } catch (error) {
                  console.error("Error opening folder:", error);
                  toast.error("Failed to open folder");
                }
              },
            },
      });
    } else if (result.partialSuccess) {
      toast.warning("Created with partial failures", {
        description: `${result.completedCount} completed, ${result.failureCount} failed.`,
      });
      setExecutionReport(result);
    } else {
      toast.error("Failed to create structure", {
        description: `${result.failureCount} operation${result.failureCount === 1 ? "" : "s"} failed.`,
      });
      setExecutionReport(result);
    }

    if (autoOpenFolder && result.completedCount > 0) {
      try {
        await openFolder(result.baseDir);
        console.log("Folder opened automatically");
      } catch (error) {
        console.error("Error opening folder:", error);
        toast.error("Failed to open folder automatically");
      }
    }

    setIsLoading(false);
    return result;
  }, [autoOpenFolder, baseDir, editorContent, options.replacements]);

  const handleCreateFolders = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (isLoading || !editorContent.trim() || !baseDir) return;
      try {
        const plan = await getStructureCreationPlan(
          editorContent,
          baseDir,
          options.replacements || []
        );
        if (plan.summary.existingTargetCount > 0) {
          toast.warning("Some targets already exist", {
            description: `${plan.summary.existingTargetCount} path${
              plan.summary.existingTargetCount === 1 ? "" : "s"
            } may be overwritten or merged.`,
          });
        }
      } catch (error) {
        console.error("Failed to prepare non-blocking creation summary:", error);
      }

      await runFolderCreation();
    },
    [isLoading, editorContent, baseDir, options.replacements, runFolderCreation]
  );

  const handleBrowse = useCallback(async () => {
    const newBaseDir = await handleBrowseDirectory(baseDir);
    if (newBaseDir) setBaseDir(newBaseDir);
  }, [baseDir]);

  const handleFileDrop = useCallback(
    async (filePath: string, shouldMove: boolean = false) => {
      try {
        const newLine = await processFileForImport(filePath, {
          shouldMove,
          replacements: options.replacements || [],
        });

        const currentContent = editorContent.trim();
        const newContent = currentContent
          ? `${currentContent}\n${newLine}`
          : newLine;
        setEditorContent(newContent);
      } catch (error: unknown) {
        console.error("Error handling file drop:", error);
      }
    },
    [editorContent, setEditorContent, options.replacements]
  );

  const handleMultipleFileDrop = useCallback(
    async (filePaths: string[], shouldMove: boolean = false) => {
      try {
        const newLines = await processMultipleFilesForImport(filePaths, {
          shouldMove,
          replacements: options.replacements || [],
        });

        const currentContent = editorContent.trim();
        const newContent = currentContent
          ? `${currentContent}\n${newLines.join("\n")}`
          : newLines.join("\n");

        setEditorContent(newContent);
      } catch (error: unknown) {
        console.error("Error handling multiple file drop:", error);
      }
    },
    [editorContent, setEditorContent, options.replacements]
  );

  return {
    editorContent,
    setEditorContent,
    baseDir,
    setBaseDir,
    isLoading,
    autoOpenFolder,
    executionReport,
    setExecutionReport,
    handleCreateFolders,
    handleBrowse,
    handleFileDrop,
    handleMultipleFileDrop,
    structures,
  };
}
