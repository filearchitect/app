import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import React from "react";

interface PreviewToggleButtonProps {
  showPreview: boolean;
  onToggle: () => void;
}

export const PreviewToggleButton: React.FC<PreviewToggleButtonProps> = ({
  showPreview,
  onToggle,
}) => {
  const Icon = showPreview ? EyeOff : Eye;
  const text = showPreview ? "Hide Preview" : "Show Preview";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      className="absolute top-2 right-2 z-50"
    >
      <Icon className="h-4 w-4 mr-2" />
      {text}
    </Button>
  );
};
