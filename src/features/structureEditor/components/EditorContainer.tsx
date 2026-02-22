import { APP_CONFIG, EXAMPLE_STRUCTURE } from "@/config/constants";
import { HelpPopoverContent, StructureInput } from "@filearchitect/ui";
import { arch, platform } from "@tauri-apps/plugin-os";
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
    const [showPlaceholder, setShowPlaceholder] = React.useState(true);

    const handleEditorChange = React.useCallback(
      (value: string) => {
        setEditorContent(value);
      },
      [setEditorContent]
    );

    React.useEffect(() => {
      let mounted = true;

      const resolvePlaceholderVisibility = async () => {
        try {
          const [osPlatform, osArch] = await Promise.all([platform(), arch()]);
          if (mounted) {
            setShowPlaceholder(!(osPlatform === "macos" && osArch === "x86_64"));
          }
        } catch {
          // Keep placeholder enabled when OS detection is unavailable.
          if (mounted) {
            setShowPlaceholder(true);
          }
        }
      };

      resolvePlaceholderVisibility();

      return () => {
        mounted = false;
      };
    }, []);

    return (
      <div className="h-full relative" data-structure-editor="true">
        <StructureInput
          value={editorContent}
          onStructureChange={handleEditorChange}
          maxLines={isLicenseActive ? undefined : APP_CONFIG.FREE_VERSION_LIMIT}
          placeholder={showPlaceholder ? EXAMPLE_STRUCTURE : undefined}
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
