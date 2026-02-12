export interface Replacement {
  search: string;
  replace: string;
  replaceInFiles: boolean;
  replaceInFolders: boolean;
}

export interface UseStructureOptions {
  content: string;
  replacements: Replacement[];
  rootDir?: string;
}

export interface UseStructureCreatorOptions {
  replacements?: Replacement[];
}
