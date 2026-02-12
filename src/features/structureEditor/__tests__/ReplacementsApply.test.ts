import { getStructure, type FileNameReplacement } from "@filearchitect/core";
import { describe, expect, it } from "vitest";

describe("replacements application", () => {
  it("applies replacements to both folders and files", async () => {
    const structure = `my-{token}-project\n\tsrc\n\t\tindex-{token}.ts`;

    const all: FileNameReplacement[] = [{ search: "{token}", replace: "bar" }];
    const files: FileNameReplacement[] = [
      { search: "{token}", replace: "bar" },
    ];
    const folders: FileNameReplacement[] = [
      { search: "{token}", replace: "bar" },
    ];

    const result = await getStructure(structure, {
      rootDir: "/tmp",
      replacements: { all, files, folders },
      // fs is not required for planning operations
    } as any);

    const names = result.operations.map((op: { name: string }) => op.name);
    expect(names).toContain("my-bar-project");
    expect(names).toContain("src");
    expect(names).toContain("index-bar.ts");
  });

  it("applies replacements to explicit rename targets (import > name)", async () => {
    const structure = `[~/Downloads/sample.txt] > sample-{token}.txt`;

    const all: FileNameReplacement[] = [{ search: "{token}", replace: "bar" }];
    const files: FileNameReplacement[] = [
      { search: "{token}", replace: "bar" },
    ];
    const folders: FileNameReplacement[] = [
      { search: "{token}", replace: "bar" },
    ];

    const result = await getStructure(structure, {
      rootDir: "/tmp",
      replacements: { all, files, folders },
    } as any);

    const names = result.operations.map((op: { name: string }) => op.name);
    expect(names).toContain("sample-bar.txt");
  });
});
