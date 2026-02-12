import { Button } from "@/components/ui/button";
import React from "react";

interface SubmitButtonProps {
  isDisabled: boolean;
  isLoading: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon?: React.ReactNode;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  isDisabled,
  isLoading,
  onClick,
  icon,
}) => {
  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      variant="default"
      size="default"
      name="submit"
    >
      {isLoading ? "Creating..." : "Create structure"}
    </Button>
  );
};
