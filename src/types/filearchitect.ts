import type { FileSystem } from "@filearchitect/core";

export interface FileNameReplacement {
  search: string;
  replace: string;
}

export interface BaseStructureOptions {
  /** Optional filesystem implementation to use */
  fs?: FileSystem;
  /** Optional file name replacements to apply */
  fileNameReplacements?: FileNameReplacement[];
  /** Optional folder name replacements to apply */
  folderNameReplacements?: FileNameReplacement[];
  /** Whether to include recursive contents of directories being copied/moved (default: true) */
  recursive?: boolean;
}

export interface GetStructureOptions extends BaseStructureOptions {
  /** The root directory path where the structure would be created */
  rootDir: string;
}

export type OperationType = "copy" | "move" | "included" | "create";

export interface StructureOperation {
  /** The type of operation (file, directory, copy, move) */
  type: OperationType;
  /** The target path where the operation will be performed */
  targetPath: string;
  /** The source path for copy/move operations */
  sourcePath?: string;
  /** Whether this is a directory operation */
  isDirectory: boolean;
  /** The depth level from the root directory (0 = root level) */
  depth: number;
  /** The name of the file or directory (last part of the path) */
  name: string;
  /** Warning message if there's an issue with this operation */
  warning?: string;
}

export interface StructureResult {
  /** The array of operations that would be performed */
  operations: StructureOperation[];
  /** The options used to generate the operations */
  options: Required<GetStructureOptions>;
}
