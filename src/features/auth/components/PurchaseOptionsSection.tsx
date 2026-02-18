import { Button } from "@/components/ui/button";
import { appUrl, openLink } from "@/lib/utils";
import React from "react";

interface PurchaseOptionsSectionProps {
  onShowActivateForm: () => void;
}

export const PurchaseOptionsSection: React.FC<PurchaseOptionsSectionProps> = ({
  onShowActivateForm,
}) => {
  const handlePurchase = () => {
    openLink(appUrl("/pricing"));
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
