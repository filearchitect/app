import { APP_CONFIG, EXAMPLE_STRUCTURE } from "@/config/constants";
import { hasFileExtensionIgnoreEscaped } from "@filearchitect/core";
import { HelpPopoverContent, StructureInput } from "@filearchitect/ui";
import { arch, platform } from "@tauri-apps/plugin-os";
import { useStructures } from "@/features/structures/StructureContext";
import React from "react";
import { toast } from "sonner";
import { useStructureEditor } from "../context/StructureEditorContext";
import { DragOverlay } from "./DragOverlay";

interface EditorContainerProps {
  isDragOver: boolean;
  isShiftPressed: boolean;
}

function shouldBlockIndentOnEmptyLineBelowFile(
  textarea: HTMLTextAreaElement
): boolean {
  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart !== selectionEnd) {
    return false;
  }

  const currentLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextNewlineIndex = value.indexOf("\n", currentLineStart);
  const currentLineEnd =
    nextNewlineIndex === -1 ? value.length : nextNewlineIndex;
  const currentLine = value.slice(currentLineStart, currentLineEnd);

  if (currentLine.trim() !== "") {
    return false;
  }

  const previousLines = value.slice(0, currentLineStart).split("\n");
  for (let i = previousLines.length - 1; i >= 0; i -= 1) {
    const previousLine = previousLines[i].trim();
    if (previousLine === "") {
      continue;
    }

    return hasFileExtensionIgnoreEscaped(previousLine);
  }

  return false;
}

function getCurrentLineBounds(text: string, cursorStart: number) {
  const lineStart = text.lastIndexOf("\n", cursorStart - 1) + 1;
  const nextNewlineIndex = text.indexOf("\n", lineStart);
  const lineEnd = nextNewlineIndex === -1 ? text.length : nextNewlineIndex;

  return { lineStart, lineEnd };
}

function isWithinIndentationPrefix(textarea: HTMLTextAreaElement): boolean {
  const { selectionStart, value } = textarea;
  const { lineStart } = getCurrentLineBounds(value, selectionStart);
  const textBeforeCursor = value.slice(lineStart, selectionStart);

  return /^[\t ]*$/.test(textBeforeCursor);
}

function getIndentWidth(prefix: string): number {
  return prefix.length;
}

function getAllowedIndentLevelForLine(text: string, lineStart: number): number {
  const previousLines = text.slice(0, lineStart).split("\n");

  for (let i = previousLines.length - 1; i >= 0; i -= 1) {
    const previousLine = previousLines[i];
    if (previousLine.trim() === "") {
      continue;
    }

    const previousIndentPrefix = previousLine.match(/^[\t ]*/)?.[0] ?? "";
    return getIndentWidth(previousIndentPrefix) + 1;
  }

  return 0;
}

function canIncreaseIndent(textarea: HTMLTextAreaElement): boolean {
  const { selectionStart, value } = textarea;
  const { lineStart, lineEnd } = getCurrentLineBounds(value, selectionStart);
  const currentLine = value.slice(lineStart, lineEnd);
  const currentIndentPrefix = currentLine.match(/^[\t ]*/)?.[0] ?? "";
  const allowedIndentLevel = getAllowedIndentLevelForLine(value, lineStart);

  return getIndentWidth(currentIndentPrefix) < allowedIndentLevel;
}

function isMultiLineSelection(textarea: HTMLTextAreaElement): boolean {
  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart === selectionEnd) {
    return false;
  }

  return value.slice(selectionStart, selectionEnd).includes("\n");
}

function updateTextareaValueAndSelection(
  textarea: HTMLTextAreaElement,
  nextValue: string,
  nextSelectionStart: number,
  nextSelectionEnd: number,
  setEditorContent: (value: string) => void
) {
  setEditorContent(nextValue);

  window.requestAnimationFrame(() => {
    textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  });
}

