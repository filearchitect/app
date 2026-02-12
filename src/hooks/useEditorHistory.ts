import { useCallback, useEffect, useRef, useState } from "react";

interface HistoryState {
  past: string[];
  present: string;
  future: string[];
}

interface UseEditorHistoryOptions {
  /** Maximum number of history states to keep */
  maxHistorySize?: number;
  /** Debounce time in ms before saving to history (to group rapid changes) */
  debounceMs?: number;
}

interface UseEditorHistoryReturn {
  /** Current content value */
  content: string;
  /** Set content (will be tracked in history) */
  setContent: (value: string) => void;
  /** Set content directly without tracking (for loading structures) */
  setContentWithoutHistory: (value: string) => void;
  /** Undo to previous state */
  undo: () => void;
  /** Redo to next state */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Clear all history */
  clearHistory: () => void;
}

export function useEditorHistory(
  initialContent: string = "",
  options: UseEditorHistoryOptions = {}
): UseEditorHistoryReturn {
  const { maxHistorySize = 100, debounceMs = 300 } = options;

  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialContent,
    future: [],
  });

  // Track the last committed content to avoid duplicate entries
  const lastCommittedRef = useRef<string>(initialContent);
  // Track the value before the current editing session started (for history)
  const valueBeforeEditingRef = useRef<string>(initialContent);
  // Timer for debouncing history commits
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we're in the middle of an undo/redo operation
  const isUndoRedoRef = useRef(false);
  // Track if we're currently in an editing session (between first keystroke and debounce commit)
  const isEditingRef = useRef(false);

  // Set content with history tracking (debounced)
  const setContent = useCallback(
    (value: string) => {
      // If this is triggered by undo/redo, don't add to history
      if (isUndoRedoRef.current) {
        return;
      }

      // If this is the start of a new editing session, capture the current value
      if (!isEditingRef.current) {
        isEditingRef.current = true;
        valueBeforeEditingRef.current = history.present;
      }

      // Update the present value immediately for responsive UI
      setHistory((prev) => ({
        ...prev,
        present: value,
        future: [], // Clear redo stack when user makes new changes
      }));

      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Schedule a history commit after debounce period
      debounceTimerRef.current = setTimeout(() => {
        const previousValue = valueBeforeEditingRef.current;
        
        // End the editing session
        isEditingRef.current = false;

        // Don't commit if content hasn't changed from the value before editing
        if (value === previousValue) {
          return;
        }

        // Don't commit if this is the same as the last committed value
        if (value === lastCommittedRef.current) {
          return;
        }

        lastCommittedRef.current = value;

        setHistory((prev) => {
          // Add the value before editing to past
          const newPast = [...prev.past, previousValue].slice(-maxHistorySize);

          return {
            past: newPast,
            present: value,
            future: [],
          };
        });
      }, debounceMs);
    },
    [maxHistorySize, debounceMs, history.present]
  );

  // Set content without tracking in history (for loading structures)
  const setContentWithoutHistory = useCallback((value: string) => {
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    isEditingRef.current = false;
    lastCommittedRef.current = value;
    valueBeforeEditingRef.current = value;
    setHistory({
      past: [],
      present: value,
      future: [],
    });
  }, []);

  // Undo to previous state
  const undo = useCallback(() => {
    // Clear any pending debounce and commit current edits first
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // If we were in the middle of editing, commit that first
    if (isEditingRef.current) {
      isEditingRef.current = false;
      const previousValue = valueBeforeEditingRef.current;
      
      setHistory((prev) => {
        // If current value is different from what we started with, add to history
        if (prev.present !== previousValue) {
          const newPast = [...prev.past, previousValue].slice(-maxHistorySize);
          lastCommittedRef.current = prev.present;
          return {
            past: newPast,
            present: prev.present,
            future: [],
          };
        }
        return prev;
      });
    }

    setHistory((prev) => {
      if (prev.past.length === 0) {
        return prev;
      }

      const newPast = [...prev.past];
      const previousState = newPast.pop()!;

      isUndoRedoRef.current = true;
      lastCommittedRef.current = previousState;
      valueBeforeEditingRef.current = previousState;

      // Reset the flag after the state update
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 0);

      return {
        past: newPast,
        present: previousState,
        future: [prev.present, ...prev.future],
      };
    });
  }, [maxHistorySize]);

  // Redo to next state
  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) {
        return prev;
      }

      const newFuture = [...prev.future];
      const nextState = newFuture.shift()!;

      isUndoRedoRef.current = true;
      lastCommittedRef.current = nextState;
      valueBeforeEditingRef.current = nextState;

      // Reset the flag after the state update
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 0);

      return {
        past: [...prev.past, prev.present],
        present: nextState,
        future: newFuture,
      };
    });
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    isEditingRef.current = false;
    setHistory((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }));
    lastCommittedRef.current = history.present;
    valueBeforeEditingRef.current = history.present;
  }, [history.present]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    content: history.present,
    setContent,
    setContentWithoutHistory,
    undo,
    redo,
    canUndo: history.past.length > 0 || isEditingRef.current,
    canRedo: history.future.length > 0,
    clearHistory,
  };
}
