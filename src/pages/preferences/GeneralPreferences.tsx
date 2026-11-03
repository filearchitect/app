import {
  clearStore,
  getStore,
  getStoreValue,
  setStoreValue,
} from "@/api/store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { expandPath } from "@/features/structureEditor/utils/folderUtils";
import { useAutoUpdater } from "@/features/updater/useAutoUpdater";
import { decrypt } from "@/utils/encryption";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-dialog";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const GeneralPreferences: React.FC = () => {
  const [defaultPath, setDefaultPath] = useState<string>("");
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [storeContents, setStoreContents] = useState<string>("");
  const [autoOpenFolder, setAutoOpenFolder] = useState<boolean>(false);
  const [createFunctionalBlankFiles, setCreateFunctionalBlankFiles] =
    useState<boolean>(false);
  const [showResetSettings, setShowResetSettings] = useState(false);
  const { handleUpdate, isUpdating } = useAutoUpdater();
  const { license } = useAuthContext();

  const isUpdateAllowed = () => {
    if (!license || !license.updates_expires_at) {
      return true;
    }
    return new Date(license.updates_expires_at) > new Date();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey) {
        setShowResetSettings(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.metaKey || !e.shiftKey) {
        setShowResetSettings(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const loadStoreContents = async () => {
    const store = await getStore();
    const entries = await store.entries();
    const contentsObject: Record<string, any> = {};

    // Decrypt each value if it's encrypted
    for (const [key, value] of entries) {
      if (key === "machine") {
        contentsObject[key] = value;
      } else if (typeof value === "string") {
        try {
          const decrypted = await decrypt(value);
          contentsObject[key] = JSON.parse(decrypted);
        } catch {
          contentsObject[key] = value;
        }
      } else {
        contentsObject[key] = value;
      }
    }

    setStoreContents(JSON.stringify(contentsObject, null, 2));
  };

  useEffect(() => {
    const initializePreferences = async () => {
      try {
        // Get app version
        const version = await getVersion();
        setCurrentVersion(version);

        // Get store values
        const store = await getStore();
        const defaultPathValue = await getStoreValue<string>("defaultPath");
        const autoOpenValue = await getStoreValue<boolean>("autoOpenFolder");
        const createFunctionalValue = await getStoreValue<boolean>(
          "createFunctionalBlankFiles"
        );

        setDefaultPath(defaultPathValue ?? "");
        setAutoOpenFolder(autoOpenValue ?? false);
        setCreateFunctionalBlankFiles(createFunctionalValue ?? true); // Set default to true

        await loadStoreContents();
      } catch (error) {
        console.error("Error initializing preferences:", error);
        toast.error("Failed to load preferences");
      }
    };

    initializePreferences();
  }, []);

  const handleBrowseDefaultPath = async () => {
    try {
      const expandedPath = await expandPath(defaultPath);
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: expandedPath || undefined,
        recursive: true,
        title: "Select Default Save Location",
      });

      if (selected && typeof selected === "string") {
        setDefaultPath(selected);
        await setStoreValue("defaultPath", selected);
        await loadStoreContents();
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
      toast.error("Failed to select directory");
    }
  };

  const handleDefaultPathChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newPath = e.target.value;
    setDefaultPath(newPath);
    await setStoreValue("defaultPath", newPath);
    await loadStoreContents();
  };

  const handleAutoOpenChange = async (checked: boolean) => {
    setAutoOpenFolder(checked);
    await setStoreValue("autoOpenFolder", checked);
    await loadStoreContents();
  };

  const handleCreateFunctionalChange = async (checked: boolean) => {
    setCreateFunctionalBlankFiles(checked);
    await setStoreValue("createFunctionalBlankFiles", checked);
    await loadStoreContents();
  };

  const handleResetSettings = async () => {
    try {
      // Clear all settings
      await clearStore();

      toast.success("Settings cleared");

      // Reset state to defaults
      setDefaultPath("");
      setAutoOpenFolder(false);

      // Reload store contents in local env
      await loadStoreContents();

      // Small delay to show the toast before refresh
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Failed to reset settings:", error);
      toast.error("Failed to reset settings");
    }
  };
  return (
    <div className="flex flex-col gap-8">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Current Version</h4>
            <p className="text-sm text-muted-foreground">{currentVersion}</p>
            {!isUpdateAllowed() && (
              <p className="text-sm text-destructive">
                Your update subscription has expired. Please renew your license
                to get updates.
              </p>
            )}
          </div>
          <Button
            onClick={handleUpdate}
            disabled={isUpdating || !isUpdateAllowed()}
            className="w-[180px]"
          >
            {isUpdating ? "Checking..." : "Check for Updates"}
          </Button>
        </div>
      </Card>

      <div className="">
        <Card variant="bottom-border" className="rounded-none">
          <div className="p-6 flex items-center">
            <Label htmlFor="defaultPath" className="text-sm font-medium pr-8">
              Default Save Location
            </Label>

            <div className="flex gap-3 flex-grow">
              <Input
                id="defaultPath"
                value={defaultPath}
                onChange={handleDefaultPathChange}
                placeholder="Choose default save location..."
                className="flex-grow"
              />
              <Button onClick={handleBrowseDefaultPath} className="shrink-0">
                Browse
              </Button>
            </div>
          </div>
        </Card>

        <Card variant="bottom-border" className="rounded-none">
          <div className="p-6 flex items-center">
            <Switch
              id="auto-open"
              checked={autoOpenFolder}
              onCheckedChange={handleAutoOpenChange}
            />
            <div className="flex-grow pl-4">
              <Label htmlFor="auto-open" className="text-sm font-medium">
                Open folder after creation
              </Label>
              <p className="text-sm text-muted-foreground">
                This will open a new Finder window at your output location.
              </p>
            </div>
          </div>
        </Card>

        <Card variant="bottom-border" className="rounded-none">
          <div className="p-6 flex items-center">
            <Switch
              id="create-functional"
              checked={createFunctionalBlankFiles}
              onCheckedChange={handleCreateFunctionalChange}
            />
            <div className="flex-grow pl-4">
              <Label
                htmlFor="create-functional"
                className="text-sm font-medium"
              >
                Create functional blank files
              </Label>
              <p className="text-sm text-muted-foreground">
                This will create minimal functioning files that can be opened.
              </p>
            </div>
          </div>
        </Card>

      </div>

      {showResetSettings && (
        <>
          <ul>
            <li>app url: {import.meta.env.VITE_APP_URL}</li>
            <li>api url: {import.meta.env.VITE_API_URL}</li>
          </ul>
          <Card className="p-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">
                Storage Contents (Debug)
              </h4>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-[300px] bg-muted/50 rounded-md p-4">
                {storeContents}
              </pre>
            </div>
          </Card>
        </>
      )}

      {showResetSettings && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Reset Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Reset all settings to their default values. This will clear
                  all saved data.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="text-muted-foreground hover:text-destructive hover:border-destructive"
                  >
                    Reset Settings
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will reset all settings to their default
                      values. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetSettings}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Reset Settings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default GeneralPreferences;
