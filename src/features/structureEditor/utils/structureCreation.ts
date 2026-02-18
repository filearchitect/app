import { getStoreValue } from "@/api/store";
import type { FileNameReplacement } from "@filearchitect/core";
import { getStructure } from "@filearchitect/core";
import { invoke } from "@tauri-apps/api/core";
import { desktopDir, documentDir, extname, join } from "@tauri-apps/api/path";
import fs from "./fs";

// Cache for the list of available blank files from the remote source
let remoteFilesCache: {
  [key: string]: { url: string; package?: boolean };
} | null = null;
let lastRemoteCacheUpdate: number = 0;
// const REMOTE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const REMOTE_CACHE_DURATION = 0;

// Cache for local blank files we've already checked
const localFilesCache = new Map<string, boolean>();

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
    const response = await fetch(
      "https://cdn.statically.io/gh/filearchitect/blank-files/main/files/files.json"
    );
    if (response.ok) {
      const data = await response.json();
      remoteFilesCache = data.files.reduce(
        (
          acc: { [key: string]: { url: string; package?: boolean } },
          file: { type: string; url?: string; package?: boolean }
        ) => {
          // Prefer the URL provided by the remote index if present
          let url = file.url || "";
          if (!url) {
            const baseUrl = `https://cdn.statically.io/gh/filearchitect/blank-files/main/files/blank.${file.type}`;
            url = file.package ? `${baseUrl}.zip` : baseUrl;
          }
          // If url is relative, build an absolute one
          if (!/^https?:\/\//i.test(url)) {
            url = `https://cdn.statically.io/gh/filearchitect/blank-files/main/${url.replace(
              /^\/?/,
              ""
            )}`;
          }
          acc[file.type] = {
            url,
            package: file.package || false,
          };
          return acc;
        },
        {}
      );
      lastRemoteCacheUpdate = Date.now();
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
      console.log(`[Functional Blank] Found local blank file for ${extension}`);
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
      console.log(
        `[Functional Blank] No functional blank available for ${extension}`
      );
      return null;
    }

    const fileInfo = remoteFiles[extension];
    const url = fileInfo.url;
    console.log(`[Functional Blank] Attempting to download from: ${url}`);

    const response = await fetch(url);
    console.log(`[Functional Blank] Response status: ${response.status}`);
    console.log(
      `[Functional Blank] Content-Type: ${response.headers.get("content-type")}`
    );
    console.log(
      `[Functional Blank] Content-Length: ${response.headers.get(
        "content-length"
      )}`
    );

    if (response.status === 200) {
      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      console.log(
        `[Functional Blank] Successfully downloaded ${data.length} bytes`
      );

      // Cache the file locally
      try {
        const blankFilesDir = await getBlankFilesDir();

        if (fileInfo.package) {
          console.log(`[Functional Blank] Extracting package for ${extension}`);

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
            console.log(
              `[Functional Blank] Removed macOS specific folder: ${macosxFolder}`
            );
          }

          console.log(
            `[Functional Blank] Extracted package for ${extension} to ${blankFilesDir}`
          );

          // Update local cache
          localFilesCache.set(extension, true);

          // Return the original data as we've already processed it
          return data;
        } else {
          // For regular files, just write them directly
          const filePath = await join(blankFilesDir, `blank.${extension}`);
          await fs.writeBinaryFile(filePath, data);
          console.log(`[Functional Blank] Cached blank file for ${extension}`);
          // Update local cache
          localFilesCache.set(extension, true);
        }
      } catch (cacheError) {
        console.error(
          "[Functional Blank] Error caching blank file:",
          cacheError
        );
      }

      return data;
    }

    console.log(
      `[Functional Blank] No functional blank available for ${extension}`
    );
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

  // If not in cache, download and cache for future use
  return await downloadAndCacheBlankFile(extension);
}

async function createEmptyOrFunctionalFile(path: string): Promise<void> {
  try {
    const createFunctional =
      (await getStoreValue<boolean>("createFunctionalBlankFiles")) ?? true; // Default to true
    console.log(
      `[Functional Blank] Create functional files preference: ${createFunctional}`
    );

    if (createFunctional) {
      const rawExtension = await extname(path);
      const extension = rawExtension
        ? rawExtension.replace(/^\./, "").toLowerCase()
        : "";
      console.log(
        `[Functional Blank] Creating file: ${path} with extension: ${extension}`
      );

      if (extension) {
        const data = await getFunctionalBlankFile(extension);
        if (data) {
          console.log(
            `[Functional Blank] Writing functional blank file to: ${path}`
          );
          await fs.writeBinaryFile(path, data);
          return;
        }
      } else {
        console.log(`[Functional Blank] No extension found for: ${path}`);
      }
    }

    // Fall back to empty file if:
    // 1. Preference is disabled
    // 2. No extension
    // 3. Download failed
    // 4. Writing binary file failed
    console.log(`[Functional Blank] Falling back to empty file for: ${path}`);
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
    (r) => r.search.trim().length > 0 && r.replace.trim().length > 0
  );

  const allReplacements: FileNameReplacement[] = valid
    .filter((r) => r.replaceInFiles && r.replaceInFolders)
    .map(({ search, replace }) => ({ search, replace }));

  const fileReplacements: FileNameReplacement[] = [
    ...allReplacements,
    ...valid
      .filter((r) => r.replaceInFiles)
      .map(({ search, replace }) => ({ search, replace })),
  ];

  const folderReplacements: FileNameReplacement[] = [
    ...allReplacements,
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

  const { operations } = await getStructure(structureString, {
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
  }>
): Promise<StructureCreationPlan> {
  const { operations } = await getStructureOperations(
    structureString,
    baseDir,
    replacements
  );

  const existingChecks: Array<{ targetPath: string; exists: boolean }> =
    await Promise.all(
    operations.map(async (operation: any) => ({
      targetPath: operation.targetPath as string,
      exists: await fs.exists(operation.targetPath),
    }))
  );
  const existingTargets = existingChecks
    .filter((check) => check.exists)
    .map((check) => check.targetPath);

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
  const plan = await getStructureCreationPlan(structureString, baseDir, replacements);

  let completedCount = 0;
  const failures: FailedStructureOperation[] = [];

  for (const operation of operations) {
    try {
      switch (operation.type) {
        case "create":
          if (operation.isDirectory) {
            await fs.mkdir(operation.targetPath, { recursive: true });
          } else {
            await createEmptyOrFunctionalFile(operation.targetPath);
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
