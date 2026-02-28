import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function LexosOverview() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Card className="shadow-md border border-gray-200">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Visão Geral do LEXOS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700">
          <p>
            O LEXOS é uma plataforma de gestão jurídica multi-escritório,
            construída sobre React + TypeScript no frontend e Supabase no
            backend, com módulos específicos para clientes, casos,
            documentos, prazos, relatórios e inteligência jurídica NIJA.
          </p>

          <Separator />

          <div>
            <h2 className="text-lg font-semibold mb-1">Camadas Principais</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                <strong>Frontend:</strong> React, TypeScript, Tailwind e
                biblioteca UI própria em <code>src/components/ui</code>.
              </li>
              <li>
                <strong>Backend:</strong> Supabase (Postgres + Auth + RLS)
                com modelo multi-escritório, auditoria e logs.
              </li>
              <li>
                <strong>IA NIJA:</strong> engine própria em{" "}
                <code>nijaCore</code>, <code>nijaEngine</code> e{" "}
                <code>nijaAnalyzer</code>, integrada com logs de uso.
              </li>
              <li>
                <strong>Governança:</strong> auditoria de eventos,
                acessos a documentos e trilhas de assinatura.
              </li>
            </ul>
          </div>

          <Separator />

          <div>
            <h2 className="text-lg font-semibold mb-1">Domínios Funcionais</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                <strong>Clientes:</strong> cadastro, documentos iniciais,
                arquivos, painéis de interação e assinatura.
              </li>
              <li>
                <strong>Casos:</strong> timeline, kanban de status, checklist,
                despesas, prazos e histórico de documentos gerados.
              </li>
              <li>
                <strong>Documentos:</strong> tipos, templates, geração,
                exportação (PDF/DOCX), assinatura e linha do tempo.
              </li>
              <li>
                <strong>NIJA:</strong> análises avançadas (risco, prescrição,
                minutas, estratégias) com rastreio de uso.
              </li>
            </ul>
          </div>

          <Separator />

          <div>
            <h2 className="text-lg font-semibold mb-1">Pilares de Projeto</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>
                <strong>Multi-escritório:</strong> tudo segmentado por{" "}
                <code>office_id</code>.
              </li>
              <li>
                <strong>Segurança:</strong> RLS por escritório, por caso e por
                tipo de documento.
              </li>
              <li>
                <strong>Auditoria:</strong> tabelas oficiais{" "}
                <code>audit_logs</code>, <code>document_events</code>,{" "}
                <code>document_access_logs</code>.
              </li>
              <li>
                <strong>Escalabilidade:</strong> organização por{" "}
                <code>src/features/&lt;domínio&gt;</code> para manter o código
                limpo e modular.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
