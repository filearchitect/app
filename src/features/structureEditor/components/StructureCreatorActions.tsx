import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button } from "@/components/ui/button";
import { FolderPlus } from "lucide-react";
import React from "react";

interface StructureCreatorActionsProps {
  onSaveAsStructure?: () => void;
  isSubmitDisabled: boolean;
  isLoading: boolean;
  onSubmit: () => void;
  hasContent: boolean;
  isStructureMode?: boolean;
  structureName?: string;
}

export const StructureCreatorActions = React.memo<StructureCreatorActionsProps>(
  ({
    onSaveAsStructure,
    isSubmitDisabled,
    isLoading,
    onSubmit,
    hasContent,
    isStructureMode,
    structureName,
  }) => {
    const handleSubmit = React.useCallback(() => {
      onSubmit();
    }, [onSubmit]);

    return (
      <div className="my-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* Show "Save as Structure" only when NOT in structure mode and there's content */}
          {!isStructureMode && hasContent && onSaveAsStructure && (
            <Button onClick={onSaveAsStructure} variant="outline">
              Save
            </Button>
          )}
          {/* Show auto-save indicator when in structure mode */}
          {isStructureMode && structureName && (
            <span className="text-sm text-muted-foreground">
              Editing <span className="font-medium">{structureName}</span>{" "}
              <span className="text-xs">(auto-saved)</span>
            </span>
          )}
        </div>
        <SubmitButton
          isDisabled={isSubmitDisabled}
          isLoading={isLoading}
          onClick={handleSubmit}
          icon={<FolderPlus className="mr-2 h-4 w-4" />}
        />
      </div>
    );
  }
);

StructureCreatorActions.displayName = "StructureCreatorActions";
