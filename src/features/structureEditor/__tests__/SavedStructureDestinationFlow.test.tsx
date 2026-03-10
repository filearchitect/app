import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStructures } from "@/features/structures/StructureContext";

const mockHandleCreateFolders = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
const mockSetStructureDestinationPath = vi.hoisted(() => vi.fn());
const mockHandleBrowseDirectory = vi.hoisted(() =>
  vi.fn().mockResolvedValue("/saved/new-destination")
);

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuthContext: () => ({
    isLicenseActive: true,
  }),
}));

vi.mock("../hooks/useStructureCreator", () => ({
  useStructureCreator: () => ({
    baseDir: "/quick/default",
    setBaseDir: vi.fn(),
    editorContent: "project",
    setEditorContent: vi.fn(),
    isLoading: false,
    executionReport: null,
    setExecutionReport: vi.fn(),
    handleCreateFolders: mockHandleCreateFolders,
    handleBrowse: vi.fn(),
    handleFileDrop: vi.fn(),
    handleMultipleFileDrop: vi.fn(),
  }),
}));

vi.mock("../hooks/useStructure", () => ({
  useStructure: () => ({
    operations: [],
  }),
}));

vi.mock("../utils/folderUtils", () => ({
  handleBrowseDirectory: mockHandleBrowseDirectory,
}));

import {
  StructureEditorProvider,
  useStructureEditor,
} from "../context/StructureEditorContext.tsx";

let contextSnapshot: ReturnType<typeof useStructureEditor> | null = null;

function ContextProbe() {
  contextSnapshot = useStructureEditor();
  return null;
}

describe("saved structure destination flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextSnapshot = null;

    vi.mocked(useStructures).mockReturnValue({
      structures: [],
      setStructures: vi.fn(),
      deleteStructure: vi.fn(),
      handleSaveStructure: vi.fn(),
      handleUpdateStructure: vi.fn(),
      editorContent: "project",
      setEditorContent: vi.fn(),
      replacements: [],
      setReplacements: vi.fn(),
      currentReplacements: [],
      setCurrentReplacements: vi.fn(),
      serializeStructure: vi.fn(),
      parseStructure: vi.fn(),
      reorderStructures: vi.fn(),
      isLoading: false,
      activeStructure: {
        name: "Saved Structure",
        rawContent: "project",
      },
      setActiveStructure: vi.fn(),
      exitStructureEditing: vi.fn(),
      createNewStructure: vi.fn(),
      structureDestinationPath: "/saved/old-destination",
      setStructureDestinationPath: mockSetStructureDestinationPath,
      requestSelectStructure: vi.fn(),
      renameStructure: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: false,
      canRedo: false,
    });
  });

  it("updates saved destination through structure state and uses it for create", async () => {
    render(
      <StructureEditorProvider>
        <ContextProbe />
      </StructureEditorProvider>
    );

    await waitFor(() => {
      expect(contextSnapshot).not.toBeNull();
    });

    await act(async () => {
      await contextSnapshot!.handleBrowse();
    });

    expect(mockHandleBrowseDirectory).toHaveBeenCalledWith(
      "/saved/old-destination"
    );

    await act(async () => {
      contextSnapshot!.setBaseDir("/saved/new-destination");
    });

    expect(mockSetStructureDestinationPath).toHaveBeenCalledWith(
      "/saved/new-destination"
    );

    await act(async () => {
      await contextSnapshot!.handleCreateFolders();
    });

    expect(mockHandleCreateFolders).toHaveBeenCalledWith(
      undefined,
      "/saved/old-destination"
    );
  });
});
