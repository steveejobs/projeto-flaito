import React from "react";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { Outlet } from "react-router-dom";
import { RouteTransitionOverlay } from "@/components/RouteTransitionOverlay";

export default function LegalShell() {
  return (
    <LegalLayout>
      <RouteTransitionOverlay>
        <Outlet />
      </RouteTransitionOverlay>
    </LegalLayout>
  );
}
