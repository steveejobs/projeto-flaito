import React from "react";
import { AppLayout } from "@/components/AppLayout";
import { Outlet } from "react-router-dom";
import { RouteTransitionOverlay } from "@/components/RouteTransitionOverlay";

/**
 * AppShell - Persistent layout wrapper for authenticated routes
 * Uses Outlet to render child routes while keeping layout mounted
 * RouteTransitionOverlay provides a subtle overlay during transitions
 * This eliminates white flashes between route transitions
 */
export default function AppShell() {
  return (
    <AppLayout>
      <RouteTransitionOverlay>
        <Outlet />
      </RouteTransitionOverlay>
    </AppLayout>
  );
}
