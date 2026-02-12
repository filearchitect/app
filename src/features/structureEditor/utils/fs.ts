import type {
  FileNameReplacement,
  FileSystem,
  FileSystemOptions,
} from "@filearchitect/core";
import { invoke } from "@tauri-apps/api/core";
import { dirname, homeDir, resolve } from "@tauri-apps/api/path";
import {
  copyFile as tauriCopyFile,
  exists as tauriExists,
  mkdir as tauriMkdir,
  readFile as tauriReadFile,
  rename as tauriRename,
  stat as tauriStat,
  writeFile as tauriWriteFile,
} from "@tauri-apps/plugin-fs";

// Mock process.cwd for @filearchitect/core
// We need this because the core package expects Node.js APIs
if (typeof window !== "undefined") {
  let homeDirPath = "/";

  // Initialize the process object if it doesn't exist
  if (!window.process) {
    window.process = {} as any;
  }

  // Set up a synchronous cwd function that uses a cached home directory
  window.process.cwd = () => homeDirPath;

  // Update the cached path asynchronously
  homeDir()
    .then((path) => {
      homeDirPath = path;
    })
    .catch((error) => {
      console.error("Failed to get home directory:", error);
    });
}

/**
 * Tauri-based implementation of the FileSystem interface
 */
class TauriFileSystem implements FileSystem {
  async exists(path: string): Promise<boolean> {
    const resolvedPath = await resolve(path);
    return await tauriExists(resolvedPath);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const resolvedPath = await resolve(path);
    await tauriMkdir(resolvedPath, { recursive: options?.recursive ?? false });
  }

  async writeFile(path: string, content: string): Promise<void> {
    const resolvedPath = await resolve(path);
    const data = new TextEncoder().encode(content);
    await tauriWriteFile(resolvedPath, data);
  }

