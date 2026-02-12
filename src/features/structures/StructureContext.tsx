import { useEditorHistory } from "@/hooks/useEditorHistory";
import { debounce } from "@/lib/utils";
import { Replacement, Structure } from "@/types";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStructureManagement } from "./useStructureManagement";

interface StructureContextValue {
  structures: Structure[];
  setStructures: React.Dispatch<React.SetStateAction<Structure[]>>;
  deleteStructure: (name: string) => Promise<void>;
  handleSaveStructure: (
    name: string,
    content: string,
    destinationPath?: string
  ) => Promise<void>;
  handleUpdateStructure: (
    oldName: string,
    newName: string,
    content: string,
    destinationPath?: string
  ) => Promise<void>;
  editorContent: string;
  setEditorContent: (value: string) => void;
  replacements: Replacement[];
  setReplacements: React.Dispatch<React.SetStateAction<Replacement[]>>;
  currentReplacements: Replacement[];
  setCurrentReplacements: React.Dispatch<React.SetStateAction<Replacement[]>>;
  serializeStructure: (
    content: string,
    replacements: Replacement[],
    destinationPath?: string
  ) => string;
  parseStructure: (rawContent: string) => {
    content: string;
    replacements?: Replacement[];
    destinationPath?: string;
  };
  reorderStructures: (reorderedStructures: Structure[]) => Promise<void>;
  isLoading: boolean;

  // Active structure editing
  activeStructure: Structure | null;
  setActiveStructure: (structure: Structure | null) => void;
  exitStructureEditing: () => void;
  createNewStructure: (preserveCurrentContent?: boolean, customName?: string) => Promise<void>;
  
  // Structure destination path (synced with active structure)
  structureDestinationPath: string;
  setStructureDestinationPath: (path: string) => void;

  // Structure selection (no confirmation needed - Quick structure content is preserved)
  requestSelectStructure: (structure: Structure) => void;

  // Rename structure
  renameStructure: (oldName: string, newName: string) => Promise<void>;

