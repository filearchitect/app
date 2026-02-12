import { Button } from "@/components/ui/button";
import { StoredLicense } from "@/features/auth/types";
import { open as openPage } from "@tauri-apps/plugin-shell";
import React from "react";

interface LicenseInfoSectionProps {
  license: StoredLicense | null;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const openPathInBrowser = async (path: string) => {
  await openPage(path);
};

export const LicenseInfoSection: React.FC<LicenseInfoSectionProps> = ({
  license,
}) => {
  return (
    <div className="mt-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-sm text-muted-foreground">License Type</div>
          <div className="text-sm font-medium capitalize">
            {license?.type === "trial" ? "Trial" : "Paid"}
          </div>
        </div>

        {license?.license_key && (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-sm text-muted-foreground">License Key</div>
            <div className="text-sm font-medium font-mono break-all">
              {license.license_key}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="text-sm text-muted-foreground">Expires At</div>
          <div className="text-sm font-medium">
            {formatDate(license?.expires_at ?? undefined)}
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button
          variant="outline"
          onClick={() =>
            openPathInBrowser(`${import.meta.env.VITE_APP_URL}/dashboard`)
          }
        >
          Manage License
        </Button>
      </div>
    </div>
  );
};
