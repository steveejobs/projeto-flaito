import React, { memo } from "react";
import { MedicalLayout } from "@/components/layout/MedicalLayout";
import { Outlet } from "react-router-dom";
import { RouteTransitionOverlay } from "@/components/RouteTransitionOverlay";
import { MessagingProvider } from "@/contexts/MessagingContext";

function MedicalShell() {
    return (
        <MessagingProvider context="MEDICAL">
            <MedicalLayout>
                <RouteTransitionOverlay>
                    <Outlet />
                </RouteTransitionOverlay>
            </MedicalLayout>
        </MessagingProvider>
    );
}

export default memo(MedicalShell);
