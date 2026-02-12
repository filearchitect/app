export const APP_CONFIG = {
  FREE_VERSION_LIMIT: parseInt(import.meta.env.VITE_MAX_LINES_FREE_VERSION),
  APP_URL: import.meta.env.VITE_APP_URL,
  DEFAULT_DRAG_DISTANCE: 8,
  MOBILE_BREAKPOINT: 768,
} as const;

export const DEFAULT_REPLACEMENT = {
  search: "",
  replace: "",
  replaceInFiles: true,
  replaceInFolders: true,
} as const;

export const EXAMPLE_STRUCTURE = `folder-name
|	sub-folder
|	|	file.js
|	another-sub-folder
|	|	document.docx`;

export interface Feature {
  title: string;
  soon?: boolean;
}

export const PRO_FEATURES: Feature[] = [
  { title: "Unlimited file and folder creation" },
  { title: "AI creation" },
  { title: "Smart cleanup", soon: true },
  { title: "Structures sync", soon: true },
  { title: "Valid for commercial use" },
  { title: "Supporting development" },
];

export const LIMITED_FEATURES: Feature[] = [
  { title: "Limited to 5 files and folders at a time" },
  { title: "No AI features" },
];
