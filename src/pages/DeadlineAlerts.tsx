import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
type PendingAlert = {
  id: string;
  office_id: string;
  deadline_id: string | null;
  fire_at: string | null;
  channel: string | null;
  status: string | null;
  tries: number | null;
  last_error: string | null;
};

type AlertLog = {
  id: string;
  office_id: string;
  alert_id: string | null;
  old_status: string | null;
  new_status: string | null;
  changed_by: string | null;
  changed_at: string | null;
};

type Kpis = {
  office_id?: string;
  pending?: number;
  failed?: number;
  next_24h?: number;
  overdue?: number;
};

function fmtDateTimeBR(dateStr?: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelStatus(status?: string | null) {
  const m: Record<string, string> = {
    PENDING: "Pendente",
    ENQUEUED: "Na fila",
    FAILED: "Falhou",
    SENT: "Enviado",
    CANCELED: "Cancelado",
    DONE: "Concluído",
  };
  if (!status) return "-";
  return m[status] || status;
}

function labelChannel(channel?: string | null) {
  const m: Record<string, string> = {
    email: "E-mail",
    push: "Push",
    sms: "SMS",
    whatsapp: "WhatsApp",
  };
  if (!channel) return "-";
  return m[channel] || channel;
}

export default function DeadlineAlerts() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [officeId, setOfficeId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [pending, setPending] = useState<PendingAlert[]>([]);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [loadingOffice, setLoadingOffice] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [processing, setProcessing] = useState(false);

  const canLoad = useMemo(() => !!officeId, [officeId]);

  useEffect(() => {
    const fetchOfficeId = async () => {
      if (!user) {
        setLoadingOffice(false);
        return;
      }
      setLoadingOffice(true);
      try {
        const { data, error } = await supabase
          .from("office_members")
          .select("office_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (!data?.office_id) {
          setOfficeId(null);
          toast({
            title: "Erro",
            description: "Você não está vinculado a nenhum escritório.",
            variant: "destructive",
          });
          return;
        }

        setOfficeId(data.office_id);
      } catch (err: any) {
        toast({
          title: "Erro",
          description: err?.message || "Falha ao carregar escritório.",
          variant: "destructive",
        });
      } finally {
        setLoadingOffice(false);
      }
    };

    fetchOfficeId();
  }, [user, toast]);

  async function fetchAll() {
    if (!officeId) return;
    setLoadingData(true);
    try {
      const { data: kpisData, error: kpisErr } = await supabase
        .from("vw_deadline_alerts_kpis" as any)
        .select("*")
        .eq("office_id", officeId)
        .maybeSingle();
      if (kpisErr) throw kpisErr;
      setKpis((kpisData as any) || null);

      const { data: pendingData, error: pendingErr } = await supabase
        .from("vw_deadline_alerts_pending" as any)
        .select("id, office_id, deadline_id, fire_at, channel, status, tries, last_error")
        .eq("office_id", officeId)
        .order("fire_at", { ascending: true })
        .limit(50);
      if (pendingErr) throw pendingErr;
      setPending(((pendingData as any) || []) as PendingAlert[]);

      const { data: logsData, error: logsErr } = await supabase
        .from("lexos_deadline_alert_logs" as any)
        .select("id, office_id, alert_id, old_status, new_status, changed_by, changed_at")
        .eq("office_id", officeId)
        .order("changed_at", { ascending: false })
        .limit(50);
      if (logsErr) throw logsErr;
      setLogs(((logsData as any) || []) as AlertLog[]);
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err?.message || "Falha ao carregar alertas.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!canLoad) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  async function handleProcess() {
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc(
        "lexos_process_deadline_alerts" as any,
        { p_limit: 50 } as any
      );
      if (error) throw error;

      const processed = (data as any)?.processed ?? 0;
      const failed = (data as any)?.failed ?? 0;
      const backendErr = (data as any)?.error;

      toast({
        title: "Processamento concluído",
        description: backendErr
          ? `Processados: ${processed} | Falhas: ${failed} | Erro: ${backendErr}`
          : `Processados: ${processed} | Falhas: ${failed}`,
        variant: backendErr || failed > 0 ? "destructive" : "default",
      });

      await fetchAll();
    } catch (err: any) {
      toast({
        title: "Erro ao processar",
        description: err?.message || "Falha ao processar alertas.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  const noOffice = !officeId;

  return (
    <div className="space-y-4 p-4 min-h-[120px]">
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Prazos</CardTitle>
            <CardDescription>
              Supabase-first: KPIs e listas via views + processamento via RPC.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchAll}
              disabled={loadingOffice || loadingData || noOffice}
            >
              Atualizar
            </Button>
            <Button
              onClick={handleProcess}
              disabled={loadingOffice || loadingData || processing || noOffice}
            >
              {processing ? "Processando..." : "Processar"}
            </Button>
          </CardContent>
        </Card>

        {loadingOffice ? (
          <Card>
            <CardContent className="py-6">Carregando escritório...</CardContent>
          </Card>
        ) : noOffice ? (
          <Card>
            <CardContent className="py-6">
              officeId não encontrado. Verifique se você está vinculado a um
              escritório.
            </CardContent>
          </Card>
        ) : loadingData ? (
          <Card>
            <CardContent className="py-6">Carregando...</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="py-4">
                  <div className="text-sm text-muted-foreground">Pendentes</div>
                  <div className="text-2xl font-semibold">{kpis?.pending ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-sm text-muted-foreground">Falhos</div>
                  <div className="text-2xl font-semibold">{kpis?.failed ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-sm text-muted-foreground">Próx. 24h</div>
                  <div className="text-2xl font-semibold">{kpis?.next_24h ?? 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <div className="text-sm text-muted-foreground">Atrasados</div>
                  <div className="text-2xl font-semibold">{kpis?.overdue ?? 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pendentes</CardTitle>
                <CardDescription>limit 50</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-2">Disparo</th>
                      <th className="py-2 pr-2">Canal</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">Tentativas (server)</th>
                      <th className="py-2 pr-2">Último erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.length === 0 ? (
                      <tr>
                        <td className="py-3" colSpan={5}>
                          Nenhum alerta pendente.
                        </td>
                      </tr>
                    ) : (
                      pending.map((a) => (
                        <tr key={a.id} className="border-b">
                          <td className="py-2 pr-2 whitespace-nowrap">
                            {fmtDateTimeBR(a.fire_at)}
                          </td>
                          <td className="py-2 pr-2">{labelChannel(a.channel)}</td>
                          <td className="py-2 pr-2">{labelStatus(a.status)}</td>
                          <td className="py-2 pr-2">{a.tries ?? 0}</td>
                          <td className="py-2 pr-2">{a.last_error || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logs (últimas alterações)</CardTitle>
                <CardDescription>limit 50</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-2">Quando</th>
                      <th className="py-2 pr-2">Alert ID</th>
                      <th className="py-2 pr-2">De</th>
                      <th className="py-2 pr-2">Para</th>
                      <th className="py-2 pr-2">Quem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td className="py-3" colSpan={5}>
                          Nenhum log encontrado.
                        </td>
                      </tr>
                    ) : (
                      logs.map((l) => (
                        <tr key={l.id} className="border-b">
                          <td className="py-2 pr-2 whitespace-nowrap">
                            {fmtDateTimeBR(l.changed_at)}
                          </td>
                          <td className="py-2 pr-2">{l.alert_id || "-"}</td>
                          <td className="py-2 pr-2">{labelStatus(l.old_status)}</td>
                          <td className="py-2 pr-2">{labelStatus(l.new_status)}</td>
                          <td className="py-2 pr-2">{l.changed_by || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
        </>
      )}
    </div>
  );
}
