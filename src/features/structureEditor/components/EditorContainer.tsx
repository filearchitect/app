import { APP_CONFIG, EXAMPLE_STRUCTURE } from "@/config/constants";
import { HelpPopoverContent, StructureInput } from "@filearchitect/ui";
import React from "react";
import { useStructureEditor } from "../context/StructureEditorContext";
import { DragOverlay } from "./DragOverlay";

interface EditorContainerProps {
  isDragOver: boolean;
  isShiftPressed: boolean;
}

export const EditorContainer: React.FC<EditorContainerProps> = React.memo(
  ({ isDragOver, isShiftPressed }) => {
    const { editorContent, setEditorContent, isLicenseActive, itemCount } =
      useStructureEditor();

    const handleEditorChange = React.useCallback(
      (value: string) => {
        setEditorContent(value);
      },
      [setEditorContent]
    );

    return (
      <div className="h-full relative" data-structure-editor="true">
        <StructureInput
          value={editorContent}
          onStructureChange={handleEditorChange}
          maxLines={isLicenseActive ? undefined : APP_CONFIG.FREE_VERSION_LIMIT}
          placeholder={EXAMPLE_STRUCTURE}
          helpContent={
            <HelpPopoverContent supportCopy={true} supportMove={true} />
          }
        />
        <DragOverlay isDragOver={isDragOver} isShiftPressed={isShiftPressed} />
      </div>
    );
  }
);

EditorContainer.displayName = "EditorContainer";
