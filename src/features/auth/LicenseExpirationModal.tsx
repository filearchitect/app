import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LIMITED_FEATURES, PRO_FEATURES } from "@/config/constants";
import { useEffect, useState } from "react";
import { useAuthContext } from "./AuthProvider";
import { LicenseService } from "./services";

interface LicenseExpirationModalProps {
  open: boolean;
  trialEndDate?: string;
  onOpenChange: (open: boolean) => void;
}

const LicenseExpirationModal: React.FC<LicenseExpirationModalProps> = ({
  open,
  trialEndDate,
  onOpenChange,
}) => {
  const [showActivateForm, setShowActivateForm] = useState(false);
  const { activateLicense, refreshLicense, isInitialized, license, isLicenseActive } =
    useAuthContext();

  // Check if this is specifically an expired trial
  const isExpiredTrial = license
    ? LicenseService.isExpiredTrial(license)
    : false;

  useEffect(() => {
    const checkModalDismissal = async () => {
      if (isExpiredTrial && open) {
        const isDismissed = await LicenseService.isLicenseModalDismissed();
        if (isDismissed) {
          onOpenChange(false);
        }
      }
    };
    checkModalDismissal();
  }, [open, isExpiredTrial, onOpenChange]);

  const handleClose = async () => {
    if (isExpiredTrial) {
      await LicenseService.setLicenseModalDismissed(true);
    }
    onOpenChange(false);
  };

  const handleLicenseActivation = async (licenseKey: string) => {
    const result = await activateLicense(licenseKey);
    if (result) {
      await refreshLicense();
      onOpenChange(false);
    } else {
      throw new Error("Invalid license key");
    }
  };

  // Don't show the modal until we've initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] sm:min-h-[540px] overflow-hidden p-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 opacity-50 pointer-events-none" />
        <div className="relative flex flex-col h-full p-8 md:p-12">
          <DialogHeader className="pb-8">
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text">
              <DialogTitle className="text-3xl font-bold text-transparent tracking-tight">
                {isExpiredTrial
                  ? "Your trial has expired"
                  : "Upgrade to FileArchitect Pro"}
              </DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-6 pt-6 leading-relaxed">
                <div className="text-gray-700 text-lg space-y-4">
                  <p>
                    {isExpiredTrial
                      ? "Your 7-day trial has ended. Upgrade to continue using all features."
                      : "Get unlimited access to all features and support the development of FileArchitect."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                      Pro Features
                    </h3>
                    <ul className="space-y-3">
                      {PRO_FEATURES.map((feature, index) => (
                        <li key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-sm text-gray-700">
                            {feature.title}
                            {feature.soon && (
                              <span className="text-xs text-gray-500 ml-2">
                                (Coming soon)
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-red-900 mb-4">
                      Free Version Limits
                    </h3>
                    <ul className="space-y-3">
                      {LIMITED_FEATURES.map((feature, index) => (
                        <li key={index} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                          <span className="text-sm text-gray-700">
                            {feature.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-auto pt-8">
            <Button
              variant="outline"
              size="lg"
              onClick={handleClose}
              className="mr-2"
            >
              {isExpiredTrial
                ? "Continue with limited features"
                : "Maybe later"}
            </Button>
            <Button
              size="lg"
              onClick={() => setShowActivateForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isExpiredTrial ? "Activate License" : "Upgrade Now"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LicenseExpirationModal;
