import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconTooltipButton } from "@/components/ui/icon-tooltip-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_REPLACEMENT } from "@/config/constants";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { useStructures } from "@/features/structures/StructureContext";
import { Minus, Plus, Settings, Sparkles } from "lucide-react";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { useStructureEditor } from "../context/StructureEditorContext";
import { Replacement } from "../types";

interface StructureCreatorSettingsProps {
  onAiGenerate?: () => void;
}

export const StructureCreatorSettings: FC<StructureCreatorSettingsProps> = ({
  onAiGenerate,
}) => {
  const { license } = useAuthContext();
  const { baseDir, setBaseDir, handleBrowse, replacements, setReplacements } =
    useStructureEditor();
  const { activeStructure } = useStructures();
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [localReplacements, setLocalReplacements] =
    useState<Replacement[]>(replacements);

  // Track the previous active structure to detect when a new structure is loaded
  const prevActiveStructureRef = useRef<string | null>(null);

  // Sync local state with context
  useEffect(() => {
    setLocalReplacements(replacements);
  }, [replacements]);

  // Auto-open settings panel when a structure with replacements is loaded
  useEffect(() => {
    const currentStructureName = activeStructure?.name ?? null;
    const prevStructureName = prevActiveStructureRef.current;

    // Only trigger when switching to a different structure
    if (currentStructureName !== prevStructureName) {
      prevActiveStructureRef.current = currentStructureName;

      // Check if the loaded replacements have any non-empty values
      const hasValidReplacements = replacements.some(
        (r) => r.search.trim() !== "" || r.replace.trim() !== ""
      );

      if (hasValidReplacements) {
        setShowAdvancedSettings(true);
      } else if (currentStructureName === null) {
        // When exiting to quick structure, close the panel
        setShowAdvancedSettings(false);
      }
    }
  }, [activeStructure, replacements]);

  // Update context when local state changes
  useEffect(() => {
    setReplacements(localReplacements);
  }, [localReplacements, setReplacements]);

  const addReplacement = useCallback(() => {
    setLocalReplacements((prev) => [...prev, { ...DEFAULT_REPLACEMENT }]);
  }, []);

  const removeReplacement = useCallback(
    (index: number) => {
      if (localReplacements.length <= 1) {
        // Clear the content of the last replacement and close settings
        const clearedReplacement = {
          ...localReplacements[0],
          search: "",
          replace: "",
        };
        setLocalReplacements([clearedReplacement]);
        setShowAdvancedSettings(false);
        return;
      }
      setLocalReplacements((prev) => prev.filter((_, i) => i !== index));
    },
    [localReplacements.length]
  );

  const updateReplacement = useCallback(
    (index: number, field: keyof Replacement, value: string | boolean) => {
      setLocalReplacements((prev) => {
        const newReplacements = [...prev];
        const current = newReplacements[index];
        newReplacements[index] = { ...current, [field]: value };
        return newReplacements;
      });
    },
    []
  );

  // Check if AI feature is available based on license
  const isAiFeatureAvailable = license?.ai_expires_at
    ? new Date(license.ai_expires_at) > new Date()
    : true;

  return (
    <div className="w-full space-y-4 pt-8" data-tauri-drag-region>
      <div>
        {/* <Label htmlFor="baseDir">Destination path</Label> */}
        <div className="flex mt-1 items-center space-x-2">
          <div className="flex items-center w-full">
            <Button
              type="button"
              variant="outline"
              className="border-r rounded-r-none pr-6"
              onClick={handleBrowse}
            >
              Select&nbsp;destination
            </Button>
            <div className="relative flex-grow">
              <Input
                id="baseDir"
                value={baseDir}
                onChange={(e) => setBaseDir(e.target.value)}
                onClick={handleBrowse}
                placeholder="Enter base directory"
                readOnly
                autoComplete="off"
                className="rounded-l-none border-l-0 pl-6 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isAiFeatureAvailable && onAiGenerate && !activeStructure && (
              <IconTooltipButton
                icon={<Sparkles className="h-4 w-4" />}
                onClick={onAiGenerate}
                variant="outline"
                label="Generate structure with AI"
                className=""
              />
            )}
            <IconTooltipButton
              icon={<Settings className="h-4 w-4" />}
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              variant="outline"
              label="Settings"
              className={
                showAdvancedSettings ? "bg-primary text-primary-foreground" : ""
              }
            />
          </div>
        </div>
      </div>

      {showAdvancedSettings && (
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              File name replacements
            </Label>
            <button
              type="button"
              onClick={addReplacement}
              className="flex items-center justify-center h-7 w-7 rounded-md bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            {localReplacements.map((replacement, index) => {
              // Hide minus on first row if it's empty
              const isFirstRowEmpty =
                index === 0 &&
                localReplacements.length === 1 &&
                replacement.search.trim() === "" &&
                replacement.replace.trim() === "";

              return (
                <div key={index} className="flex items-center space-x-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Search"
                      value={replacement.search}
                      onChange={(e) =>
                        updateReplacement(index, "search", e.target.value)
                      }
                      autoComplete="off"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Replace"
                      value={replacement.replace}
                      onChange={(e) =>
                        updateReplacement(index, "replace", e.target.value)
                      }
                      autoComplete="off"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      <Checkbox
                        id={`files-${index}`}
                        checked={replacement.replaceInFiles}
                        onCheckedChange={(checked) =>
                          updateReplacement(
                            index,
                            "replaceInFiles",
                            checked as boolean
                          )
                        }
                      />
                      <Label htmlFor={`files-${index}`} className="text-xs">
                        Files
                      </Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Checkbox
                        id={`folders-${index}`}
                        checked={replacement.replaceInFolders}
                        onCheckedChange={(checked) =>
                          updateReplacement(
                            index,
                            "replaceInFolders",
                            checked as boolean
                          )
                        }
                      />
                      <Label htmlFor={`folders-${index}`} className="text-xs">
                        Folders
                      </Label>
                    </div>
                    {!isFirstRowEmpty && (
                      <button
                        type="button"
                        onClick={() => removeReplacement(index)}
                        className="flex items-center justify-center h-7 w-7 rounded-md bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-colors shadow-sm"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                    {isFirstRowEmpty && <div className="w-7" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
