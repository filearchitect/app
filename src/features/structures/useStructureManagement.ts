import { fs } from "@/features/structureEditor";
import { Structure } from "@/types";
import { path } from "@tauri-apps/api";
import yaml from "js-yaml";
import { useCallback, useEffect, useState } from "react";

type ParsedStructure = {
  content: string;
  replacements?: Array<{
    search: string;
    replace: string;
    replaceInFiles: boolean;
    replaceInFolders: boolean;
  }>;
  destinationPath?: string;
  order?: number;
};

const serializeStructure = (
  content: string,
  replacements: Array<{
    search: string;
    replace: string;
    replaceInFiles: boolean;
    replaceInFolders: boolean;
  }>,
  destinationPath?: string,
  order?: number
) => {
  const validReplacements = (replacements || []).filter(
    (r) => r.search.trim() && r.replace.trim()
  );

  const frontmatter: Record<string, any> = {};

  const allReplacements = validReplacements
    .filter((r) => r.replaceInFiles && r.replaceInFolders)
    .map(({ search, replace }) => ({
      search: search.trim(),
      replace: replace.trim(),
    }));

  const fileReplacements = validReplacements
    .filter((r) => r.replaceInFiles && !r.replaceInFolders)
    .map(({ search, replace }) => ({
      search: search.trim(),
      replace: replace.trim(),
    }));

  const folderReplacements = validReplacements
    .filter((r) => !r.replaceInFiles && r.replaceInFolders)
    .map(({ search, replace }) => ({
      search: search.trim(),
      replace: replace.trim(),
    }));

  if (allReplacements.length > 0) frontmatter.allReplacements = allReplacements;
  if (fileReplacements.length > 0)
    frontmatter.fileReplacements = fileReplacements;
  if (folderReplacements.length > 0)
    frontmatter.folderReplacements = folderReplacements;
  if (destinationPath && destinationPath.trim())
    frontmatter.destinationPath = destinationPath.trim();
  if (typeof order === "number") frontmatter.order = order;

  if (Object.keys(frontmatter).length === 0) return content;

  const yamlContent = yaml.dump(frontmatter, {
    indent: 2,
    lineWidth: -1,
    noCompatMode: true,
    skipInvalid: true,
  });

  return `---\n${yamlContent}---\n${content}`;
};

const parseStructure = (rawContent: string): ParsedStructure => {
  if (!rawContent.startsWith("---\n")) {
    return { content: rawContent };
  }

  const endIndex = rawContent.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { content: rawContent };
  }

  try {
    const frontmatter = yaml.load(rawContent.slice(4, endIndex)) as any;
    const content = rawContent.slice(endIndex + 5);

    const allReplacements =
      frontmatter?.allReplacements?.map((r: any) => ({
        search: r.search,
        replace: r.replace,
        replaceInFiles: true,
        replaceInFolders: true,
      })) || [];

    const fileReplacements =
      frontmatter?.fileReplacements?.map((r: any) => ({
        search: r.search,
        replace: r.replace,
        replaceInFiles: true,
        replaceInFolders: false,
      })) || [];

    const folderReplacements =
      frontmatter?.folderReplacements?.map((r: any) => ({
        search: r.search,
        replace: r.replace,
        replaceInFiles: false,
        replaceInFolders: true,
      })) || [];

    const replacements: ParsedStructure["replacements"] = [
      ...allReplacements,
      ...fileReplacements,
      ...folderReplacements,
    ];

    const order =
      typeof frontmatter?.order === "number" ? frontmatter.order : undefined;

    return {
      content,
      replacements,
      destinationPath: frontmatter?.destinationPath,
      order,
    };
  } catch (error) {
    console.error("Failed to parse structure frontmatter:", error);
    return { content: rawContent };
  }
};

