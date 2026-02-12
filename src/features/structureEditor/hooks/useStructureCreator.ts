import { getStoreValue } from "@/api/store";
import { useStructures } from "@/features/structures/StructureContext";
import { createFolders } from "@/lib/filearchitect";
import { handleAsyncError } from "@/utils/errorHandling";
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

  const handleCreateFolders = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (isLoading || !editorContent.trim() || !baseDir) return;

      setIsLoading(true);

      const result = await handleAsyncError(
        () => createFolders(editorContent, baseDir, options.replacements || []),
        "Failed to create folders"
      );

      if (result) {
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

        if (autoOpenFolder) {
          try {
            await openFolder(result);
            console.log("Folder opened automatically");
          } catch (error) {
            console.error("Error opening folder:", error);
            toast.error("Failed to open folder automatically");
          }
        }
      }

      setIsLoading(false);
    },
    [isLoading, editorContent, baseDir, autoOpenFolder, options.replacements]
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
    handleCreateFolders,
    handleBrowse,
    handleFileDrop,
    handleMultipleFileDrop,
    structures,
  };
}
