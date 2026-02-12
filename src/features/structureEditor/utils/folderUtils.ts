import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { getDesktopDir } from "./structureCreation";

export const expandPath = async (path: string): Promise<string> => {
  try {
    return await invoke<string>("expand_path", { path });
  } catch (error) {
    console.error("Error expanding path:", error);
    return path;
  }
};

export const getInitialBaseDir = async (): Promise<string> => {
  try {
    return await getDesktopDir();
  } catch (error) {
    console.error("Error getting desktop directory:", error);
    return "";
  }
};

export const handleBrowseDirectory = async (
  currentBaseDir: string
): Promise<string | null> => {
  try {
    const expandedPath = await expandPath(currentBaseDir);
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: expandedPath,
    });
    return typeof selected === "string" ? selected : null;
  } catch (error) {
    console.error("Error selecting directory:", error);
    toast.error("Failed to select directory");
    return null;
  }
};
