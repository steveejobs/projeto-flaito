import React from "react";
import { cn } from "@/lib/utils";

interface StepTransitionProps {
  children: React.ReactNode;
  show: boolean;
}

export function StepTransition({ children, show }: StepTransitionProps) {
  // Don't render anything if not showing
  if (!show) return null;
  
  return (
    <div className="transition-all duration-200 ease-out opacity-100 translate-y-0 capture-animate-in">
      {children}
    </div>
  );
}
