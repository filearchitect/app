import {
  createFolders as createFoldersWithFunctionalBlanks,
  createFoldersDetailed as createFoldersDetailedWithFunctionalBlanks,
  getStructureCreationPlan as getStructureCreationPlanWithFunctionalBlanks,
  type CreateFoldersExecutionResult,
  type StructureCreationPlan,
} from "@/features/structureEditor/utils/structureCreation";
import type { FileNameReplacement } from "@filearchitect/core";

export interface Replacement {
  search: string;
  replace: string;
  replaceInFiles: boolean;
  replaceInFolders: boolean;
}

export type { CreateFoldersExecutionResult, StructureCreationPlan };

/**
 * High-level helper used by the app. It mirrors the old `createFolders()` API
 * but delegates the heavy lifting to `@filearchitect/core#createStructure`.
 * It can be dropped once all callers migrate directly to the core function.
 */
export async function createFolders(
  structureString: string,
  baseDir: string,
  replacements: Replacement[] = []
): Promise<string> {
  const valid = replacements.filter(
    (r) => r.search.trim().length > 0 && r.replace.trim().length > 0
  );

  const all: FileNameReplacement[] = valid
    .filter((r) => r.replaceInFiles && r.replaceInFolders)
    .map(({ search, replace }) => ({ search, replace }));

  const files: FileNameReplacement[] = valid
    .filter((r) => r.replaceInFiles)
    .map(({ search, replace }) => ({ search, replace }));

  const folders: FileNameReplacement[] = valid
    .filter((r) => r.replaceInFolders)
    .map(({ search, replace }) => ({ search, replace }));

  // Delegate to the structure editor implementation which supports functional blank files
  return await createFoldersWithFunctionalBlanks(structureString, baseDir, [
    // Ensure 'all' rules also flow into specific categories for maximum compatibility
    // The util accepts a unified list of replacements with flags; it will split internally.
    ...all.map(({ search, replace }) => ({
      search,
      replace,
      replaceInFiles: true,
      replaceInFolders: true,
    })),
    ...files.map(({ search, replace }) => ({
      search,
      replace,
      replaceInFiles: true,
      replaceInFolders: false,
    })),
    ...folders.map(({ search, replace }) => ({
      search,
      replace,
      replaceInFiles: false,
      replaceInFolders: true,
    })),
  ] as any);
}

export async function getStructureCreationPlan(
  structureString: string,
  baseDir: string,
  replacements: Replacement[] = []
): Promise<StructureCreationPlan> {
  return await getStructureCreationPlanWithFunctionalBlanks(
    structureString,
    baseDir,
    replacements as any
  );
}

export async function createFoldersDetailed(
  structureString: string,
  baseDir: string,
  replacements: Replacement[] = []
): Promise<CreateFoldersExecutionResult> {
  return await createFoldersDetailedWithFunctionalBlanks(
    structureString,
    baseDir,
    replacements as any
  );
}
