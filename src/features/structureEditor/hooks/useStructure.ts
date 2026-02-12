import { useAppBoot } from "@/hooks/useAppBoot";
import {
  getStructure,
  GetStructureResult,
  type FileNameReplacement,
} from "@filearchitect/core";
import { desktopDir, resolve } from "@tauri-apps/api/path";
import { useEffect, useState } from "react";
import { UseStructureOptions } from "../types";
import fs from "../utils/fs";

interface Replacement {
  search: string;
  replace: string;
  replaceInFiles: boolean;
  replaceInFolders: boolean;
}

export function useStructure({
  content = "",
  replacements,
  rootDir,
}: UseStructureOptions) {
  const isInitialized = useAppBoot();
  const [structure, setStructure] = useState<GetStructureResult>({
    operations: [],
    options: {
      rootDir: "",
      replacements: {},
      recursive: true,
      fs,
    },
  });

  useEffect(() => {
    // Don't update structure until app is initialized
    if (!isInitialized) {
      return;
    }

    const updateStructure = async () => {
      try {
        // Include replacements in all applicable categories
        const fileReplacements: FileNameReplacement[] = replacements
          .filter((r) => r.replaceInFiles)
          .map(({ search, replace }) => ({ search, replace }));

        const folderReplacements: FileNameReplacement[] = replacements
          .filter((r) => r.replaceInFolders)
          .map(({ search, replace }) => ({ search, replace }));

        // All replacements that apply to both
        const allReplacements: FileNameReplacement[] = replacements
          .filter((r) => r.replaceInFiles && r.replaceInFolders)
          .map(({ search, replace }) => ({ search, replace }));

        // Get and resolve the root directory
        const resolvedRootDir = await resolve(rootDir || (await desktopDir()));

        const options = {
          rootDir: resolvedRootDir,
          recursive: true,
          fs,
          replacements: {
            all: allReplacements,
            files: fileReplacements,
            folders: folderReplacements,
          },
        } as const;

        const newStructure = await getStructure(content, options);
        console.log("newStructure", newStructure);
        setStructure(newStructure);
      } catch (error) {
        console.error("Error updating structure:", error);
      }
    };

    updateStructure();
  }, [content, replacements, rootDir, isInitialized]);

  return structure;
}
