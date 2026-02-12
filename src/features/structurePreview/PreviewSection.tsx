import { IconTooltipButton } from "@/components/ui/icon-tooltip-button";
import { type GetStructureResult } from "@filearchitect/core";
import { ClipboardCopy, Eye, EyeOff, ListMinus, ListPlus } from "lucide-react";
import React, { useState } from "react";
import { StructurePreview } from "./StructurePreview";

interface PreviewSectionProps {
  showPreview: boolean;
  structure: GetStructureResult;
  onTogglePreview: () => void;
  destinationPath?: string;
  showCopyToEditor?: boolean;
  onCopyStructureToEditor?: () => void;
}

export const PreviewSection = React.memo<PreviewSectionProps>(
  ({
    showPreview,
    structure,
    onTogglePreview,
    destinationPath = "",
    showCopyToEditor = false,
    onCopyStructureToEditor,
  }) => {
    const [showFullPaths, setShowFullPaths] = useState(false);

    return (
      <div className="h-full relative">
        <div className="border border-gray-300 rounded p-4 h-full overflow-y-auto bg-gray-50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <StructurePreview
            structure={structure}
            showFullPaths={showFullPaths}
          />
          <div className="absolute right-4 top-4 flex gap-2 z-10">
            {showCopyToEditor && (
              <IconTooltipButton
                variant="outline"
                size="sm"
                onClick={onCopyStructureToEditor}
                className="h-8 px-2 bg-white"
                icon={<ClipboardCopy className="h-4 w-4" />}
                label="Copy structure to editor"
              />
            )}
            <IconTooltipButton
              variant="outline"
              size="sm"
              onClick={() => setShowFullPaths((prev) => !prev)}
              className="h-8 px-2 bg-white"
              icon={
                showFullPaths ? (
                  <ListMinus className="h-4 w-4" />
                ) : (
                  <ListPlus className="h-4 w-4" />
                )
              }
              label={showFullPaths ? "Hide paths" : "Show paths"}
            />
            <IconTooltipButton
              variant="outline"
              size="sm"
              onClick={onTogglePreview}
              className="h-8 px-2 bg-white"
              icon={
                showPreview ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )
              }
              label={showPreview ? "Hide preview" : "Show preview"}
            />
          </div>
        </div>
      </div>
    );
  }
);

PreviewSection.displayName = "PreviewSection";
