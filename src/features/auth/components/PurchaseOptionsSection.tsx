import { Button } from "@/components/ui/button";
import { open as openPage } from "@tauri-apps/plugin-shell";
import React from "react";

interface PurchaseOptionsSectionProps {
  onShowActivateForm: () => void;
}

const openPathInBrowser = async (path: string) => {
  await openPage(path);
};

export const PurchaseOptionsSection: React.FC<PurchaseOptionsSectionProps> = ({
  onShowActivateForm,
}) => {
  const handlePurchase = () => {
    openPathInBrowser(`${import.meta.env.VITE_APP_URL}/pricing`);
  };

  return (
    <div className="mt-4 space-y-3">
      <Button type="button" onClick={handlePurchase} className="w-full">
        See purchase options
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onShowActivateForm}
      >
        I already have a license key
      </Button>
    </div>
  );
};
