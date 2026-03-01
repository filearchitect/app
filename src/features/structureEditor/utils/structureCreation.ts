import { getStoreValue } from "@/api/store";
import type { FileNameReplacement } from "@filearchitect/core";
import { getStructure } from "@filearchitect/core";
import { invoke } from "@tauri-apps/api/core";
import { desktopDir, documentDir, extname, join } from "@tauri-apps/api/path";
import { fetch } from "@tauri-apps/plugin-http";
import fs from "./fs";

const BLANK_FILES_INDEX_URL =
  "https://raw.githubusercontent.com/filearchitect/blank-files/main/files/files.json";
const BLANK_FILES_RAW_BASE_URL =
  "https://raw.githubusercontent.com/filearchitect/blank-files/main/";

// Cache for the list of available blank files from the remote source
let remoteFilesCache: {
  [key: string]: { url: string; package?: boolean };
} | null = null;
let lastRemoteCacheUpdate: number = 0;
const REMOTE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Cache for local blank files we've already checked
const localFilesCache = new Map<string, boolean>();
const unavailableRemoteExtensions = new Set<string>();
const inFlightFunctionalDownloads = new Map<string, Promise<Uint8Array | null>>();

export interface StructureCreationSummary {
  totalOperations: number;
  createFileCount: number;
  createDirectoryCount: number;
  copyCount: number;
  moveCount: number;
  existingTargetCount: number;
  existingTargets: string[];
}

export interface StructureCreationPlan {
  summary: StructureCreationSummary;
}

export interface FailedStructureOperation {
  type: string;
  targetPath: string;
  sourcePath?: string;
  isDirectory: boolean;
  message: string;
}

export interface CreateFoldersExecutionResult {
  baseDir: string;
  summary: StructureCreationSummary;
  completedCount: number;
  failureCount: number;
  failures: FailedStructureOperation[];
  partialSuccess: boolean;
}

async function getBlankFilesDir(): Promise<string> {
  const documentsDir = await documentDir();
  const blankFilesDir = await join(documentsDir, "FileArchitect", "BlankFiles");
  await fs.mkdir(blankFilesDir, { recursive: true });
  return blankFilesDir;
}

async function updateRemoteFilesCache(): Promise<void> {
  try {
    const response = await fetch(BLANK_FILES_INDEX_URL);
    if (response.ok) {
      const data = await response.json();
      remoteFilesCache = data.files.reduce(
        (
          acc: {
            [key: string]: { url: string; package?: boolean };
          },
          file: { type: string; url?: string; package?: boolean }
        ) => {
          // Prefer the URL provided by the remote index if present
          let relativePath = file.url || "";
          if (!relativePath) {
            relativePath = file.package
              ? `files/blank.${file.type}.zip`
              : `files/blank.${file.type}`;
          }
          // If URL is absolute, use it directly and keep fallback identical.
          if (/^https?:\/\//i.test(relativePath)) {
            acc[file.type] = {
              url: relativePath,
              package: file.package || false,
            };
            return acc;
          }
          const sanitizedPath = relativePath.replace(/^\/+/, "");
          const normalizedPath = sanitizedPath.startsWith("files/")
            ? sanitizedPath
            : `files/${sanitizedPath}`;
          acc[file.type] = {
            url: `${BLANK_FILES_RAW_BASE_URL}${normalizedPath}`,
            package: file.package || false,
          };
          return acc;
        },
        {}
      );
      lastRemoteCacheUpdate = Date.now();
      unavailableRemoteExtensions.clear();
    }
  } catch (error) {
    console.error(
      "[Functional Blank] Error updating remote files cache:",
      error
    );
  }
}

async function getRemoteFilesCache(): Promise<{
  [key: string]: { url: string; package?: boolean };
} | null> {
  if (
    !remoteFilesCache ||
    Date.now() - lastRemoteCacheUpdate > REMOTE_CACHE_DURATION
  ) {
    await updateRemoteFilesCache();
  }
  return remoteFilesCache;
}

