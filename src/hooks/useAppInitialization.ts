import { useAuthContext } from "@/features/auth/AuthProvider";
import { useStructures } from "@/features/structures/StructureContext";
import { useAutoUpdater } from "@/features/updater/useAutoUpdater";
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
