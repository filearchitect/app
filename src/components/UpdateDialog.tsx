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
  isRestartReady?: boolean;
  lastError?: string | null;
  onUpdate: () => void;
  onRestartNow?: () => void;
};

export function UpdateDialog({
  open,
  onOpenChange,
  updateInfo,
  isUpdating,
  isRestartReady = false,
  lastError,
  onUpdate,
  onRestartNow,
}: UpdateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isRestartReady ? "Update Ready" : "Update Available"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isRestartReady
              ? `Version ${updateInfo?.version} has been installed. Restart now to apply the update.`
              : `Version ${updateInfo?.version} is available.`}
            {!isRestartReady && updateInfo?.manualDownload && (
              <p className="mt-2 text-sm">
                Click below to open the download page in your browser.
              </p>
            )}
            {!isRestartReady && updateInfo?.body && (
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
          <AlertDialogCancel disabled={isUpdating}>Later</AlertDialogCancel>
          {isRestartReady ? (
            <AlertDialogAction
              onClick={onRestartNow ?? onUpdate}
              disabled={isUpdating}
            >
              Restart now
            </AlertDialogAction>
          ) : (
            <AlertDialogAction onClick={onUpdate} disabled={isUpdating}>
              {updateInfo?.manualDownload
                ? "Download from website"
                : isUpdating
                ? "Updating..."
                : "Download update"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
