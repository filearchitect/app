import { useEffect, useState } from "react";

export interface UseDragAndDropOptions {
  onFileDrop: (filePath: string, shouldMove: boolean) => void;
  onMultipleFileDrop: (filePaths: string[], shouldMove: boolean) => void;
}

export function useDragAndDrop({
  onFileDrop,
  onMultipleFileDrop,
}: UseDragAndDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // Set up keyboard event listeners for modifier keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Set up Tauri file drop event listeners
  useEffect(() => {
    let unlistenDrop: (() => void) | null = null;
    let unlistenHover: (() => void) | null = null;
    let unlistenCancelled: (() => void) | null = null;

    const setupFileDropListeners = async () => {
      try {
        if (typeof window !== "undefined" && window.__TAURI__) {
          const { listen } = await import("@tauri-apps/api/event");

          // Listen for drag drop events
          unlistenDrop = await listen("tauri://drag-drop", (event) => {
            // In Tauri 2.0, the payload is an object with paths and position
            let paths: string[] = [];
            if (Array.isArray(event.payload)) {
              // Old format: payload is directly an array
              paths = event.payload;
            } else if (
              event.payload &&
              typeof event.payload === "object" &&
              "paths" in event.payload
            ) {
              // New format: payload is an object with paths property
              paths = (event.payload as any).paths;
            }

            if (paths && paths.length > 0) {
              const shouldMove = isShiftPressed;
              if (paths.length > 1) {
                onMultipleFileDrop(paths, shouldMove);
              } else {
                onFileDrop(paths[0], shouldMove);
              }
            }
            setIsDragOver(false);
          });

          // Listen for drag enter events
          unlistenHover = await listen("tauri://drag-enter", (event) => {
            setIsDragOver(true);
          });

          // Listen for drag leave events
          unlistenCancelled = await listen("tauri://drag-leave", (event) => {
            setIsDragOver(false);
          });
        }
      } catch (error) {
        console.error("Failed to setup file drop listeners:", error);
      }
    };

    setupFileDropListeners();

    return () => {
      try {
        if (unlistenDrop) {
          unlistenDrop();
          unlistenDrop = null;
        }
        if (unlistenHover) {
          unlistenHover();
          unlistenHover = null;
        }
        if (unlistenCancelled) {
          unlistenCancelled();
          unlistenCancelled = null;
        }
      } catch (error) {
        console.error("Failed to cleanup file drop listeners:", error);
      }
    };
  }, [onFileDrop, onMultipleFileDrop, isShiftPressed]);

  return {
    isDragOver,
    isShiftPressed,
  };
}