export function useStructureManagement() {
  const [structures, setStructures] = useState<Structure[]>([]);
  const [editorContent, setEditorContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Note: We keep the disk folder as "Templates" for backward compatibility
  const getTemplatesDir = useCallback(async () => {
    const documentsDir = await path.documentDir();
    return await path.join(documentsDir, "FileArchitect", "Templates");
  }, []);

  const ensureTemplatesDir = useCallback(async () => {
    const templatesDir = await getTemplatesDir();
    await fs.mkdir(templatesDir, { recursive: true });
    return templatesDir;
  }, [getTemplatesDir]);

  const loadStructures = useCallback(async () => {
    try {
      setIsLoading(true);
      const templatesDir = await ensureTemplatesDir();
      const entries = await fs.readdir(templatesDir);

      const loadedStructures: Array<{
        name: string;
        rawContent: string;
        order?: number;
      }> = await Promise.all(
        entries.map(async (entry) => {
          const name = entry.name.replace(/\.txt$/, "");
          const filePath = await path.join(templatesDir, entry.name);
          const rawContent = (await fs.readFile(filePath)) as string;
          const parsed = parseStructure(rawContent);
          return { name, rawContent, order: parsed.order };
        })
      );

      // Sort by numeric frontmatter order first, then by name
      loadedStructures.sort((a, b) => {
        const ao =
          typeof a.order === "number" ? a.order : Number.POSITIVE_INFINITY;
        const bo =
          typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });

      setStructures(
        loadedStructures.map(({ name, rawContent }) => ({ name, rawContent }))
      );
    } catch (error) {
      console.error("Failed to load structures:", error);
    } finally {
      setIsLoading(false);
    }
  }, [ensureTemplatesDir]);

  useEffect(() => {
    loadStructures();
  }, [loadStructures]);

  const reorderStructures = useCallback(
    async (reorderedStructures: Structure[]) => {
      try {
        const templatesDir = await ensureTemplatesDir();
        // Persist order into frontmatter (1-based index)
        for (let i = 0; i < reorderedStructures.length; i++) {
          const s = reorderedStructures[i];
          const filePath = await path.join(templatesDir, `${s.name}.txt`);
          const raw = (await fs.readFile(filePath)) as string;
          const parsed = parseStructure(raw);
          const nextRaw = serializeStructure(
            parsed.content,
            parsed.replacements || [],
            parsed.destinationPath,
            i + 1
          );
          await fs.writeFile(filePath, nextRaw);
        }
        setStructures(reorderedStructures);
      } catch (error) {
        console.error("Failed to reorder structures:", error);
        throw error;
      }
    },
    [ensureTemplatesDir]
  );

  const handleSaveStructure = useCallback(
    async (name: string, rawContent: string, destinationPath?: string) => {
      const templatesDir = await ensureTemplatesDir();
      // Determine next order as max(existing)+1
      const entries = await fs.readdir(templatesDir);
      let maxOrder = 0;
      for (const entry of entries) {
        const filePath = await path.join(templatesDir, entry.name);
        const raw = (await fs.readFile(filePath)) as string;
        const p = parseStructure(raw);
        if (typeof p.order === "number") maxOrder = Math.max(maxOrder, p.order);
      }
      const parsed = parseStructure(rawContent);
      const body = serializeStructure(
        parsed.content,
        parsed.replacements || [],
        destinationPath ?? parsed.destinationPath,
        maxOrder + 1
      );
      const filePath = await path.join(templatesDir, `${name}.txt`);
      await fs.writeFile(filePath, body);
      await loadStructures();
    },
    [ensureTemplatesDir, loadStructures]
  );

  const deleteStructure = useCallback(
    async (name: string) => {
      try {
        const templatesDir = await ensureTemplatesDir();
        const filePath = await path.join(templatesDir, `${name}.txt`);
        await fs.unlink(filePath);
        await loadStructures();
      } catch (error) {
        console.error("Failed to delete structure:", error);
        throw error;
      }
    },
    [ensureTemplatesDir, loadStructures]
  );

  const handleUpdateStructure = useCallback(
    async (
      oldName: string,
      newName: string,
      content: string,
      destinationPath?: string
    ) => {
      const templatesDir = await ensureTemplatesDir();
      // Preserve old order if present
      const oldPath = await path.join(templatesDir, `${oldName}.txt`);
      let preservedOrder: number | undefined = undefined;
      try {
        const oldRaw = (await fs.readFile(oldPath)) as string;
        const p = parseStructure(oldRaw);
        preservedOrder = p.order;
      } catch {}

      const parsedNew = parseStructure(content);
      const nextBody = serializeStructure(
        parsedNew.content,
        parsedNew.replacements || [],
        destinationPath ?? parsedNew.destinationPath,
        preservedOrder
      );

      const newPath = await path.join(templatesDir, `${newName}.txt`);
      await fs.writeFile(newPath, nextBody);
      if (oldName !== newName) {
        try {
          await fs.unlink(oldPath);
        } catch {}
      }
      await loadStructures();
    },
    [ensureTemplatesDir, loadStructures]
  );

  const renameStructure = useCallback(
    async (oldName: string, newName: string) => {
      try {
        const templatesDir = await ensureTemplatesDir();
        const oldPath = await path.join(templatesDir, `${oldName}.txt`);
        const newPath = await path.join(templatesDir, `${newName}.txt`);
        await fs.rename(oldPath, newPath);
        await loadStructures();
      } catch (error) {
        console.error("Failed to rename structure:", error);
        throw error;
      }
    },
    [ensureTemplatesDir, loadStructures]
  );

  const updateStructureContent = useCallback(
    async (
      oldName: string,
      newName: string,
      content: string,
      destinationPath?: string
    ) => {
      const templatesDir = await ensureTemplatesDir();
      const oldPath = await path.join(templatesDir, `${oldName}.txt`);
      let preservedOrder: number | undefined = undefined;
      try {
        const oldRaw = (await fs.readFile(oldPath)) as string;
        const p = parseStructure(oldRaw);
        preservedOrder = p.order;
      } catch {}

      const parsedNew = parseStructure(content);
      const body = serializeStructure(
        parsedNew.content,
        parsedNew.replacements || [],
        destinationPath ?? parsedNew.destinationPath,
        preservedOrder
      );

      const newPath = await path.join(templatesDir, `${newName}.txt`);
      await fs.writeFile(newPath, body);
      if (oldName !== newName) {
        try {
          await fs.unlink(oldPath);
        } catch {}
      }
      await loadStructures();
    },
    [ensureTemplatesDir, loadStructures]
  );

  /**
   * Saves structure content without reloading all structures.
   * Used for auto-save to avoid flickering/heavy operations.
   * Preserves existing structure metadata (order, replacements, destinationPath).
   */
  const saveStructureContentQuiet = useCallback(
    async (structureName: string, newContent: string): Promise<string> => {
      const templatesDir = await ensureTemplatesDir();
      const filePath = await path.join(templatesDir, `${structureName}.txt`);

      // Read existing structure to preserve metadata
      let preservedOrder: number | undefined = undefined;
      let preservedReplacements: ParsedStructure["replacements"] = [];
      let preservedDestinationPath: string | undefined = undefined;

      try {
        const existingRaw = (await fs.readFile(filePath)) as string;
        const parsed = parseStructure(existingRaw);
        preservedOrder = parsed.order;
        preservedReplacements = parsed.replacements || [];
        preservedDestinationPath = parsed.destinationPath;
      } catch {
        // Structure file doesn't exist yet, that's fine
      }

      const newRawContent = serializeStructure(
        newContent,
        preservedReplacements,
        preservedDestinationPath,
        preservedOrder
      );

      await fs.writeFile(filePath, newRawContent);

      // Update structure in memory without reloading all
      setStructures((prev) =>
        prev.map((s) =>
          s.name === structureName ? { ...s, rawContent: newRawContent } : s
        )
      );

      return newRawContent;
    },
    [ensureTemplatesDir]
  );

  /**
   * Saves structure destination path without reloading all structures.
   * Used for auto-save to avoid flickering/heavy operations.
   */
  const saveStructureDestinationQuiet = useCallback(
    async (structureName: string, newDestinationPath: string): Promise<string> => {
      const templatesDir = await ensureTemplatesDir();
      const filePath = await path.join(templatesDir, `${structureName}.txt`);

      // Read existing structure to preserve other metadata
      let preservedOrder: number | undefined = undefined;
      let preservedReplacements: ParsedStructure["replacements"] = [];
      let preservedContent: string = "";

      try {
        const existingRaw = (await fs.readFile(filePath)) as string;
        const parsed = parseStructure(existingRaw);
        preservedOrder = parsed.order;
        preservedReplacements = parsed.replacements || [];
        preservedContent = parsed.content;
      } catch {
        // Structure file doesn't exist yet, that's fine
      }

      const newRawContent = serializeStructure(
        preservedContent,
        preservedReplacements,
        newDestinationPath || undefined,
        preservedOrder
      );

      await fs.writeFile(filePath, newRawContent);

      // Update structure in memory without reloading all
      setStructures((prev) =>
        prev.map((s) =>
          s.name === structureName ? { ...s, rawContent: newRawContent } : s
        )
      );

      return newRawContent;
    },
    [ensureTemplatesDir]
  );

  /**
   * Creates a new structure with the given name and empty content.
   * Returns the created structure.
   */
  const createEmptyStructure = useCallback(
    async (name: string): Promise<Structure> => {
      const templatesDir = await ensureTemplatesDir();

      // Determine next order as max(existing)+1
      const entries = await fs.readdir(templatesDir);
      let maxOrder = 0;
      for (const entry of entries) {
        const filePath = await path.join(templatesDir, entry.name);
        const raw = (await fs.readFile(filePath)) as string;
        const p = parseStructure(raw);
        if (typeof p.order === "number") maxOrder = Math.max(maxOrder, p.order);
      }

      const rawContent = serializeStructure("", [], undefined, maxOrder + 1);
      const filePath = await path.join(templatesDir, `${name}.txt`);
      await fs.writeFile(filePath, rawContent);

      const newStructure: Structure = { name, rawContent };

      // Add to structures list
      setStructures((prev) => [...prev, newStructure]);

      return newStructure;
    },
    [ensureTemplatesDir]
  );

  return {
    structures,
    setStructures,
    loadStructures,
    handleSaveStructure,
    deleteStructure,
    handleUpdateStructure,
    renameStructure,
    updateStructureContent,
    saveStructureContentQuiet,
    saveStructureDestinationQuiet,
    createEmptyStructure,
    editorContent,
    setEditorContent,
    serializeStructure: useCallback(serializeStructure, []),
    parseStructure: useCallback(parseStructure, []),
    reorderStructures,
    isLoading,
  };
}
