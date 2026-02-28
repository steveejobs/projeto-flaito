import { supabase } from '@/integrations/supabase/client';

export type DocumentAction = 'view' | 'download' | 'upload' | 'delete' | 'sign' | 'render';

export async function logDocumentAccess(
  documentId: string,
  action: DocumentAction,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase.rpc('log_document_access', {
      p_document_id: documentId,
      p_action: action,
      p_metadata: metadata,
    });
  } catch (err) {
    console.error('Failed to log document access:', err);
    // Don't throw - logging failures shouldn't break the main flow
  }
}
