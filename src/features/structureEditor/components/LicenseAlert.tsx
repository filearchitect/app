import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/constants";
import { appUrl, openLink } from "@/lib/utils";
import React from "react";

interface LicenseAlertProps {
  isLicenseActive: boolean;
  itemCount: number;
}

export const LicenseAlert: React.FC<LicenseAlertProps> = React.memo(
  ({ isLicenseActive, itemCount }) => {
    const showAlert =
      !isLicenseActive && itemCount >= APP_CONFIG.FREE_VERSION_LIMIT;

    if (!showAlert) {
      return null;
    }

    return (
      <Alert className="mb-4 bg-red-50 backdrop-blur-sm border-b border-primary/20 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <AlertTitle className="text-base font-semibold text-primary">
              Free Version Limit Reached
            </AlertTitle>
            <AlertDescription className="text-sm text-gray-600">
              You've reached the limit of {APP_CONFIG.FREE_VERSION_LIMIT} items
              in the free version.
            </AlertDescription>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 text-white font-medium"
            onClick={() => openLink(appUrl("/pricing"))}
          >
            Upgrade Now
          </Button>
        </div>
      </Alert>
    );
  }
);

LicenseAlert.displayName = "LicenseAlert";
