// supabase/functions/nija-embed-chunks/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmbedRequest {
  document_id?: string;
  knowledge_id?: string;
  office_id?: string;
  force_reindex?: boolean;
}

// Configurações de Chunking
const CHUNK_SIZE = 800; // tokens aproximados (~3200 chars) para capturar mais contexto jurídico
const CHUNK_OVERLAP = 100;

function chunkText(text: string, size: number, overlap: number): string[] {
  if (!text || text.length < 50) return [];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk.length + para.length) <= size * 4) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = para;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  return chunks.filter(c => c.trim().length > 50);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { document_id, knowledge_id, office_id, force_reindex }: EmbedRequest = await req.json();
    console.log(`[nija-embed-chunks] Processing. doc: ${document_id}, knowledge: ${knowledge_id}, office: ${office_id}`);

    const itemsToProcess: { 
      id: string; 
      title: string; 
      content: string; 
      type: string; 
      ramo?: string; 
      office_id?: string;
      source_table: 'legal_documents' | 'office_knowledge' 
    }[] = [];

    // 1. Buscar de legal_documents (Global)
    if (document_id || (!knowledge_id && !office_id)) {
      let query = supabaseClient.from("legal_documents").select("id, title, content, type, ramo");
      if (document_id) query = query.eq("id", document_id);
      
      const { data } = await query;
      if (data) {
        itemsToProcess.push(...data.map(d => ({ ...d, source_table: 'legal_documents' as const })));
      }
    }

    // 2. Buscar de office_knowledge (Privado por Office)
    if (knowledge_id || office_id) {
      let query = supabaseClient.from("office_knowledge").select("id, title, content, type, office_id, ramo");
      if (knowledge_id) query = query.eq("id", knowledge_id);
      if (office_id) query = query.eq("office_id", office_id);
      
      const { data } = await query;
      if (data) {
        itemsToProcess.push(...data.map(d => ({ ...d, source_table: 'office_knowledge' as const })));
      }
    }

    console.log(`[nija-embed-chunks] Found ${itemsToProcess.length} items to process.`);

    let totalChunksCreated = 0;

    for (const item of itemsToProcess) {
      if (!item.content) continue;

      // Limpeza de chunks antigos
      if (force_reindex) {
        await supabaseClient.from("legal_chunks").delete().eq("document_id", item.id);
      } else {
        const { count } = await supabaseClient
          .from("legal_chunks")
          .select("*", { count: 'exact', head: true })
          .eq("document_id", item.id);
        if (count && count > 0) continue;
      }

      const chunks = chunkText(item.content, CHUNK_SIZE, CHUNK_OVERLAP);
      for (let i = 0; i < chunks.length; i++) {
        // Enriquecimento do prompt para o embedding capturar contexto semântico
        const header = `[TABELA: ${item.source_table}] [TIPO: ${item.type}] [RAMO: ${item.ramo || 'GERAL'}] [TITULO: ${item.title}]\n\n`;
        const chunkWithHeader = header + chunks[i];

        const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: chunkWithHeader,
          }),
        });

        if (!embRes.ok) {
          console.error(`[nija-embed-chunks] Error: ${await embRes.text()}`);
          continue;
        }

        const { data: [{ embedding }] } = await embRes.json();

        const { error: insertError } = await supabaseClient
          .from("legal_chunks")
          .insert({
            document_id: item.id,
            office_id: item.office_id || null, // Nulo para documentos globais
            chunk_index: i,
            chunk_text: chunks[i],
            embedding: embedding,
            metadata: {
              title: item.title,
              type: item.type,
              ramo: item.ramo,
              source: item.source_table,
              is_global: item.source_table === 'legal_documents'
            }
          });

        if (!insertError) totalChunksCreated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: itemsToProcess.length, total_chunks: totalChunksCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

