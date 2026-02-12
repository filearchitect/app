import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";

interface LicenseActivationFormProps {
  onSubmit: (licenseKey: string) => Promise<void>;
  onCancel: () => void;
}

export const LicenseActivationForm: React.FC<LicenseActivationFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [licenseKey, setLicenseKey] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!licenseKey.trim()) {
      setError("Please enter a license key");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(licenseKey.trim());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to activate license"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="licenseKey"
        placeholder="Enter your license key"
        value={licenseKey}
        onChange={(e) => setLicenseKey(e.target.value)}
        disabled={isSubmitting}
      />
      <Button
        type="submit"
        className="w-full"
        variant="default"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Activating..." : "Activate License"}
      </Button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        ← Back to purchase options
      </Button>
    </form>
  );
};
