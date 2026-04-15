import React from "react";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { Outlet } from "react-router-dom";
import { RouteTransitionOverlay } from "@/components/RouteTransitionOverlay";
import OperatorFeedbackButton from "@/components/layout/OperatorFeedbackButton";

import { MessagingProvider } from "@/contexts/MessagingContext";

export default function LegalShell() {
  return (
    <MessagingProvider context="LEGAL">
      <LegalLayout>
        <Outlet />
      </LegalLayout>
      <OperatorFeedbackButton module="LEGAL" />
    </MessagingProvider>
  );
}
