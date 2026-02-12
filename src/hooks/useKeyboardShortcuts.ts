import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const shortcut = shortcuts.find(
        (s) =>
          s.key === event.key &&
          !!s.ctrlKey === event.ctrlKey &&
          !!s.metaKey === event.metaKey &&
          !!s.shiftKey === event.shiftKey &&
          !!s.altKey === event.altKey
      );

      if (shortcut) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return { navigate };
}

// Predefined shortcuts
export const usePreferencesShortcut = () => {
  const navigate = useNavigate();

  useKeyboardShortcuts([
    {
      key: ",",
      metaKey: true, // cmd+, on macOS
      action: () => navigate("/preferences/general"),
    },
    {
      key: ",",
      ctrlKey: true, // ctrl+, on Windows/Linux
      action: () => navigate("/preferences/general"),
    },
  ]);

  return { navigate };
};
