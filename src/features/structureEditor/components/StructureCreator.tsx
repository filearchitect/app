import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { APP_CONFIG } from "@/config/constants";
import { PreviewSection } from "@/features/structurePreview/PreviewSection";
import { PreviewToggleButton } from "@/features/structurePreview/PreviewToggleButton";
import { useStructures } from "@/features/structures/StructureContext";
import React from "react";
import { toast } from "sonner";
import { useStructureEditor } from "../context/StructureEditorContext";
import { useAiGeneration } from "../hooks/useAiGeneration";
import { useDragAndDrop } from "../hooks/useDragAndDrop";
import { useModalManagement } from "../hooks/useModalManagement";
import AiInputModal from "./AiInputModal";
import { EditorContainer } from "./EditorContainer";
import { LicenseAlert } from "./LicenseAlert";
import { StructureCreatorActions } from "./StructureCreatorActions";
import { StructureCreatorSettings } from "./StructureCreatorSettings";

export const StructureCreator: React.FC = () => {
  const {
    baseDir,
    editorContent,
    setEditorContent,
    isLoading,
    handleCreateFolders,
    executionReport,
    setExecutionReport,
    handleFileDrop,
    handleMultipleFileDrop,
    structure,
    isLicenseActive,
    itemCount,
    hasContent,
  } = useStructureEditor();

  const {
    activeStructure,
    createNewStructure,
  } = useStructures();

  const { isDragOver, isShiftPressed } = useDragAndDrop({
    onFileDrop: handleFileDrop,
    onMultipleFileDrop: handleMultipleFileDrop,
  });

  const { handleAiSubmit } = useAiGeneration({
    onStructureGenerated: setEditorContent,
  });

  const {
    showPreview,
    showAiModal,
    togglePreview,
    handleOpenAiModal,
    handleCloseAiModal,
  } = useModalManagement();

  // Save structure dialog state
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [structureNameInput, setStructureNameInput] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const handleCopyExecutionReport = React.useCallback(async () => {
    if (!executionReport) return;

    const lines = [
      `Structure creation report`,
      `Completed: ${executionReport.completedCount}`,
      `Failed: ${executionReport.failureCount}`,
      "",
      "Failed operations:",
      ...executionReport.failures.map((failure) => {
        const source = failure.sourcePath ? ` | source: ${failure.sourcePath}` : "";
        return `- [${failure.type}] target: ${failure.targetPath}${source} | error: ${failure.message}`;
      }),
    ];

    const text = lines.join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Failure report copied");
    } catch (error) {
      console.error("Failed to copy creation report:", error);
      toast.error("Failed to copy report");
    }
  }, [executionReport]);

  // Open the save dialog
  const handleOpenSaveDialog = React.useCallback(() => {
    setStructureNameInput("");
    setShowSaveDialog(true);
  }, []);

  // Save with the entered name
  const handleSaveWithName = React.useCallback(async () => {
    const trimmedName = structureNameInput.trim();
    if (!trimmedName) return;
    
    setIsSaving(true);
    try {
      await createNewStructure(true, trimmedName);
      setShowSaveDialog(false);
      setStructureNameInput("");
    } finally {
      setIsSaving(false);
    }
  }, [structureNameInput, createNewStructure]);

  const isSubmitDisabled = React.useMemo(
    () =>
      !hasContent ||
      !baseDir ||
      (!isLicenseActive && itemCount >= APP_CONFIG.FREE_VERSION_LIMIT),
    [hasContent, baseDir, isLicenseActive, itemCount]
  );

  const isStructureMode = Boolean(activeStructure);

  const handleCopyStructureToEditor = React.useCallback(() => {
    // Build text from preview operations using tab indentation per depth
    const lines = structure.operations.map(
      (op: { depth: number; name: string }) => {
        const indent = op.depth > 0 ? Array(op.depth).fill("\t").join("") : "";
        return `${indent}${op.name}`;
      }
    );
    const replacementText = lines.join("\n");

    // Find the textarea bound to editorContent
    const textareas = document.querySelectorAll("textarea");
    let targetTextarea: HTMLTextAreaElement | null = null;
    for (const textarea of textareas) {
      if ((textarea as HTMLTextAreaElement).value === editorContent) {
        targetTextarea = textarea as HTMLTextAreaElement;
        break;
      }
    }

    if (!targetTextarea) {
      // Fallback: append to end
      const newContent =
        (editorContent ? editorContent + "\n" : "") + replacementText;
      setEditorContent(newContent);
      return;
    }

    const { selectionStart, selectionEnd } = targetTextarea;
    const content = editorContent;

    // Compute full line bounds for replacement
    const lineStart =
      content.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const nextNewline = content.indexOf("\n", selectionEnd);
    const lineEnd = nextNewline === -1 ? content.length : nextNewline;

    const lineText = content.slice(lineStart, lineEnd);
    const baseIndentMatch = lineText.match(/^[\t ]*/);
    const baseIndent = baseIndentMatch ? baseIndentMatch[0] : "";

    // Prefix each generated line with the base indent to preserve context alignment
    const indentedReplacement = replacementText
      .split("\n")
      .map((l: string) => baseIndent + l)
      .join("\n");

    const before = content.slice(0, lineStart);
    const after = content.slice(lineEnd);

    const newContent = before + indentedReplacement + after;
    setEditorContent(newContent);
  }, [editorContent, setEditorContent, structure.operations]);

  const hasExpandableAtCursor = React.useMemo(() => {
    // Detect ([...]) containing a file system-like path
    const pattern = /(\([^)]*[\/\\][^)]*\))|(\[[^\]]*[\/\\][^\]]*\])/;

    const textareas = document.querySelectorAll("textarea");
    for (const textarea of textareas) {
      if ((textarea as HTMLTextAreaElement).value === editorContent) {
        const ta = textarea as HTMLTextAreaElement;
        const { selectionStart, selectionEnd } = ta;
        const content = editorContent;
        const lineStart =
          content.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
        const nextNewline = content.indexOf("\n", selectionEnd);
        const lineEnd = nextNewline === -1 ? content.length : nextNewline;
        const lineText = content.slice(lineStart, lineEnd);
        // Show if current line matches, or anywhere in the document (e.g., loaded from structures)
        return pattern.test(lineText) || pattern.test(editorContent);
      }
    }
    // Fallback: scan entire content
    return pattern.test(editorContent);
  }, [editorContent]);

  return (
    <div className="h-full flex flex-col px-8 ">
      <div className="flex-grow flex flex-col overflow-hidden">
        <div className="w-full mx-auto h-full flex flex-col">
          <div
            className="flex justify-between items-center"
            data-tauri-drag-region
          >
            <StructureCreatorSettings onAiGenerate={handleOpenAiModal} />
          </div>

          <div
            className={`mt-4 flex-1 min-h-0 flex flex-col transition-all duration-200 ${
              isStructureMode ? "bg-blue-50/30 -mx-4 px-4 rounded-lg" : ""
            }`}
          >
            <LicenseAlert
              isLicenseActive={isLicenseActive}
              itemCount={itemCount}
            />
            <div className="flex-1 min-h-0">
              <ResizablePanelGroup direction="horizontal" className="h-full">
                <ResizablePanel minSize={30}>
                  <div
                    className="h-full relative"
                    data-testid="structure-editor-container"
                  >
                    {!showPreview && hasContent && (
                      <PreviewToggleButton
                        showPreview={showPreview}
                        onToggle={togglePreview}
                      />
                    )}
                    <div className="h-full relative overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <div
                          className={`relative h-full transition-all duration-200 ${
                            isDragOver
                              ? "ring-2 ring-blue-400 ring-opacity-50 bg-blue-50"
                              : ""
                          }`}
                        >
                          <EditorContainer
                            isDragOver={isDragOver}
                            isShiftPressed={isShiftPressed}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </ResizablePanel>
                {showPreview && hasContent && (
                  <>
                    <ResizableHandle
                      withHandle
                      className="w-4 transition-all hover:w-6 data-[dragging]:w-6 bg-transparent group before:w-[2px] before:h-full before:absolute before:left-1/2 before:-translate-x-1/2 before:transition-all hover:before:bg-primary/40 data-[dragging]:before:bg-primary [&>div]:opacity-0 [&>div]:group-hover:opacity-100 [&>div]:group-data-[dragging]:opacity-100 [&>div]:transition-opacity [&>div>div]:opacity-0 [&>div>div]:group-hover:opacity-100 [&>div>div]:group-data-[dragging]:opacity-100"
                    />
                    <ResizablePanel defaultSize={50} minSize={30}>
                      <PreviewSection
                        showPreview={showPreview}
                        structure={structure}
                        onTogglePreview={togglePreview}
                        destinationPath={baseDir}
                        showCopyToEditor={hasExpandableAtCursor}
                        onCopyStructureToEditor={handleCopyStructureToEditor}
                      />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </div>
          </div>
          <div className="py-4 mt-auto">
            <StructureCreatorActions
              isLoading={isLoading}
              onSubmit={() => void handleCreateFolders()}
              onSaveAsStructure={handleOpenSaveDialog}
              isSubmitDisabled={isSubmitDisabled}
              hasContent={hasContent}
              isStructureMode={isStructureMode}
              structureName={activeStructure?.name}
            />
          </div>
        </div>
      </div>

      <AiInputModal
        isOpen={showAiModal}
        onClose={handleCloseAiModal}
        onSubmit={handleAiSubmit}
      />

      <Dialog
        open={Boolean(executionReport && executionReport.failureCount > 0)}
        onOpenChange={(open) => {
          if (!open) {
            setExecutionReport(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Some operations failed</DialogTitle>
            <DialogDescription>
              {executionReport?.completedCount ?? 0} completed,{" "}
              {executionReport?.failureCount ?? 0} failed.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[280px] overflow-y-auto rounded border p-3 text-xs">
            <ul className="space-y-2">
              {(executionReport?.failures ?? []).slice(0, 20).map((failure) => (
                <li key={`${failure.type}-${failure.targetPath}`}>
                  <div
                    className="font-medium truncate"
                    title={`[${failure.type}] ${failure.targetPath}`}
                  >
                    [{failure.type}] {failure.targetPath}
                  </div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground">
                      Error details
                    </summary>
                    <div className="text-muted-foreground break-all mt-1">
                      {failure.message}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => void handleCopyExecutionReport()}
            >
              Copy report
            </Button>
            <Button variant="outline" onClick={() => setExecutionReport(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Structure Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Structure</DialogTitle>
            <DialogDescription>
              Enter a name for your structure.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Structure name"
              value={structureNameInput}
              onChange={(e) => setStructureNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && structureNameInput.trim()) {
                  handleSaveWithName();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveWithName}
              disabled={!structureNameInput.trim() || isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
