import { useAuthContext } from "@/features/auth/AuthProvider";
import { getVersion } from "@tauri-apps/api/app";
import { fetch } from "@tauri-apps/plugin-http";
import { platform } from "@tauri-apps/plugin-os";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { compareVersions } from "compare-versions";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const DOWNLOAD_PAGE_PATH = "/download";

type UpdateInfo = {
  version: string;
  body?: string;
  manifest?: any;
  /** Windows: show "Download" button and open website instead of in-app install */
  manualDownload?: boolean;
  downloadUrl?: string;
};

const isLocalDev = import.meta.env.VITE_DEV_MODE === "true";
const baseUrl = import.meta.env.VITE_APP_URL ?? "https://filearchitect.com";
// Tauri plugin uses endpoints from tauri.conf (with {{target}} = platform); this is for logging only
const expectedEndpoint = `${baseUrl}/api/updates/{{target}}/latest`;

export function useAutoUpdater() {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const hasCheckedForUpdates = useRef(false);
  const { license, isInitialized: isAuthInitialized } = useAuthContext();

  const isUpdateAllowed = () => {
    console.log("License in isUpdateAllowed:", {
      license,
      updates_expires_at: license?.updates_expires_at,
      currentDate: new Date().toISOString(),
    });

    // If no license or no updates_expires_at, allow updates
    if (!license || !license.updates_expires_at) {
      console.log("No updates_expires_at found in license");
      return true;
    }

    const isAllowed = new Date(license.updates_expires_at) > new Date();
    console.log("Update allowed?", isAllowed);
    return isAllowed;
  };

  const checkForUpdates = async () => {
    const allowed = isUpdateAllowed();
    console.log("Update check - allowed?", allowed);

    if (!allowed) {
      console.log("Updates are not allowed - license has expired");
      return false;
    }

    try {
      const target = await platform();
      const currentVersion = await getVersion();

      console.log("Update Check Configuration:", {
        isLocalDev,
        baseUrl,
        expectedEndpoint,
        currentVersion,
        target,
      });

      // Windows: no signing key — just check version and prompt user to download from website
      if (target === "windows") {
        const res = await fetch(`${baseUrl}/api/updates/windows/latest`);
        if (!res.ok) return false;
        const data = (await res.json()) as {
          version?: string;
          notes?: string;
        };
        const remoteVersion = data.version?.replace(/^v/, "") ?? "";
        if (
          !remoteVersion ||
          compareVersions(remoteVersion, currentVersion) <= 0
        ) {
          return false;
        }
        setUpdateInfo({
          version: remoteVersion,
          body: data.notes,
          manualDownload: true,
          downloadUrl: `${baseUrl}${DOWNLOAD_PAGE_PATH}`,
        });
        setShowUpdateDialog(true);
        return true;
      }

      // macOS: full in-app updater (signed)
      const manifest = await check({ target });
      console.log("Update manifest:", manifest);

      if (manifest) {
        setUpdateInfo({
          version: manifest.version,
          body: manifest.body,
          manifest,
        });
        setShowUpdateDialog(true);
        return true;
      }
      return false;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Update check failed:", err.message, err);
      console.error(
        "Expected endpoint (Tauri uses tauri.conf endpoints):",
        expectedEndpoint
      );
      toast.error("Failed to check for updates");
      return false;
    }
  };

  const handleUpdate = useCallback(async () => {
    if (!isUpdateAllowed()) {
      toast.error(
        "Your update subscription has expired. Please renew your license to get updates."
      );
      return;
    }

    // Windows manual download: open website and close dialog
    if (updateInfo?.manualDownload && updateInfo?.downloadUrl) {
      const { openLink } = await import("@/lib/utils");
      await openLink(updateInfo.downloadUrl);
      setShowUpdateDialog(false);
      return;
    }

    setIsUpdating(true);
    try {
      const hasUpdate = await checkForUpdates();
      if (!hasUpdate) {
        toast.success("You're on the latest version!");
        return;
      }

      if (!updateInfo?.manifest) return;

      const toastId = toast.loading("Preparing update...", {
        duration: Infinity,
      });

      let downloaded = 0;
      let contentLength = 0;

      try {
        await updateInfo.manifest.downloadAndInstall((event: any) => {
          switch (event.event) {
            case "Started":
              contentLength = event.data.contentLength ?? 0;
              toast.loading("Starting download...", { id: toastId });
              break;
            case "Progress":
              downloaded += event.data.chunkLength;
              const progress = Math.round((downloaded / contentLength) * 100);
              toast.loading(`Downloading: ${progress}%`, { id: toastId });
              break;
            case "Finished":
              toast.loading("Installing update...", { id: toastId });
              break;
          }
        });

        // Remove migrations here since they'll run on app boot
        toast.success("Update installed! Restarting...", { id: toastId });

        // Small delay to ensure the success message is seen
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await relaunch();
      } catch (installError) {
        console.error("Installation failed:", installError);
        toast.error("Failed to install update", { id: toastId });
        throw installError;
      }
    } catch (error) {
      console.error("Update process failed:", error);
      toast.error("Update process failed");
    } finally {
      setIsUpdating(false);
    }
  }, [updateInfo]);

  // Run initial check once after auth is ready (so license is available for isUpdateAllowed)
  useEffect(() => {
    if (!isAuthInitialized || hasCheckedForUpdates.current) {
      return;
    }
    hasCheckedForUpdates.current = true;
    checkForUpdates();
  }, [isAuthInitialized]);

  return {
    showUpdateDialog,
    setShowUpdateDialog,
    updateInfo,
    isUpdating,
    handleUpdate,
    checkForUpdates,
  };
}