async function getLocalBlankFile(
  extension: string
): Promise<Uint8Array | null> {
  try {
    // Check cache first
    if (localFilesCache.has(extension)) {
      const exists = localFilesCache.get(extension);
      if (!exists) return null;
    }

    const blankFilesDir = await getBlankFilesDir();

    // Always check for a local blank file first (works for both package and non-package types)
    const filePath = await join(blankFilesDir, `blank.${extension}`);
    const exists = await fs.exists(filePath);

    // Update cache
    localFilesCache.set(extension, exists);

    if (exists) {
      const data = await fs.readBinaryFile(filePath);
      return data;
    }

    return null;
  } catch (error) {
    console.error("[Functional Blank] Error reading local blank file:", error);
    return null;
  }
}

async function downloadAndCacheBlankFile(
  extension: string
): Promise<Uint8Array | null> {
  try {
    // Check if the file exists in the remote cache
    const remoteFiles = await getRemoteFilesCache();
    if (!remoteFiles || !remoteFiles[extension]) {
      unavailableRemoteExtensions.add(extension);
      return null;
    }

    const fileInfo = remoteFiles[extension];
    const url = fileInfo.url;
    const response = await fetch(url);

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Cache the file locally
      try {
        const blankFilesDir = await getBlankFilesDir();

        if (fileInfo.package) {
          // For zip packages, extract the contents
          const tempZipPath = await join(
            blankFilesDir,
            `temp_${extension}.zip`
          );
          await fs.writeBinaryFile(tempZipPath, data);

          // Extract directly to the BlankFiles directory
          await invoke("extract_zip", {
            zipPath: tempZipPath,
            destinationPath: blankFilesDir,
          });

          // Remove the temporary zip file
          await fs.unlink(tempZipPath);

          // Remove macOS specific folders if they exist
          const macosxFolder = await join(blankFilesDir, "__MACOSX");
          if (await fs.exists(macosxFolder)) {
            await fs.rm(macosxFolder, { recursive: true });
          }

          // Update local cache
          localFilesCache.set(extension, true);
          unavailableRemoteExtensions.delete(extension);

          // Return the original data as we've already processed it
          return data;
        } else {
          // For regular files, just write them directly
          const filePath = await join(blankFilesDir, `blank.${extension}`);
          await fs.writeBinaryFile(filePath, data);
          // Update local cache
          localFilesCache.set(extension, true);
          unavailableRemoteExtensions.delete(extension);
        }
      } catch (cacheError) {
        console.error(
          "[Functional Blank] Error caching blank file:",
          cacheError
        );
      }

      return data;
    }

    unavailableRemoteExtensions.add(extension);
    return null;
  } catch (error) {
    console.error(
      "[Functional Blank] Error downloading functional blank file:",
      error
    );
    return null;
  }
}

async function getFunctionalBlankFile(
  extension: string
): Promise<Uint8Array | null> {
  // First try to get from local cache
  const localData = await getLocalBlankFile(extension);
  if (localData) {
    return localData;
  }

  if (unavailableRemoteExtensions.has(extension)) {
    return null;
  }

  const existingDownload = inFlightFunctionalDownloads.get(extension);
  if (existingDownload) {
    return await existingDownload;
  }

  const downloadPromise = downloadAndCacheBlankFile(extension).finally(() => {
    inFlightFunctionalDownloads.delete(extension);
  });
  inFlightFunctionalDownloads.set(extension, downloadPromise);

  // If not in cache, download and cache for future use
  return await downloadPromise;
}

async function createEmptyOrFunctionalFile(
  path: string,
  createFunctional: boolean
): Promise<void> {
  try {
    if (createFunctional) {
      const rawExtension = await extname(path);
      const extension = rawExtension
        ? rawExtension.replace(/^\./, "").toLowerCase()
        : "";

      if (extension) {
        const data = await getFunctionalBlankFile(extension);
        if (data) {
          await fs.writeBinaryFile(path, data);
          return;
        }
      }
    }

    // Fall back to empty file if:
    // 1. Preference is disabled
    // 2. No extension
    // 3. Download failed
    // 4. Writing binary file failed
    await fs.writeFile(path, "");
  } catch (error) {
    console.error("[Functional Blank] Error creating file:", error);
    // Ensure we at least create an empty file
    await fs.writeFile(path, "");
  }
}

