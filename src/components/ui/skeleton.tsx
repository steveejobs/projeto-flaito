import * as React from "react";
import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("animate-pulse rounded-md bg-white/5 dark:bg-white/10 ring-1 ring-white/5", className)}
      {...props}
    />
  );
});

Skeleton.displayName = "Skeleton";

export { Skeleton };
