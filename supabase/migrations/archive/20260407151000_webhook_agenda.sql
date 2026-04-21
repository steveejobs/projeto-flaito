-- Script para atrelar a Tabela Agenda_Medica à Edge Function 
-- Utilizando a extensão nativa de funções webhooks do Supabase

-- O Trigger deve rodar SEMPRE que uma consulta for Inserida
-- ou Atualizada (caso mude o horário, para reenviar pro Google).
-- Mas para evitar loops infinitos (O Update da Edge function disparando a si mesma),
-- usaremos um controle na Função ou filtramos as colunas.

CREATE OR REPLACE FUNCTION public.trigger_sync_google_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Impede o loop infinito: Só aciona o Webhook se o Update NÃO for proveniente da Edge Function (onde ela apenas atualiza o sync_status)
  -- Se as datas/tipo mudaram ou é registro novo (INSERT) disparar webhook.
  IF (TG_OP = 'INSERT') OR 
     (TG_OP = 'UPDATE' AND (NEW.data_hora IS DISTINCT FROM OLD.data_hora 
                         OR NEW.duracao_minutos IS DISTINCT FROM OLD.duracao_minutos
                         OR NEW.tipo_consulta IS DISTINCT FROM OLD.tipo_consulta
                         OR NEW.observacoes IS DISTINCT FROM OLD.observacoes)) THEN
                         
    -- Chama a extensão que assincronamente dispara o POST
    PERFORM net.http_post(
      url := 'https://ccvbosbjtlxewqybvwqj.supabase.co/functions/v1/google-calendar-sync',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('record', row_to_json(NEW))
    );
    
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_agenda_google_sync ON public.agenda_medica;

CREATE TRIGGER trigger_agenda_google_sync
  AFTER INSERT OR UPDATE
  ON public.agenda_medica
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_google_calendar();