function indentSelectedLines(
  textarea: HTMLTextAreaElement,
  setEditorContent: (value: string) => void
): boolean {
  const { selectionStart, selectionEnd, value } = textarea;
  const firstLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const firstLine = value.slice(
    firstLineStart,
    value.indexOf("\n", firstLineStart) === -1
      ? value.length
      : value.indexOf("\n", firstLineStart)
  );
  const firstLineIndentPrefix = firstLine.match(/^[\t ]*/)?.[0] ?? "";
  const allowedIndentLevel = getAllowedIndentLevelForLine(value, firstLineStart);

  if (getIndentWidth(firstLineIndentPrefix) >= allowedIndentLevel) {
    return false;
  }

  const blockToIndent = value.slice(firstLineStart, selectionEnd);
  const lines = blockToIndent.split("\n");
  const indentedBlock = lines.map((line) => `\t${line}`).join("\n");
  const nextValue =
    value.slice(0, firstLineStart) + indentedBlock + value.slice(selectionEnd);

  updateTextareaValueAndSelection(
    textarea,
    nextValue,
    selectionStart + 1,
    selectionEnd + lines.length,
    setEditorContent
  );

  return true;
}

function outdentSelectedLines(
  textarea: HTMLTextAreaElement,
  setEditorContent: (value: string) => void
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const firstLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const blockToOutdent = value.slice(firstLineStart, selectionEnd);
  const lines = blockToOutdent.split("\n");

  let removedTabs = 0;
  const outdentedBlock = lines
    .map((line) => {
      if (line.startsWith("\t")) {
        removedTabs += 1;
        return line.slice(1);
      }

      return line;
    })
    .join("\n");

  if (removedTabs === 0) {
    return;
  }

  const nextValue =
    value.slice(0, firstLineStart) + outdentedBlock + value.slice(selectionEnd);
  const nextSelectionStart =
    selectionStart > firstLineStart ? Math.max(firstLineStart, selectionStart - 1) : selectionStart;
  const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - removedTabs);

  updateTextareaValueAndSelection(
    textarea,
    nextValue,
    nextSelectionStart,
    nextSelectionEnd,
    setEditorContent
  );
}

function normalizeStructureWhitespace(text: string) {
  let normalized = false;
  let previousNonEmptyIndent = -1;

  const nextText = text
    .split("\n")
    .map((line) => {
      let nextLine = line;

      const indentationPrefix = nextLine.match(/^[\t ]*/)?.[0] ?? "";
      const normalizedIndentWidth = getIndentWidth(indentationPrefix);
      const maxAllowedIndent = previousNonEmptyIndent + 1;
      const clampedIndentWidth = Math.min(normalizedIndentWidth, maxAllowedIndent);
      const normalizedPrefix = "\t".repeat(clampedIndentWidth);

      if (
        indentationPrefix.includes(" ") ||
        indentationPrefix !== normalizedPrefix
      ) {
        nextLine = normalizedPrefix + nextLine.slice(indentationPrefix.length);
        normalized = true;
      }

      if (nextLine.trim() !== "") {
        previousNonEmptyIndent = clampedIndentWidth;
      }

      return nextLine;
    })
    .join("\n");

  return { text: nextText, normalized };
}

function replaceTextareaSelection(
  textarea: HTMLTextAreaElement,
  replacement: string,
  setEditorContent: (value: string) => void
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const nextValue =
    value.slice(0, selectionStart) + replacement + value.slice(selectionEnd);
  const nextCursor = selectionStart + replacement.length;

  setEditorContent(nextValue);

  window.requestAnimationFrame(() => {
    textarea.setSelectionRange(nextCursor, nextCursor);
  });
}

