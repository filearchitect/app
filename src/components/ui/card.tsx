import * as React from "react";

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bottom-border";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        variant === "default"
          ? "rounded-lg border bg-card text-card-foreground shadow-sm"
          : "border-0 border-b bg-card text-card-foreground py-4 first:pt-0",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
