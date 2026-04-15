import React from "react";
import { MedicalLayout } from "@/components/layout/MedicalLayout";
import { Outlet } from "react-router-dom";
import { RouteTransitionOverlay } from "@/components/RouteTransitionOverlay";
import OperatorFeedbackButton from "@/components/layout/OperatorFeedbackButton";

/**
 * MedicalShell - Persistent layout wrapper for authenticated medical routes
 * Styled with Apple/Google design principles (clean, light, teal accents)
 */
import { MessagingProvider } from "@/contexts/MessagingContext";

export default function MedicalShell() {
    return (
        <MessagingProvider context="MEDICAL">
            <MedicalLayout>
                <RouteTransitionOverlay>
                    <Outlet />
                </RouteTransitionOverlay>
            </MedicalLayout>
            <OperatorFeedbackButton module="MEDICAL" />
        </MessagingProvider>
    );
}
