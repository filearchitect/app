import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { openLink } from "@/lib/utils";
import { format } from "date-fns";
import React, { useState } from "react";
import { toast } from "sonner";

const proFeatures = [
  {
    title: "Structure creation and management",
  },
  {
    title: "AI creation",
  },
  {
    title: "Smart cleanup",
    soon: true,
  },
  {
    title: "Structures sync",
    soon: true,
  },
  {
    title: "Valid for commercial use",
  },
  {
    title: "Supporting development",
  },
];

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-5 h-5 text-green-500"
  >
    <path
      fillRule="evenodd"
      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
      clipRule="evenodd"
    />
  </svg>
);

const AccountPreferences: React.FC = () => {
  const { license, isLoading, error, activateLicense } = useAuthContext();
  const [licenseKey, setLicenseKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    setIsActivating(true);
    try {
      const result = await activateLicense(licenseKey.trim());
      if (result) {
        toast.success("License activated successfully");
        // Refresh page to reflect updated license
        window.location.reload();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to activate license"
      );
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="text-muted-foreground">
          Loading license information...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-destructive/10">
        <div className="text-destructive">Error loading license: {error}</div>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "PPP 'at' pp");
  };

  return (
    <div className="">
      {!license && (
        <div className="p-6">
          <h3 className="text-base font-semibold mb-6">Activate License</h3>
          <form onSubmit={handleActivateLicense} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter your license key"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                disabled={isActivating}
              />
            </div>
            <Button type="submit" disabled={isActivating || !licenseKey.trim()}>
              {isActivating ? "Activating..." : "Activate License"}
            </Button>
          </form>
        </div>
      )}

      {license && (
        <>
          <Card className="p-6">
            <h3 className="text-base font-semibold mb-6">
              License Information
            </h3>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-sm text-muted-foreground">
                  License Type
                </div>
                <div className="text-sm font-medium capitalize">
                  <Badge
                    className={
                      license.type === "trial"
                        ? "bg-yellow-500 text-white"
                        : "bg-green-600 text-white"
                    }
                  >
                    {license.type}
                  </Badge>
                </div>
              </div>

              {license.license_key && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm text-muted-foreground">
                    License Key
                  </div>
                  <div className="text-sm font-medium font-mono break-all">
                    {license.license_key}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="text-sm text-muted-foreground">Expires At</div>
                <div className="text-sm font-medium">
                  {license.expires_at
                    ? formatDate(license.expires_at)
                    : "Never"}
                </div>
              </div>

              {import.meta.env.DEV && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm text-muted-foreground">
                    Last Checked
                  </div>
                  <div className="text-sm font-medium">
                    {new Date(license.last_checked_at).toLocaleDateString(
                      "en-US",
                      {
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {(license?.type === "once" || license?.type === "yearly") && (
        <div className="flex justify-end py-6">
          <Button
            variant="outline"
            onClick={() =>
              openLink(`${import.meta.env.VITE_APP_URL}/dashboard`)
            }
          >
            Manage License
          </Button>
        </div>
      )}

      {license?.type === "trial" && (
        <>
          <Card className="p-6 mt-6">
            <h3 className="">License Status</h3>
            <div className="flex items-center gap-3">
              <div className="flex-grow flex items-center gap-2 ">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    license.expires_at
                      ? new Date(license.expires_at).getTime() > Date.now()
                        ? "bg-green-500"
                        : "bg-red-500"
                      : "bg-gray-500"
                  }`}
                />
                <span className="text-sm font-medium">
                  {license.expires_at
                    ? new Date(license.expires_at).getTime() > Date.now()
                      ? `Active until ${formatDate(license.expires_at)}`
                      : "Expired"
                    : "N/A"}
                </span>
              </div>
              <Button
                variant="default"
                className="flex-1 "
                onClick={() =>
                  openLink(`${import.meta.env.VITE_APP_URL}/purchase`)
                }
              >
                Purchase License
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    Activate License Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Activate License Key</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleActivateLicense} className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Enter your license key"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                        disabled={isActivating}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={isActivating || !licenseKey.trim()}
                      >
                        {isActivating ? "Activating..." : "Activate"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </Card>

          <Card className="mt-6 p-6 bg-blue-300/10">
            <h3 className="text-base font-semibold mb-6">
              File Architect Complete features
            </h3>
            <div className="space-y-4">
              {proFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-1">
                    <CheckIcon />
                  </div>
                  <div>
                    <div className="font-medium">
                      {feature.title}{" "}
                      {feature.soon && (
                        <span className="text-xs text-gray-500">
                          (Coming soon)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default AccountPreferences;
