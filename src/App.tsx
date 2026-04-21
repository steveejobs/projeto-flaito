import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatContextProvider } from "@/contexts/ChatContext";
import { OfficeBrandingProvider } from "@/contexts/OfficeBrandingContext";
import { DevPanelProvider } from "@/contexts/DevPanelContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import LegalShell from "@/components/layout/LegalShell";
import MedicalShell from "@/components/layout/MedicalShell";
import { ModuleProtectedRoute } from "@/components/ModuleProtectedRoute";
import { ActiveClientProvider } from "@/contexts/ActiveClientContext";
import { AppInitializer } from "@/components/system/AppInitializer";
import { SimpleErrorBoundary } from "@/components/system/SimpleErrorBoundary";
import { SessionBootstrap } from "@/components/auth/SessionBootstrap";


// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Clientes from "./pages/Clientes";
import CRMPage from "./pages/CRM";

import Cases from "./modules/legal/Cases";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import LegalDashboard from "./modules/legal/pages/LegalDashboard";


import MeuEscritorio from "./pages/MeuEscritorio";

import Documents from "./modules/legal/Documents";
import DocumentTypes from "./pages/DocumentTypes";
import NijaUsage from "./pages/NijaUsage";

import Onboarding from "./pages/Onboarding";
import Reports from "./pages/Reports";
import Integrations from "./pages/Integrations";
import DeadlineAlerts from "./pages/DeadlineAlerts";
import LexosOverview from "./pages/LexosOverview";
import LexosProjectExplorer from "./pages/LexosProjectExplorer";
import LexosProjectArchitecture from "./pages/LexosProjectArchitecture";
import SystemAudit from "./pages/SystemAudit";
import Nija from "./modules/legal/Nija";
import DocumentPrint from "./pages/DocumentPrint";
import Agenda from "./modules/legal/Agenda";
import TjtoDictionaryAdmin from "./pages/TjtoDictionaryAdmin";
import Knowledge from "./pages/Knowledge";
import AdminMaintenance from "./pages/AdminMaintenance";
import PrecedentsAdmin from "./pages/PrecedentsAdmin";
import Audit from "./pages/Audit";
import AdminModelos from "./pages/AdminModelos";
import AdminCaptureQr from "./pages/AdminCaptureQr";
import OfficeSettings from "./pages/OfficeSettings";
import OfficeMembers from "./pages/OfficeMembers";
import MemberProfile from "./pages/MemberProfile";
import VoiceAgentConfig from "./pages/VoiceAgentConfig";
import PublicClientCapture from "./pages/PublicClientCapture";
import PublicSignaturePage from "./pages/PublicSignaturePage";
import AcceptInvite from "./pages/AcceptInvite";
import WhatsAppChannels from "./pages/system/WhatsAppChannels";

import MedicalDashboard from "./modules/medicina/MedicalDashboard";
import AgendaMedicaPage from "./modules/medicina/agenda/AgendaMedicaPage";
import PacientesPage from "./modules/medicina/pacientes/PacientesPage";
import PacienteDetalhe from "./modules/medicina/pacientes/PacienteDetalhe";
import AtendimentoMedicoPage from "./modules/medicina/pacientes/AtendimentoMedicoPage";
import TranscricaoPage from "./modules/medicina/transcricao/TranscricaoPage";
import AnaliseClinicaPage from "./modules/medicina/analise/AnaliseClinicaPage";
import ProtocolosPage from "./modules/medicina/protocolos/ProtocolosPage";
import DecifradorCasosPage from "./modules/medicina/ia/DecifradorCasosPage";

