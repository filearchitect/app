import React from "react";
import { Button, type ButtonProps } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

interface IconTooltipButtonProps extends ButtonProps {
  /** Icon displayed inside the button */
  icon: React.ReactNode;
  /** Tooltip label */
  label: string;
}

export const IconTooltipButton = React.forwardRef<
  HTMLButtonElement,
  IconTooltipButtonProps
>(({ icon, label, ...buttonProps }, ref) => {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={ref} {...buttonProps}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

IconTooltipButton.displayName = "IconTooltipButton";
