import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import React, { ChangeEvent, KeyboardEvent, useState } from "react";
import { Link } from "react-router-dom";

interface AiInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => Promise<void>;
}

const AiInputModal = React.memo<AiInputModalProps>(
  ({ isOpen, onClose, onSubmit }) => {
    const [prompt, setPrompt] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async () => {
      if (!prompt.trim()) {
        setError("Please enter an AI prompt");
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        await onSubmit(prompt);
        setPrompt("");
        onClose();
      } catch (err) {
        setError(
          `Failed to generate: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      } finally {
        setIsLoading(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Generate Structure with AI</DialogTitle>
            <DialogDescription className="mt-2">
              Describe the the structure you want to create in simple words like
              "Music composition, "Graphic design", "Logo design", etc.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Input
              value={prompt}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPrompt(e.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Enter a prompt"
              autoFocus
            />
            <p className="text-sm text-muted-foreground">
              You can change the formatting in your{" "}
              <Link
                to="/preferences/ai"
                className="text-primary underline hover:text-primary/90"
              >
                preferences
              </Link>
            </p>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Structure"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

AiInputModal.displayName = "AiInputModal";

export default AiInputModal;
