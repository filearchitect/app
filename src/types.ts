export interface Replacement {
  search: string;
  replace: string;
  replaceInFiles: boolean;
  replaceInFolders: boolean;
}

export interface Structure {
  name: string;
  rawContent: string;
  replacements?: Replacement[];
  destinationPath?: string;
}

export interface Frontmatter {
  fileReplacements?: Array<{ search: string; replace: string }>;
  folderReplacements?: Array<{ search: string; replace: string }>;
  allReplacements?: Array<{ search: string; replace: string }>;
  destinationPath?: string;
}
