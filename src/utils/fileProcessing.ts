import { Replacement } from "@/features/structureEditor/types";
import { expandPath } from "@/features/structureEditor/utils/folderUtils";
import { invoke } from "@tauri-apps/api/core";

export interface FileProcessingOptions {
  shouldMove: boolean;
  replacements: Replacement[];
}

export const processFileForImport = async (
  filePath: string,
  options: FileProcessingOptions
): Promise<string> => {
  const { shouldMove, replacements } = options;
  const delimiter = shouldMove ? ["(", ")"] : ["[", "]"];
  const expandedPath = await expandPath(filePath);

  const isDirectory = await invoke<boolean>("read_directory_contents", {
    path: expandedPath,
  })
    .then(() => true)
    .catch(() => false);

  const baseName = expandedPath.split("/").pop() || expandedPath;
  let newName = baseName;

  // Apply replacements
  for (const replacement of replacements) {
    if (
      (isDirectory && replacement.replaceInFolders) ||
      (!isDirectory && replacement.replaceInFiles)
    ) {
      newName = newName.replace(
        new RegExp(replacement.search, "g"),
        replacement.replace
      );
    }
  }

  const importPath = `${delimiter[0]}${filePath}${delimiter[1]}`;
  return newName !== baseName ? `${importPath} > ${newName}` : importPath;
};

export const processMultipleFilesForImport = async (
  filePaths: string[],
  options: FileProcessingOptions
): Promise<string[]> => {
  const processedFiles = await Promise.all(
    filePaths.map((filePath) => processFileForImport(filePath, options))
  );

  return processedFiles;
};