// Placeholder pages
import KpisPage from "./pages/placeholders/KpisPage";
import CasesPaymentsPage from "./pages/placeholders/CasesPaymentsPage";
import CasesHistoryPage from "./pages/placeholders/CasesHistoryPage";
import AgendaPaymentsPage from "./pages/placeholders/AgendaPaymentsPage";
import AgendaHistoryPage from "./pages/placeholders/AgendaHistoryPage";
import NijaDocsPage from "./pages/placeholders/NijaDocsPage";
import NijaResearchPage from "./pages/placeholders/NijaResearchPage";
import NijaCreditsPage from "./pages/placeholders/NijaCreditsPage";
import SystemOverviewPage from "./pages/placeholders/SystemOverviewPage";
import IntegrationsPaymentsPage from "./pages/placeholders/IntegrationsPaymentsPage";
import IntegrationsWhatsappPage from "./pages/placeholders/IntegrationsWhatsappPage";
import IntegrationsEmailPage from "./pages/placeholders/IntegrationsEmailPage";
import IntegrationsN8nPage from "./pages/placeholders/IntegrationsN8nPage";
import IntegrationsApisPage from "./pages/placeholders/IntegrationsApisPage";
import AdminUsersPage from "./pages/placeholders/AdminUsersPage";
import AdminOfficesPage from "./pages/placeholders/AdminOfficesPage";
import AdminPermissionsPage from "./pages/placeholders/AdminPermissionsPage";
import AdminAuditPage from "./pages/placeholders/AdminAuditPage";
import AuditoriaTecnicaPage from "./pages/system/AuditoriaTecnicaPage";
import Governanca from "./pages/system/Governanca";
import AuditoriaPage from "./pages/system/Auditoria";
import DiagramasPage from "./pages/system/Diagramas";
import MatrizAcessoPage from "./pages/system/MatrizAcesso";
import IntegracoesPage from "./pages/system/Integracoes";
import RebuildPage from "./pages/system/Rebuild";
import SaudePage from "./pages/system/Saude";
import PolicySimulatorPage from "./pages/system/PolicySimulator";
import EnvironmentsPage from "./pages/system/Environments";
import GovernanceReport from "./pages/system/GovernanceReport";
import AparenciaPage from "./pages/system/Aparencia";
import StorageMaintenance from "./pages/StorageMaintenance";
import PlaudInbox from "./pages/PlaudInbox";
import OperationsInbox from "./pages/OperationsInbox";
import AgentStudio from "./pages/AgentStudio";
import FlowManager from "./pages/FlowManager";
import FlowBuilder from "./pages/FlowBuilder";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_QA_MODE === 'true') {
      document.body.classList.add('qa-mode');
      console.log('👷 [QA] Global QA Mode signal injected.');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ActiveClientProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <SessionBootstrap>
              <OfficeBrandingProvider>
                <DevPanelProvider>
                  <ChatContextProvider>
                    <AppInitializer>
                      <Routes>
                        {/* ====== ROTAS PÚBLICAS (SEM LAYOUT) ====== */}
                      <Route path="/" element={<Navigate to="/login" replace />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/captacao/:officeSlug" element={<PublicClientCapture />} />
                      <Route path="/assinatura/:token" element={<PublicSignaturePage />} />
                      <Route path="/convite/:token" element={<AcceptInvite />} />

                      {/* ====== ONBOARDING (PROTECTED, SEM LAYOUT) ====== */}
                      <Route
                        path="/onboarding"
                        element={
                          <ProtectedRoute>
                            <SimpleErrorBoundary name="Onboarding" bypassPath="/dashboard">
                              <Onboarding />
                            </SimpleErrorBoundary>
                          </ProtectedRoute>
                        }
                      />

                      <Route element={<LegalShell />}>
                        {/* DASHBOARD */}
                        <Route
                          path="/dashboard"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <LegalDashboard />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />

                        {/* CRM */}
                        <Route
                          path="/crm"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <CRMPage />
                            </RoleProtectedRoute>
                          }
                        />
                        {/* CENTRAL OPERACIONAL */}
                        <Route
                          path="/inbox"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <OperationsInbox />
                            </RoleProtectedRoute>
                          }
                        />

                        {/* STUDIO DE AGENTES E FLUXOS */}
                        <Route
                          path="/agent-studio"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <AgentStudio />
                            </RoleProtectedRoute>
                          }
                        />
                        {/* Flow Builder/Manager — DEV-only until execution engine is implemented */}
                        {import.meta.env.DEV && (
                          <>
                            <Route path="/flow-manager" element={<RoleProtectedRoute minRole="ADMIN"><FlowManager /></RoleProtectedRoute>} />
                            <Route path="/flow-builder/:id" element={<RoleProtectedRoute minRole="ADMIN"><FlowBuilder /></RoleProtectedRoute>} />
                          </>
                        )}
                        <Route
                          path="/alerts"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <DeadlineAlerts />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/kpis"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <KpisPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />


                        {/* CASOS / DOCUMENTOS */}
                        <Route
                          path="/cases"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <Cases />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/documents"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <Documents />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/documents/print/:id"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <DocumentPrint />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/cases/payments"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <CasesPaymentsPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/cases/history"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <CasesHistoryPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />


                        {/* CLIENTES */}
                        <Route
                          path="/clientes"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <Clientes />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />

                        {/* AGENDA */}
                        <Route
                          path="/agenda"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <Agenda />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/agenda/payments"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <AgendaPaymentsPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/agenda/history"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <AgendaHistoryPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />


                        {/* NIJA */}
                        <Route
                          path="/nija"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <Nija />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/nija/docs"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <NijaDocsPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/nija/research"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="LEGAL">
                                <NijaResearchPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/nija/credits"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <ModuleProtectedRoute module="LEGAL">
                                <NijaCreditsPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />


                        {/* CONTEÚDO */}
                        <Route
                          path="/document-types"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <DocumentTypes />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/knowledge"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <Knowledge />
                            </RoleProtectedRoute>
                          }
                        />

                        {/* ESCRITÓRIO */}
                        <Route
                          path="/meu-escritorio"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <MeuEscritorio />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/office"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <OfficeSettings />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/members"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <OfficeMembers />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/profile"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <MemberProfile />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/voice-agent"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <VoiceAgentConfig />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/sistema/aparencia"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <AparenciaPage />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <Reports />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/nija-usage"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <NijaUsage />
                            </RoleProtectedRoute>
                          }
                        />

                        {/* SISTEMA LEXOS — DEV-only: hidden from production users */}
                        {import.meta.env.DEV && (
                          <>
                            <Route path="/system" element={<RoleProtectedRoute minRole="ADMIN"><SystemOverviewPage /></RoleProtectedRoute>} />
                            <Route path="/system/explore" element={<RoleProtectedRoute minRole="ADMIN"><LexosProjectExplorer /></RoleProtectedRoute>} />
                            <Route path="/system/architecture" element={<RoleProtectedRoute minRole="ADMIN"><LexosProjectArchitecture /></RoleProtectedRoute>} />
                            <Route path="/system/integrations" element={<RoleProtectedRoute minRole="ADMIN"><Integrations /></RoleProtectedRoute>} />
                            <Route path="/system/integrations/payments" element={<RoleProtectedRoute minRole="ADMIN"><IntegrationsPaymentsPage /></RoleProtectedRoute>} />
                            <Route path="/system/integrations/whatsapp" element={<RoleProtectedRoute minRole="ADMIN"><IntegrationsWhatsappPage /></RoleProtectedRoute>} />
                            <Route path="/system/integrations/email" element={<RoleProtectedRoute minRole="ADMIN"><IntegrationsEmailPage /></RoleProtectedRoute>} />
                            <Route path="/system/integrations/n8n" element={<RoleProtectedRoute minRole="ADMIN"><IntegrationsN8nPage /></RoleProtectedRoute>} />
                            <Route path="/system/integrations/apis" element={<RoleProtectedRoute minRole="ADMIN"><IntegrationsApisPage /></RoleProtectedRoute>} />
                            <Route path="/system/maintenance" element={<RoleProtectedRoute minRole="OWNER"><AdminMaintenance /></RoleProtectedRoute>} />
                            <Route path="/system/storage-maintenance" element={<RoleProtectedRoute minRole="OWNER"><StorageMaintenance /></RoleProtectedRoute>} />
                            <Route path="/lexos-overview" element={<RoleProtectedRoute minRole="ADMIN"><LexosOverview /></RoleProtectedRoute>} />
                            <Route path="/system-audit" element={<RoleProtectedRoute minRole="ADMIN"><SystemAudit /></RoleProtectedRoute>} />
                            <Route path="/system/auditoria-tecnica" element={<RoleProtectedRoute minRole="ADMIN"><AuditoriaTecnicaPage /></RoleProtectedRoute>} />
                            <Route path="/audit" element={<RoleProtectedRoute minRole="OWNER"><Audit /></RoleProtectedRoute>} />
                            <Route path="/system/governanca" element={<RoleProtectedRoute minRole="ADMIN"><Governanca /></RoleProtectedRoute>} />
                            <Route path="/system/auditoria" element={<RoleProtectedRoute minRole="ADMIN"><AuditoriaPage /></RoleProtectedRoute>} />
                            <Route path="/system/diagramas" element={<RoleProtectedRoute minRole="ADMIN"><DiagramasPage /></RoleProtectedRoute>} />
                            <Route path="/system/matriz-acesso" element={<RoleProtectedRoute minRole="ADMIN"><MatrizAcessoPage /></RoleProtectedRoute>} />
                            <Route path="/system/integracoes" element={<RoleProtectedRoute minRole="ADMIN"><IntegracoesPage /></RoleProtectedRoute>} />
                            <Route path="/system/rebuild" element={<RoleProtectedRoute minRole="ADMIN"><RebuildPage /></RoleProtectedRoute>} />
                            <Route path="/system/saude" element={<RoleProtectedRoute minRole="ADMIN"><SaudePage /></RoleProtectedRoute>} />
                            <Route path="/system/policy-simulator" element={<RoleProtectedRoute minRole="ADMIN"><PolicySimulatorPage /></RoleProtectedRoute>} />
                            <Route path="/system/environments" element={<RoleProtectedRoute minRole="OWNER"><EnvironmentsPage /></RoleProtectedRoute>} />
                            <Route path="/system/governance-report" element={<RoleProtectedRoute minRole="ADMIN"><GovernanceReport /></RoleProtectedRoute>} />
                          </>
                        )}

                        {/* Integrations — kept for production (operational) */}
                        <Route
                          path="/integrations"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <Integrations />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/plaud-inbox"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <PlaudInbox />
                            </RoleProtectedRoute>
                          }
                        />

                        {/* ADMINISTRAÇÃO */}
                        <Route
                          path="/admin/users"
                          element={
                            <RoleProtectedRoute minRole="OWNER">
                              <AdminUsersPage />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/offices"
                          element={
                            <RoleProtectedRoute minRole="OWNER">
                              <AdminOfficesPage />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/permissions"
                          element={
                            <RoleProtectedRoute minRole="OWNER">
                              <AdminPermissionsPage />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/audit"
                          element={
                            <RoleProtectedRoute minRole="OWNER">
                              <AdminAuditPage />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/tjto-dictionary"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <TjtoDictionaryAdmin />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/precedents"
                          element={
                            <RoleProtectedRoute minRole="OWNER">
                              <PrecedentsAdmin />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/modelos"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <AdminModelos />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/captacao"
                          element={
                            <RoleProtectedRoute minRole="OWNER">
                              <AdminCaptureQr />
                            </RoleProtectedRoute>
                          }
                        />

                        {/* ====== REDIRECTS (aliases para rotas canônicas) ====== */}
                        <Route path="/office/settings" element={<Navigate to="/settings/office" replace />} />
                        <Route path="/office/members" element={<Navigate to="/settings/members" replace />} />
                        <Route path="/history/agenda" element={<Navigate to="/agenda/history" replace />} />
                        <Route path="/history/cases" element={<Navigate to="/cases/history" replace />} />
                        <Route path="/payments/agenda" element={<Navigate to="/agenda/payments" replace />} />
                        <Route path="/payments/cases" element={<Navigate to="/cases/payments" replace />} />
                      </Route>

                      {/* ====== MÓDULO MÉDICO ====== */}
                      <Route element={<MedicalShell />}>
                        {/* Shared routes duplicated inside MedicalShell to avoid cross-shell navigation */}
                        <Route
                          path="/medical/agent-studio"
                          element={
                            <RoleProtectedRoute minRole="ADMIN">
                              <AgentStudio />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/inbox"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <OperationsInbox />
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/dashboard"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <MedicalDashboard />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/ia"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <DecifradorCasosPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/agenda"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <AgendaMedicaPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/patients"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <PacientesPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/patients/:id"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <PacienteDetalhe />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/atendimento/:id"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <AtendimentoMedicoPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/transcricao"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <TranscricaoPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/analise"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <AnaliseClinicaPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                        <Route
                          path="/medical/protocolos"
                          element={
                            <RoleProtectedRoute minRole="MEMBER">
                              <ModuleProtectedRoute module="MEDICAL">
                                <ProtocolosPage />
                              </ModuleProtectedRoute>
                            </RoleProtectedRoute>
                          }
                        />
                      </Route>

                      {/* Catch-all */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppInitializer>
                </ChatContextProvider>
              </DevPanelProvider>
            </OfficeBrandingProvider>
            </SessionBootstrap>
          </AuthProvider>
        </BrowserRouter>
        <Sonner />
      </ActiveClientProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
};

export default App;
