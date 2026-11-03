import { LicenseService } from "@/features/auth/services";
import { StoredLicense } from "@/features/auth/types";
import { useEffect, useState } from "react";

interface UseLicenseModalOptions {
  license: StoredLicense | null;
  isInitialized: boolean;
}

export function useLicenseModal({
  license,
  isInitialized,
}: UseLicenseModalOptions) {
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  useEffect(() => {
    // Only update the modal state after initialization and when we have a definitive license state
    if (isInitialized && license) {
      const checkModalState = async () => {
        const isExpiredTrial = LicenseService.isExpiredTrial(license);
        if (isExpiredTrial) {
          const isDismissed = await LicenseService.isLicenseModalDismissed();
          setShowLicenseModal(!isDismissed);
        } else {
          setShowLicenseModal(false);
        }
      };
      checkModalState();
    }
  }, [license, isInitialized]);

  return {
    showLicenseModal,
    setShowLicenseModal,
  };
}
