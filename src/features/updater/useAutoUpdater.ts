import { useAuthContext } from "@/features/auth/AuthProvider";
import { getStoreValue, setStoreValue } from "@/api/store";
import { getVersion } from "@tauri-apps/api/app";
import { fetch } from "@tauri-apps/plugin-http";
import { platform } from "@tauri-apps/plugin-os";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { compareVersions } from "compare-versions";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const GITHUB_REPO = "filearchitect/app";
const GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_LATEST_RELEASE_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

type UpdateInfo = {
  version: string;
  body?: string;
  manifest?: any;
  /** Windows: show "Download" button and open website instead of in-app install */
  manualDownload?: boolean;
  downloadUrl?: string;
};

const SKIPPED_UPDATE_VERSION_KEY = "updaterSkippedVersion";

const isLocalDev = import.meta.env.VITE_DEV_MODE === "true";
// Tauri plugin updater endpoint is configured in tauri.conf / tauri.production.conf
const expectedEndpoint =
  "https://github.com/filearchitect/app/releases/latest/download/latest.json";

export function useAutoUpdater() {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateError, setLastUpdateError] = useState<string | null>(null);
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
      setLastUpdateError(null);
      const target = await platform();
      const currentVersion = await getVersion();
      const skippedVersion =
        (await getStoreValue<string>(SKIPPED_UPDATE_VERSION_KEY)) ?? "";

      console.log("Update Check Configuration:", {
        isLocalDev,
        expectedEndpoint,
        currentVersion,
        target,
      });

      // Windows: no in-app updater install path yet — check GitHub release and open manual download
      if (target === "windows") {
        const res = await fetch(GITHUB_LATEST_RELEASE_API, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) return false;
        const data = (await res.json()) as {
          tag_name?: string;
          body?: string;
        };
        const remoteVersion = data.tag_name?.replace(/^v/, "") ?? "";
        if (
          !remoteVersion ||
          compareVersions(remoteVersion, currentVersion) <= 0
        ) {
          return false;
        }
        if (skippedVersion && skippedVersion === remoteVersion) {
          console.log("Skipping previously skipped version:", remoteVersion);
          return false;
        }
        setUpdateInfo({
          version: remoteVersion,
          body: data.body,
          manualDownload: true,
          downloadUrl: GITHUB_LATEST_RELEASE_PAGE,
        });
        setShowUpdateDialog(true);
        return true;
      }

      // macOS: full in-app updater (signed). Let updater resolve the correct
      // platform target (darwin-aarch64 / darwin-x86_64) automatically.
      const manifest = await check();
      console.log("Update manifest:", manifest);

      if (manifest) {
        if (skippedVersion && skippedVersion === manifest.version) {
          console.log("Skipping previously skipped version:", manifest.version);
          return false;
        }
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
      setLastUpdateError(err.message);
      toast.error("Failed to check for updates", {
        description: err.message,
      });
      return false;
    }
  };

  const skipCurrentVersion = useCallback(async () => {
    if (!updateInfo?.version) {
      return;
    }
    await setStoreValue(SKIPPED_UPDATE_VERSION_KEY, updateInfo.version);
    setShowUpdateDialog(false);
    toast.success(`Skipped update ${updateInfo.version}`);
  }, [updateInfo]);

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
        if (lastUpdateError) {
          toast.error("Unable to complete update check", {
            description: lastUpdateError,
          });
          return;
        }
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
  }, [lastUpdateError, updateInfo]);

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
    lastUpdateError,
    skipCurrentVersion,
    handleUpdate,
    checkForUpdates,
  };
}