function buildReplacementGroups(
  replacements: Array<{
    search: string;
    replace: string;
    replaceInFiles: boolean;
    replaceInFolders: boolean;
  }>
) {
  const valid = replacements.filter(
    (r) => r.search.trim().length > 0
  );

  const allReplacements: FileNameReplacement[] = valid
    .filter((r) => r.replaceInFiles && r.replaceInFolders)
    .map(({ search, replace }) => ({ search, replace }));

  const fileReplacements: FileNameReplacement[] = [
    ...valid
      .filter((r) => r.replaceInFiles)
      .map(({ search, replace }) => ({ search, replace })),
  ];

  const folderReplacements: FileNameReplacement[] = [
    ...valid
      .filter((r) => r.replaceInFolders)
      .map(({ search, replace }) => ({ search, replace })),
  ];

  return { allReplacements, fileReplacements, folderReplacements };
}

async function getStructureOperations(
  structureString: string,
  baseDir: string,
  replacements: Array<{
    search: string;
    replace: string;
    replaceInFiles: boolean;
    replaceInFolders: boolean;
  }>
) {
  const sanitizedStructureString = structureString
    .split("\n")
    .map((line) => line.replace(/ +$/g, ""))
    .join("\n");

  const { allReplacements, fileReplacements, folderReplacements } =
    buildReplacementGroups(replacements);

  const options = {
    fs,
    replacements: {
      all: allReplacements,
      files: fileReplacements,
      folders: folderReplacements,
    },
  } as const;

  const { operations } = await getStructure(sanitizedStructureString, {
    ...options,
    rootDir: baseDir,
  });

  return { operations, fileReplacements, folderReplacements };
}

export async function getStructureCreationPlan(
  structureString: string,
  baseDir: string,
  replacements: Array<{
    search: string;
    replace: string;
    replaceInFiles: boolean;
    replaceInFolders: boolean;
  }>,
  options?: { includeExistingTargets?: boolean }
): Promise<StructureCreationPlan> {
  const { operations } = await getStructureOperations(
    structureString,
    baseDir,
    replacements
  );

  let existingTargets: string[] = [];
  if (options?.includeExistingTargets !== false) {
    const existingChecks: Array<{ targetPath: string; exists: boolean }> =
      await Promise.all(
        operations.map(async (operation: any) => ({
          targetPath: operation.targetPath as string,
          exists: await fs.exists(operation.targetPath),
        }))
      );
    existingTargets = existingChecks
      .filter((check) => check.exists)
      .map((check) => check.targetPath);
  }

  return {
    summary: {
      totalOperations: operations.length,
      createFileCount: operations.filter(
        (op: any) => op.type === "create" && !op.isDirectory
      ).length,
      createDirectoryCount: operations.filter(
        (op: any) => op.type === "create" && op.isDirectory
      ).length,
      copyCount: operations.filter((op: any) => op.type === "copy").length,
      moveCount: operations.filter((op: any) => op.type === "move").length,
      existingTargetCount: existingTargets.length,
      existingTargets,
    },
  };
}