  async writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
    const resolvedPath = await resolve(path);
    await tauriWriteFile(resolvedPath, data);
  }

  async readFile(path: string): Promise<string> {
    const resolvedPath = await resolve(path);
    const data = await tauriReadFile(resolvedPath);
    return new TextDecoder().decode(data);
  }

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const resolvedPath = await resolve(path);
    return await tauriReadFile(resolvedPath);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    try {
      const resolvedSrc = await resolve(src);
      const resolvedDest = await resolve(dest);

      // Create parent directories if they don't exist
      const parentDir = await dirname(resolvedDest);
      if (parentDir) {
        await this.mkdir(parentDir, { recursive: true });
      }

      // Try to copy if source exists
      try {
        const sourceExists = await this.exists(resolvedSrc);
        if (sourceExists) {
          await tauriCopyFile(resolvedSrc, resolvedDest);
          return;
        }
      } catch (error) {
        // Ignore errors checking source existence or copying
      }

      // If we get here, either the source doesn't exist or we couldn't access it
      // Create an empty file at the destination
      await this.writeFile(resolvedDest, "");
    } catch (error) {
      // If we can't even write to the destination, throw the error
      throw error;
    }
  }

  async readdir(
    path: string
  ): Promise<{ name: string; isDirectory: () => boolean }[]> {
    try {
      const resolvedPath = await resolve(path);

      // Check if directory exists
      const exists = await this.exists(resolvedPath);
      if (!exists) {
        // Return empty array for non-existent directories
        return [];
      }

      const entries = await invoke<{ name: string; isDirectory: boolean }[]>(
        "read_directory_structure",
        { path: resolvedPath }
      );
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: () => entry.isDirectory,
      }));
    } catch (error) {
      // If there's any error (like forbidden paths), return empty array
      return [];
    }
  }

  async stat(path: string): Promise<{ isDirectory: () => boolean }> {
    const resolvedPath = await resolve(path);
    const stats = await tauriStat(resolvedPath);
    return {
      isDirectory: () => stats.isDirectory,
    };
  }

  async copyFolder(
    src: string,
    dest: string,
    options?: FileSystemOptions
  ): Promise<void> {
    try {
      const resolvedSrc = await resolve(src);
      const resolvedDest = await resolve(dest);

      // Create destination directory
      await this.mkdir(resolvedDest, { recursive: true });

      // Check if source exists
      const sourceExists = await this.exists(resolvedSrc);
      if (!sourceExists) {
        // If source doesn't exist, just leave the empty destination directory
        return;
      }

      try {
        const recursive = options?.recursive ?? true;
        const fileReplacements: FileNameReplacement[] =
          options?.replacements?.files || [];
        const folderReplacements: FileNameReplacement[] =
          options?.replacements?.folders || [];

        // First, get all files and directories recursively
        const allFiles = await this.getAllFiles(resolvedSrc);
        const allDirs = await this.getAllDirectories(resolvedSrc);

        // Helper to apply replacements to a path split into parts
        const applyToParts = (
          parts: string[],
          isLastFile: boolean
        ): string[] => {
          return parts.map((part, index) => {
            const isLast = index === parts.length - 1;
            const rules =
              isLast && isLastFile ? fileReplacements : folderReplacements;
            let result = part;
            for (const { search, replace } of rules) {
              try {
                result = result.replace(new RegExp(search, "g"), replace);
              } catch {
                // Fallback to plain replace if regex invalid
                result = result.split(search).join(replace);
              }
            }
            return result;
          });
        };

        // Create all directories first
        for (const dir of allDirs) {
          const relativePath = await this.getRelativePath(resolvedSrc, dir);
          const dirParts = relativePath.split("/").filter(Boolean);
          const newDirParts = applyToParts(dirParts, false);
          const targetDir = await resolve(resolvedDest, newDirParts.join("/"));
          await this.mkdir(targetDir, { recursive: true });
        }

        // Then copy each file with replacements for the file name
        for (const file of allFiles) {
          const relativePath = await this.getRelativePath(resolvedSrc, file);
          const fileParts = relativePath.split("/").filter(Boolean);
          const newFileParts = applyToParts(fileParts, true);
          const targetFile = await resolve(
            resolvedDest,
            newFileParts.join("/")
          );
          // Ensure parent directory exists
          const parentDir = await dirname(targetFile);
          if (parentDir) {
            await this.mkdir(parentDir, { recursive: true });
          }
          await this.copyFile(file, targetFile);
        }

        // If not recursive, we only ensured top-level entries in the loops above
        if (!recursive) {
          // No extra handling needed as getAllFiles/Dirs are recursive by design;
          // Consumers should pass recursive=false only with flat sources.
        }
      } catch (error) {
        // If we can't read the source directory or its contents,
        // just leave the empty destination directory
      }
    } catch (error) {
      // If we can't even create the destination directory, throw the error
      throw error;
    }
  }

  async unlink(path: string): Promise<void> {
    const resolvedPath = await resolve(path);
    await invoke("remove_file", { path: resolvedPath });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const resolvedOldPath = await resolve(oldPath);
    const resolvedNewPath = await resolve(newPath);
    await tauriRename(resolvedOldPath, resolvedNewPath);
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    const resolvedPath = await resolve(path);
    await invoke("remove_path", {
      path: resolvedPath,
      recursive: options?.recursive ?? false,
    });
  }

  async isDirectory(path: string): Promise<boolean> {
    const stats = await this.stat(path);
    return stats.isDirectory();
  }

  async moveFolder(
    src: string,
    dest: string,
    options?: FileSystemOptions
  ): Promise<void> {
    await this.copyFolder(src, dest, options);
    await this.rm(src, { recursive: true });
  }

  async ensureDir(path: string): Promise<void> {
    await this.mkdir(path, { recursive: true });
  }

  async emptyDir(path: string): Promise<void> {
    const entries = await this.readdir(path);
    for (const entry of entries) {
      const entryPath = await resolve(path, entry.name);
      if (entry.isDirectory()) {
        await this.rm(entryPath, { recursive: true });
      } else {
        await this.unlink(entryPath);
      }
    }
  }

  async copy(src: string, dest: string): Promise<void> {
    try {
      const stats = await this.stat(src);
      if (stats.isDirectory()) {
        await this.copyFolder(src, dest);
      } else {
        await this.copyFile(src, dest);
      }
    } catch (error: unknown) {
      // If we can't stat the source (doesn't exist or forbidden),
      // try to determine type from the path or operation context
      if (src.endsWith("/") || (await this.exists(dest + "/"))) {
        // Treat as directory if source ends with / or dest exists as directory
        await this.copyFolder(src, dest);
      } else {
        // Default to file
        await this.copyFile(src, dest);
      }
    }
  }

  async move(src: string, dest: string): Promise<void> {
    try {
      // First try to copy (this will create empty files/folders if source doesn't exist)
      await this.copy(src, dest);

      // Only try to remove the source if it actually exists
      const exists = await this.exists(src);
      if (exists) {
        await this.remove(src);
      }
    } catch (error: unknown) {
      // If we can't remove the source, but the copy succeeded, that's fine
      // Only throw if it's not a "no such file" error
      if (error instanceof Error && !error.message.includes("No such file")) {
        throw error;
      }
    }
  }

  async existsAs(path: string, type: "file" | "directory"): Promise<boolean> {
    try {
      const stats = await this.stat(path);
      return type === "directory" ? stats.isDirectory() : !stats.isDirectory();
    } catch {
      return false;
    }
  }

  async ensureFile(path: string): Promise<void> {
    const exists = await this.exists(path);
    if (!exists) {
      await this.writeFile(path, "");
    }
  }

  async remove(
    path: string,
    options?: { recursive?: boolean }
  ): Promise<boolean> {
    try {
      const resolvedPath = await resolve(path);
      await invoke("remove_path", {
        path: resolvedPath,
        recursive: options?.recursive ?? false,
      });
      return true;
    } catch (error) {
      console.error(`Error removing path ${path}:`, error);
      return false;
    }
  }

  async isEmptyDir(path: string): Promise<boolean> {
    const entries = await this.readdir(path);
    return entries.length === 0;
  }

  async readFileOrDefault(
    path: string,
    defaultContent: string = ""
  ): Promise<string> {
    try {
      return await this.readFile(path);
    } catch {
      return defaultContent;
    }
  }

  async ensureEmptyDir(path: string): Promise<void> {
    await this.ensureDir(path);
  }

  async copyIfNotExists(src: string, dest: string): Promise<boolean> {
    const exists = await this.exists(dest);
    if (!exists) {
      await this.copy(src, dest);
      return true;
    }
    return false;
  }

  async moveIfNotExists(src: string, dest: string): Promise<boolean> {
    const exists = await this.exists(dest);
    if (!exists) {
      await this.move(src, dest);
      return true;
    }
    return false;
  }

  async getAllFiles(dirPath: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await this.readdir(dirPath);
    for (const entry of entries) {
      const fullPath = await resolve(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        result.push(...subFiles);
      } else {
        result.push(fullPath);
      }
    }
    return result;
  }

  async getAllDirectories(dirPath: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await this.readdir(dirPath);
    for (const entry of entries) {
      const fullPath = await resolve(dirPath, entry.name);
      if (entry.isDirectory()) {
        result.push(fullPath);
        const subDirs = await this.getAllDirectories(fullPath);
        result.push(...subDirs);
      }
    }
    return result;
  }

  async getRelativePath(from: string, to: string): Promise<string> {
    const fromParts = from.split("/").filter(Boolean);
    const toParts = to.split("/").filter(Boolean);

    let commonParts = 0;
    while (
      commonParts < fromParts.length &&
      commonParts < toParts.length &&
      fromParts[commonParts] === toParts[commonParts]
    ) {
      commonParts++;
    }

    const relativeParts = toParts.slice(commonParts);
    return relativeParts.join("/");
  }

  async glob(pattern: string): Promise<string[]> {
    const parts = pattern.split("/");
    const baseDir = parts[0] === "" ? "/" : ".";

    let files = await this.getAllFiles(baseDir);
    files = files.concat(await this.getAllDirectories(baseDir));

    const regexPattern = pattern
      .replace(/\*/g, "[^/]*")
      .replace(/\*\*/g, ".*")
      .replace(/\./g, "\\.");

    const regex = new RegExp(`^${regexPattern}$`);
    return files.filter((file) => regex.test(file));
  }

  matchesPattern(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, "[^/]*")
      .replace(/\*\*/g, ".*")
      .replace(/\./g, "\\.");

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  getCommonParent(...paths: string[]): string {
    if (paths.length === 0) return "";
    if (paths.length === 1) return paths[0];

    const parts = paths.map((p) => p.split("/").filter(Boolean));
    const minLength = Math.min(...parts.map((p) => p.length));

    let commonParts: string[] = [];
    for (let i = 0; i < minLength; i++) {
      const part = parts[0][i];
      if (parts.every((p) => p[i] === part)) {
        commonParts.push(part);
      } else {
        break;
      }
    }

    return commonParts.length ? "/" + commonParts.join("/") : "/";
  }

  async watch(
    path: string,
    callback: (eventType: "add" | "change" | "unlink", path: string) => void
  ): Promise<() => void> {
    // Not implemented for Tauri yet
    return () => {};
  }
}

// Export a singleton instance
const fs = new TauriFileSystem();
export default fs;

/**
 * Joins path segments together
 * @param segments Path segments to join
 * @returns Joined path
 */
function joinPaths(...segments: string[]): string {
  return segments.join("/");
}

/**
 * Gets the parent directory path from a file path
 * @param path File path
 * @returns Parent directory path or null if no parent
 */
function getParentDir(path: string): string | null {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) {
    return null;
  }
  return path.substring(0, lastSlash);
}