export const EditorContainer: React.FC<EditorContainerProps> = React.memo(
  ({ isDragOver, isShiftPressed }) => {
    const { editorContent, setEditorContent, isLicenseActive, itemCount } =
      useStructureEditor();
    const { activeStructure } = useStructures();
    const [showPlaceholder, setShowPlaceholder] = React.useState(true);
    const lastWhitespaceToastRef = React.useRef(0);

    const showWhitespaceToast = React.useCallback((message: string) => {
      const now = Date.now();
      if (now - lastWhitespaceToastRef.current < 1500) {
        return;
      }

      lastWhitespaceToastRef.current = now;
      toast(message);
    }, []);

    const handleEditorChange = React.useCallback(
      (value: string) => {
        const normalizedValue = normalizeStructureWhitespace(value);
        setEditorContent(normalizedValue.text);

        if (normalizedValue.normalized) {
          showWhitespaceToast("Spaces at the start of a line are converted to tabs.");
        }
      },
      [setEditorContent, showWhitespaceToast]
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

    const focusEditorTextarea = React.useCallback(() => {
      const textarea = document.querySelector(
        '[data-structure-editor="true"] textarea'
      ) as HTMLTextAreaElement | null;
      if (!textarea) return;

      textarea.focus({ preventScroll: true });
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    }, []);

    React.useEffect(() => {
      const timer = window.setTimeout(() => {
        focusEditorTextarea();
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }, [activeStructure?.name, focusEditorTextarea]);

    React.useEffect(() => {
      const handler = () => {
        focusEditorTextarea();
      };

      window.addEventListener("focus-structure-editor", handler);
      return () => {
        window.removeEventListener("focus-structure-editor", handler);
      };
    }, [focusEditorTextarea]);

    const handleKeyDownCapture = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Tab") {
          return;
        }

        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement)) {
          return;
        }

        if (isMultiLineSelection(target)) {
          event.preventDefault();
          event.stopPropagation();

          if (event.shiftKey) {
            outdentSelectedLines(target, setEditorContent);
            return;
          }

          if (indentSelectedLines(target, setEditorContent)) {
            return;
          }

          showWhitespaceToast(
            "You can only indent one level deeper than the previous line."
          );
          return;
        }

        if (event.shiftKey) {
          return;
        }

        if (!shouldBlockIndentOnEmptyLineBelowFile(target)) {
          if (canIncreaseIndent(target)) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          showWhitespaceToast(
            "You can only indent one level deeper than the previous line."
          );
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        showWhitespaceToast("You can't indent under a file. Only folders can have children.");
      },
      [setEditorContent, showWhitespaceToast]
    );

    const handleBeforeInputCapture = React.useCallback(
      (event: React.FormEvent<HTMLDivElement>) => {
        const nativeEvent = event.nativeEvent as InputEvent;
        if (nativeEvent.inputType !== "insertText" || nativeEvent.data !== " ") {
          return;
        }

        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement)) {
          return;
        }

        if (!isWithinIndentationPrefix(target)) {
          return;
        }

        event.preventDefault();

        if (!canIncreaseIndent(target)) {
          showWhitespaceToast(
            "You can only indent one level deeper than the previous line."
          );
          return;
        }

        replaceTextareaSelection(target, "\t", setEditorContent);
        showWhitespaceToast("Leading spaces are converted to tabs.");
      },
      [setEditorContent, showWhitespaceToast]
    );

    const handlePasteCapture = React.useCallback(
      (event: React.ClipboardEvent<HTMLDivElement>) => {
        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement)) {
          return;
        }

        const pastedText = event.clipboardData.getData("text");
        if (!pastedText) {
          return;
        }

        const normalizedPaste = normalizeStructureWhitespace(pastedText);
        if (!normalizedPaste.normalized) {
          return;
        }

        event.preventDefault();
        replaceTextareaSelection(target, normalizedPaste.text, setEditorContent);
        showWhitespaceToast("Spaces at the start of a line are converted to tabs.");
      },
      [setEditorContent, showWhitespaceToast]
    );

    return (
      <div
        className="h-full relative"
        data-structure-editor="true"
        onKeyDownCapture={handleKeyDownCapture}
        onBeforeInputCapture={handleBeforeInputCapture}
        onPasteCapture={handlePasteCapture}
      >
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