export async function createFoldersDetailed(
  structureString: string,
  baseDir: string,
  replacements: Array<{
    search: string;
    replace: string;
    replaceInFiles: boolean;
    replaceInFolders: boolean;
  }>
): Promise<CreateFoldersExecutionResult> {
  const { operations, fileReplacements, folderReplacements } =
    await getStructureOperations(structureString, baseDir, replacements);
  const plan = await getStructureCreationPlan(structureString, baseDir, replacements, {
    includeExistingTargets: false,
  });
  const createFunctionalBlankFiles =
    (await getStoreValue<boolean>("createFunctionalBlankFiles")) ?? true;

  let completedCount = 0;
  const failures: FailedStructureOperation[] = [];

  for (const operation of operations) {
    try {
      switch (operation.type) {
        case "create":
          if (operation.isDirectory) {
            await fs.mkdir(operation.targetPath, { recursive: true });
          } else {
            await createEmptyOrFunctionalFile(
              operation.targetPath,
              createFunctionalBlankFiles
            );
          }
          break;
        case "copy":
          if (!operation.sourcePath) {
            throw new Error("Source path is required for copy operations");
          }
          if (operation.isDirectory) {
            const allFiles = await fs.getAllFiles(operation.sourcePath);
            const allDirs = await fs.getAllDirectories(operation.sourcePath);

            for (const dir of allDirs) {
              const relativePath = await fs.getRelativePath(
                operation.sourcePath,
                dir
              );
              let targetDir = operation.targetPath;
              const dirParts = relativePath.split("/");
              const newDirParts = dirParts.map((part) => {
                let result = part;
                for (const { search, replace } of folderReplacements) {
                  result = result.replace(new RegExp(search, "g"), replace);
                }
                return result;
              });

              targetDir = joinPaths(targetDir, ...newDirParts);
              await fs.mkdir(targetDir, { recursive: true });
            }

            for (const file of allFiles) {
              const relativePath = await fs.getRelativePath(
                operation.sourcePath,
                file
              );
              let targetFile = operation.targetPath;
              const fileParts = relativePath.split("/");
              const newFileParts = fileParts.map((part, index, array) => {
                let result = part;
                const isLastPart = index === array.length - 1;
                const replacementsToApply = isLastPart
                  ? fileReplacements
                  : folderReplacements;

                for (const { search, replace } of replacementsToApply) {
                  result = result.replace(new RegExp(search, "g"), replace);
                }
                return result;
              });

              targetFile = joinPaths(targetFile, ...newFileParts);
              await fs.copyFile(file, targetFile);
            }
          } else {
            let targetPath = operation.targetPath;
            for (const { search, replace } of fileReplacements) {
              const fileName = targetPath.split("/").pop() || "";
              const newFileName = fileName.replace(
                new RegExp(search, "g"),
                replace
              );
              targetPath = targetPath.replace(fileName, newFileName);
            }
            await fs.copyFile(operation.sourcePath, targetPath);
          }
          break;
        case "move":
          if (!operation.sourcePath) {
            throw new Error("Source path is required for move operations");
          }
          if (operation.isDirectory) {
            await fs.moveFolder(operation.sourcePath, operation.targetPath);
          } else {
            await fs.rename(operation.sourcePath, operation.targetPath);
          }
          break;
      }
      completedCount += 1;
    } catch (error) {
      console.error(`Error processing operation:`, operation, error);
      failures.push({
        type: operation.type,
        targetPath: operation.targetPath,
        sourcePath: operation.sourcePath,
        isDirectory: operation.isDirectory,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    baseDir,
    summary: plan.summary,
    completedCount,
    failureCount: failures.length,
    failures,
    partialSuccess: completedCount > 0 && failures.length > 0,
  };
}

export async function createFolders(
  structureString: string,
  baseDir: string,
  replacements: Array<{
    search: string;
    replace: string;
    replaceInFiles: boolean;
    replaceInFolders: boolean;
  }>
): Promise<string> {
  const result = await createFoldersDetailed(structureString, baseDir, replacements);
  if (result.failureCount > 0) {
    throw new Error(
      `${result.failureCount} operation${result.failureCount === 1 ? "" : "s"} failed`
    );
  }
  return result.baseDir;
}

export async function getDesktopDir(): Promise<string> {
  return desktopDir();
}

export async function openFolder(path: string): Promise<void> {
  try {
    await invoke("open_folder_command", { path });
  } catch (error) {
    console.error("Error opening folder:", error);
    throw error;
  }
}

function joinPaths(...segments: string[]): string {
  return segments.join("/");
}
