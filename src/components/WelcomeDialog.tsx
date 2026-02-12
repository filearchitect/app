import { getStoreValue, setStoreValue } from "@/api/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect } from "react";

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  useEffect(() => {
    const checkFirstVisit = async () => {
      const hasVisited = await getStoreValue<boolean>("hasVisitedBefore");
      if (!hasVisited && !open) {
        onOpenChange(true);
      }
    };
    checkFirstVisit();
  }, []);

  const handleClose = async () => {
    await setStoreValue("hasVisitedBefore", true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] sm:min-h-[540px] overflow-hidden p-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 opacity-50 pointer-events-none" />
        <div className="relative flex flex-col h-full p-8 md:p-12">
          <DialogHeader className="pb-8">
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text">
              <DialogTitle className="text-3xl font-bold text-transparent tracking-tight">
                Thank you for downloading FileArchitect!
              </DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-6 pt-6 leading-relaxed">
                <div className="text-gray-700 text-lg space-y-4 text-lg">
                  <p>
                    We're excited to help you organize and manage your file
                    structures more efficiently.
                  </p>
                  <p>
                    Read the{" "}
                    <a
                      href="https://filearchitect.com/docs"
                      target="_blank"
                      className="text-blue-500 hover:text-blue-600 underline transition-colors"
                    >
                      docs
                    </a>{" "}
                    to learn more about the syntax and the advanced features.
                  </p>
                  <p>
                    You’re currently using the trial version, which gives you
                    full access to all features for 7 days. After that, you'll
                    need to{" "}
                    <a
                      className="link"
                      href="https://filearchitect.com/purchase"
                    >
                      purchase a license
                    </a>{" "}
                    to continue using the app.
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-gray-700 shadow-sm text-lg">
                  <p>
                    The app is currently in beta and you might encounter some
                    bugs or changes. If you have any questions, feedback, or
                    suggestions, add them to our forum{" "}
                    <a
                      href="https://filearchitect.userjot.com/"
                      target="_blank"
                      className="link"
                    >
                      https://filearchitect.userjot.com/
                    </a>{" "}
                    or email us at{" "}
                    <a href="mailto:support@filearchitect.com" className="link">
                      support@filearchitect.com
                    </a>
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-auto pt-8">
            <Button size="lg" className="" onClick={handleClose}>
              Get Started
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
