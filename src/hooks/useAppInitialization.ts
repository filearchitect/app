import { useAuthContext } from "@/features/auth/AuthProvider";
import { isSetappBuild } from "@/features/auth/setapp";
import { useStructures } from "@/features/structures/StructureContext";
import { useAutoUpdater } from "@/features/updater/useAutoUpdater";
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { useDeepLinking } from "./useDeepLinking";
import { useFirstVisit } from "./useFirstVisit";
import { usePreferencesShortcut } from "./useKeyboardShortcuts";
import { useLicenseModal } from "./useLicenseModal";

export function useAppInitialization() {
  const { showWelcome, setShowWelcome } = useFirstVisit();
  const {
    showUpdateDialog,
    setShowUpdateDialog,
    updateInfo,
    isUpdating,
    isRestartReady,
    lastUpdateError,
    handleUpdate,
    handleRestartNow,
  } = useAutoUpdater();
  const { license, isLicenseActive, isInitialized, setLicense } =
    useAuthContext();
  const { exitStructureEditing, setEditorContent } = useStructures();
  const setappBuild = isSetappBuild();

  // Use the keyboard shortcuts hook
  usePreferencesShortcut();

  // Use the deep linking hook (structure links open content in Quick structure)
  useDeepLinking({
    setLicense,
    onStructureContent: (content) => {
      exitStructureEditing();
      setEditorContent(content);
    },
  });

  // Use the license modal hook
  const { showLicenseModal, setShowLicenseModal } = useLicenseModal({
    license,
    isInitialized,
  });

  useEffect(() => {
    if (!setappBuild || !isInitialized) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void invoke("show_setapp_release_notes_if_needed").catch((error) => {
        console.warn("Setapp release notes were unavailable:", error);
      });
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isInitialized, setappBuild]);

  return {
    // Welcome dialog
    showWelcome,
    setShowWelcome,

    // Update dialog
    showUpdateDialog,
    setShowUpdateDialog,
    updateInfo,
    isUpdating,
    isRestartReady,
    lastUpdateError,
    handleUpdate,
    handleRestartNow,

    // License modal
    showLicenseModal,
    setShowLicenseModal,

    // Auth context
    license,
    isLicenseActive,
    isInitialized,
  };
}
