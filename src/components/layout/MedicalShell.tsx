import React from "react";
import { MedicalLayout } from "@/components/layout/MedicalLayout";
import { Outlet } from "react-router-dom";
import { RouteTransitionOverlay } from "@/components/RouteTransitionOverlay";

/**
 * MedicalShell - Persistent layout wrapper for authenticated medical routes
 * Styled with Apple/Google design principles (clean, light, teal accents)
 */
export default function MedicalShell() {
    return (
        <MedicalLayout>
            <RouteTransitionOverlay>
                <Outlet />
            </RouteTransitionOverlay>
        </MedicalLayout>
    );
}