  // Undo/Redo support
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const StructureContext = createContext<StructureContextValue | null>(null);

const defaultReplacement: Replacement = {
  search: "",
  replace: "",
  replaceInFiles: true,
  replaceInFolders: true,
};

export const StructureProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    structures,
    setStructures,
    handleSaveStructure: saveStructure,
    deleteStructure,
    serializeStructure,
    parseStructure,
    reorderStructures,
    saveStructureContentQuiet,
    saveStructureDestinationQuiet,
    createEmptyStructure,
    renameStructure,
    isLoading,
  } = useStructureManagement();

  // Use history-aware editor content state
  const {
    content: editorContent,
    setContent: setEditorContent,
    setContentWithoutHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useEditorHistory("");

  const handleSaveStructure = async (
    name: string,
    content: string,
    destinationPath?: string
  ) => {
    await saveStructure(name, content, destinationPath);
  };

  const handleUpdateStructure = async (
    oldName: string,
    newName: string,
    content: string,
    destinationPath?: string
  ) => {
    // Create new structure first so we never lose data
    await saveStructure(newName, content, destinationPath);
    // Then remove the old one if the name changed
    if (oldName !== newName) {
      await deleteStructure(oldName);
    }
  };

  const [replacements, setReplacements] = useState<Replacement[]>([
    defaultReplacement,
  ]);
  const [currentReplacements, setCurrentReplacements] = useState<Replacement[]>(
    [defaultReplacement]
  );

  // Active structure editing state
  const [activeStructure, setActiveStructureState] = useState<Structure | null>(
    null
  );
  const [structureDestinationPath, setStructureDestinationPathState] = useState("");

  // Quick structure state (persists when switching to saved structures)
  const [quickStructureContent, setQuickStructureContent] = useState("");
  const [quickStructureReplacements, setQuickStructureReplacements] = useState<Replacement[]>([
    defaultReplacement,
  ]);

  // Ref to track if we're currently switching structures (to avoid auto-save during switch)
  const isSwitchingRef = useRef(false);
  // Ref to store the last saved content to avoid saving unchanged content
  const lastSavedContentRef = useRef<string>("");
  // Ref to store the last saved destination path
  const lastSavedDestinationRef = useRef<string>("");

  // Debounced auto-save function for content
  const debouncedSave = useMemo(
    () =>
      debounce(async (structureName: string, content: string) => {
        if (isSwitchingRef.current) return;
        if (content === lastSavedContentRef.current) return;

        try {
          const newRawContent = await saveStructureContentQuiet(
            structureName,
            content
          );
          lastSavedContentRef.current = content;
          // Update the active structure's rawContent in memory
          setActiveStructureState((prev) =>
            prev ? { ...prev, rawContent: newRawContent } : null
          );
        } catch (error) {
          console.error("Auto-save failed:", error);
        }
      }, 500),
    [saveStructureContentQuiet]
  );

  // Debounced auto-save function for destination path
  const debouncedSaveDestination = useMemo(
    () =>
      debounce(async (structureName: string, destinationPath: string) => {
        if (isSwitchingRef.current) return;
        if (destinationPath === lastSavedDestinationRef.current) return;

        try {
          const newRawContent = await saveStructureDestinationQuiet(
            structureName,
            destinationPath
          );
          lastSavedDestinationRef.current = destinationPath;
          // Update the active structure's rawContent in memory
          setActiveStructureState((prev) =>
            prev ? { ...prev, rawContent: newRawContent } : null
          );
        } catch (error) {
          console.error("Auto-save destination failed:", error);
        }
      }, 500),
    [saveStructureDestinationQuiet]
  );

  // Auto-save when editor content changes while a structure is active
  useEffect(() => {
    if (activeStructure && !isSwitchingRef.current) {
      debouncedSave(activeStructure.name, editorContent);
    }
  }, [editorContent, activeStructure, debouncedSave]);

  // Listen for undo/redo menu events from Tauri
  useEffect(() => {
    let unlistenUndo: (() => void) | undefined;
    let unlistenRedo: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Dynamic import to handle both Tauri and web environments
        const { listen } = await import("@tauri-apps/api/event");
        
        unlistenUndo = await listen("menu-undo", () => {
          undo();
        });
        
        unlistenRedo = await listen("menu-redo", () => {
          redo();
        });
      } catch (error) {
        // Not in Tauri environment, fall back to keyboard shortcuts
        console.log("Tauri events not available, using keyboard fallback");
      }
    };

    setupListeners();

    // Keyboard fallback for web/non-Tauri environments
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      
      if (isCmdOrCtrl && e.key === "z") {
        const activeElement = document.activeElement;
        const isTextInput =
          activeElement instanceof HTMLInputElement ||
          (activeElement instanceof HTMLTextAreaElement &&
            !activeElement.closest('[data-structure-editor="true"]'));
        
        if (isTextInput) {
          return;
        }

        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      
      if (isCmdOrCtrl && e.key === "y" && !e.shiftKey) {
        const activeElement = document.activeElement;
        const isTextInput =
          activeElement instanceof HTMLInputElement ||
          (activeElement instanceof HTMLTextAreaElement &&
            !activeElement.closest('[data-structure-editor="true"]'));
        
        if (isTextInput) {
          return;
        }

        e.preventDefault();
        redo();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    
    return () => {
      unlistenUndo?.();
      unlistenRedo?.();
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [undo, redo]);

  // Set active structure and load its content
  const setActiveStructure = useCallback(
    (structure: Structure | null) => {
      if (structure) {
        isSwitchingRef.current = true;

        // Save current Quick structure content before switching (if not already editing a structure)
        if (!activeStructure) {
          setQuickStructureContent(editorContent);
          setQuickStructureReplacements(replacements);
        }

        const { content, replacements: structureReplacements, destinationPath } =
          parseStructure(structure.rawContent);

        setActiveStructureState(structure);
        // Use setContentWithoutHistory to avoid polluting undo stack when loading
        setContentWithoutHistory(content);
        lastSavedContentRef.current = content;
        
        // Set destination path from structure
        setStructureDestinationPathState(destinationPath || "");
        lastSavedDestinationRef.current = destinationPath || "";

        if (structureReplacements?.length) {
          setReplacements(structureReplacements);
        } else {
          setReplacements([defaultReplacement]);
        }

        // Allow auto-save after a short delay to let the content settle
        setTimeout(() => {
          isSwitchingRef.current = false;
        }, 100);
      } else {
        setActiveStructureState(null);
        lastSavedContentRef.current = "";
        setStructureDestinationPathState("");
        lastSavedDestinationRef.current = "";
      }
    },
    [parseStructure, setContentWithoutHistory, activeStructure, editorContent, replacements]
  );

  // Exit structure editing mode and restore Quick structure content
  const exitStructureEditing = useCallback(() => {
    setActiveStructureState(null);
    // Restore Quick structure content (without polluting undo stack)
    setContentWithoutHistory(quickStructureContent);
    setReplacements(quickStructureReplacements);
    lastSavedContentRef.current = "";
    setStructureDestinationPathState("");
    lastSavedDestinationRef.current = "";
  }, [setContentWithoutHistory, quickStructureContent, quickStructureReplacements]);

  // Set destination path with auto-save
  const setStructureDestinationPath = useCallback(
    (path: string) => {
      setStructureDestinationPathState(path);
      // Auto-save if we're editing a structure
      if (activeStructure && !isSwitchingRef.current) {
        debouncedSaveDestination(activeStructure.name, path);
      }
    },
    [activeStructure, debouncedSaveDestination]
  );

  // Create a new structure with auto-generated or custom name
  // If preserveCurrentContent is true, the current editor content will be saved to the new structure
  // If customName is provided, use that name instead of auto-generating
  const createNewStructure = useCallback(
    async (preserveCurrentContent = false, customName?: string) => {
      let name: string;
      
      if (customName) {
        // Use custom name, but ensure it's unique
        const existingNames = new Set(structures.map((s) => s.name));
        if (existingNames.has(customName)) {
          let counter = 1;
          let uniqueName = customName;
          while (existingNames.has(uniqueName)) {
            counter++;
            uniqueName = `${customName} ${counter}`;
          }
          name = uniqueName;
        } else {
          name = customName;
        }
      } else {
        // Generate a unique name
        let baseName = "Untitled Structure";
        name = baseName;
        let counter = 1;

        const existingNames = new Set(structures.map((s) => s.name));
        while (existingNames.has(name)) {
          counter++;
          name = `${baseName} ${counter}`;
        }
      }

      // Save current content before switching if we want to preserve it
      const contentToPreserve = preserveCurrentContent ? editorContent : "";

      const newStructure = await createEmptyStructure(name);

      if (preserveCurrentContent && contentToPreserve) {
        // Set structure as active first
        isSwitchingRef.current = true;
        setActiveStructureState(newStructure);
        // Keep the current editor content (don't replace with empty structure content)
        lastSavedContentRef.current = contentToPreserve;
        // Allow auto-save after a short delay
        setTimeout(() => {
          isSwitchingRef.current = false;
          // Trigger a save immediately since content differs from structure
          debouncedSave(name, contentToPreserve);
        }, 100);
      } else {
        setActiveStructure(newStructure);
      }
    },
    [
      structures,
      createEmptyStructure,
      setActiveStructure,
      editorContent,
      debouncedSave,
    ]
  );

  // Request to select a structure - switches immediately (Quick structure content is preserved)
  const requestSelectStructure = useCallback(
    (structure: Structure) => {
      // If already editing this structure, do nothing
      if (activeStructure?.name === structure.name) return;

      // Switch immediately - Quick structure content is preserved automatically
      setActiveStructure(structure);
    },
    [activeStructure, setActiveStructure]
  );

  return (
    <StructureContext.Provider
      value={{
        structures,
        setStructures,
        deleteStructure,
        handleSaveStructure,
        handleUpdateStructure,
        editorContent,
        setEditorContent,
        replacements,
        setReplacements,
        currentReplacements,
        setCurrentReplacements,
        serializeStructure,
        parseStructure,
        reorderStructures,
        isLoading,
        // Active structure editing
        activeStructure,
        setActiveStructure,
        exitStructureEditing,
        createNewStructure,
        // Structure destination path
        structureDestinationPath,
        setStructureDestinationPath,
        // Structure selection
        requestSelectStructure,
        // Rename
        renameStructure,
        // Undo/Redo
        undo,
        redo,
        canUndo,
        canRedo,
      }}
    >
      {children}
    </StructureContext.Provider>
  );
};

export const useStructures = () => {
  const context = useContext(StructureContext);
  if (!context) {
    throw new Error("useStructures must be used within a StructureProvider");
  }
  return context;
};
