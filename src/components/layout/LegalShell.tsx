import React, { memo } from "react";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { Outlet } from "react-router-dom";
import { MessagingProvider } from "@/contexts/MessagingContext";

function LegalShell() {
  return (
    <MessagingProvider context="LEGAL">
      <LegalLayout>
        <Outlet />
      </LegalLayout>
    </MessagingProvider>
  );
}

export default memo(LegalShell);
