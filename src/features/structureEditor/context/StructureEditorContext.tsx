import { useAuthContext } from "@/features/auth/AuthProvider";
import { useStructures } from "@/features/structures/StructureContext";
import type {
  CreateFoldersExecutionResult,
  StructureCreationPlan,
} from "@/lib/filearchitect";
import { Replacement } from "@/types";
import React, { createContext, ReactNode, useContext } from "react";
import { useStructure } from "../hooks/useStructure";
import { useStructureCreator } from "../hooks/useStructureCreator";

interface StructureEditorContextType {
  // Editor state
  baseDir: string;
  setBaseDir: (value: string) => void;
  editorContent: string;
  setEditorContent: (value: string) => void;

  // Loading state
  isLoading: boolean;
  showCreateConfirm: boolean;
  setShowCreateConfirm: (value: boolean) => void;
  createPlan: StructureCreationPlan | null;
  executionReport: CreateFoldersExecutionResult | null;
  setExecutionReport: (report: CreateFoldersExecutionResult | null) => void;

  // Actions
  handleCreateFolders: (
    e?: React.FormEvent,
    confirmCreate?: boolean
  ) => Promise<void>;
  handleBrowse: () => void;
  handleFileDrop: (filePath: string, shiftKey: boolean) => void;
  handleMultipleFileDrop: (filePaths: string[], shiftKey: boolean) => void;

  // Structure data
  structure: ReturnType<typeof useStructure>;

  // Structures
  replacements: Replacement[];
  setReplacements: React.Dispatch<React.SetStateAction<Replacement[]>>;
  handleSaveStructure: ReturnType<typeof useStructures>["handleSaveStructure"];

  // Auth
  isLicenseActive: boolean;

  // Computed values
  itemCount: number;
  hasContent: boolean;
}

const StructureEditorContext = createContext<
  StructureEditorContextType | undefined
>(undefined);

export const StructureEditorProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const {
    handleSaveStructure,
    replacements,
    setReplacements,
    activeStructure,
    structureDestinationPath,
    setStructureDestinationPath,
  } = useStructures();
  const { isLicenseActive } = useAuthContext();

  const {
    baseDir: defaultBaseDir,
    setBaseDir: setDefaultBaseDir,
    editorContent,
    setEditorContent,
    isLoading,
    showCreateConfirm,
    setShowCreateConfirm,
    createPlan,
    executionReport,
    setExecutionReport,
    handleCreateFolders,
    handleBrowse,
    handleFileDrop,
    handleMultipleFileDrop,
  } = useStructureCreator({
    replacements,
  });

  // When editing a structure, use its destination path; otherwise use the default
  const isStructureMode = Boolean(activeStructure);
  const baseDir =
    isStructureMode && structureDestinationPath
      ? structureDestinationPath
      : defaultBaseDir;

  const setBaseDir = React.useCallback(
    (value: string) => {
      if (isStructureMode) {
        // When editing a structure, update the structure's destination path
        setStructureDestinationPath(value);
      } else {
        // Otherwise, update the default base dir
        setDefaultBaseDir(value);
      }
    },
    [isStructureMode, setStructureDestinationPath, setDefaultBaseDir]
  );

  const structure = useStructure({
    content: editorContent,
    replacements,
    rootDir: baseDir,
  });

  const itemCount = React.useMemo(() => {
    if (!editorContent) return 0;
    return editorContent.split("\n").filter((line) => line.trim().length > 0)
      .length;
  }, [editorContent]);

  const hasContent = (editorContent || "").trim() !== "";

  const value = React.useMemo(
    (): StructureEditorContextType => ({
      baseDir,
      setBaseDir,
      editorContent,
      setEditorContent,
      isLoading,
      showCreateConfirm,
      setShowCreateConfirm,
      createPlan,
      executionReport,
      setExecutionReport,
      handleCreateFolders,
      handleBrowse,
      handleFileDrop,
      handleMultipleFileDrop,
      structure,
      replacements,
      setReplacements,
      handleSaveStructure,
      isLicenseActive,
      itemCount,
      hasContent,
    }),
    [
      baseDir,
      setBaseDir,
      editorContent,
      setEditorContent,
      isLoading,
      showCreateConfirm,
      setShowCreateConfirm,
      createPlan,
      executionReport,
      setExecutionReport,
      handleCreateFolders,
      handleBrowse,
      handleFileDrop,
      handleMultipleFileDrop,
      structure,
      replacements,
      setReplacements,
      handleSaveStructure,
      isLicenseActive,
      itemCount,
      hasContent,
    ]
  );

  return (
    <StructureEditorContext.Provider value={value}>
      {children}
    </StructureEditorContext.Provider>
  );
};

export const useStructureEditor = () => {
  const context = useContext(StructureEditorContext);
  if (context === undefined) {
    throw new Error(
      "useStructureEditor must be used within a StructureEditorProvider"
    );
  }
  return context;
};
