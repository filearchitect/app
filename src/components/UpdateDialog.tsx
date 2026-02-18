import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

type UpdateInfo = {
  version: string;
  body?: string;
  manifest?: any;
  manualDownload?: boolean;
  downloadUrl?: string;
};

type UpdateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updateInfo: UpdateInfo | null;
  isUpdating: boolean;
  lastError?: string | null;
  onUpdate: () => void;
  onSkipVersion?: () => void;
};

export function UpdateDialog({
  open,
  onOpenChange,
  updateInfo,
  isUpdating,
  lastError,
  onUpdate,
  onSkipVersion,
}: UpdateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Available</AlertDialogTitle>
          <AlertDialogDescription>
            Version {updateInfo?.version} is available.
            {updateInfo?.manualDownload && (
              <p className="mt-2 text-sm">
                Click below to open the download page in your browser.
              </p>
            )}
            {updateInfo?.body && (
              <div className="mt-2 text-sm">
                Release Notes:
                <div className="mt-1 prose prose-sm dark:prose-invert max-w-none [&>ul]:list-disc [&>ul]:pl-4">
                  <ReactMarkdown>{updateInfo.body}</ReactMarkdown>
                </div>
              </div>
            )}
            {lastError && (
              <details className="mt-3 text-sm text-muted-foreground">
                <summary className="cursor-pointer">Update error details</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
                  {lastError}
                </pre>
              </details>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!!updateInfo?.version && onSkipVersion && (
            <Button
              type="button"
              variant="ghost"
              onClick={onSkipVersion}
              disabled={isUpdating}
            >
              Skip this version
            </Button>
          )}
          <AlertDialogCancel disabled={isUpdating}>Later</AlertDialogCancel>
          <AlertDialogAction onClick={onUpdate} disabled={isUpdating}>
            {updateInfo?.manualDownload
              ? "Download from website"
              : isUpdating
              ? "Updating..."
              : "Update & Restart"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
