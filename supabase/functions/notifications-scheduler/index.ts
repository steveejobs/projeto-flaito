import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { resolveVariables } from '../_shared/variableResolver.ts';
import { AppointmentStatus, ReportStatus, QueueStatus } from '../_shared/constants.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logger = (level: 'info' | 'error' | 'warn', message: string, context: any = {}) => {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context }));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const correlationId = crypto.randomUUID();
  logger('info', 'Rules Engine execution started', { correlationId });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const triggerSource = req.headers.get('user-agent')?.includes('PostgreSQL') ? 'cron_job' : 'manual_trigger';
    logger('info', 'Rules Engine execution started', { correlationId, triggerSource });
    const { data: rules, error: rulesError } = await supabaseAdmin
      .from('automation_rules')
      .select('*, message_templates(name, content)')
      .eq('is_active', true);

    if (rulesError) throw rulesError;
    
    logger('info', `Found ${rules?.length || 0} active rules`, { correlationId });

    let totalQueued = 0;
    const results = [];

    // 2. TRIGGER & EVALUATE pipeline
    for (const rule of (rules || [])) {
      logger('info', `Evaluating rule: ${rule.name}`, { rule_id: rule.id, type: rule.resource_type, correlationId });
      let itemsToProcess: any[] = [];
      
      try {
        const validConsultaTriggers = ['TIME_TRIGGER', 'AGENDADO', 'agendado', 'SCHEDULED'];
        const validLaudoTriggers = ['CREATED', 'FINALIZADO', 'finalizado', 'APPROVED', 'signed', 'finalized', 'ASSINADO'];

        if (rule.resource_type === 'CONSULTA' && validConsultaTriggers.includes(rule.event_type)) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + (rule.offset_days || 0));
          const dateStr = targetDate.toISOString().split('T')[0];

          // Fetch matching appointments
          const { data: appts } = await supabaseAdmin
            .from('agenda_medica' as any)
            .select('id, data_hora, pacientes(client_id, telefone, nome), offices(id, nome)')
            .gte('data_hora', `${dateStr}T00:00:00`)
            .lte('data_hora', `${dateStr}T23:59:59`)
            .eq('status', AppointmentStatus.AGENDADO)
            .eq('office_id', rule.office_id);

          itemsToProcess = (appts || []).map(a => ({
            resource_id: a.id,
            client_id: a.pacientes?.client_id,
            dest_nome: a.pacientes?.nome,
            dest_tel: a.pacientes?.telefone,
            office_id: a.offices?.id,
            variables: {
              client_name: a.pacientes?.nome,
              appointment_date: new Date(a.data_hora).toLocaleDateString('pt-BR'),
              appointment_time: new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              office_name: a.offices?.nome || "Clínica"
            }
          }));
        } 
        else if (rule.resource_type === 'LAUDO' && validLaudoTriggers.includes(rule.event_type)) {
          // Example logic for Medical Reports
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: reports } = await supabaseAdmin
            .from('medical_reports')
            .select('id, status, created_at, pacientes(client_id, telefone, nome, office_id)')
            .eq('office_id', rule.office_id)
            .gte('created_at', twentyFourHoursAgo);
            
          itemsToProcess = (reports || []).filter(r => {
            const s = r.status;
            return s === ReportStatus.FINALIZED || s === ReportStatus.SIGNED || s === 'FINALIZADO' || s === 'APPROVED' || s === 'ASSINADO';
          }).map(r => ({
            resource_id: r.id,
            client_id: r.pacientes?.client_id,
            dest_nome: r.pacientes?.nome,
            dest_tel: r.pacientes?.telefone,
            office_id: r.pacientes?.office_id,
            variables: {
              client_name: r.pacientes?.nome,
              report_date: new Date(r.created_at).toLocaleDateString('pt-BR')
            }
          }));
        }
        else if (rule.resource_type === 'CASE' && rule.event_type === 'CREATED') {
          // Ex: Onboarding Legal Case
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: cases } = await supabaseAdmin
            .from('cases')
            .select('id, created_at, clients(id, phone, full_name, office_id)')
            .eq('office_id', rule.office_id)
            .gte('created_at', twentyFourHoursAgo);
            
          itemsToProcess = (cases || []).map(c => ({
            resource_id: c.id,
            client_id: c.clients?.id,
            dest_nome: c.clients?.full_name,
            dest_tel: c.clients?.phone,
            office_id: c.clients?.office_id,
            variables: {
               client_name: c.clients?.full_name,
               case_id: c.id
            }
          }));
        }

        // 3. ENQUEUE Pipeline with Idempotency
        let ruleQueued = 0;
        for (const item of itemsToProcess) {
          if (!item.dest_tel) continue;

          // A. Attempt to register run in automation_runs
          const { error: runError } = await supabaseAdmin
            .from('automation_runs')
            .insert({ rule_id: rule.id, resource_id: item.resource_id });

          // If standard unique constraint violation (code 23505), it already ran. Skip silently.
          if (runError) {
            if (runError.code === '23505') continue; 
            logger('warn', 'Failed to insert automation run', { error: runError, rule_id: rule.id, resource_id: item.resource_id });
            continue;
          }

          // B. Enqueue if lock acquired
          const content = rule.message_templates?.content || "";
          
          const resolvedMessage = await resolveVariables(supabaseAdmin, content, {
            client_id: item.client_id,
            office_id: rule.office_id || item.office_id,
            case_id: item.variables.case_id,
            appointment_id: rule.resource_type === 'CONSULTA' ? item.resource_id : undefined,
            report_id: rule.resource_type === 'LAUDO' ? item.resource_id : undefined,
          }, item.variables);

          await supabaseAdmin
            .from('notificacoes_fila')
            .insert({
              office_id: rule.office_id || item.office_id,
              context_type: rule.context_type,
              resource_type: rule.resource_type,
              resource_id: item.resource_id,
              destinatario_nome: item.dest_nome,
              destinatario: item.dest_tel,
              mensagem: resolvedMessage,
              status: QueueStatus.PENDING,
              template_id: rule.template_id,
              payload_envio: {
                 client_id: item.client_id,
                 template_vars: Object.values(item.variables), // Important for Meta templates
                 rule_id: rule.id
              }
            });

          ruleQueued++;
          totalQueued++;
        }
        
        results.push({ rule: rule.name, type: rule.resource_type, queued: ruleQueued });
        
      } catch (e: any) {
         logger('error', `Failed processing rule ${rule.id}`, { error: e.message, correlationId });
      }
    }

    logger('info', 'Rules Engine finished', { totalQueued, correlationId, results });
    return new Response(JSON.stringify({ success: true, totalQueued, results, correlationId, triggerSource }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    logger('error', 'Critical Rules Engine failure', { error: error.message, correlationId });
    return new Response(JSON.stringify({ error: error.message, correlationId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
