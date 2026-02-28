import React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PremiumFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  touched?: boolean;
}

export const PremiumField = React.forwardRef<HTMLInputElement, PremiumFieldProps>(
  ({ label, error, touched, className, id, ...props }, ref) => {
    const fieldId = id || props.name || label.toLowerCase().replace(/\s/g, "-");
    const showError = touched && error;

    return (
      <div className="space-y-2">
        <Label
          htmlFor={fieldId}
          className={cn(
            "text-base font-medium",
            showError ? "text-red-400" : "text-white/80"
          )}
        >
          {label}
          {props.required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        <Input
          ref={ref}
          id={fieldId}
          className={cn(
            "bg-white/[0.04] border-white/10 text-white placeholder:text-white/30",
            "focus:border-[var(--brand-primary)]/50 focus:ring-2 focus:ring-[var(--brand-primary)]/10",
            "h-14 text-lg transition-all duration-200",
            showError && "border-red-400/50 focus:border-red-400 focus:ring-red-400/10",
            className
          )}
          {...props}
        />
        {showError && (
          <p className="text-sm text-red-400 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

PremiumField.displayName = "PremiumField";
