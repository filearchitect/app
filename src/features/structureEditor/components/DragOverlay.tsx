import React from "react";

interface DragOverlayProps {
  isDragOver: boolean;
  isShiftPressed: boolean;
}

export const DragOverlay: React.FC<DragOverlayProps> = React.memo(
  ({ isDragOver, isShiftPressed }) => {
    if (!isDragOver) {
      return null;
    }

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-400 rounded-lg pointer-events-none">
        <div className="text-center">
          <div className="text-blue-600 font-medium">Drop files here</div>
          <div className="text-blue-500 text-sm">
            {isShiftPressed
              ? "Files will be moved to your structure"
              : "Files will be copied to your structure"}
          </div>
          <div className="text-blue-400 text-xs mt-1">
            {isShiftPressed
              ? "Release Shift to copy instead"
              : "Hold Shift to move instead"}
          </div>
        </div>
      </div>
    );
  }
);

DragOverlay.displayName = "DragOverlay";
